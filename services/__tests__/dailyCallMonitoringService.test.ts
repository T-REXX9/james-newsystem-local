import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchCustomersForDailyCall,
  subscribeToDailyCallMonitoringUpdates,
} from '../dailyCallMonitoringService';

describe('dailyCallMonitoringService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetchCustomersForDailyCall calls local API with expected query params', async () => {
    const mockRows = [{ id: '1', shopName: 'Test Shop' }];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockRows }),
    } as Response);

    const result = await fetchCustomersForDailyCall({ status: 'active', search: 'james', viewerUserId: '63' });

    expect(result).toEqual(mockRows);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchSpy.mock.calls[0][0]);
    expect(requestUrl).toContain('/daily-call-monitoring/excel?');
    expect(requestUrl).toContain('main_id=1');
    expect(requestUrl).toContain('status=active');
    expect(requestUrl).toContain('search=james');
    expect(requestUrl).toContain('viewer_user_id=63');
  });

  it('fetchCustomersForDailyCall returns empty list when API fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const result = await fetchCustomersForDailyCall({ status: 'all' });

    expect(result).toEqual([]);
  });

  it('fetchCustomersForDailyCall returns empty list for malformed payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    } as Response);

    const result = await fetchCustomersForDailyCall({ status: 'inactive' });

    expect(result).toEqual([]);
  });

  it('subscribeToDailyCallMonitoringUpdates triggers onUpdate on interval and supports unsubscribe', () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();

    const unsubscribe = subscribeToDailyCallMonitoringUpdates({ onUpdate });

    vi.advanceTimersByTime(45000);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    unsubscribe();
    vi.advanceTimersByTime(90000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('subscribeToDailyCallMonitoringUpdates forwards callback errors to onError', () => {
    vi.useFakeTimers();
    const expectedError = new Error('update failed');
    const onError = vi.fn();

    subscribeToDailyCallMonitoringUpdates({
      onUpdate: () => {
        throw expectedError;
      },
      onError,
    });

    vi.advanceTimersByTime(45000);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expectedError);
  });
});
