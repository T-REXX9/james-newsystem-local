# Real-time Subscription Patterns

This document describes the real-time subscription architecture implemented in the application using Supabase Realtime.

## Overview

The application uses a **subscription-first architecture** where list-based components subscribe to Supabase Realtime events and apply incremental state updates instead of full re-fetches. This provides instant updates across all connected clients without visible loading states or scroll position resets.

## Architecture

### Core Hooks

#### `useRealtimeSubscription`
Generic hook for subscribing to table changes.

```typescript
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

useRealtimeSubscription({
  tableName: 'contacts',
  callbacks: {
    onInsert: (newItem) => console.log('New item:', newItem),
    onUpdate: (updatedItem) => console.log('Updated item:', updatedItem),
    onDelete: (payload) => console.log('Deleted item:', payload.id),
    onError: (error) => console.error('Subscription error:', error),
  },
  enabled: true,
});
```

#### `useRealtimeList`
Specialized hook for managing list state with real-time updates.

```typescript
import { useRealtimeList } from '../hooks/useRealtimeList';

const { data, isLoading, error, refetch, setData } = useRealtimeList({
  tableName: 'tasks',
  initialFetchFn: fetchTasks,
  sortFn: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  filterFn: (item) => !item.is_deleted,
});
```

#### `useRealtimeNestedList`
Hook for managing parent-child relationships (e.g., sales inquiries with items).

```typescript
import { useRealtimeNestedList } from '../hooks/useRealtimeNestedList';

const { data, isLoading, error } = useRealtimeNestedList({
  parentTableName: 'sales_inquiries',
  childTableName: 'sales_inquiry_items',
  parentFetchFn: getAllSalesInquiries,
  childParentIdField: 'sales_inquiry_id',
  childrenField: 'items',
  sortChildFn: (a, b) => a.line_number - b.line_number,
});
```

### Optimistic Updates

Use optimistic update utilities to provide instant feedback before server confirmation:

```typescript
import { applyOptimisticUpdate, applyOptimisticDelete } from '../utils/optimisticUpdates';

// Optimistic update
const handleStatusChange = async (task: Task, newStatus: string) => {
  setTasks(prev => applyOptimisticUpdate(prev, task.id, { status: newStatus }));
  
  try {
    await updateTask(task.id, { status: newStatus });
  } catch (error) {
    console.error('Error updating task:', error);
    // Real-time subscription will correct the state
  }
};

// Optimistic delete
const handleDelete = async (id: string) => {
  setTasks(prev => applyOptimisticDelete(prev, id));
  
  try {
    await deleteTask(id);
  } catch (error) {
    console.error('Error deleting task:', error);
    // Real-time subscription will correct the state
  }
};
```

## Subscribed Tables

The following tables have real-time subscriptions:

- `contacts` - Customer database
- `products` - Product database
- `tasks` - Task management
- `deals` - Pipeline deals
- `notifications` - User notifications
- `team_messages` - Team chat messages
- `recycle_bin_items` - Deleted items
- `sales_inquiries` + `sales_inquiry_items` - Sales inquiries with nested items
- `sales_orders` + `sales_order_items` - Sales orders with nested items
- `order_slips` + `order_slip_items` - Order slips with nested items
- `invoices` + `invoice_items` - Invoices with nested items

## Component Pattern

### Basic List Component

```typescript
import React from 'react';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { fetchProducts } from '../services/supabaseService';
import { Product } from '../types';

const ProductList: React.FC = () => {
  const { data: products, isLoading } = useRealtimeList<Product>({
    tableName: 'products',
    initialFetchFn: fetchProducts,
    sortFn: (a, b) => a.part_no.localeCompare(b.part_no),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {products.map(product => (
        <div key={product.id}>{product.part_no}</div>
      ))}
    </div>
  );
};
```

### With Filters

```typescript
const filteredData = useMemo(() => {
  return products.filter(p => 
    p.status === 'Active' && 
    p.part_no.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [products, searchQuery]);
```

## Best Practices

1. **Always use optimistic updates** for user-initiated mutations to provide instant feedback
2. **Let real-time events correct state** if optimistic updates fail
3. **Use `useMemo`** for filtered/sorted data to prevent unnecessary re-renders
4. **Use `React.memo()`** for list item components with proper equality checks
5. **Clean up subscriptions** automatically handled by hooks
6. **Handle errors gracefully** with error callbacks
7. **Preserve sort order** by providing `sortFn` to hooks
8. **Apply client-side filters** using `useMemo` on real-time data

## Troubleshooting

### Subscription not receiving events
- Check that Realtime is enabled in Supabase project settings
- Verify table has proper RLS policies
- Check browser console for subscription errors
- Ensure channel name is unique

### Memory leaks
- Hooks automatically clean up subscriptions on unmount
- Check that components using hooks are properly unmounted
- Use `subscriptionManager` for manual subscription tracking

### Duplicate events
- Each subscription creates a unique channel
- Avoid creating multiple subscriptions to the same table in the same component
- Use `useRealtimeList` instead of multiple `useRealtimeSubscription` calls

### State not updating
- Verify callbacks are properly memoized
- Check that `setData` is being called with new array reference
- Ensure sort/filter functions are stable (use `useCallback` if needed)

## Performance Considerations

- Real-time updates only affect items in current view
- Incremental updates prevent full list re-renders
- Memoization prevents unnecessary recalculations
- Optimistic updates provide instant feedback
- Subscriptions automatically reconnect on network issues

