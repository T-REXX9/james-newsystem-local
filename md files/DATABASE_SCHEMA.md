# Customer Database Enhancements - Database Schema

## Table Structure Overview

### 1. personal_comments
Stores personal notes and comments about customers after interactions.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- author_id (UUID, FK → auth.users)
- author_name (TEXT)
- author_avatar (TEXT)
- text (TEXT, NOT NULL)
- timestamp (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id (for fast lookup by customer)
- author_id (for user's own comments)

**Relationships**:
- One comment belongs to one contact
- One contact has many comments

---

### 2. sales_reports
Tracks sales transactions with approval workflow.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- date (DATE, NOT NULL)
- time (TIME, NOT NULL)
- products (JSONB)
  └─ Array of {name, quantity, price}
- total_amount (DECIMAL, NOT NULL)
- currency (TEXT, DEFAULT 'PHP')
- sales_agent (TEXT, NOT NULL)
- approval_status (TEXT: 'pending'|'approved'|'rejected')
- approved_by (UUID, FK → auth.users)
- approval_date (TIMESTAMP)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id
- approval_status (for filtering pending reports)

**Workflow**:
1. Agent creates report (status = pending)
2. Manager approves/rejects
3. Finance views approved reports

---

### 3. discount_requests
Handles customer discount request submissions.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- inquiry_id (UUID, FK → inquiries, NULLABLE)
- request_date (DATE, NOT NULL)
- discount_percentage (DECIMAL(5,2), 1-100)
- reason (TEXT, NOT NULL)
- status (TEXT: 'pending'|'approved'|'rejected')
- approved_by (UUID, FK → auth.users)
- approval_date (TIMESTAMP)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id
- status

**Usage**:
- Staff submit discount requests
- Managers approve/reject
- Finance tracks approved discounts

---

### 4. updated_contact_details
Tracks requests to update customer information.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- changed_fields (JSONB)
  └─ {fieldName: {oldValue: any, newValue: any}}
- submitted_by (UUID, FK → auth.users, NOT NULL)
- submitted_date (TIMESTAMP)
- approval_status (TEXT: 'pending'|'approved'|'rejected')
- approved_by (UUID, FK → auth.users)
- approval_date (TIMESTAMP)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id
- approval_status

**Example changed_fields**:
```json
{
  "address": {"oldValue": "123 Main St", "newValue": "456 Oak Ave"},
  "priceGroup": {"oldValue": "AA", "newValue": "BB"},
  "contact_person": {"oldValue": "John", "newValue": "Jane"}
}
```

---

### 5. sales_progress
Monitors deal progression from inquiry to close.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- inquiry_date (DATE, NOT NULL)
- inquiry (TEXT, NOT NULL)
- stage (TEXT, NOT NULL)
  └─ Enum: NEW, DISCOVERY, QUALIFIED, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST
- stage_changed_date (TIMESTAMP)
- expected_closure_date (DATE)
- outcome (TEXT: 'closed_won'|'closed_lost'|NULL)
- outcome_date (TIMESTAMP)
- lost_reason (TEXT)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id
- stage (for pipeline reports)

**Pipeline Tracking**:
- Tracks progression from inquiry → closed
- Timestamps for each stage change
- Reasons for lost deals

---

### 6. incident_reports
Customer complaint documentation and approval.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- report_date (DATE, NOT NULL)
- incident_date (DATE, NOT NULL)
- issue_type (TEXT: 'product_quality'|'service_quality'|'delivery'|'other')
- description (TEXT, NOT NULL)
- reported_by (TEXT, NOT NULL)
- attachments (TEXT[])
  └─ Array of file URLs
- approval_status (TEXT: 'pending'|'approved'|'rejected')
- approved_by (UUID, FK → auth.users)
- approval_date (TIMESTAMP)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id
- approval_status

**Workflow**:
1. Staff files incident
2. Manager approves (status = approved)
3. Creates associated sales_return entry
4. Finance processes refund

---

### 7. sales_returns
Processes product returns linked to incidents.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- incident_report_id (UUID, FK → incident_reports, NOT NULL)
- return_date (DATE, NOT NULL)
- products (JSONB)
  └─ Array of {name, quantity, originalPrice, refundAmount}
- total_refund (DECIMAL, NOT NULL)
- currency (TEXT, DEFAULT 'PHP')
- reason (TEXT, NOT NULL)
- status (TEXT: 'processed'|'pending')
- processed_by (UUID, FK → auth.users)
- processed_date (TIMESTAMP)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id
- incident_report_id
- status

**Relationship**:
- One incident → One return (usually)
- Some incidents may have multiple returns

---

### 8. purchase_history
Complete transaction record for customers.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- purchase_date (DATE, NOT NULL)
- products (JSONB)
  └─ Array of {name, quantity, price}
- total_amount (DECIMAL, NOT NULL)
- currency (TEXT, DEFAULT 'PHP')
- payment_status (TEXT: 'paid'|'pending'|'overdue')
- invoice_number (TEXT)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id
- payment_status
- purchase_date (for chronological queries)

**Usage**:
- Revenue tracking
- Payment follow-up
- Customer lifetime value calculation

---

### 9. inquiry_history
Lead inquiry tracking and conversion metrics.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- inquiry_date (DATE, NOT NULL)
- product (TEXT, NOT NULL)
- quantity (INTEGER, NOT NULL)
- status (TEXT: 'converted'|'pending'|'cancelled')
- converted_to_purchase (BOOLEAN, DEFAULT FALSE)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id
- status
- inquiry_date

**Metrics**:
- Total inquiries per customer
- Conversion rate calculation
- Product popularity

---

### 10. payment_terms
Track customer payment arrangements.

```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- terms_type (TEXT: 'cash'|'credit'|'installment')
- credit_days (INTEGER)
  └─ For credit terms
- installment_months (INTEGER)
  └─ For installment terms
- start_date (DATE, NOT NULL)
- end_date (DATE)
- status (TEXT: 'active'|'expired'|'upgraded'|'downgraded')
- previous_terms (TEXT)
  └─ For historical reference
- changed_date (TIMESTAMP)
- changed_by (UUID, FK → auth.users)
- reason (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id
- status (for filtering active/expired)

**Historical Tracking**:
- Maintains all term changes
- Shows upgrade/downgrade history
- Audit trail of who changed terms

---

### 11. customer_metrics (Aggregate Table)
Summary/calculated metrics for quick access.

```sql
- id (UUID, PK)
- contact_id (UUID, UNIQUE, FK → contacts)
- average_monthly_purchase (DECIMAL, DEFAULT 0)
- purchase_frequency (INTEGER, DEFAULT 0)
  └─ Days between purchases
- outstanding_balance (DECIMAL, DEFAULT 0)
- total_purchases (INTEGER, DEFAULT 0)
- last_purchase_date (DATE)
- average_order_value (DECIMAL, DEFAULT 0)
- currency (TEXT, DEFAULT 'PHP')
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Indexes**:
- contact_id (UNIQUE)

**Update Pattern** (Upsert):
```typescript
// Check if exists
if (existing) {
  UPDATE customer_metrics WHERE contact_id = ?
} else {
  INSERT INTO customer_metrics (contact_id, ...)
}
```

**Usage**:
- Dashboard KPIs
- Customer segmentation
- Sales performance tracking

---

## Data Relationships

```
contacts (1)
    ├─→ (M) personal_comments
    ├─→ (M) sales_reports
    ├─→ (M) discount_requests
    ├─→ (M) updated_contact_details
    ├─→ (M) sales_progress
    ├─→ (M) incident_reports
    │   └─→ (M) sales_returns
    ├─→ (M) purchase_history
    ├─→ (M) inquiry_history
    ├─→ (M) payment_terms
    └─→ (1) customer_metrics
```

---

## Foreign Key Relationships

| Table | Foreign Key | References | On Delete |
|-------|-------------|-----------|-----------|
| personal_comments | contact_id | contacts.id | CASCADE |
| personal_comments | author_id | auth.users.id | SET NULL |
| sales_reports | contact_id | contacts.id | CASCADE |
| sales_reports | approved_by | auth.users.id | SET NULL |
| discount_requests | contact_id | contacts.id | CASCADE |
| discount_requests | approved_by | auth.users.id | SET NULL |
| updated_contact_details | contact_id | contacts.id | CASCADE |
| updated_contact_details | submitted_by | auth.users.id | SET NULL |
| updated_contact_details | approved_by | auth.users.id | SET NULL |
| sales_progress | contact_id | contacts.id | CASCADE |
| incident_reports | contact_id | contacts.id | CASCADE |
| incident_reports | approved_by | auth.users.id | SET NULL |
| sales_returns | contact_id | contacts.id | CASCADE |
| sales_returns | incident_report_id | incident_reports.id | RESTRICT |
| sales_returns | processed_by | auth.users.id | SET NULL |
| purchase_history | contact_id | contacts.id | CASCADE |
| inquiry_history | contact_id | contacts.id | CASCADE |
| payment_terms | contact_id | contacts.id | CASCADE |
| payment_terms | changed_by | auth.users.id | SET NULL |
| customer_metrics | contact_id | contacts.id | CASCADE |

---

## Index Strategy

### Lookup Indexes (Frequently Used)
- All tables have index on `contact_id`
- Enables quick retrieval of all records for a customer

### Status Indexes (Filtering)
- `sales_reports(approval_status)`
- `discount_requests(status)`
- `updated_contact_details(approval_status)`
- `incident_reports(approval_status)`
- `purchase_history(payment_status)`
- `inquiry_history(status)`
- `payment_terms(status)`

### Date Indexes (Sorting)
- Various date fields for chronological queries
- Improves performance for "order by date" queries

---

## JSONB Field Structures

### products (sales_reports, sales_returns, purchase_history)
```json
[
  {
    "name": "Product Name",
    "quantity": 5,
    "price": 1000
  }
]
```

### changed_fields (updated_contact_details)
```json
{
  "fieldName": {
    "oldValue": "previous",
    "newValue": "updated"
  }
}
```

### products in sales_returns
```json
[
  {
    "name": "Product Name",
    "quantity": 3,
    "originalPrice": 1000,
    "refundAmount": 3000
  }
]
```

---

## Query Examples

### Get Customer Metrics
```sql
SELECT * FROM customer_metrics WHERE contact_id = ?
```

### Get Pending Approvals
```sql
SELECT * FROM sales_reports WHERE approval_status = 'pending'
ORDER BY created_at DESC
```

### Customer Purchase Timeline
```sql
SELECT * FROM purchase_history 
WHERE contact_id = ? 
ORDER BY purchase_date DESC
```

### Calculate Conversion Rate
```sql
SELECT 
  COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted,
  COUNT(*) as total,
  ROUND(COUNT(CASE WHEN status = 'converted' THEN 1 END)::numeric / COUNT(*) * 100, 2) as conversion_rate
FROM inquiry_history
WHERE contact_id = ?
```

### Recent Incident with Return Status
```sql
SELECT 
  ir.*,
  sr.status as return_status,
  sr.total_refund
FROM incident_reports ir
LEFT JOIN sales_returns sr ON ir.id = sr.incident_report_id
WHERE ir.contact_id = ?
ORDER BY ir.report_date DESC
LIMIT 10
```

---

## Migration Execution

To apply all these tables:

```bash
# Using Supabase CLI
supabase db push

# Or manually run:
# 006_create_customer_enhancements.sql
```

---

## Backup & Recovery

Recommended backup strategy:
1. Daily automated backups via Supabase
2. Export critical tables (customer_metrics, sales_reports)
3. Version control migration files in git
4. Maintain changelog of schema modifications

---

## Performance Considerations

1. **Partitioning**: Consider partitioning purchase_history by date if > 1M rows
2. **Caching**: Use customer_metrics table for dashboard queries
3. **Archiving**: Archive old records to separate tables if needed
4. **Batch Operations**: Use batch inserts for bulk data loads
5. **Query Optimization**: Monitor slow queries in Supabase dashboard

---

**Schema Version**: 006
**Created**: December 2025
**Status**: Production Ready
