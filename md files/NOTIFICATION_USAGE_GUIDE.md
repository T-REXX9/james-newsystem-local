# Notification Usage Guide

## Overview

The notification system provides simple functions to create and send notifications to users. Notifications are persistent, real-time, and support multiple notification types.

## Quick Start

### Import the Functions

```typescript
import {
  notifyUser,
  notifyRole,
  notifyAll,
  createNotification
} from './services/supabaseService';
```

## Common Use Cases

### 1. Send Notification to Single User

```typescript
await notifyUser(
  userId,
  'Task Assigned',
  'You have been assigned a new task: Follow up with client',
  'info',
  '/tasks'  // Optional: navigation URL
);
```

**Parameters:**
- `userId` (string) - The user's ID
- `title` (string) - Notification title
- `message` (string) - Notification message
- `type` (NotificationType) - One of: 'info', 'success', 'warning', 'error'
- `actionUrl` (string, optional) - URL to navigate to when clicked

---

### 2. Send Notification to All Users with a Specific Role

```typescript
await notifyRole(
  'Sales Agent',
  'Weekly Goal Update',
  'New sales targets for this week are now available',
  'info'
);
```

**Parameters:**
- `role` (string) - The user role ('Sales Agent', 'Manager', 'Owner', etc.)
- `title` (string) - Notification title
- `message` (string) - Notification message
- `type` (NotificationType) - One of: 'info', 'success', 'warning', 'error'
- `actionUrl` (string, optional) - URL to navigate to

---

### 3. Broadcast Notification to All Users

```typescript
await notifyAll(
  'System Maintenance',
  'Server maintenance scheduled for tonight 11 PM - 1 AM',
  'warning'
);
```

**Parameters:**
- `title` (string) - Notification title
- `message` (string) - Notification message
- `type` (NotificationType) - One of: 'info', 'success', 'warning', 'error'
- `actionUrl` (string, optional) - URL to navigate to

---

### 4. Create Detailed Notification with Metadata

```typescript
await createNotification({
  recipient_id: userId,
  title: 'Discount Request Approved',
  message: '10% volume discount on Castrol products has been approved',
  type: 'success',
  action_url: '/customers',
  metadata: {
    customerId: 'cust-123',
    discountPercentage: 10,
    approvedBy: 'admin_id'
  }
});
```

**Parameters:**
- `recipient_id` (string) - The user's ID
- `title` (string) - Notification title
- `message` (string) - Notification message
- `type` (NotificationType) - One of: 'info', 'success', 'warning', 'error'
- `action_url` (string, optional) - URL to navigate to
- `metadata` (object, optional) - Any custom JSON data

---

## Notification Types

| Type | Color | Use Case |
|------|-------|----------|
| `'info'` | Blue | General information, task assignments |
| `'success'` | Green | Approvals, completed actions |
| `'warning'` | Yellow | Alerts, low stock, pending actions |
| `'error'` | Red | Rejections, failures, issues |

---

## Real-World Examples

### Task Assignment

```typescript
// In your task creation function
async function createTask(task: Task, assignedUserId: string) {
  // Create the task in database...
  
  // Send notification to assignee
  await notifyUser(
    assignedUserId,
    'New Task Assigned',
    `"${task.title}" has been assigned to you. Due: ${task.dueDate}`,
    'info',
    '/tasks'
  );
}
```

### Report Approval

```typescript
// When owner approves a report
async function approveReport(reportId: string, submitterId: string) {
  // Update report status...
  
  await notifyUser(
    submitterId,
    'Report Approved',
    'Your November sales report has been approved and published',
    'success',
    '/dashboard'
  );
}
```

### Report Rejection

```typescript
// When report is rejected
async function rejectReport(reportId: string, submitterId: string, reason: string) {
  // Update report status...
  
  await notifyUser(
    submitterId,
    'Report Needs Revision',
    `Your report needs changes: ${reason}`,
    'error',
    '/dashboard'
  );
}
```

### Stock Alert

```typescript
// When product inventory is low
async function checkStockLevels() {
  const lowStockProducts = await getProductsBelowThreshold();
  
  if (lowStockProducts.length > 0) {
    await notifyRole(
      'Owner',
      'Low Stock Alert',
      `${lowStockProducts.length} products are below minimum stock levels`,
      'warning',
      '/products'
    );
  }
}
```

### Discount Request

```typescript
// When discount request is approved
async function approveDiscountRequest(requestId: string, requestUserId: string, percentage: number) {
  // Approve the request...
  
  await notifyUser(
    requestUserId,
    'Discount Request Approved',
    `Your ${percentage}% discount request has been approved`,
    'success',
    '/customers'
  );
}
```

### System Announcement

```typescript
// Broadcast to all users
async function announceScheduledMaintenance(date: string, duration: string) {
  await notifyAll(
    'Scheduled Maintenance',
    `System maintenance on ${date} for ${duration}. Plan accordingly.`,
    'warning'
  );
}
```

### Contact Update Status

```typescript
// After contact information is approved
async function approveContactUpdate(submitterId: string, contactName: string) {
  await notifyUser(
    submitterId,
    'Contact Updated',
    `Information for ${contactName} has been updated successfully`,
    'success',
    '/customers'
  );
}

// After contact update is rejected
async function rejectContactUpdate(submitterId: string, reason: string) {
  await notifyUser(
    submitterId,
    'Contact Update Rejected',
    `Update rejected: ${reason}. Please resubmit with corrections.`,
    'error',
    '/customers'
  );
}
```

---

## Using Notifications in Components

### Access Notifications with Hook

```typescript
import { useNotifications } from './components/NotificationProvider';

function MyComponent() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    deleteNotification 
  } = useNotifications();

  return (
    <div>
      <p>Unread: {unreadCount}</p>
      {notifications.map(notif => (
        <div key={notif.id}>
          <h3>{notif.title}</h3>
          <p>{notif.message}</p>
          <button onClick={() => markAsRead(notif.id)}>Read</button>
          <button onClick={() => deleteNotification(notif.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

---

## Best Practices

1. **Keep messages concise** - Notifications should be quick to read
2. **Use appropriate types** - Match notification type to the action (success for wins, error for failures)
3. **Include action URLs** - Help users navigate directly to relevant content
4. **Avoid duplicate notifications** - Check if notification already exists before sending
5. **Use metadata for context** - Store IDs or details needed when notification is clicked
6. **Test in real-time** - Open app in multiple tabs to verify real-time updates

---

## Notification Display

Notifications appear in the bell icon (🔔) in the top-right corner of the app. Users can:
- Click to mark as read
- Delete individual notifications
- Mark all as read
- See unread count in the badge

---

## Type Definitions

```typescript
type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface Notification {
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

interface CreateNotificationInput {
  recipient_id: string;
  title: string;
  message: string;
  type: NotificationType;
  action_url?: string;
  metadata?: Record<string, any>;
}
```

---

## Troubleshooting

### Notifications not appearing?
- Verify user is logged in (NotificationProvider requires userId)
- Check browser console for errors
- Ensure userId is correct

### Real-time not updating?
- Check browser console for subscription errors
- Verify Supabase connection is active
- Check that user has correct RLS permissions

### Wrong notification type styling?
- Ensure type is one of: 'info', 'success', 'warning', 'error'
- Check that type string matches exactly (lowercase)
