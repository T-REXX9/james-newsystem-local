# Sales Person Promotion Dashboard & List View

## Objective

Build the sales person interface for viewing assigned promotions and tracking posting status.

## Scope

**Included:**
- Create `PromotionDashboardWidget.tsx` for sales person dashboard
- Integrate widget into `file:components/SalespersonDashboardView.tsx`
- Create `PromotionListView.tsx` for dedicated promotions page
- Implement filtering (All Promotions, Assigned to Me, Active Only)
- Display promotion cards with posting status per platform
- Show proof status indicators (Not Posted, Pending, Approved, Rejected)
- Display rejection reasons for rejected proofs
- Real-time updates for proof approval/rejection
- "Upload Proof" and "Re-upload" buttons per platform

**Excluded:**
- Proof upload modal (separate ticket)
- Navigation/routing (integration ticket)

## Acceptance Criteria

- [ ] Dashboard widget shows active promotions count and pending posts
- [ ] Widget has "View All Promotions" button
- [ ] Dedicated page shows all visible promotions (based on assignment)
- [ ] Filters work correctly (All, Assigned to Me, Active Only)
- [ ] Each promotion card shows products, dates, and platform posting status
- [ ] Platform status uses color-coded indicators (green=approved, yellow=pending, red=rejected)
- [ ] Upload/Re-upload buttons appear for appropriate platforms
- [ ] Real-time updates work (approvals/rejections appear immediately)
- [ ] Interface matches wireframes from Core Flows

## Technical References

- **Core Flows**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/3884e2ef-91f6-4615-a6b1-b7522e088ff8` (Sales Person Flows 7-8, 11)
- **Tech Plan**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/5fd7de40-a5b7-4c37-ae0f-5420b0b52d57` (Component Architecture)
- **Pattern Reference**: `file:components/SalespersonDashboardView.tsx`

## Dependencies

- **Requires**: Ticket #2 (Service Layer) must be completed first
- **Parallel with**: Ticket #3 (Owner UI)