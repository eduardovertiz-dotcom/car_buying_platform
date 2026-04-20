export type Step = "upload" | "check" | "analyze" | "verify" | "complete";

export type VerificationStatus =
  | "not_started"
  | "basic_processing"
  | "basic_complete"
  | "professional_processing"
  | "professional_complete";

export type VerificationResult = {
  status: "safe" | "review" | "high_risk";
  summary: string;
  findings: string[];
  confidence: number;
};

export type DocumentType = "ine" | "registration" | "invoice";

export type DocumentItem = {
  status: "missing" | "pending" | "uploaded";
  file_name: string;
  file_url: string;
  uploaded_at: string;
};

export type DocumentCollection = {
  ine: DocumentItem;
  registration: DocumentItem;
  invoice: DocumentItem;
};

export type ContractStatus = "not_started" | "generated";

export type MaintenanceRecordType = "service" | "repair" | "inspection";

export type MaintenanceRecord = {
  id: string;
  type: MaintenanceRecordType;
  title: string;
  date: string;
  notes?: string;
};

export type ActivityEntryType =
  | "transaction_created"
  | "step_completed"
  | "basic_verification_requested"
  | "professional_verification_requested"
  | "document_uploaded"
  | "contract_generated"
  | "transaction_completed"
  | "maintenance_added";

export type ActivityEntry = {
  id: string;
  type: ActivityEntryType;
  step: Step;
  timestamp: string;
  meta?: { document_type?: DocumentType };
};

export type Transaction = {
  id: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    vin?: string | null;
    plate?: string | null;
  };
  current_step: Step;
  checklist_progress: number;
  verification_status: VerificationStatus;
  documents: DocumentCollection;
  verification_results: VerificationResult | null;
  activity_log: ActivityEntry[];
  contract: {
    status: ContractStatus;
    file_name?: string;
    created_at?: string;
  };
  maintenance: {
    records: MaintenanceRecord[];
  };
  share: {
    token?: string;
    enabled: boolean;
  };
  buyer_name?: string;
  buyer_email?: string;
  seller_name?: string;
  seller_email?: string;
  price?: string;
  location?: string;
  // Transaction lifecycle status — DB-backed, absolute source of truth
  status?: string;
  // Plan purchased — set by post-checkout, used to gate Pro features
  plan?: "39" | "69" | null;
  // Decision audit fields — kept for analytics only, never used for control flow
  accepted_risk_level?: "LOW" | "MODERATE" | "HIGH";
  accepted_confidence?: number;
  accepted_at?: string;
  // Documenso e-signature
  documenso_document_id?: string;
  signing_status?: "not_sent" | "pending" | "signed";
  created_at: string;
};

// All 5 steps — Pro users see all; Basic users skip "verify"
export const STEPS: { key: Step; label: string; index: number }[] = [
  { key: "upload",   label: "Upload",   index: 0 },
  { key: "check",    label: "Check",    index: 1 },
  { key: "analyze",  label: "Analyze",  index: 2 },
  { key: "verify",   label: "Verify",   index: 3 },
  { key: "complete", label: "Complete", index: 4 },
];

// Returns plan-appropriate step list:
// Basic ($39): Upload → Check → Analyze → Complete
// Pro   ($69): Upload → Check → Analyze → Verify → Complete
export function getSteps(plan: "39" | "69" | null): typeof STEPS {
  return plan === "69" ? STEPS : STEPS.filter((s) => s.key !== "verify");
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  ine: "Seller ID (INE / official ID)",
  registration: "Vehicle registration (Tarjeta de circulación)",
  invoice: "Ownership invoice (Factura)",
};

const EMPTY_DOC: DocumentItem = { status: "missing", file_name: "", file_url: "", uploaded_at: "" };

export const DEFAULT_DOCUMENTS: DocumentCollection = {
  ine:          { ...EMPTY_DOC },
  registration: { ...EMPTY_DOC },
  invoice:      { ...EMPTY_DOC },
};

// ─── Document normalization ───────────────────────────────────────────────────
//
// Single authoritative boundary that enforces DocumentItem shape.
// Called at every data-ingestion point (HYDRATE, API responses).
// After this runs, all downstream code can trust the shape without guards.

const VALID_DOC_STATUSES = new Set<DocumentItem["status"]>(["missing", "pending", "uploaded"]);

function normalizeItem(raw: unknown): DocumentItem {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_DOC };
  }
  const obj = raw as Record<string, unknown>;
  const status = VALID_DOC_STATUSES.has(obj.status as DocumentItem["status"])
    ? (obj.status as DocumentItem["status"])
    : "missing";
  return {
    status,
    file_name:   typeof obj.file_name   === "string" ? obj.file_name   : "",
    file_url:    typeof obj.file_url    === "string" ? obj.file_url    : "",
    uploaded_at: typeof obj.uploaded_at === "string" ? obj.uploaded_at : "",
  };
}

export function normalizeDocuments(input: unknown): DocumentCollection {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[normalizeDocuments] invalid input — using defaults:", input);
    }
    return { ...DEFAULT_DOCUMENTS };
  }
  const obj = input as Record<string, unknown>;
  if (process.env.NODE_ENV !== "production") {
    const needsCorrection =
      !obj.ine || !obj.registration || !obj.invoice ||
      typeof (obj.ine as Record<string, unknown>)?.file_name !== "string";
    if (needsCorrection) {
      console.warn("[normalizeDocuments] corrected input:", input);
    }
  }
  return {
    ine:          normalizeItem(obj.ine),
    registration: normalizeItem(obj.registration),
    invoice:      normalizeItem(obj.invoice),
  };
}
