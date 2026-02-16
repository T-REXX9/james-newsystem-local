# Navigation, Routing & Access Control Integration

## Objective

Integrate the promotion management feature into the application's navigation, routing, and access control systems.

## Scope

**Included:**
- Add "Product Promotions" menu item to `file:utils/topbarMenuConfig.ts` under Sales → Transactions
- Add routing case in `file:App.tsx` for `sales-transaction-product-promotions`
- Register module in `file:constants.ts` (AVAILABLE_APP_MODULES)
- Set up permission checks (Owner only)
- Add module to DEFAULT_STAFF_ACCESS_RIGHTS if needed
- Update MODULE_ID_ALIASES if legacy support needed
- Test access control (Owner can access, others cannot)

**Excluded:**
- Component implementation (already done in previous tickets)

## Acceptance Criteria

- [ ] "Product Promotions" appears in topbar navigation under Sales → Transactions
- [ ] Menu item only visible to Owner role
- [ ] Clicking menu item navigates to PromotionManagementView
- [ ] Sales persons see their promotion list when navigating to the route
- [ ] Access denied screen shows for unauthorized roles
- [ ] Module ID follows naming convention: `sales-transaction-product-promotions`
- [ ] Navigation works with the topbar navigation dropdowns

## Technical References

- **Tech Plan**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/5fd7de40-a5b7-4c37-ae0f-5420b0b52d57` (Integration section)
- **Pattern Reference**: `file:utils/topbarMenuConfig.ts`, `file:App.tsx`, `file:constants.ts`

## Dependencies

- **Requires**: Ticket #3 (Owner UI) and Ticket #5 (Sales Person UI) must be completed first
