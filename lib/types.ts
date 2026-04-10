export type Step = "understand" | "find" | "evaluate" | "verify" | "complete";

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
  status: "missing" | "uploaded";
  file_name?: string;
  file_url?: string;
  uploaded_at?: string;
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
    vin?: string;
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
  created_at: string;
};

export const STEPS: { key: Step; label: string; index: number }[] = [
  { key: "understand", label: "Understand", index: 0 },
  { key: "find", label: "Find", index: 1 },
  { key: "evaluate", label: "Evaluate", index: 2 },
  { key: "verify", label: "Verify", index: 3 },
  { key: "complete", label: "Complete", index: 4 },
];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  ine: "INE / Identificación oficial",
  registration: "Tarjeta de circulación",
  invoice: "Factura",
};

export const DEFAULT_DOCUMENTS: DocumentCollection = {
  ine: { status: "missing" },
  registration: { status: "missing" },
  invoice: { status: "missing" },
};
