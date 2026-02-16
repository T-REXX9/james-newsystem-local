# Owner Promotion Management UI

## Objective

Build the complete Owner interface for creating, viewing, and managing promotions.

## Scope

**Included:**
- Create `PromotionManagementView.tsx` with dashboard layout (KPI cards + tabs)
- Implement `CreatePromotionModal.tsx` with product picker and platform chips
- Implement `PromotionDetailsModal.tsx` with tabbed view (Overview, Proofs, Performance)
- Implement `ExtendPromotionModal.tsx` for extending promotions
- Implement product selection modal (reuse existing product search patterns)
- Add real-time updates using `useRealtimeList` hook
- Implement optimistic updates for better UX
- Follow existing UI patterns from `file:components/ProductDatabase.tsx`

**Excluded:**
- Sales person views (separate ticket)
- Navigation/routing (integration ticket)
- Proof upload interface (sales person ticket)

## Acceptance Criteria

- [ ] Dashboard shows KPI cards (Active, Pending Review, Expiring Soon)
- [ ] Tabbed sections work (Active, Expired, Pending Review)
- [ ] Create promotion modal includes all fields from Core Flows
- [ ] Product picker modal allows single/multiple selection with search
- [ ] Platform input creates chips/tags dynamically
- [ ] Promotion details modal shows Overview, Proofs, and Performance tabs
- [ ] Extend modal allows date and price updates
- [ ] Real-time updates work (new promotions appear immediately)
- [ ] Combined status badge shows "Active - 3/5 Posted" format
- [ ] All modals follow existing design patterns

## Technical References

- **Core Flows**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/3884e2ef-91f6-4615-a6b1-b7522e088ff8` (Owner Flows 1-6)
- **Tech Plan**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/5fd7de40-a5b7-4c37-ae0f-5420b0b52d57` (Component Architecture)
- **Pattern Reference**: `file:components/ProductDatabase.tsx`, `file:components/SalesOrderView.tsx`

## Dependencies

- **Requires**: Ticket #2 (Service Layer) must be completed first