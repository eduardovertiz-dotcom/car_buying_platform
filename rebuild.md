# Rebuild Reference — English Stable Baseline

## Snapshot Description

This is the last stable English version of the MexGuardian marketing and product UI.

**Includes:**
- Final landing page structure (9 sections, conversion-optimized)
- Pricing section with USD / CAD / MXN currency toggle
- Live exchange rate logic (fetched once on mount, rounded, fallback-safe)
- Final product-style footer
- Final CTA + copy system (risk-consequence framing)
- Mobile-responsive layout

---

## Key Files

| File | Purpose |
|---|---|
| `app/page.tsx` | Full marketing landing page |
| `app/globals.css` | All marketing + transaction UI styles |
| `components/AIInterface.tsx` | Transaction step engine (Upload → Complete) |
| `components/panels/AnalyzePanel.tsx` | Risk analysis panel |

**Snapshot copies (for visual reference):**
- `snapshots/english-v1/page.tsx`
- `snapshots/english-v1/globals.css`

---

## Features Included

- Full marketing page redesign (9-section structure)
- Clean product-style footer (two-row, minimal)
- Currency toggle: USD / CAD / MXN
- Dynamic exchange rate via `api.exchangerate.host` (rounded, fallback-safe)
- FAQ with English-language clarification for expat buyers
- Conversion-optimized copy (final pass — risk → decision → action framing)
- Mobile-responsive layout (nav, hero CTAs, process steps, pricing, footer)
- Credibility layer (Profeco, INEGI, AMIA, Chamber of Deputies sources)

---

## How to Restore

```bash
git checkout v1.english-stable
```

To restore as a new working branch:

```bash
git checkout -b restore-english-baseline v1.english-stable
```

---

## Notes for Future Work

- **Next step is full Spanish adaptation**
- Do NOT overwrite the English version
- Spanish should be implemented as:
  - A separate language layer (i18n), OR
  - A toggle system (EN / ES switch in nav)
- Maintain the same page structure, section order, and UX patterns
- The conversion logic, copy framing, and credibility sources should be adapted — not removed
- The currency toggle should persist across language variants
