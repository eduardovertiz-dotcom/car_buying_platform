// Discriminated union — every adapter resolves to one of these two shapes.
// Adapters never throw; they always return a ProviderResult.
export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ── Verifik / REPUVE ─────────────────────────────────────────────────────────
export type RepuveResult = {
  theft: boolean;
  status: string;
};

// ── Apitude / debts (reserved) ───────────────────────────────────────────────
export type DebtsResult = {
  has_debts: boolean;
  amount: number;
};

// ── ValidaCFDI / invoice (reserved) ─────────────────────────────────────────
export type FacturaResult = {
  valid: boolean;
  status: string;
};

// ── Verify route input ───────────────────────────────────────────────────────
export type VerifyInput = {
  plate: string;
  vin?: string;
  factura?: {
    uuid: string;
    rfc_emisor: string;
    rfc_receptor: string;
    total: number;
  };
};
