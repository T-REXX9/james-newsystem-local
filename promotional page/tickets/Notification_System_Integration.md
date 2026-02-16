# Notification System Integration

## Objective

Integrate promotion events with the existing notification system for alerts and user notifications.

## Scope

**Included:**
- Add new notification types to system:
  - `promotion_expiring` - 7 days before expiration
  - `promotion_assigned` - New promotion assigned to sales person
  - `proof_approved` - Owner approved proof
  - `proof_rejected` - Owner rejected proof
- Implement notification creation in service layer functions
- Create expiration alert widget for owner's main dashboard
- Test notification delivery via real-time subscriptions
- Ensure notifications link to relevant promotions

**Excluded:**
- Notification UI components (already exist)
- Email notifications (not in scope)

## Acceptance Criteria

- [ ] Expiration alerts created automatically 7 days before end_date
- [ ] Sales persons receive notification when promotion is assigned
- [ ] Sales persons receive notification when proof is approved
- [ ] Sales persons receive notification when proof is rejected (includes reason)
- [ ] Owner receives notification when new proof is uploaded
- [ ] Expiration alert widget appears on owner's dashboard
- [ ] Clicking notification navigates to relevant promotion
- [ ] Notifications use existing `file:components/NotificationProvider.tsx` infrastructure

## Technical References

- **Core Flows**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/3884e2ef-91f6-4615-a6b1-b7522e088ff8` (Flow 6, Flow 11)
- **Tech Plan**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/5fd7de40-a5b7-4c37-ae0f-5420b0b52d57` (Database Trigger section)
- **Pattern Reference**: `file:components/NotificationProvider.tsx`

## Dependencies

- **Requires**: Ticket #1 (Database Schema - trigger function)
- **Requires**: Ticket #2 (Service Layer)
- **Requires**: Ticket #3 (Owner UI) and Ticket #5 (Sales Person UI) for testing