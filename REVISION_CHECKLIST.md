# James Quek New-System Revision Checklist

Updated: 4 August 2026 (Asia/Manila)

## Working rules

- Work on one revision at a time.
- Do not mark a revision complete until its focused unit tests and relevant compile checks pass.
- Do not use browser, live-API, or integration tests; verification is unit-test-only, with build/syntax checks where needed.
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

- [x] **INV-01 — Product visibility and changes synchronize across modules (P0)**
  - Status: Complete.
  - Completion report:
    - Confirmed Product Database changes update the shared `tblinventory_item` record used by all inventory modules; no duplicate Stock Movement product store exists.
    - Corrected Stock Movement, Purchase Order, and Receiving product pickers to request active products only.
    - Kept Stock Adjustment's complete product map for historical document labels, while limiting its new-item autocomplete to active products.
    - Preserved historical access: hidden item `VV-026` is excluded from active product search, while its 2013 receiving movement remains retrievable by item ID.
    - Added regression coverage for Stock Movement filtering, Stock Adjustment history versus new choices, and Purchase Order/Receiving picker status.
    - Verification: focused tests 19/19 passed; production build passed.
    - Full-suite baseline: 274 tests passed, 15 failed, and 1 skipped. The same 15 pre-existing failures remain outside INV-01; all product visibility, Stock Movement, Stock Adjustment, Purchase Order, and Receiving tests passed.

- [ ] **INV-02 — Product Database uses larger text and tabbed detail (P1)**
  - Completion report: Pending.

- [x] **INV-03 — Centralized quantity and disabled product transfer (P0)**
  - Status: Complete.
  - Completion report:
    - Removed Transfer Product from navigation and default role/module permissions. Existing deep links now show a disabled-module notice instead of the transfer form.
    - Added a server-side safety lock to all seven transfer mutation actions; historical transfer lists remain readable, but create, update, delete, item changes, and posting are rejected with HTTP 410.
    - Added one centralized `total_stock` value to product results and updated Product Database, product search/autocomplete, Stock Movement, Stock Adjustment, purchasing requests, Receiving, call monitoring, and quick search to use it. Legacy warehouse columns are summed only as a compatibility fallback.
    - Removed warehouse quantity selectors, split columns, and WH1–WH6 displays from active Inventory Report, Reorder Report, Stock Movement, Stock Adjustment, Purchase Request, Receiving, and quick-search workflows.
    - Collapsed inventory-audit warehouse rows into a single `CENTRALIZED` count on both the server and client, including safe handling for incomplete physical counts.
    - Limited Reorder Report to centralized totals and removed warehouse-specific report options.
    - Verification (unit tests only): backend transfer lock 7/7 passed; focused frontend tests 30/30 passed; all changed PHP files passed syntax checks; production build passed.

- [x] **DCR-01 — Daily Collection scrolling works (P0)**
  - Status: Complete.
  - Completion report:
    - Removed the route-level overflow trap that clipped Daily Collection content inside the fixed application frame.
    - Added explicit full-height vertical scrolling to the Daily Collection page, while retaining separate scroll areas for the record list and wide detail table.
    - Kept the detail header sticky only inside its own table scroller so it does not cover page-level action controls.
    - Added a component unit test with 20 collection headers and 30 detail rows, verifying the last header and last transaction/action row remain rendered within the correct scroll containers.
    - Verification (unit tests only): focused component test 1/1 passed; production build passed.

- [x] **DCR-02 — Daily Collection disapproval reverses ledger effect (P0)**
  - Status: Complete.
  - Completion report:
    - Changed a disapproval into an immediate final `Disapproved` result instead of allowing the record to continue to the next approval level.
    - Removed every ledger row linked either by the DCR reference or by one of its collection-item IDs, covering older rows with inconsistent reference values.
    - Kept the collection status update, approver audit flag/reason/timestamp, and ledger reversal in one database transaction so partial disapproval cannot be saved.
    - Preserved unrelated ledger entries and returned the number of reversed rows for audit/diagnostic use.
    - Verification (unit tests only): 2/2 in-memory repository unit tests passed, including forced-failure rollback; changed PHP files passed syntax checks.

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

- [x] **PUR-02 — Reorder Report creates PR and tracks PR/PO/RR stages (P0)**
  - Status: Complete.
  - Completion report:
    - Kept multi-item selection and verified that one generated PR contains every selected eligible item.
    - Added a left-side Purchase Activity panel that immediately displays the newly generated PR number and shows Stage 1 PR, Stage 2 PO, and Stage 3 Receiving statuses for existing workflows.
    - Added explicit PR, PO, and Receiving status values to each report row while retaining clickable document numbers.
    - Disabled selection for items already in an active purchasing workflow; select-all now selects eligible items only.
    - Added a server-side workflow guard that rejects duplicate PR creation/addition for items in active PR or PO activity and releases the item after Receiving is posted.
    - Cleared Reorder Report cache after PR creation/item addition, PR-to-PO conversion, and Receiving creation so stage numbers refresh immediately.
    - Verification (unit tests only): frontend workflow/component tests 5/5 passed; backend workflow-guard tests 3/3 passed; changed PHP files passed syntax checks; production build passed.

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
- [ ] All focused unit suites pass.
- [ ] All P0 accounting and inventory rules have unit coverage.
- [ ] Role permissions and audit events are verified by unit tests.
- [ ] Open clarifications are recorded for James rather than guessed.
