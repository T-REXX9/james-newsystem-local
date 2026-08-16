# James Quek New-System Revision Checklist

Updated: 16 August 2026 (Asia/Manila)

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

- [x] **ACC-02 — Customer ledger old layout with improved left search (P1)**
  - Status: Complete.
  - Completion report:
    - Restored James's supplied Customer Ledger structure: permanent left customer search, Accounting Copy heading, old customer name, seven customer metric cards, legacy transaction columns and totals, aging balances, Export Excel, Print, and Back controls.
    - Customer search now includes historical names and keeps the selected customer/report stable when later searches exclude the customer or fail.
    - Corrected calendar Week/Month/Year ranges and carried the opening balance into filtered detailed and summary reports.
    - Replaced invoice-based aging with ledger-based FIFO credit allocation so aging totals reconcile with the effective ledger balance, including PDC and credit-balance handling.
    - Removed the SQLite-backed Customer Ledger test approach. Ledger calculations now live in a database-free calculator with unit tests, while production repositories retain MySQL-native queries.
    - Verification (unit tests only): focused frontend tests 35/35 passed; backend ledger-rule tests 8/8 passed; changed PHP files passed syntax checks; production build passed.
    - Full frontend baseline: 325 passed, 9 failed, 1 skipped. All nine failures are outside ACC-02 (six require an unavailable local API and three are existing Product/Special Price contract mismatches); no Customer Ledger test failed.

- [x] **ACC-03 — Purchase History matches supplied reference (P2)**
  - Status: Complete.
  - Completion report:
    - Matched James's full-resolution reference with the permanent left customer search, Customer Purchase History heading, customer and old-name display, generated timestamp, Print/Back controls, and readable 14px report text.
    - Added Customer Since, VIP Status, Price Code, current-month Total Sales, Outstanding Balance, Terms, Credit Limit, and Agent fields.
    - Restored the reference detail columns, per-date subtotals, Grand Total, and full Part No./Description/Qty summary with item and quantity totals.
    - Corrected returned quantities so only Posted/Approved returns linked to the same source transaction affect sales and return totals.
    - Historical customers remain searchable and the selected customer/report remains visible while another search is in progress.
    - Verification (unit tests only): focused page test 1/1 and backend reference contract 8/8 passed; changed PHP files passed syntax checks.

- [x] **NAV-01 — Records can open in a new browser tab (P1)**
  - Status: Complete.
  - Completion report:
    - Replaced button-only record numbers with real deep links across Sales Inquiry, Sales Order, Order Slip, Invoice, Purchase Request, Purchase Order, Receiving, Reorder Report, and Suggested Stock purchase activity.
    - Right-click/Open Link in New Tab and Command/Ctrl-click now preserve the original tab, while a normal click keeps the existing in-app behavior.
    - Each link stores its module and record identifiers in the URL so a new tab restores the intended record without discarding unsaved work in the original tab.
    - Verification (unit tests only): focused link, sales-record, and purchasing-record suites 26/26 passed.

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

- [x] **INV-02 — Product Database uses larger text and tabbed detail (P1)**
  - Status: Complete.
  - Completion report:
    - Increased the Product Database form, controls, and record-table text to readable sizes; the wide record table now scrolls horizontally instead of compressing text into tiny columns.
    - Organized the editor into Product Details, Supplier & Costing, and Pricing & Stock tabs, with the selected product opening on Product Details.
    - Verification (unit tests only): focused Product Database tests 2/2 passed and TypeScript passed static checking.

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

- [x] **DCR-03 — Daily Collection naming, attribution, and approved print (P1)**
  - Status: Complete.
  - Completion report:
    - Renamed the transaction screen and navigation entry to Daily Collection Entry while retaining Collection Report as the printed/report title.
    - Added the creating agent's full name to collection records and displayed it on the entry screen.
    - Restricted Print to Approved and Posted entries; Pending and Disapproved entries cannot be printed.
    - Verification (unit tests only): focused naming/print and Daily Collection component tests 3/3 passed; the changed repository passed PHP syntax checking and TypeScript passed static checking.

- [x] **DASH-01 — Daily Call Monitoring structure and prospect handling (P1)**
  - Status: Complete.
  - Completion report:
    - Renamed the page to Daily Call Monitoring Dashboard and changed the creation action to Add Prospect.
    - New prospects now remain Unverified until an authorized user verifies them; rejection marks the prospect Blacklisted and records the decision in the audit trail.
    - Kept customer search and the master-list workflow available on initial page load.
    - Verification (unit tests only): focused Daily Call dashboard and verification-audit tests passed 19/19.

- [x] **DASH-02 — Daily Call metrics, potential values, and filters (P1)**
  - Status: Complete.
  - Completion report:
    - Added Unverified prospect totals for today, this week, and this month, plus current/next VIP and last-purchase filters.
    - Added the amount required to reach the next VIP tier and documented the displayed calculation for Total Potential Sales.
    - Total Potential Sales now uses Priority and Recovery average monthly sales plus ₱5,000 for each Verified prospect; Unverified prospects are excluded.
    - Verification (unit tests only): focused Daily Call metric, filter, and dashboard tests passed.

- [x] **DASH-03 — Management-only Sales Performance Dashboard (P1)**
  - Status: Complete.
  - Completion report:
    - Renamed the management report to Sales Performance Dashboard and retained its live monthly sales measures.
    - Restricted both the menu entry and direct route to company-owner/management access.
    - Verification (unit tests only): dashboard menu and route-access contract tests passed.

- [x] **DASH-04 — Management Operations Dashboard and activity log (P1)**
  - Status: Complete.
  - Completion report:
    - Added an Operations Dashboard showing timestamp, user, page, activity type, reference number, and result from the central audit trail.
    - Added activity-type filtering and retained the existing activity search controls.
    - Standardized audit entries for Daily Collection creation/posting/approval/disapproval, Sales Return creation/posting, and prospect verification/rejection.
    - Verification (unit tests only): focused Operations Dashboard and audit-contract tests passed 5/5.

- [x] **DASH-05 — Dashboard menu contains the three requested dashboards (P1)**
  - Status: Complete.
  - Completion report:
    - Replaced the single Home entry with a Dashboards menu containing Daily Call Monitoring Dashboard, Operations Dashboard, and Sales Performance Dashboard.
    - Agent users see only Daily Call Monitoring Dashboard; management-only dashboards are hidden and protected from direct navigation.
    - Verification (unit tests only): focused dashboard menu/navigation tests passed 18/18.

- [x] **PUR-01 — Newest simplified Purchase Request template (P1)**
  - Completion report:
    - Updated the current Purchase Request screen to James's latest simplified structure with Create Purchase Request heading, item-source guidance, Save as Draft, Preview PR, and Submit PR actions.
    - Kept item selection, preferred supplier, quantities, prices, remarks, recommendation fields, total quantity, and estimated amount functional.
    - Verification (unit tests only): focused Purchase Request form tests 2/2 passed and TypeScript passed static checking.

- [x] **PUR-02 — Reorder Report creates PR and tracks PR/PO/RR stages (P0)**
  - Status: Complete.
  - Completion report:
    - Kept multi-item selection and verified that one generated PR contains every selected eligible item.
    - Added a left-side Purchase Activity panel that immediately displays the newly generated PR number and shows Stage 1 PR, Stage 2 PO, and Stage 3 Receiving statuses for existing workflows.
    - Added explicit PR, PO, and Receiving status values to each report row while retaining clickable document numbers.
    - Disabled selection for items already in an active purchasing workflow; select-all now selects eligible items only.
    - Added a server-side workflow guard that rejects duplicate PR creation/addition for items in active PR or PO activity and releases the item after Receiving is posted.
    - Cleared Reorder Report cache after PR creation/item addition, PR-to-PO conversion, and Receiving creation so stage numbers refresh immediately.
    - Corrected completed Receiving recognition so Delivered records release their item checkboxes instead of being treated as active workflows.
    - Kept the selected-item actions above the dynamically loaded list so Add to PR remains reachable and usable while additional report rows load.
    - Verification (unit tests only): frontend workflow/component tests 5/5 passed; backend workflow-guard tests 3/3 passed; changed PHP files passed syntax checks; production build passed.

- [x] **PUR-03 — Newest Item Suggested for Stock template creates PR (P1)**
  - Completion report:
    - Added James's multi-select Create PR for Selected action; one PR is created with every selected suggestion, requested quantities, and source-suggestion references.
    - Added a left-side PR Activity entry showing the newly generated PR number with a direct link to that Purchase Request.
    - Removed the old direct-to-PO action from Suggested Stock so the workflow can no longer skip the PR stage.
    - Verification (unit tests only): suggestion-to-PR service 2/2 and PR UI contract 2/2 passed; TypeScript passed static checking.

- [x] **PUR-04 — Purchase Order generation and controlled unpost (P1)**
  - Completion report:
    - Renamed and completed the approved-PR action as Generate Purchase Order; it carries the PR reference, supplier, items, quantities, prices, and ETA values, then opens the generated PO.
    - Added an Owner/Administrator/Purchasing Manager Unpost action for posted POs. The API rejects unpost when Receiving exists or received quantities are present and records successful unposts in the activity audit trail.
    - Verification (unit tests only): backend recovery contract 7/7 and frontend generation/unpost suites 6/6 passed; changed PHP files passed syntax checks.

- [x] **PUR-05 — Receiving enforces PR → PO → RR sequence (P0)**
  - Completion report:
    - Replaced the optional typed PO reference and unrestricted product picker with a server-approved list of posted POs created from PRs; selecting a PO fills its supplier and remaining receivable lines.
    - Enforced the same sequence on the API, including PO/PR status validation, PO-line ownership, remaining-quantity limits, and one-time PO received-quantity updates when the RR is posted.
    - Verification (unit tests only): receiving policy 6/6, repository contract 7/7, and frontend receiving service 3/3 passed; changed PHP files passed syntax checks and TypeScript passed static checking.

- [x] **PUR-06 — Posted Return to Supplier deducts centralized stock (P0)**
  - Completion report:
    - Posted returns now aggregate duplicate lines for the same inventory item, validate the total against current centralized stock, and write one centralized stock-out movement for the full returned quantity.
    - Over-returns are rejected before posting; unposting removes the corresponding movement so stock is restored without duplicating deductions on repost.
    - Verification (unit tests only): stock policy 3/3, repository contract 7/7, and frontend return service 2/2 passed; changed PHP files passed syntax checks.

## Final regression gate

- [x] Console errors reported after the revisions were corrected.
  - Expired cached sessions are cleared before notification and chat providers mount, preventing repeated unauthorized requests.
  - Internal-chat realtime is opt-in unless its companion server is configured, and reconnect attempts are capped.
  - Reorder Report's Receiving status is included in its grouped SQL query, removing the reported server error.
  - Added an inline favicon so the application no longer requests a missing file.
  - Owner homepage monitoring now retries temporary read failures once and keeps snapshot data available when the separate master-list request fails.
  - Verification (unit tests only): frontend 282/282 passed with 1 intentional skip; backend 13/13 passed.
- [x] Production build passes.
- [x] All focused unit suites pass.
- [x] All P0 accounting and inventory rules have unit coverage.
- [x] Role permissions and audit events are verified by unit tests.
- [x] Open clarifications are recorded for James rather than guessed.
