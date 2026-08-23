import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fetchIncidentItemsReport } from '../incidentItemsReportService';

const okResponse = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => ({ ok: true, data }),
  } as Response);

describe('incidentItemsReportService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the authenticated tenant main_id instead of the static fallback', async () => {
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
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [],
        summary: {},
        meta: {},
      })
    );

    await fetchIncidentItemsReport({ page: 1, perPage: 10 });

    const [url] = (global.fetch as any).mock.calls[0];
    expect(new URL(String(url), window.location.origin).searchParams.get('main_id')).toBe('42');
  });

  it('normalizes grouped rows and numeric summary values', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [
          {
            supplier_id: 10,
            supplier_name: 'QK9N',
            product_id: 123,
            item_code: 'P300',
            incident_count: '3',
            average_confidence: '0.92',
            recent_incidents: [{ incident_report_id: 99, date: '2026-08-01', summary: null }],
          },
        ],
        summary: {
          total_incident_items: '3',
          affected_suppliers: '1',
          affected_items: '1',
          top_incident_count: '3',
        },
        meta: { page: '1', per_page: '10', total: '1', total_pages: '1' },
      })
    );

    const result = await fetchIncidentItemsReport({ page: 1, perPage: 10 });

    expect(result.items[0]).toMatchObject({
      supplier_id: '10',
      product_id: '123',
      item_code: 'P300',
      incident_count: 3,
      average_confidence: 0.92,
    });
    expect(result.items[0].recent_incidents[0]).toEqual({
      incident_report_id: '99',
      date: '2026-08-01',
      summary: '',
    });
    expect(result.summary).toMatchObject({
      total_incident_items: 3,
      affected_suppliers: 1,
      affected_items: 1,
      top_incident_count: 3,
    });
  });
});

