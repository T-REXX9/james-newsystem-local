# Promotion Service Layer & File Upload

## Objective

Implement the complete service layer for promotion management, including CRUD operations, file uploads, and proof review.

## Scope

**Included:**
- Create `promotionService.ts` with all CRUD operations
- Implement file upload to Supabase Storage
- Implement proof submission, approval, and rejection functions
- Implement promotion extension logic
- Implement performance tracking query (aggregate from sales_orders/invoices)
- Create `promotionRealtimeService.ts` for real-time subscriptions
- Add TypeScript interfaces to `file:types.ts`
- Follow existing service patterns from `file:services/salesOrderService.ts`

**Excluded:**
- UI components (separate tickets)
- Navigation/routing setup
- Notification creation (handled in integration ticket)

## Acceptance Criteria

- [ ] `promotionService.ts` implements all functions from Tech Plan
- [ ] File upload handles validation (type, size), compression, and error cases
- [ ] Proof approval/rejection updates posting status and stores review metadata
- [ ] Performance tracking queries sales_orders/invoices filtered by date and product
- [ ] Real-time service subscribes to promotions and postings tables
- [ ] All functions follow existing error handling patterns
- [ ] TypeScript interfaces added for Promotion, PromotionProduct, PromotionPosting
- [ ] Service functions include proper authentication checks

## Technical References

- **Tech Plan**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/5fd7de40-a5b7-4c37-ae0f-5420b0b52d57` (Service Layer section)
- **Pattern Reference**: `file:services/salesOrderService.ts`, `file:services/salesInquiryRealtimeService.ts`
- **Types**: `file:types.ts`

## Dependencies

- **Requires**: Ticket #1 (Database Schema) must be completed first