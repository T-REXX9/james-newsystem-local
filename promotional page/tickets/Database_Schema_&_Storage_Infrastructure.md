# Database Schema & Storage Infrastructure

## Objective

Set up the complete database schema and file storage infrastructure for the promotion management system.

## Scope

**Included:**
- Create `promotions` table with all fields (campaign_title, description, dates, status, assignment, platforms)
- Create `promotion_products` table with tier-specific pricing columns
- Create `promotion_postings` table with proof tracking fields
- Create Supabase Storage bucket `promotion-screenshots` (public)
- Set up RLS policies for all tables and storage bucket
- Create database indexes for query optimization
- Create expiration alert trigger function
- Add soft delete support (is_deleted, deleted_at)

**Excluded:**
- Service layer implementation (separate ticket)
- Frontend components
- Notification integration (handled in integration ticket)

## Acceptance Criteria

- [ ] All three tables created with proper constraints and relationships
- [ ] Storage bucket created and accessible
- [ ] RLS policies enforce Owner-only write access to promotions
- [ ] RLS policies allow sales persons to insert/update their own postings
- [ ] Indexes created on status, end_date, and foreign keys
- [ ] Expiration alert trigger function created and tested
- [ ] Soft delete pattern implemented consistently
- [ ] Database types regenerated and committed

## Technical References

- **Tech Plan**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/5fd7de40-a5b7-4c37-ae0f-5420b0b52d57` (Data Model section)
- **Pattern Reference**: `file:supabase/migrations/` (existing migration files)
- **Type Generation**: Update `file:database.types.ts`

## Dependencies

None - this is the foundation ticket.