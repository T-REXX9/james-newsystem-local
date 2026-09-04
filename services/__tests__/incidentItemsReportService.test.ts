import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchIncidentItemIncidents,
  fetchIncidentItemsReport,
  fetchWarehouseIncidentReport,
  formatIncidentReportShortId,
} from '../incidentItemsReportService';

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

  it('formats an Incident Report ID as the first eight characters', () => {
    expect(formatIncidentReportShortId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('a1b2c3d4');
    expect(formatIncidentReportShortId('short')).toBe('short');
    expect(formatIncidentReportShortId('')).toBe('');
  });

  it('loads every matching Incident Report for an Incident Item', async () => {
    localStorage.setItem(
      'local_api_auth_session',
      JSON.stringify({ token: 'test-token', context: { main_userid: 42, user: { id: 7, main_userid: 42 } } })
    );
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        incidents: [
          {
            incident_report_id: 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
            date: '2026-09-02',
            contact_id: 'c-1',
            customer_name: 'Alpha Co',
            summary: 'Nozzle leak',
          },
          {
            incident_report_id: 'bbbb2222-cccc-dddd-eeee-ffff00001111',
            date: '2026-08-15',
            contact_id: 'c-2',
            customer_name: 'Beta Inc',
            summary: 'Crack',
          },
        ],
      })
    );

    const result = await fetchIncidentItemIncidents({
      supplierId: '10',
      supplierName: 'QK9N',
      productId: '123',
      itemCode: 'P300',
      partNo: 'PN-1',
      description: 'Nozzle',
      dateFrom: '2026-01-01',
      dateTo: '2026-09-04',
      matchSource: 'manual',
    });

    const [url] = (global.fetch as any).mock.calls[0];
    const params = new URL(String(url), window.location.origin).searchParams;
    expect(params.get('main_id')).toBe('42');
    expect(params.get('supplier_id')).toBe('10');
    expect(params.get('supplier_name')).toBe('QK9N');
    expect(params.get('product_id')).toBe('123');
    expect(params.get('item_code')).toBe('P300');
    expect(params.get('part_no')).toBe('PN-1');
    expect(params.get('description')).toBe('Nozzle');
    expect(params.get('date_from')).toBe('2026-01-01');
    expect(params.get('date_to')).toBe('2026-09-04');
    expect(params.get('match_source')).toBe('manual');
    expect(result).toEqual([
      {
        incident_report_id: 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
        date: '2026-09-02',
        contact_id: 'c-1',
        customer_name: 'Alpha Co',
        summary: 'Nozzle leak',
      },
      {
        incident_report_id: 'bbbb2222-cccc-dddd-eeee-ffff00001111',
        date: '2026-08-15',
        contact_id: 'c-2',
        customer_name: 'Beta Inc',
        summary: 'Crack',
      },
    ]);
  });

  it('loads a warehouse Incident Report by id', async () => {
    localStorage.setItem(
      'local_api_auth_session',
      JSON.stringify({ token: 'test-token', context: { main_userid: 42, user: { id: 7, main_userid: 42 } } })
    );
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        id: 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
        contact_id: 'c-1',
        report_date: '2026-09-02',
        report_time: '09:30:00',
        incident_date: '2026-09-01',
        incident_time: '15:00:00',
        issue_type: 'product_quality',
        description: 'Nozzle leak',
        reported_by: 'Agent',
        done_by: 'Agent',
        approval_status: 'pending',
        attachments: [],
        related_transactions: [],
        customer_name: 'Alpha Co',
      })
    );

    const result = await fetchWarehouseIncidentReport('aaaa1111-bbbb-cccc-dddd-eeeeffff0001');

    const [url] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/incident-items-report/incidents/aaaa1111-bbbb-cccc-dddd-eeeeffff0001');
    expect(new URL(String(url), window.location.origin).searchParams.get('main_id')).toBe('42');
    expect(result.id).toBe('aaaa1111-bbbb-cccc-dddd-eeeeffff0001');
    expect(result.customer_name).toBe('Alpha Co');
    expect(result.approval_status).toBe('pending');
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
    localStorage.setItem(
      'local_api_auth_session',
      JSON.stringify({ token: 'test-token', context: { main_userid: 42, user: { id: 7, main_userid: 42 } } })
    );
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
      contact_id: '',
      customer_name: 'Unknown customer',
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
