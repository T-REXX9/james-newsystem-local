# Owner Proof Review & Approval System

## Objective

Implement the proof review interface for owners to approve/reject screenshot submissions from sales persons.

## Scope

**Included:**
- Proof review interface within `PromotionDetailsModal.tsx` (Proofs tab)
- Screenshot viewer/lightbox for full-size preview
- Approve/reject action buttons
- Rejection reason modal with required text field
- Real-time updates when new proofs are uploaded
- Visual indicators for proof status (Pending, Approved, Rejected)
- Display rejection reasons for rejected proofs

**Excluded:**
- Proof upload interface (sales person ticket)
- Notification delivery (integration ticket)

## Acceptance Criteria

- [ ] Proofs tab displays all platform postings with status
- [ ] Screenshot thumbnails are clickable for full-size view
- [ ] Approve button updates status and records reviewer
- [ ] Reject button opens modal requiring rejection reason
- [ ] Rejection reason is stored and displayed
- [ ] Real-time updates show new proof uploads immediately
- [ ] Post URLs are displayed and clickable (if provided)
- [ ] Interface matches wireframe from Core Flows

## Technical References

- **Core Flows**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/3884e2ef-91f6-4615-a6b1-b7522e088ff8` (Owner Flow 3)
- **Tech Plan**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/5fd7de40-a5b7-4c37-ae0f-5420b0b52d57` (Approve/Reject Proof Flow)

## Dependencies

- **Requires**: Ticket #3 (Owner Promotion Management UI) must be completed first
- **Parallel with**: Ticket #6 (Proof Upload System)