# James Quek New-System Revision Checklist

Updated: 4 August 2026 (Asia/Manila)

## Working rules

- Work on one revision at a time.
- Do not mark a revision complete until its focused tests and relevant regression checks pass.
- Record a brief completion report under every finished revision.
- Preserve the checkpoint already published to `main`: `53621e3`.

## Checklist

- [x] **ACC-01 — Sales return finds historical references (P0)**
  - Target: Transaction `D24116` must be searchable and selectable for a sales return with reference.
  - Status: Complete.
  - Completion report:
    - Confirmed `D24116` exists in `tbldelivery_receipt` as a posted order slip for main account 1.
    - Root cause: the picker reused two broad report searches containing historical item-level subqueries; the invoice request exceeded the PHP 30-second limit on the legacy dataset.
    - Added a dedicated `/sales-returns/source-documents` API lookup for invoice/order-slip number, internal reference, and customer name. It excludes cancelled source documents and returns the source reference, type, customer, salesperson, date, status, item count, and total.
    - Updated the Sales Return modal to use the dedicated lookup for its initial list and typed searches.
    - Added API, service, and rendered-autocomplete regression coverage for `D24116`.
    - Verification: API regression 7/7 passed; focused frontend tests 3/3 passed; production build passed.
    - Full-suite baseline: 270 tests passed, 15 failed, and 1 skipped. The failures are pre-existing and outside ACC-01; no Sales Return test failed.

- [ ] **ACC-02 — Customer ledger old layout with improved left search (P1)**
  - Completion report: Pending.

- [ ] **ACC-03 — Purchase History matches supplied reference (P2)**
  - Completion report: Pending; exact field list still requires confirmation.

- [ ] **NAV-01 — Records can open in a new browser tab (P1)**
  - Completion report: Pending.

- [ ] **INV-01 — Product visibility and changes synchronize across modules (P0)**
  - Completion report: Pending.

- [ ] **INV-02 — Product Database uses larger text and tabbed detail (P1)**
  - Completion report: Pending.

- [ ] **INV-03 — Centralized quantity and disabled product transfer (P0)**
  - Completion report: Pending.

- [ ] **DCR-01 — Daily Collection scrolling works (P0)**
  - Completion report: Pending.

- [ ] **DCR-02 — Daily Collection disapproval reverses ledger effect (P0)**
  - Completion report: Pending.

- [ ] **DCR-03 — Daily Collection naming, attribution, and approved print (P1)**
  - Completion report: Pending.

- [ ] **DASH-01 — Daily Call Monitoring structure and prospect handling (P1)**
  - Completion report: Pending.

- [ ] **DASH-02 — Daily Call metrics, potential values, and filters (P1)**
  - Completion report: Pending; Total Potential Sales formula requires confirmation.

- [ ] **DASH-03 — Management-only Sales Performance Dashboard (P1)**
  - Completion report: Pending.

- [ ] **DASH-04 — Management Operations Dashboard and activity log (P1)**
  - Completion report: Pending.

- [ ] **DASH-05 — Dashboard menu contains the three requested dashboards (P1)**
  - Completion report: Pending.

- [ ] **PUR-01 — Newest simplified Purchase Request template (P1)**
  - Completion report: Pending.

- [ ] **PUR-02 — Reorder Report creates PR and tracks PR/PO/RR stages (P0)**
  - Completion report: Pending.

- [ ] **PUR-03 — Newest Item Suggested for Stock template creates PR (P1)**
  - Completion report: Pending.

- [ ] **PUR-04 — Purchase Order generation and controlled unpost (P1)**
  - Completion report: Pending.

- [ ] **PUR-05 — Receiving enforces PR → PO → RR sequence (P0)**
  - Completion report: Pending.

- [ ] **PUR-06 — Posted Return to Supplier deducts centralized stock (P0)**
  - Completion report: Pending.

## Final regression gate

- [ ] Production build passes.
- [ ] Full automated test suite passes.
- [ ] All P0 accounting and inventory workflows pass end-to-end tests.
- [ ] Role permissions and audit events are verified.
- [ ] Open clarifications are recorded for James rather than guessed.
