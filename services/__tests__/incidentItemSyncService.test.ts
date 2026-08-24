import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncIncidentReportItem } from '../incidentItemSyncService';

const okResponse = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => ({ ok: true, data }),
  } as Response);

describe('incidentItemSyncService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requires an authenticated session', async () => {
    await expect(syncIncidentReportItem({
      incident_report_id: 'incident-1',
      contact_id: 'contact-1',
      description: 'Wrong quantity received',
      issue_summary: 'Wrong quantity received',
      issue_type: 'delivery',
      report_date: '2026-08-24',
    })).rejects.toThrow('session has expired');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('posts the existing incident item fields with the authenticated tenant and token', async () => {
    localStorage.setItem(
      'local_api_auth_session',
      JSON.stringify({
        token: 'test-token',
        context: {
          main_userid: 42,
          user: { id: 7, main_userid: 42 },
        },
        userProfile: { main_userid: 42 },
      })
    );
    (global.fetch as any).mockImplementation(() => okResponse({ id: '1', created: true }));

    await syncIncidentReportItem({
      incident_report_id: 'incident-1',
      contact_id: 'contact-1',
      product_id: 'product-1',
      item_code: 'P300',
      part_no: 'PART-300',
      description: 'Brake pad',
      supplier_id: 'supplier-1',
      supplier_name: 'Supplier One',
      quantity: 2,
      issue_summary: 'Wrong quantity received',
      issue_type: 'delivery',
      report_date: '2026-08-24',
    });

    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/incident-report-items');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(options.body)).toMatchObject({
      main_id: 42,
      incident_report_id: 'incident-1',
      item_code: 'P300',
      quantity: 2,
    });
  });
});
