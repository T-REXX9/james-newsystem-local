import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRealtimeSubscription, RealtimeCallbacks } from './useRealtimeSubscription';

export interface UseRealtimeListOptions<T> {
  tableName: string;
  initialFetchFn: () => Promise<T[]>;
  sortFn?: (a: T, b: T) => number;
  filterFn?: (item: T) => boolean;
  enabled?: boolean;
  idField?: keyof T;
}

export function useRealtimeList<T extends { id: string }>({
  tableName,
  initialFetchFn,
  sortFn,
  filterFn,
  enabled = true,
  idField = 'id' as keyof T,
}: UseRealtimeListOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initial data fetch
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await initialFetchFn();
      const sorted = sortFn ? [...result].sort(sortFn) : result;
      setData(sorted);
    } catch (err) {
      console.error(`Error fetching ${tableName}:`, err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [initialFetchFn, tableName]);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [fetchData, enabled]);

  // Real-time event handlers
  const handleInsert = useCallback((newItem: T) => {
    setData((prevData) => {
      const updated = [...prevData, newItem];
      return sortFn ? updated.sort(sortFn) : updated;
    });
  }, [sortFn]);

  const handleUpdate = useCallback((updatedItem: T) => {
    setData((prevData) => {
      const index = prevData.findIndex((item) => item[idField] === updatedItem[idField]);
      if (index === -1) {
        // Item not found, might be a new item that matches our filter
        const updated = [...prevData, updatedItem];
        return sortFn ? updated.sort(sortFn) : updated;
      }
      
      const updated = [...prevData];
      updated[index] = updatedItem;
      
      // Re-sort if sort function provided and sort key might have changed
      return sortFn ? updated.sort(sortFn) : updated;
    });
  }, [idField, sortFn]);

  const handleDelete = useCallback((payload: { id: string }) => {
    setData((prevData) => prevData.filter((item) => item[idField] !== payload.id));
  }, [idField]);

  const handleError = useCallback((err: Error) => {
    console.error(`Real-time subscription error for ${tableName}:`, err);
    setError(err);
  }, [tableName]);

  // Set up real-time subscription
  const callbacks: RealtimeCallbacks<T> = useMemo(() => ({
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
    onError: handleError,
  }), [handleInsert, handleUpdate, handleDelete, handleError]);

  useRealtimeSubscription<T>({
    tableName,
    callbacks,
    enabled,
  });

  // Apply client-side filter if provided
  const filteredData = useMemo(() => {
    return filterFn ? data.filter(filterFn) : data;
  }, [data, filterFn]);

  return {
    data: filteredData,
    rawData: data,
    isLoading,
    error,
    refetch: fetchData,
    setData, // Expose for optimistic updates
  };
}
