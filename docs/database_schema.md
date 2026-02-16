Profiles Table Schema:
```
Table: public.profiles
├── id (uuid, PK, FK → auth.users.id)
├── email (text)
├── full_name (text)
├── avatar_url (text)
├── role (text)
├── access_rights (text[])
├── birthday (text)
├── mobile (text)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

RLS Policies:
- SELECT: Public (all users can view all profiles)
- INSERT: Self-only (users can only insert their own profile)
- UPDATE: Self-only (users can only update their own profile)

Trigger Behavior:
- Automatically creates profile when user signs up via `auth.signUp()`
- Extracts metadata from `raw_user_meta_data` field
- Default permissions: `['dashboard', 'pipelines', 'mail', 'calendar', 'tasks']`

Migration Reference:
- File: `supabase/migrations/001_create_profiles_table.sql`
- File: `supabase/migrations/002_adjust_profiles_table.sql`
- Applied: via MCP migration `adjust_profiles_table` (profiles table existed already)

Service Layer:
- Primary creation path now uses `createStaffAccount()` in `services/supabaseService.ts`
- Responsibilities: validate input, generate avatar URLs, call `auth.signUp()`, verify profile trigger execution, and fall back to manual profile insert if needed
- Default values sourced from `constants.ts` (`DEFAULT_STAFF_ACCESS_RIGHTS`, `DEFAULT_STAFF_ROLE`, `STAFF_ROLES`, `generateAvatarUrl`)

New Trigger Logging:
- Migration `supabase/migrations/005_enhance_profile_trigger.sql` adds `profile_creation_logs` to capture trigger success/errors with metadata
- Trigger now validates email format, logs failures, and remains idempotent with `ON CONFLICT`

Usage Example:
```ts
import { createStaffAccount } from '../services/supabaseService';

await createStaffAccount({
  email: 'agent@example.com',
  password: 'StrongPass1!',
  fullName: 'New Agent',
  role: 'Sales Agent',
  mobile: '09171234567',
  birthday: '1990-01-01'
});
```

---

Data Sanitization Rules (App Layer)

Overview:
- The service layer now applies placeholder values before insert/update to prevent null/empty strings from reaching the database.
- Required fields still validate and will block submissions when empty.

Placeholder Defaults:
- Text (optional): "n/a"
- Numeric (optional): 0
- Date (optional): null (dates remain nullable unless required)

Field-Level Rules (Selected Entities):
- Contacts
  - company: required (no placeholder)
  - address, deliveryAddress, province, city, area, tin, businessLine, terms, transactionType, vatType, vatPercentage, dealershipTerms, dealershipSince, comment: "n/a"
  - creditLimit, dealershipQuota, dealValue: 0
  - email, phone, mobile: "n/a"
  - contactPersons[]: each field defaults to "n/a" when blank
- Products
  - part_no, description: required (no placeholder)
  - item_code, oem_no, brand, category: "n/a"
  - cost, price_aa, price_bb, price_cc, price_dd, price_vip1, price_vip2: 0
- Sales Orders / Sales Inquiries
  - sales_date: required
  - delivery_address, reference_no, customer_reference, send_by, price_group, terms, promise_to_pay, po_number, remarks, inquiry_type, urgency: "n/a"
  - credit_limit: 0

Nullable Fields That Remain Nullable:
- Optional date fields such as urgency_date remain null when not provided.
- Attachments/related transaction arrays remain undefined unless supplied.

Migration Guidance (Existing Data):
- Existing null/empty text fields can be updated to "n/a" via bulk update scripts as needed.
- Numeric nulls can be set to 0 when the field is optional and numeric by design.
- Required fields should be backfilled with real values; do not replace required fields with placeholders.
