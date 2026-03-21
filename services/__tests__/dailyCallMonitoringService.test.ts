import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCallLogForDailyCall,
  fetchAgentSnapshotForDailyCall,
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

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: '1', shopName: 'Test Shop' });
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

  it('fetchAgentSnapshotForDailyCall maps aggregate payload into frontend shapes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contacts: [{ id: '1', shopName: 'Test Shop' }],
          call_logs: [{ id: 'log-1', contact_id: '1', agent_name: 'Jane Doe', channel: 'text', outcome: 'logged', occurred_at: '2026-03-07T00:00:00Z' }],
          inquiries: [{ id: 'inq-1', contact_id: '1', sales_date: '2026-03-07T00:00:00Z', status: 'Submitted' }],
          purchases: [{ id: 'pur-1', contact_id: '1', total_amount: 1200, purchase_date: '2026-03-07T00:00:00Z' }],
          team_messages: [{ id: 'msg-1', sender_id: '1', sender_name: 'Owner', message: 'Follow up today', created_at: '2026-03-07T00:00:00Z', is_from_owner: true }],
        },
      }),
    } as Response);

    const result = await fetchAgentSnapshotForDailyCall('63');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.contacts).toHaveLength(1);
    expect(result.callLogs[0]).toMatchObject({ id: 'log-1', agent_name: 'Jane Doe', channel: 'text' });
    expect(result.inquiries[0]).toMatchObject({ id: 'inq-1', title: 'Submitted' });
    expect(result.purchases[0]).toMatchObject({ id: 'pur-1', amount: 1200 });
    expect(result.teamMessages[0]).toMatchObject({ id: 'msg-1', is_from_owner: true });
  });

  it('fetchAgentSnapshotForDailyCall normalizes snake_case contact rows from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contacts: [
            {
              id: '1',
              shop_name: 'A&M Injection Pump',
              assigned_to: 'Sales Agent Demo',
              city: 'null',
              province: 'Davao del Norte',
              contact_number: '',
              mode_of_payment: '30DAYS PDC',
      dealer_price_group: 'gold',
              status_label: 'active',
            },
          ],
          call_logs: [],
          inquiries: [],
          purchases: [],
          team_messages: [],
        },
      }),
    } as Response);

    const result = await fetchAgentSnapshotForDailyCall('63');

    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]).toMatchObject({
      id: '1',
      shopName: 'A&M Injection Pump',
      assignedTo: 'Sales Agent Demo',
      city: '',
      province: 'Davao del Norte',
      modeOfPayment: '30DAYS PDC',
      dealerPriceGroup: 'gold',
    });
  });

  it('createCallLogForDailyCall posts to the local API and returns the created log', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'log-9',
          contact_id: '1',
          agent_name: 'Jane Doe',
          channel: 'text',
          direction: 'outbound',
          duration_seconds: 0,
          notes: 'hello',
          outcome: 'logged',
          occurred_at: '2026-03-07T00:00:00Z',
          next_action: null,
          next_action_due: null,
        },
      }),
    } as Response);

    const result = await createCallLogForDailyCall({
      contact_id: '1',
      agent_name: 'Jane Doe',
      channel: 'text',
      direction: 'outbound',
      duration_seconds: 0,
      notes: 'hello',
      outcome: 'logged' as any,
      occurred_at: '2026-03-07T00:00:00Z',
      next_action: null,
      next_action_due: null,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain('/daily-call-monitoring/call-logs');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(result).toMatchObject({ id: 'log-9', contact_id: '1', notes: 'hello' });
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
