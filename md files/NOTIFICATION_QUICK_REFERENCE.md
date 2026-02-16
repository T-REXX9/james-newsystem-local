# Quick Reference - Notification System Integration Points

## Using Notifications in Your Code

### Import the Hook
```typescript
import { useNotifications } from './components/NotificationProvider';
```

### Access Notifications in Components
```typescript
const { 
  notifications, 
  unreadCount, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  refreshNotifications 
} = useNotifications();
```

## Creating Notifications

### Option 1: Quick Notify Single User
```typescript
import { notifyUser } from './services/supabaseService';

await notifyUser(
  userId,
  'Task Assigned',
  'You have a new task: Follow up with client',
  'info',
  '/tasks'  // action_url - optional
);
```

### Option 2: Notify All Users with Specific Role
```typescript
import { notifyRole } from './services/supabaseService';

await notifyRole(
  'Sales Agent',
  'Weekly Goal Update',
  'New sales targets are now available',
  'info'
);
```

### Option 3: Broadcast to All Users
```typescript
import { notifyAll } from './services/supabaseService';

await notifyAll(
  'System Announcement',
  'Scheduled maintenance tonight 11 PM - 1 AM',
  'warning'
);
```

### Option 4: Detailed Notification Creation
```typescript
import { createNotification } from './services/supabaseService';

await createNotification({
  recipient_id: userId,
  title: 'Discount Request Approved',
  message: '10% volume discount on Castrol products has been approved',
  type: 'success',
  action_url: '/customers',  // optional
  metadata: {                // optional
    customerId: 'cust-123',
    discountPercentage: 10
  }
});
```

## Notification Types & Styling

```
┌─────────────────┬────────────┬──────────────────┐
│ Type            │ Color      │ Icon             │
├─────────────────┼────────────┼──────────────────┤
│ 'info'          │ Blue       │ Info circle      │
│ 'success'       │ Green      │ Check circle     │
│ 'warning'       │ Yellow     │ Alert triangle   │
│ 'error'         │ Red        │ X circle         │
└─────────────────┴────────────┴──────────────────┘
```

## Common Use Cases

### Task Assignment
```typescript
// In services/supabaseService.ts createTask()
async function createTask(task: Omit<Task, 'id'>) {
  // ... create task in database
  
  // Notify assignee
  await notifyUser(
    task.assignedUserId,
    'New Task Assigned',
    `"${task.title}" has been assigned to you`,
    'info',
    '/tasks'
  );
}
```

### Report Approval/Rejection
```typescript
// After report approval
await notifyUser(
  reportSubmitterId,
  'Report Approved',
  'Your sales report has been approved and published',
  'success',
  '/dashboard'
);

// After report rejection
await notifyUser(
  reportSubmitterId,
  'Report Rejected',
  'Your report needs revisions. Please see comments.',
  'error',
  '/dashboard'
);
```

### Discount Request Status
```typescript
// Approved
await notifyUser(
  requestUserId,
  'Discount Request Approved',
  '10% volume discount on Castrol has been approved',
  'success',
  '/customers'
);

// Rejected
await notifyUser(
  requestUserId,
  'Discount Request Denied',
  'Your discount request could not be approved at this time',
  'error',
  '/customers'
);
```

### Contact Update Status
```typescript
// Approved
await notifyUser(
  submitterId,
  'Contact Information Updated',
  'Changes to contact have been saved successfully',
  'success',
  '/customers'
);

// Rejected
await notifyUser(
  submitterId,
  'Contact Update Rejected',
  'Missing verification documents. Please resubmit.',
  'error',
  '/customers'
);
```

### Stock Alerts
```typescript
await notifyRole(
  'Owner',
  'Low Stock Alert',
  'Motul 300V inventory below minimum threshold',
  'warning',
  '/products'
);
```

### System Announcements
```typescript
await notifyAll(
  'System Maintenance',
  'Server maintenance scheduled for Dec 15, 11 PM - 1 AM',
  'info'
);
```

## Component Props

### NotificationProvider
```typescript
<NotificationProvider userId={userProfile.id}>
  {children}
</NotificationProvider>
```

### NotificationCenter
```typescript
// No props needed - uses useNotifications hook internally
<NotificationCenter />
```

## Context Value API

```typescript
interface NotificationContextValue {
  notifications: Notification[];        // All notifications
  unreadCount: number;                 // Count of unread
  isLoading: boolean;                  // Loading state
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}
```

## Type Definitions

```typescript
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: NotificationType;
  action_url?: string;
  metadata?: Record<string, any>;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export interface CreateNotificationInput {
  recipient_id: string;
  title: string;
  message: string;
  type: NotificationType;
  action_url?: string;
  metadata?: Record<string, any>;
}
```

## Database Queries (SQL)

### Get user's unread notifications
```sql
SELECT * FROM notifications 
WHERE recipient_id = $1 AND is_read = false 
ORDER BY created_at DESC;
```

### Mark notification as read
```sql
UPDATE notifications 
SET is_read = true, read_at = NOW() 
WHERE id = $1 AND recipient_id = auth.uid();
```

### Get unread count
```sql
SELECT COUNT(*) FROM notifications 
WHERE recipient_id = $1 AND is_read = false;
```

### Delete notification
```sql
DELETE FROM notifications 
WHERE id = $1 AND recipient_id = auth.uid();
```

## Real-Time Subscription

The system automatically subscribes to `postgres_changes` events on the notifications table:

```typescript
channel
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_id=eq.${userId}`
    },
    (payload) => callback(payload.new)
  )
  .subscribe();
```

This means:
- New notifications appear instantly
- Badge count updates automatically
- No page refresh needed
- Works across multiple browser tabs

## Testing the System

### Manual Testing Steps

1. **Create a Notification**
   ```typescript
   // In browser console:
   const { notifyUser } = await import('./services/supabaseService.js');
   await notifyUser('user_admin_001', 'Test', 'This is a test notification', 'info');
   ```

2. **Check Notifications Appear**
   - Look for bell icon badge count increase
   - Click bell icon to see notification

3. **Test Real-Time Updates**
   - Open app in two tabs with same user
   - Create notification in one tab
   - Verify it appears in both tabs instantly

4. **Test Mark as Read**
   - Click on unread notification
   - Verify badge count decreases
   - Verify notification moves to read section

5. **Test Delete**
   - Click trash icon on notification
   - Verify notification disappears

## Troubleshooting

### Notifications not appearing?
- Check user is authenticated (wrapped in NotificationProvider)
- Check browser console for errors
- Verify userId is passed correctly to NotificationProvider

### Real-time updates not working?
- Check browser console for subscription errors
- Verify Supabase client is initialized correctly
- Check RLS policies on notifications table

### Badge count not updating?
- Check notifications are being fetched on mount
- Verify getUnreadCount returns correct value
- Check real-time subscription is active

## Performance Notes

- Notifications are paginated (default 50 per request)
- Unread count is cached in context
- Real-time subscriptions are per-user
- Database indexes optimize common queries
- RLS policies prevent fetching unauthorized data

## Security Reminders

- RLS policies prevent users from accessing others' notifications
- All notification mutations are validated server-side
- Action URLs are user-controlled but safe
- Metadata is optional and can contain any JSON data
- Never store sensitive data in notification messages or metadata
