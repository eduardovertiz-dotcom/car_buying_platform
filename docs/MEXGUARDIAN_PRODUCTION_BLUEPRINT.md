# MexGuardian — Production Blueprint

**Version:** v1.0-launch-baseline  
**Date:** 2026-04-17  
**Status:** Production freeze — launch-ready

---

## 1. System Overview

MexGuardian is a vehicle purchase verification platform for the Mexican used-car market. It guides a buyer through document upload, risk analysis, registry verification, and purchase agreement generation — all within a single transaction session.

**Core flow:**

```
Upload → Check → Analyze → Verify → Complete
```

Basic plan ($49) skips `Verify` and goes directly to `Complete`.  
Pro plan ($79) runs the full five-step flow.

The product is built on Next.js 14 App Router with client-side state managed via React Context + `useReducer`, persisted to `localStorage` per transaction.

---

## 2. Step Engine

### Step definitions (`lib/types.ts`)

| Key | Label | Index | Description |
|---|---|---|---|
| `upload` | Upload | 0 | Vehicle details form + document upload |
| `check` | Check | 1 | Initial check confirmation step |
| `analyze` | Analyze | 2 | Risk analysis display (AnalyzePanel) |
| `verify` | Verify | 3 | Registry checks + expert review decision |
| `complete` | Complete | 4 | Agreement generation + e-signature |

### Plan-aware step list (`getSteps(plan)`)

- **Basic ($49):** Upload → Check → Analyze → Complete (`verify` filtered out)
- **Pro ($79):** Upload → Check → Analyze → Verify → Complete

### Step transitions

- `ADVANCE_STEP` — move forward one step; blocked during any `*_processing` verification state
- `ADVANCE_TO_STEP` — forward jump to a named step (used by Basic plan to skip `verify`)
- `GO_TO_STEP` — backward navigation only; resets verification state if jumping before `verify`

### Entry/exit conditions per step

**Upload:**
- Entry: always
- Exit (`canContinue`): `vehicleComplete` (make + model + year) AND at least one document uploaded
- Advance is blocked if neither condition is met; button text changes to explain what's missing

**Check:**
- Entry: after Upload advance
- Exit: single CTA advance — no conditions

**Analyze (AnalyzePanel):**
- Entry: after Check advance
- Exit (Basic): `advanceToStep("complete")` — skips Verify
- Exit (Pro): `advanceStep()` — proceeds to Verify
- `risk_computed` tracking event fires once on mount

**Verify (VerifyInterface):**
- Entry: Pro plan only
- Renders ONLY `VerifyInterface` — all shared panels are hidden on this step
- Verification API call fires automatically on mount via `useEffect([identifier, verification_status])`
- Hard guard: no API call and no state mutation if `vehicle.vin || vehicle.plate` is null
- Exit: user clicks "Proceed with this risk level" → `acceptRisk()` + 800ms flash → `advanceStep()`

**Complete (CompleteInterface):**
- Entry: after Verify (Pro) or Analyze (Basic)
- User fills agreement fields, generates contract, optionally sends for e-signature
- No further step advances

---

## 3. Risk Engine

**Single source of truth:** `lib/risk.ts` → `computeRisk(transaction): RiskOutput`

No component or panel calculates risk independently. All risk data flows from `computeRisk()`.

### Confidence model

Confidence score is based on document completeness:

| Signal | Points |
|---|---|
| INE (Seller ID) uploaded | +30 |
| Registration uploaded | +30 |
| Invoice (Factura) uploaded | +30 |
| VIN or plate present | +10 |
| **Maximum** | **100** |

### Risk classification

When `verification_results` are present (after Verify step runs):
- `safe` → `LOW`
- `review` → `MODERATE`
- `high_risk` → `HIGH`

When no verification results exist (Analyze step):
- 0 unknowns → `LOW`
- 1+ unknowns → `MODERATE`
- 2+ unknowns OR any finding containing "theft"/"stolen"/"invalid" → `HIGH`

### RiskOutput type

```typescript
type RiskOutput = {
  riskLevel:       "LOW" | "MODERATE" | "HIGH";
  confidence:      number;          // 0–100
  confidenceLabel: string;          // "Very Low" … "Very High"
  issues:          string[];        // actionable problems
  unknowns:        string[];        // missing data gaps
  resolved:        string[];        // items cleared by verification
};
```

### Issues vs unknowns vs resolved

- **issues** — findings containing "theft", "stolen", "invalid", "failed"
- **resolved** — findings containing "no theft", "validated", "passed", "valid"
- **unknowns** — missing documents or missing identifier (VIN/plate)

---

## 4. Decision System

### How risk acceptance works

When the user clicks "Proceed with this risk level" in VerifyInterface:

1. `acceptRisk({ riskLevel, confidence })` is dispatched to the reducer
2. Reducer writes `accepted_risk_level`, `accepted_confidence`, `accepted_at` to transaction state
3. State persists to `localStorage`
4. 800ms flash ("✓ Decision recorded.") displays before `advanceStep()` fires

### Where decision memory is used

**CompleteInterface** reads `accepted_risk_level`, `accepted_confidence`, `accepted_at`:
- If present: `RiskBlock` displays the accepted values (not live recalculated risk)
- Header label: "You chose to proceed with"
- Timestamp displayed: "Decision recorded X ago"
- If absent (Basic plan skipped Verify): live `computeRisk()` output is used instead

This ensures the Complete step always reflects what the user explicitly committed to, not a potentially different recalculated value.

---

## 5. Agreement System

### Template source

`lib/agreement.ts` → `generateAgreementHTML(data: AgreementData): string`

Single bilingual HTML template (Spanish primary, English reference). No duplicate templates anywhere in the codebase.

### Required inputs

```typescript
type AgreementData = {
  id:          string;    // transaction ID
  date:        string;    // localized date string
  vehicle:     { make, model, year, vin?, plate? };
  buyer_name?:  string;
  buyer_email?: string;
  seller_name?: string;
  seller_email?:string;
  price?:       string;
  location?:    string;
};
```

### Generation flow

1. User fills all 6 fields in `CompleteInterface` (buyer name/email, seller name/email, price, location)
2. `canGenerate` gate enforces all fields are non-empty before enabling the button
3. `handleGenerate()` calls `updateAgreementFields()` then `generateContract()`
4. `contract.status` transitions `"not_started"` → `"generated"`
5. Download opens agreement HTML in a new window which triggers `window.print()`

### Documenso e-signature

After generation, user can optionally send for e-signature via the Documenso integration (see Section 6).

---

## 6. Documenso Integration

### API route

`POST /api/documenso/create`

**Request body:**
```json
{
  "buyer_name":    "string",
  "buyer_email":   "string",
  "seller_name":   "string",
  "seller_email":  "string",
  "agreement_html":"string"
}
```

**Response (always HTTP 200):**
```json
{ "success": true,  "document_id": "string" }  // nominal path
{ "success": false, "fallback": true }           // any failure path
```

The API route **never returns a non-200 status** and **never throws to the client**. All error paths (`missing env`, `missing fields`, `upload failure`, `recipients failure`, `send failure`, `network error`) return the fallback shape.

### Three-step Documenso flow

1. `POST /api/v1/documents` — upload agreement HTML as a document
2. `POST /api/v1/documents/:id/recipients` — add buyer + seller as SIGNER roles
3. `POST /api/v1/documents/:id/send` — trigger email delivery

Steps 2 and 3 failures are non-fatal: document ID is returned with whatever progress was made.

### Client fallback

When `data.success === false` or any network error occurs:
- `signingFallback` state is set to `true`
- UI shows: "Signature service unavailable" + emphasized Download button
- User can always proceed via manual download and physical signature
- No blocking error state is ever shown

### Environment variables required

```
DOCUMENSO_API_KEY=...
DOCUMENSO_BASE_URL=https://api.documenso.com  # optional, defaults to this
```

---

## 7. Tracking System

**Centralized utility:** `lib/track.ts` → `track(event, properties?)`

In development (`NODE_ENV === "development"`): logs to console.  
In production: no-op placeholder — swap in any analytics provider.

### Events

| Event | Where it fires | Properties |
|---|---|---|
| `risk_computed` | `AnalyzePanel` — once on mount | `risk_level`, `confidence`, `issues_count`, `unknowns_count` |
| `risk_accepted` | `VerifyInterface` — on CTA click (basic + pro) | `risk_level`, `confidence` |
| `upgrade_clicked` | `AnalyzePanel.handleUpgrade` + `VerifyInterface.handleUpsell` | — |
| `agreement_generated` | `CompleteInterface.handleGenerate` | — |

### Firing guarantees

- `risk_computed`: `useEffect([], [])` — fires exactly once per Analyze mount
- `risk_accepted`: fires on button click, button is unmounted during 800ms flash (no double-fire)
- `upgrade_clicked`: fires before redirect — at most once per redirect attempt
- `agreement_generated`: fires synchronously in `handleGenerate` after state dispatch

---

## 8. State Management

### Transaction structure (key fields)

```typescript
type Transaction = {
  id:                   string;
  vehicle:              { make, model, year, vin: string|null, plate: string|null };
  current_step:         Step;
  checklist_progress:   number;           // 0–100
  verification_status:  VerificationStatus;
  documents:            DocumentCollection; // { ine, registration, invoice }
  verification_results: VerificationResult | null;
  activity_log:         ActivityEntry[];
  contract:             { status: "not_started"|"generated", file_name?, created_at? };
  maintenance:          { records: MaintenanceRecord[] };
  share:                { enabled: boolean, token?: string };

  // Agreement fields (set in Complete step)
  buyer_name?:    string;
  buyer_email?:   string;
  seller_name?:   string;
  seller_email?:  string;
  price?:         string;
  location?:      string;

  // Decision memory (set when user accepts risk in Verify)
  accepted_risk_level?: "LOW" | "MODERATE" | "HIGH";
  accepted_confidence?: number;
  accepted_at?:         string;  // ISO timestamp

  // E-signature (set after Documenso document creation)
  documenso_document_id?: string;
  signing_status?:        "not_sent" | "pending" | "signed";

  created_at: string;
};
```

### Persistence

- State is persisted to `localStorage` under key `transaction_${transactionId}`
- Hydration runs on mount via `useEffect` — reads stored state and dispatches `HYDRATE`
- Persist write is gated behind `hydrated === true` to prevent mock state from overwriting stored state
- Back navigation via `GO_TO_STEP` resets `verification_status` + `verification_results` if jumping before the `verify` step index

### VIN/plate normalization

`UPDATE_VEHICLE` reducer normalizes empty strings to `null`:
```typescript
vin:   v.vin   !== undefined ? (v.vin   ? v.vin   : null) : state.vehicle.vin,
plate: v.plate !== undefined ? (v.plate ? v.plate : null) : state.vehicle.plate,
```

This ensures `vehicle.vin || vehicle.plate` truthiness checks never succeed on empty strings.

### localStorage keys used

| Key | Content |
|---|---|
| `transaction_${id}` | Full serialized `Transaction` object |
| `share_${token}` | Snapshot of transaction for public share page |
| `docs_notified_${id}` | Boolean flag — prevents duplicate admin notifications |

### Cache reset

To clear a transaction for a fresh start:
```javascript
localStorage.removeItem(`transaction_${transactionId}`);
```

To wipe all MexGuardian state:
```javascript
Object.keys(localStorage)
  .filter(k => k.startsWith("transaction_") || k.startsWith("share_") || k.startsWith("docs_notified_"))
  .forEach(k => localStorage.removeItem(k));
```

New users automatically receive a fresh transaction via `createFreshTransaction()` — no explicit reset required for first-time sessions.

---

## 9. Panel Visibility by Step

Shared panels (`DocumentsPanel`, `VerificationPanel`, `ActivityPanel`) are rendered in the server layout but gate their own visibility via `useTransaction()`:

| Panel | upload | check | analyze | verify | complete |
|---|---|---|---|---|---|
| DocumentsPanel | ✓ | ✓ | ✓ | — | — |
| VerificationPanel | ✓ | ✓ | ✓ | — | — |
| ActivityPanel | ✓ | ✓ | ✓ | — | ✓ |

`Verify` renders only `VerifyInterface` — no panels.  
`Complete` renders only `CompleteInterface` + `ActivityPanel`.

---

## 10. Known Constraints

These are intentional non-implementations for v1:

- **Document storage**: uploaded files are mocked — `file_url` is a synthetic path, no actual file is stored server-side
- **REPUVE/SAT live API**: verification calls hit `/api/verify` which may return in `"manual"` mode if live APIs are unavailable; results fall back gracefully
- **Documenso signing status webhook**: `signing_status` transitions from `"pending"` → `"signed"` are not automated — no webhook handler exists for Documenso events
- **Multi-transaction UI**: a user can have multiple paid transactions but the dashboard (`/transactions`) shows the most recent one
- **Analytics provider**: `lib/track.ts` is a no-op stub in production — events are defined but not forwarded to any platform
- **Mobile upload**: file inputs accept `.pdf/.jpg/.jpeg/.png` but image-based document parsing is not implemented
- **Seller-side flow**: the platform is buyer-only; sellers receive a signature request via email but have no dedicated UI

---

## 11. Future Extensions

- Wire `lib/track.ts` to Segment, PostHog, or Mixpanel
- Add Documenso webhook handler to auto-update `signing_status`
- Implement real file storage (Supabase Storage or S3) to replace mock URLs
- Add SMS/WhatsApp notification for verification completion
- Multi-language support (currently bilingual in agreement template only)
- Admin dashboard for reviewing manual verification queue beyond current `AdminVerifyPanel`
