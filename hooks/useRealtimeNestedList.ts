import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRealtimeSubscription, RealtimeCallbacks } from './useRealtimeSubscription';

export interface UseRealtimeNestedListOptions<TParent, TChild> {
  parentTableName: string;
  childTableName: string;
  parentFetchFn: () => Promise<TParent[]>;
  childFetchFn?: () => Promise<TChild[]>;
  parentIdField?: keyof TParent;
  childParentIdField?: keyof TChild;
  childrenField: keyof TParent;
  sortParentFn?: (a: TParent, b: TParent) => number;
  sortChildFn?: (a: TChild, b: TChild) => number;
  enabled?: boolean;
}

export function useRealtimeNestedList<
  TParent extends { id: string },
  TChild extends { id: string }
>({
  parentTableName,
  childTableName,
  parentFetchFn,
  childFetchFn,
  parentIdField = 'id' as keyof TParent,
  childParentIdField,
  childrenField,
  sortParentFn,
  sortChildFn,
  enabled = true,
}: UseRealtimeNestedListOptions<TParent, TChild>) {
  const [data, setData] = useState<TParent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initial data fetch
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await parentFetchFn();
      setData(result);
    } catch (err) {
      console.error(`Error fetching ${parentTableName}:`, err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [parentFetchFn, parentTableName]);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [fetchData, enabled]);

  // Parent event handlers
  const handleParentInsert = useCallback((newItem: TParent) => {
    setData((prevData) => {
      const updated = [...prevData, newItem];
      return sortParentFn ? updated.sort(sortParentFn) : updated;
    });
  }, [sortParentFn]);

  const handleParentUpdate = useCallback((updatedItem: TParent) => {
    setData((prevData) => {
      const index = prevData.findIndex((item) => item[parentIdField] === updatedItem[parentIdField]);
      if (index === -1) return prevData;
      
      const updated = [...prevData];
      // Preserve children if they exist
      const existingChildren = updated[index][childrenField];
      updated[index] = { ...updatedItem, [childrenField]: existingChildren } as TParent;
      
      return sortParentFn ? updated.sort(sortParentFn) : updated;
    });
  }, [parentIdField, childrenField, sortParentFn]);

  const handleParentDelete = useCallback((payload: { id: string }) => {
    setData((prevData) => prevData.filter((item) => item[parentIdField] !== payload.id));
  }, [parentIdField]);

  // Child event handlers
  const handleChildInsert = useCallback((newChild: TChild) => {
    if (!childParentIdField) return;
    
    setData((prevData) => {
      const parentId = newChild[childParentIdField] as unknown as string;
      const parentIndex = prevData.findIndex((item) => item[parentIdField] === parentId);
      if (parentIndex === -1) return prevData;

      const updated = [...prevData];
      const parent = { ...updated[parentIndex] };
      const children = (parent[childrenField] as unknown as TChild[]) || [];
      const updatedChildren = [...children, newChild];
      parent[childrenField] = (sortChildFn ? updatedChildren.sort(sortChildFn) : updatedChildren) as any;
      updated[parentIndex] = parent;

      return updated;
    });
  }, [childParentIdField, parentIdField, childrenField, sortChildFn]);

  const handleChildUpdate = useCallback((updatedChild: TChild) => {
    if (!childParentIdField) return;

    setData((prevData) => {
      const parentId = updatedChild[childParentIdField] as unknown as string;
      const parentIndex = prevData.findIndex((item) => item[parentIdField] === parentId);
      if (parentIndex === -1) return prevData;

      const updated = [...prevData];
      const parent = { ...updated[parentIndex] };
      const children = (parent[childrenField] as unknown as TChild[]) || [];
      const childIndex = children.findIndex((child) => child.id === updatedChild.id);
      
      if (childIndex === -1) return prevData;

      const updatedChildren = [...children];
      updatedChildren[childIndex] = updatedChild;
      parent[childrenField] = (sortChildFn ? updatedChildren.sort(sortChildFn) : updatedChildren) as any;
      updated[parentIndex] = parent;

      return updated;
    });
  }, [childParentIdField, parentIdField, childrenField, sortChildFn]);

  const handleChildDelete = useCallback((payload: { id: string }) => {
    setData((prevData) => {
      return prevData.map((parent) => {
        const children = (parent[childrenField] as unknown as TChild[]) || [];
        const filteredChildren = children.filter((child) => child.id !== payload.id);
        
        if (filteredChildren.length === children.length) return parent;
        
        return { ...parent, [childrenField]: filteredChildren };
      });
    });
  }, [childrenField]);

  const handleError = useCallback((err: Error) => {
    console.error(`Real-time subscription error:`, err);
    setError(err);
  }, []);

  // Set up parent subscription
  const parentCallbacks: RealtimeCallbacks<TParent> = useMemo(() => ({
    onInsert: handleParentInsert,
    onUpdate: handleParentUpdate,
    onDelete: handleParentDelete,
    onError: handleError,
  }), [handleParentInsert, handleParentUpdate, handleParentDelete, handleError]);

  useRealtimeSubscription<TParent>({
    tableName: parentTableName,
    callbacks: parentCallbacks,
    enabled,
  });

  // Set up child subscription
  const childCallbacks: RealtimeCallbacks<TChild> = useMemo(() => ({
    onInsert: handleChildInsert,
    onUpdate: handleChildUpdate,
    onDelete: handleChildDelete,
    onError: handleError,
  }), [handleChildInsert, handleChildUpdate, handleChildDelete, handleError]);

  useRealtimeSubscription<TChild>({
    tableName: childTableName,
    callbacks: childCallbacks,
    enabled,
  });

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    setData, // Expose for optimistic updates
  };
}

