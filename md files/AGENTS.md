# Repository Guidelines for Agentic Coding Agents

## Commands
- `npm install` — install dependencies
- `npm run dev` — dev server on localhost:8080
- `npm run build` — production build to dist/
- `npm run test` — run all tests
- `npm run test -- filename` — run single test file
- `npm run preview` — serve production build locally

## Code Style
- TypeScript, functional React components with `React.FC<Props>`
- 2-space indentation, single quotes, PascalCase components, camelCase functions
- Import order: React → third-party → local components → services → types/constants
- Tailwind classes inline, no CSS modules
- Error handling with try/catch, console.error for debugging
- Use services layer for data access (Supabase)
- Props from types.ts when possible

## Testing
- Place tests beside components: `Component.test.tsx`
- Use react-testing-library, mock services with `vi.mock()`
- Test empty states, error states, and user interactions

## Structure
- components/ for UI, services/ for data logic, types.ts for models
- constants.ts for mock data and fixtures
- Never edit dist/ directly

## Real-time Subscription Patterns

All list-based features should use real-time subscriptions for instant updates across clients.

### Using `useRealtimeList` Hook

For simple list components, use the `useRealtimeList` hook:

```typescript
import { useRealtimeList } from '../hooks/useRealtimeList';
import { fetchItems } from '../services/supabaseService';

const { data, isLoading, setData } = useRealtimeList({
  tableName: 'items',
  initialFetchFn: fetchItems,
  sortFn: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
});
```

### Optimistic Updates

Always apply optimistic updates for user-initiated mutations:

```typescript
import { applyOptimisticUpdate, applyOptimisticDelete } from '../utils/optimisticUpdates';

// Update
setData(prev => applyOptimisticUpdate(prev, id, { status: 'Done' }));
await updateItem(id, { status: 'Done' });

// Delete
setData(prev => applyOptimisticDelete(prev, id));
await deleteItem(id);
```

### Client-side Filtering

Apply filters using `useMemo` on real-time data:

```typescript
const filteredData = useMemo(() => {
  return data.filter(item => item.status === 'Active');
}, [data]);
```

### Nested Data (Parent-Child)

For tables with parent-child relationships, use `useRealtimeNestedList`:

```typescript
import { useRealtimeNestedList } from '../hooks/useRealtimeNestedList';

const { data } = useRealtimeNestedList({
  parentTableName: 'orders',
  childTableName: 'order_items',
  parentFetchFn: fetchOrders,
  childParentIdField: 'order_id',
  childrenField: 'items',
});
```

### Guidelines

1. **Never call `loadData()` after mutations** - real-time subscriptions handle updates
2. **Always use optimistic updates** for instant user feedback
3. **Use `useMemo`** for derived data (filters, sorts, aggregations)
4. **Use `React.memo()`** for list item components to prevent unnecessary re-renders
5. **Let real-time events correct state** if optimistic updates fail
6. **Preserve scroll position** by using incremental updates instead of full re-fetches

See `docs/REALTIME_PATTERNS.md` for detailed documentation.
