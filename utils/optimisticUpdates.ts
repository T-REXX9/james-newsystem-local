/**
 * Optimistic update utilities for real-time list management
 */

export function applyOptimisticInsert<T>(
  list: T[],
  item: T,
  sortFn?: (a: T, b: T) => number
): T[] {
  const updated = [...list, item];
  return sortFn ? updated.sort(sortFn) : updated;
}

export function applyOptimisticUpdate<T extends { id: string }>(
  list: T[],
  id: string,
  updates: Partial<T>
): T[] {
  return list.map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );
}

export function applyOptimisticDelete<T extends { id: string }>(
  list: T[],
  id: string
): T[] {
  return list.filter((item) => item.id !== id);
}

export function rollbackOptimisticUpdate<T>(
  currentList: T[],
  originalList: T[]
): T[] {
  return [...originalList];
}

/**
 * Apply multiple optimistic updates in sequence
 */
export function applyOptimisticBulkUpdate<T extends { id: string }>(
  list: T[],
  updates: Array<{ id: string; updates: Partial<T> }>
): T[] {
  return list.map((item) => {
    const update = updates.find((u) => u.id === item.id);
    return update ? { ...item, ...update.updates } : item;
  });
}

/**
 * Apply optimistic bulk delete
 */
export function applyOptimisticBulkDelete<T extends { id: string }>(
  list: T[],
  ids: string[]
): T[] {
  const idSet = new Set(ids);
  return list.filter((item) => !idSet.has(item.id));
}

