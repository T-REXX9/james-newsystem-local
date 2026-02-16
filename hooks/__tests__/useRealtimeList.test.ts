import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRealtimeList } from '../useRealtimeList';

// Mock the useRealtimeSubscription hook
vi.mock('../useRealtimeSubscription', () => ({
  useRealtimeSubscription: vi.fn(() => ({ channel: null })),
}));

interface TestItem {
  id: string;
  name: string;
  createdAt: string;
}

describe('useRealtimeList', () => {
  const mockFetchFn = vi.fn<[], Promise<TestItem[]>>();
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should fetch initial data on mount', async () => {
    const mockData: TestItem[] = [
      { id: '1', name: 'Item 1', createdAt: '2024-01-01' },
      { id: '2', name: 'Item 2', createdAt: '2024-01-02' },
    ];
    mockFetchFn.mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useRealtimeList({
        tableName: 'test_table',
        initialFetchFn: mockFetchFn,
      })
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockFetchFn).toHaveBeenCalledTimes(1);
  });

  it('should apply sort function to data', async () => {
    const mockData: TestItem[] = [
      { id: '1', name: 'B Item', createdAt: '2024-01-01' },
      { id: '2', name: 'A Item', createdAt: '2024-01-02' },
    ];
    mockFetchFn.mockResolvedValue(mockData);

    const sortFn = (a: TestItem, b: TestItem) => a.name.localeCompare(b.name);

    const { result } = renderHook(() =>
      useRealtimeList({
        tableName: 'test_table',
        initialFetchFn: mockFetchFn,
        sortFn,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data[0].name).toBe('A Item');
    expect(result.current.data[1].name).toBe('B Item');
  });

  it('should apply filter function to data', async () => {
    const mockData: TestItem[] = [
      { id: '1', name: 'Active Item', createdAt: '2024-01-01' },
      { id: '2', name: 'Inactive Item', createdAt: '2024-01-02' },
    ];
    mockFetchFn.mockResolvedValue(mockData);

    const filterFn = (item: TestItem) => item.name.includes('Active');

    const { result } = renderHook(() =>
      useRealtimeList({
        tableName: 'test_table',
        initialFetchFn: mockFetchFn,
        filterFn,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].name).toBe('Active Item');
  });

  it('should handle fetch errors', async () => {
    const mockError = new Error('Fetch failed');
    mockFetchFn.mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useRealtimeList({
        tableName: 'test_table',
        initialFetchFn: mockFetchFn,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(mockError);
    expect(result.current.data).toEqual([]);
  });

  it('should not fetch when enabled is false', async () => {
    mockFetchFn.mockResolvedValue([]);

    renderHook(() =>
      useRealtimeList({
        tableName: 'test_table',
        initialFetchFn: mockFetchFn,
        enabled: false,
      })
    );

    await waitFor(() => {
      expect(mockFetchFn).not.toHaveBeenCalled();
    });
  });
});
