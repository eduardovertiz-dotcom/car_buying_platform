"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  Transaction,
  Step,
  STEPS,
  ActivityEntry,
  VerificationResult,
  DocumentType,
  MaintenanceRecord,
  MaintenanceRecordType,
  DEFAULT_DOCUMENTS,
  normalizeDocuments,
} from "@/lib/types";
import { mockTransactions } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";

// ─── Actions ────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADVANCE_STEP" }
  | { type: "ADVANCE_TO_STEP"; payload: Step }
  | { type: "GO_TO_STEP"; payload: Step }
  | { type: "HYDRATE"; payload: Transaction }
  | { type: "REQUEST_BASIC_VERIFICATION" }
  | { type: "COMPLETE_BASIC_VERIFICATION"; payload: VerificationResult }
  | { type: "REQUEST_PROFESSIONAL_VERIFICATION" }
  | { type: "COMPLETE_PROFESSIONAL_VERIFICATION"; payload: VerificationResult }
  | { type: "UPLOAD_DOCUMENT"; payload: { document_type: DocumentType; file_name: string; file_url: string } }
  | { type: "GENERATE_CONTRACT" }
  | { type: "ADD_MAINTENANCE_RECORD"; payload: { type: MaintenanceRecordType; title: string; date: string } }
  | { type: "ENABLE_SHARE"; payload: { token: string } }
  | { type: "REVOKE_SHARE" }
  | { type: "UPDATE_AGREEMENT_FIELDS"; payload: { buyer_name?: string; buyer_email?: string; seller_name?: string; seller_email?: string; price?: string; location?: string } }
  | { type: "ACCEPT_RISK"; payload: { riskLevel: "LOW" | "MODERATE" | "HIGH"; confidence: number } }
  | { type: "UPDATE_VEHICLE"; payload: { make?: string; model?: string; year?: number; vin?: string; plate?: string } }
  | { type: "SEND_FOR_SIGNATURE"; payload: { documenso_document_id: string } }
  | { type: "RESET_VERIFICATION" }
  | { type: "SET_STATUS"; payload: string }
  | { type: "SET_PLAN"; payload: "39" | "69" };

// ─── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: Transaction, action: Action): Transaction {
  switch (action.type) {
    case "HYDRATE": {
      const payload = action.payload;

      // Migration: remap legacy step keys — no mutation, derive clean value
      const STEP_MIGRATION: Record<string, Step> = {
        understand: "upload",
        find: "check",
        evaluate: "analyze",
      };
      const current_step: Step =
        STEP_MIGRATION[payload.current_step as string] ?? payload.current_step;

      // Migration: remap legacy "none" verification status
      const rawStatus = payload.verification_status as string;
      const baseVerificationStatus = rawStatus === "none" ? "not_started" : payload.verification_status;

      // Normalize documents through the single authoritative boundary.
      // Guarantees all keys exist and every field has the correct type.
      const documents = normalizeDocuments(payload.documents);

      // Migration: fill in fields added after initial schema
      const contract = payload.contract ?? { status: "not_started" as const };
      const maintenance = payload.maintenance ?? { records: [] };
      const share = payload.share ?? { enabled: false };

      // Processing states reset to prevent stuck spinner on refresh
      const finalVerificationStatus =
        baseVerificationStatus === "basic_complete" ||
        baseVerificationStatus === "professional_complete"
          ? baseVerificationStatus
          : baseVerificationStatus === "basic_processing" ||
            baseVerificationStatus === "professional_processing"
          ? ("not_started" as const)
          : baseVerificationStatus;

      // Verification results are only valid when status is complete
      const finalVerificationResults =
        finalVerificationStatus === "basic_complete" ||
        finalVerificationStatus === "professional_complete"
          ? payload.verification_results
          : null;

      return {
        ...payload,
        current_step,
        verification_status: finalVerificationStatus,
        verification_results: finalVerificationResults,
        documents,
        contract,
        maintenance,
        share,
      };
    }

    case "ADVANCE_STEP": {
      // Guard: block advancement while verification is processing
      if (
        state.verification_status === "basic_processing" ||
        state.verification_status === "professional_processing"
      ) {
        return state;
      }

      const currentIndex = STEPS.findIndex(
        (s) => s.key === state.current_step
      );
      const nextIndex = currentIndex + 1;

      // Guard: already at final step
      if (nextIndex >= STEPS.length) return state;

      const nextStep = STEPS[nextIndex].key as Step;
      const newProgress = Math.round((nextIndex / (STEPS.length - 1)) * 100);

      const newEntry: ActivityEntry = {
        id: `act_${Date.now()}`,
        type: "step_completed",
        step: state.current_step,
        timestamp: new Date().toISOString(),
      };

      return {
        ...state,
        current_step: nextStep,
        checklist_progress: newProgress,
        activity_log: [...state.activity_log, newEntry],
      };
    }

    case "REQUEST_BASIC_VERIFICATION": {
      if (
        state.verification_status === "basic_complete" ||
        state.verification_status === "professional_complete"
      ) return state;
      const newEntry: ActivityEntry = {
        id: `act_${Date.now()}`,
        type: "basic_verification_requested",
        step: state.current_step,
        timestamp: new Date().toISOString(),
      };
      return {
        ...state,
        verification_status: "basic_processing",
        activity_log: [...state.activity_log, newEntry],
      };
    }

    case "COMPLETE_BASIC_VERIFICATION": {
      return {
        ...state,
        verification_status: "basic_complete",
        verification_results: action.payload,
      };
    }

    case "REQUEST_PROFESSIONAL_VERIFICATION": {
      if (state.verification_status === "professional_complete") return state;
      const newEntry: ActivityEntry = {
        id: `act_${Date.now()}`,
        type: "professional_verification_requested",
        step: state.current_step,
        timestamp: new Date().toISOString(),
      };
      return {
        ...state,
        verification_status: "professional_processing",
        activity_log: [...state.activity_log, newEntry],
      };
    }

    case "COMPLETE_PROFESSIONAL_VERIFICATION": {
      return {
        ...state,
        verification_status: "professional_complete",
        verification_results: action.payload,
      };
    }

    case "RESET_VERIFICATION": {
      return {
        ...state,
        verification_status: "not_started" as const,
        verification_results: null,
      };
    }

    case "SET_STATUS": {
      return { ...state, status: action.payload };
    }

    case "SET_PLAN": {
      return { ...state, plan: action.payload };
    }

    case "UPLOAD_DOCUMENT": {
      const { document_type, file_name, file_url } = action.payload;
      const newEntry: ActivityEntry = {
        id: `act_${Date.now()}`,
        type: "document_uploaded",
        step: state.current_step,
        timestamp: new Date().toISOString(),
        meta: { document_type },
      };
      return {
        ...state,
        documents: {
          ...state.documents,
          [document_type]: {
            status: "uploaded",
            file_name,
            file_url,
            uploaded_at: new Date().toISOString(),
          },
        },
        activity_log: [...state.activity_log, newEntry],
      };
    }

    case "GENERATE_CONTRACT": {
      const newEntry: ActivityEntry = {
        id: `act_${Date.now()}`,
        type: "contract_generated",
        step: state.current_step,
        timestamp: new Date().toISOString(),
      };
      return {
        ...state,
        contract: {
          status: "generated",
          file_name: "vehicle_purchase_agreement.pdf",
          created_at: new Date().toISOString(),
        },
        activity_log: [...state.activity_log, newEntry],
      };
    }

    case "ADD_MAINTENANCE_RECORD": {
      const { type, title, date } = action.payload;
      const newRecord: MaintenanceRecord = {
        id: `maint_${Date.now()}`,
        type,
        title,
        date,
      };
      const newEntry: ActivityEntry = {
        id: `act_${Date.now()}`,
        type: "maintenance_added",
        step: state.current_step,
        timestamp: new Date().toISOString(),
      };
      return {
        ...state,
        maintenance: { records: [...state.maintenance.records, newRecord] },
        activity_log: [...state.activity_log, newEntry],
      };
    }

    case "ENABLE_SHARE": {
      return {
        ...state,
        share: { enabled: true, token: action.payload.token },
      };
    }

    case "REVOKE_SHARE": {
      return {
        ...state,
        share: { enabled: false, token: undefined },
      };
    }

    case "UPDATE_AGREEMENT_FIELDS": {
      return { ...state, ...action.payload };
    }

    case "ACCEPT_RISK": {
      return {
        ...state,
        accepted_risk_level: action.payload.riskLevel,
        accepted_confidence: action.payload.confidence,
        accepted_at: new Date().toISOString(),
      };
    }

    case "SEND_FOR_SIGNATURE": {
      return {
        ...state,
        documenso_document_id: action.payload.documenso_document_id,
        signing_status: "pending" as const,
      };
    }

    case "UPDATE_VEHICLE": {
      const v = action.payload;
      return {
        ...state,
        vehicle: {
          ...state.vehicle,
          ...v,
          // Normalize: empty string → null so downstream checks (vehicle.vin || vehicle.plate)
          // are never fooled by a stale empty string.
          vin:   v.vin   !== undefined ? (v.vin   ? v.vin   : null) : state.vehicle.vin,
          plate: v.plate !== undefined ? (v.plate ? v.plate : null) : state.vehicle.plate,
        },
      };
    }

    case "ADVANCE_TO_STEP": {
      // Forward jump to a specific step — used by Basic plan to skip "verify"
      const targetKey = action.payload;
      const targetIndex = STEPS.findIndex((s) => s.key === targetKey);
      const currentIndex = STEPS.findIndex((s) => s.key === state.current_step);
      if (targetIndex <= currentIndex) return state;
      const newProgress = Math.round((targetIndex / (STEPS.length - 1)) * 100);
      return {
        ...state,
        current_step: targetKey,
        checklist_progress: newProgress,
      };
    }

    case "GO_TO_STEP": {
      const targetKey = action.payload;
      const targetIndex = STEPS.findIndex((s) => s.key === targetKey);
      const currentIndex = STEPS.findIndex((s) => s.key === state.current_step);

      // Guard: only allow going backward
      if (targetIndex >= currentIndex) return state;

      // Guard: lock flow after decision — status is the single source of truth
      if (state.status === "decision_made") return state;

      // Guard: block navigation while verification is actively processing
      if (
        state.verification_status === "basic_processing" ||
        state.verification_status === "professional_processing"
      ) {
        return state;
      }

      const verifyIndex = STEPS.findIndex((s) => s.key === "verify");
      const shouldResetVerification = targetIndex < verifyIndex;
      const newProgress = Math.round((targetIndex / (STEPS.length - 1)) * 100);

      return {
        ...state,
        current_step: targetKey,
        checklist_progress: newProgress,
        ...(shouldResetVerification && {
          verification_status: "not_started" as const,
          verification_results: null,
          accepted_risk_level: undefined,
          accepted_confidence: undefined,
          accepted_at: undefined,
        }),
      };
    }

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

type TransactionContextValue = {
  transaction: Transaction;
  advanceStep: () => void;
  advanceToStep: (step: Step) => void;
  goToStep: (step: Step) => void;
  returnedToStep: Step | null;
  isAtFinalStep: boolean;
  requestBasicVerification: () => void;
  completeBasicVerification: (results: VerificationResult) => void;
  requestProfessionalVerification: () => void;
  completeProfessionalVerification: (results: VerificationResult) => void;
  uploadDocument: (document_type: DocumentType, file_name: string, file_url: string) => void;
  generateContract: () => void;
  addMaintenanceRecord: (type: MaintenanceRecordType, title: string, date: string) => void;
  enableShare: (token: string) => void;
  revokeShare: () => void;
  updateAgreementFields: (fields: { buyer_name?: string; buyer_email?: string; seller_name?: string; seller_email?: string; price?: string; location?: string }) => void;
  acceptRisk: (risk: { riskLevel: "LOW" | "MODERATE" | "HIGH"; confidence: number }) => void;
  updateVehicle: (fields: { make?: string; model?: string; year?: number; vin?: string; plate?: string }) => void;
  sendForSignature: (documenso_document_id: string) => void;
  resetVerification: () => void;
  setStatus: (status: string) => void;
  isDecisionMade: boolean;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

type Props = {
  transactionId: string;
  children: ReactNode;
};

function createFreshTransaction(id: string): Transaction {
  return {
    id,
    vehicle: { make: "", model: "", year: new Date().getFullYear() },
    current_step: "upload",
    checklist_progress: 0,
    verification_status: "not_started",
    documents: { ...DEFAULT_DOCUMENTS },
    verification_results: null,
    activity_log: [
      {
        id: `act_${Date.now()}`,
        type: "transaction_created",
        step: "upload",
        timestamp: new Date().toISOString(),
      },
    ],
    contract: { status: "not_started" },
    maintenance: { records: [] },
    share: { enabled: false },
    created_at: new Date().toISOString(),
  };
}

function getInitialState(transactionId: string): Transaction {
  return mockTransactions.find((t) => t.id === transactionId) ?? createFreshTransaction(transactionId);
}

export function TransactionProvider({ transactionId, children }: Props) {
  const [transaction, dispatch] = useReducer(
    reducer,
    transactionId,
    getInitialState
  );
  const [returnedToStep, setReturnedToStep] = useState<Step | null>(null);

  // Gate persist until after hydration to prevent mock state overwriting localStorage
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`transaction_${transactionId}`);
    if (saved) {
      try {
        const parsed: Transaction = JSON.parse(saved);
        dispatch({ type: "HYDRATE", payload: parsed });
      } catch {
        // Corrupted storage — fall back to mock
      }
    }
    setHydrated(true);
  }, [transactionId]);

  // Sync plan from DB — catches post-Stripe upgrades where localStorage
  // still has the old plan. Only updates the plan field; never touches
  // activity_log, documents, or other frontend-only state.
  useEffect(() => {
    if (!transactionId) return;
    const supabase = createClient();
    supabase
      .from("transactions")
      .select("plan")
      .eq("id", transactionId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.plan) return;
        const dbPlan = data.plan as "39" | "69";
        dispatch({ type: "SET_PLAN", payload: dbPlan });
      });
  }, [transactionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage — only after hydration is complete
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      `transaction_${transactionId}`,
      JSON.stringify(transaction)
    );
  }, [transaction, transactionId, hydrated]);

  const currentIndex = STEPS.findIndex((s) => s.key === transaction.current_step);
  const isAtFinalStep = currentIndex === STEPS.length - 1;

  const value: TransactionContextValue = {
    transaction,
    isAtFinalStep,
    returnedToStep,
    advanceStep() {
      dispatch({ type: "ADVANCE_STEP" });
      setReturnedToStep(null);
    },
    advanceToStep(step) {
      dispatch({ type: "ADVANCE_TO_STEP", payload: step });
    },
    goToStep(step) {
      dispatch({ type: "GO_TO_STEP", payload: step });
      setReturnedToStep(step);
    },
    requestBasicVerification() {
      dispatch({ type: "REQUEST_BASIC_VERIFICATION" });
    },
    completeBasicVerification(results) {
      dispatch({ type: "COMPLETE_BASIC_VERIFICATION", payload: results });
    },
    requestProfessionalVerification() {
      dispatch({ type: "REQUEST_PROFESSIONAL_VERIFICATION" });
    },
    completeProfessionalVerification(results) {
      dispatch({ type: "COMPLETE_PROFESSIONAL_VERIFICATION", payload: results });
    },
    uploadDocument(document_type, file_name, file_url) {
      dispatch({ type: "UPLOAD_DOCUMENT", payload: { document_type, file_name, file_url } });
    },
    generateContract() {
      dispatch({ type: "GENERATE_CONTRACT" });
    },
    addMaintenanceRecord(type, title, date) {
      dispatch({ type: "ADD_MAINTENANCE_RECORD", payload: { type, title, date } });
    },
    enableShare(token) {
      dispatch({ type: "ENABLE_SHARE", payload: { token } });
    },
    revokeShare() {
      dispatch({ type: "REVOKE_SHARE" });
    },
    updateAgreementFields(fields) {
      dispatch({ type: "UPDATE_AGREEMENT_FIELDS", payload: fields });
    },
    acceptRisk(risk) {
      dispatch({ type: "ACCEPT_RISK", payload: risk });
    },
    updateVehicle(fields) {
      dispatch({ type: "UPDATE_VEHICLE", payload: fields });
    },
    sendForSignature(documenso_document_id) {
      dispatch({ type: "SEND_FOR_SIGNATURE", payload: { documenso_document_id } });
    },
    resetVerification() {
      dispatch({ type: "RESET_VERIFICATION" });
    },
    setStatus(status) {
      dispatch({ type: "SET_STATUS", payload: status });
    },
    isDecisionMade: transaction.status === "decision_made",
  };

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useTransaction(): TransactionContextValue {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error("useTransaction must be used within TransactionProvider");
  return ctx;
}
