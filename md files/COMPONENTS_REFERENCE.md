# New Components Reference Guide

## Component Inventory

### 1. CustomerMetricsView.tsx
**Purpose**: Display customer financial metrics and KPIs

**Props**:
- `contactId: string` - Customer ID

**Key Features**:
- Average monthly purchase calculation
- Purchase frequency tracking (days)
- Outstanding balance display
- Total purchases count
- Average order value
- Metric cards with color-coded indicators

**Usage**:
```tsx
<CustomerMetricsView contactId={customerId} />
```

---

### 2. SalesReportTab.tsx
**Purpose**: View and approve sales reports

**Props**:
- `contactId: string` - Customer ID
- `currentUserId?: string` - Current user ID for approvals
- `onApprove?: (reportId: string) => void` - Callback on approval

**Key Features**:
- List sales reports by date
- Show products and total amount
- Approval/rejection buttons for pending reports
- Status badges (pending/approved/rejected)
- Notes field for context

**Usage**:
```tsx
<SalesReportTab 
  contactId={customerId} 
  currentUserId={userId}
  onApprove={handleApproved}
/>
```

---

### 3. IncidentReportTab.tsx
**Purpose**: File and track customer incident/complaint reports

**Props**:
- `contactId: string` - Customer ID
- `currentUserId?: string` - Current user ID

**Key Features**:
- List all incidents by date
- Issue type badges (color-coded)
- Description and reported by info
- Attachment support
- Approval workflow with audit trail
- Links to sales returns

**Usage**:
```tsx
<IncidentReportTab 
  contactId={customerId} 
  currentUserId={userId}
/>
```

---

### 4. SalesReturnTab.tsx
**Purpose**: Process and track product returns

**Props**:
- `contactId: string` - Customer ID
- `currentUserId?: string` - Current user ID

**Key Features**:
- List returns linked to incident reports
- Show returned products with refund amounts
- Status tracking (pending/processed)
- Process button to mark as completed
- Refund amount display
- Reason for return

**Usage**:
```tsx
<SalesReturnTab 
  contactId={customerId} 
  currentUserId={userId}
/>
```

---

### 5. PurchaseHistoryTab.tsx
**Purpose**: View customer purchase transaction history

**Props**:
- `contactId: string` - Customer ID

**Key Features**:
- Complete purchase timeline
- Invoice numbers and links
- Payment status indicators (paid/pending/overdue)
- Product details per transaction
- Total purchase value summary
- Notes field for context

**Usage**:
```tsx
<PurchaseHistoryTab contactId={customerId} />
```

---

### 6. InquiryHistoryTab.tsx
**Purpose**: Track customer inquiries and conversion metrics

**Props**:
- `contactId: string` - Customer ID

**Key Features**:
- Inquiry history with dates
- Product and quantity tracking
- Status (converted/pending/cancelled)
- Conversion rate calculation
- Conversion metrics summary
- Notes for each inquiry

**Usage**:
```tsx
<InquiryHistoryTab contactId={customerId} />
```

---

### 7. PersonalCommentsTab.tsx
**Purpose**: Add and view personal comments about customers

**Props**:
- `contactId: string` - Customer ID
- `currentUserId?: string` - Current user ID
- `currentUserName?: string` - Current user's full name
- `currentUserAvatar?: string` - Current user's avatar URL

**Key Features**:
- Add new comments with form
- View all comments in chronological order
- Author info with avatar
- Timestamp for all comments
- Comment thread interface
- Real-time comment updates

**Usage**:
```tsx
<PersonalCommentsTab 
  contactId={customerId}
  currentUserId={userId}
  currentUserName="John Doe"
  currentUserAvatar={avatarUrl}
/>
```

---

### 8. UpdateContactApprovalModal.tsx
**Purpose**: Modal for approving contact information updates

**Props**:
- `contact: Contact` - Contact object
- `isOpen: boolean` - Modal visibility
- `onClose: () => void` - Close callback
- `currentUserId?: string` - Current user ID for approval
- `onApprove?: () => void` - Approval callback

**Key Features**:
- Shows pending update requests
- Displays old vs new values side-by-side
- Field-level change tracking
- Approval/rejection buttons
- Submission tracking (who, when)
- Approved updates history

**Usage**:
```tsx
<UpdateContactApprovalModal
  contact={contact}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  currentUserId={userId}
  onApprove={handleApprove}
/>
```

---

### 9. DiscountRequestModal.tsx
**Purpose**: Modal for requesting customer discounts

**Props**:
- `contactId: string` - Customer ID
- `isOpen: boolean` - Modal visibility
- `onClose: () => void` - Close callback
- `inquiryId?: string` - Optional inquiry ID
- `onSuccess?: () => void` - Success callback

**Key Features**:
- Discount percentage input (1-100%)
- Reason field (required)
- Form validation
- Submit for approval
- Error handling
- Info message about approval workflow

**Usage**:
```tsx
<DiscountRequestModal
  contactId={customerId}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  inquiryId={inquiryId}
  onSuccess={() => {
    // Refresh data
  }}
/>
```

---

## Integration in ContactDetails

All components are integrated into the `ContactDetails.tsx` component via a tab system:

```tsx
// Tab Navigation
{tabs.map(tab => (
  <button
    onClick={() => setActiveTab(tab.id)}
    className={activeTab === tab.id ? 'active' : ''}
  >
    {tab.label}
  </button>
))}

// Tab Content
{activeTab === 'Metrics' && <CustomerMetricsView contactId={contact.id} />}
{activeTab === 'SalesReports' && <SalesReportTab contactId={contact.id} />}
// ... etc
```

---

## Data Flow

### Create Operations
```
Component Form Submit
    ↓
Service Function (create*)
    ↓
Supabase Insert
    ↓
Local State Update
```

### Approval Workflow
```
Submit Request
    ↓
Status = "pending"
    ↓
Manager Reviews
    ↓
updateApproval() called
    ↓
Status = "approved" or "rejected"
    ↓
UI Updates with audit info
```

### Read Operations
```
useEffect on contactId change
    ↓
fetch* Service Function
    ↓
Sort/Filter Data
    ↓
setData() to State
    ↓
Component Renders List
```

---

## Error Handling

All components include try-catch error handling:
- Console.error for debugging
- User-friendly fallback messages
- Loading states for async operations
- Disabled buttons during submission

---

## Styling

All components follow the existing design system:
- **Color Scheme**: Slate, brand-blue, emerald, yellow, rose, orange
- **Icons**: lucide-react icons
- **Layout**: Tailwind CSS with dark mode support
- **Consistency**: Card-based design with borders and shadows

---

## Performance Considerations

1. **Lazy Loading**: Data loads only when tab is clicked
2. **Pagination**: Not yet implemented - consider for large datasets
3. **Caching**: Service functions fetch fresh data each time
4. **Scrolling**: Custom scrollbar for better UX
5. **Rendering**: Memoization could be added for large lists

---

## Future Enhancements

1. Add pagination to history tabs
2. Implement data filtering/search
3. Add export functionality (CSV/PDF)
4. Real-time updates with subscriptions
5. Bulk operations (approve multiple reports)
6. Analytics and trending data
7. Integration with email notifications
8. Mobile-responsive improvements
