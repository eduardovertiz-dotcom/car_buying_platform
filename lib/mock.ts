import { Transaction, DEFAULT_DOCUMENTS } from "./types";

export const mockTransactions: Transaction[] = [
  {
    id: "txn_001",
    vehicle: {
      make: "Nissan",
      model: "Sentra",
      year: 2019,
      vin: "3N1AB7AP1KY123456",
    },
    current_step: "understand",
    checklist_progress: 0,
    verification_status: "not_started",
    documents: { ...DEFAULT_DOCUMENTS },
    verification_results: null,
    activity_log: [
      {
        id: "act_1",
        type: "transaction_created",
        step: "understand",
        timestamp: "2026-04-07T10:00:00Z",
      },
    ],
    contract: { status: "not_started" },
    maintenance: { records: [] },
    share: { enabled: true, token: "test_abc123" },
    created_at: "2026-04-07T10:00:00Z",
  },
  {
    id: "txn_002",
    vehicle: {
      make: "Toyota",
      model: "Corolla",
      year: 2021,
    },
    current_step: "understand",
    checklist_progress: 0,
    verification_status: "not_started",
    documents: { ...DEFAULT_DOCUMENTS },
    verification_results: null,
    activity_log: [
      {
        id: "act_1",
        type: "transaction_created",
        step: "understand",
        timestamp: "2026-04-09T08:00:00Z",
      },
    ],
    contract: { status: "not_started" },
    maintenance: { records: [] },
    share: { enabled: false },
    created_at: "2026-04-09T08:00:00Z",
  },
];

export const mockBasicResults = {
  status: "review" as const,
  summary:
    "Basic checks completed. The vehicle has no stolen vehicle report in REPUVE. One outstanding lien was detected. Factura structure is valid but could not be fully authenticated. Recommend professional verification before proceeding.",
  findings: [
    "No stolen vehicle record found in REPUVE",
    "Outstanding lien detected — verify with seller",
    "Factura structure valid, authentication inconclusive",
    "VIN matches registration record",
  ],
  confidence: 62,
};

export const mockProfessionalResults = {
  status: "review" as const,
  summary:
    "Professional review complete. Identity of seller confirmed. Lien has been flagged as unresolved — this must be cleared before transfer. Factura authenticated as genuine. No cloning indicators detected. Proceed with caution pending lien resolution.",
  findings: [
    "Seller identity verified",
    "Lien confirmed unresolved — requires clearance before transfer",
    "Factura authenticated as genuine by ValidaCFDI",
    "No cloning indicators detected by Vincario",
    "No fraud markers in document inspection",
  ],
  confidence: 88,
};
