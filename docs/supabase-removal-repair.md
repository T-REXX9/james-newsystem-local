# Local workflow cleanup and database wiring

Updated 2026-08-29. Changes span the `james-newsystem` frontend and sibling `api`
Git repositories. The previous audit is superseded by this implementation.

## Removed

- Unused Tasks and old Dashboard screens; retained deal-board and prospect-maintenance
  routes; the three unlinked AI customer-service routes and their exclusive services.
- Unmounted salesperson/owner dashboard variants, their exclusive templates/helpers,
  the old customer-record modal, inquiry-alert panel, deal components, and staff view.
- The unused contact-update approval modal and unreachable ManagementView customer
  detail branch. Review now lives inside the current customer workflow.
- The static AI Agent Activity placeholder in customer details.
- Task/deal PHP endpoints and repositories, obsolete default permissions/aliases,
  unavailable-feature stubs, and the Supabase-named service facade. Remaining facade
  consumers use `services/localDataService.ts`, backed only by local APIs.
- Retired bookmarked routes now show Page not found. Healthy accounting, sales,
  campaign/template, staff, chat, and Daily Call pages were retained.

Removal backups are outside the repositories:
`/tmp/james-retired-pages-before-removal.tar.gz`,
`/tmp/james-retired-exclusive-components.tar.gz`, and
`/tmp/james-retired-api-before-removal.tar.gz`.

## Current workflows

### Customer inquiries and sales returns

Daily Call customer details and Customer Database history tabs now read the existing
`tblinquiry` and `tblcredit_memo` records through authenticated, tenant-scoped
`/api/v1/customer-workflows/{contactId}/inquiries` and `/returns` endpoints.
Customer IDs are matched exactly; every page is loaded; return history includes
older dates rather than defaulting to only the current month. Failed requests show
errors and allow retry instead of appearing as an empty history.

The old customer-tab Process Return stub was removed. Posting/unposting stays in
the existing Accounting → Sales Return Credit workflow, which owns stock and
accounting effects. The customer history tab links there.

### Customer update and discount requests

Agent Full Details → Request Update / Request Discount persists to the new
`customer_requests` MySQL table. Requests are visible in the current customer
Requests tab; Customer Database → Profile also shows them. Owners can approve or
reject; agents can inspect their own requests but cannot approve them.

Approved customer updates apply through the existing customer repository, including
contact-person changes. Review and database updates are transactional. The backend
checks authenticated account scope and owner authority, rejects duplicate reviews,
validates fields/contact ownership, and prevents stale requests from overwriting
newer customer edits. Open customer views refresh after approval. Review actions write the existing audit trail.

Discount approval records the authorization and its review note. It does not
automatically reprice existing sales documents or bypass their pricing controls.

### Server Maintenance / recovery

The menu recognizes the current Company Owner role. The authenticated owner-only
local recovery API stores snapshots for explicit customer/product deletions made
with this version. Deletion and snapshot capture occur in one transaction.
Customer recovery includes related contact people, terms, and image metadata;
product recovery restores its previous enabled/inventory flags. Conflicting
references cannot be overwritten. Raw snapshots are not returned to the browser.

Older deleted records cannot be reconstructed. Inactive products are not inferred
to be deleted. Discard recovery permanently deletes the snapshot; disabled product
rows remain to preserve transaction references. There is no automatic purge or
promise of 90-day retention. Recovery currently covers customers and products,
not historical Supabase recycle-bin entries or other document types.

### Activity logs

The frontend logger now posts authenticated entries to `tblaudit_trail`, using
server-resolved actor/tenant IDs. These entries are prefixed `Client:` to distinguish
them from source-document server audit events. Logging failure returns false and
does not block the primary action. Existing activity-log reading remains intact.

## Database rollout

Both additive migrations have been applied to the configured local database:

- `api/migrations/017_create_customer_requests.sql`
- `api/migrations/018_create_local_recycle_bin.sql`

Apply both migrations **before deploying the updated API**, particularly before
customer/product deletes. No task, deal, or AI legacy tables were recreated.
No existing business data was deleted or edited during verification.

## Verification

- Production Vite build passes; the existing large-bundle warning remains.
- Automated frontend/component/service tests: **534 passed, 7 skipped**.
  Tests include actual current route rendering, retired-route
  rejection, local request mapping/pagination, request review failures, and recovery
  confirmation/failure handling.
- `php api/tests/CustomerWorkflowDatabaseTest.php`: 31 assertions pass against
  connection-local temporary tables cloned from the installed MySQL schema. Tests
  cover local persistence, role/tenant restrictions, stale edits, duplicate approval,
  history scoping, customer/product recovery, conflicts, and audit logging. These
  tests do not modify persistent business rows.
- Existing customer-verification audit contract: 5 checks pass. Existing historical
  sales-return source-document API test: 7 checks pass.
- Read-only HTTP checks: health, customers, inquiries, returns and activity logs
  return 200; new protected endpoints without credentials return 401; retired task
  and deal endpoints return 404.
- Live-data integration suites that create/post records now require explicit
  `RUN_LOCAL_API_INTEGRATION=1`. Use only against a disposable database; they are
  skipped by default. This is not a claim that those real write flows were run.
- Full TypeScript checking still reports unrelated existing diagnostics; Vite does
  not perform that type check. No clean full type-check claim is made.
- No authenticated browser session was exercised. Browser-tool access was blocked
  earlier; automated tests are not presented as manual staff workflow verification.

The local frontend is available at `http://127.0.0.1:8080/james-newsystem/` and the
PHP API at `http://127.0.0.1:8081/api/v1/health` while their dev processes are running.
