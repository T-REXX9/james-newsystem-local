import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDailyCallIncidentReport, reviewDailyCallIncidentReport } from '../dailyCallCustomerDetailService';

describe('dailyCallCustomerDetailService incident reports', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts incident reports to the local API with the active tenant and token', async () => {
    localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'incident-token',
      context: { main_userid: 42, user: { id: 7, main_userid: 42 } },
      userProfile: { main_userid: 42 },
    }));
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          id: 'incident-1',
          contact_id: 'contact-1',
          report_date: '2026-08-26',
          incident_date: '2026-08-25',
          issue_type: 'delivery',
          description: 'Package arrived with missing items.',
          reported_by: 'Test User',
          approval_status: 'pending',
        },
      }),
    } as Response);

    const created = await createDailyCallIncidentReport({
      id: 'incident-1',
      contact_id: 'contact-1',
      report_date: '2026-08-26',
      incident_date: '2026-08-25',
      issue_type: 'delivery',
      description: 'Package arrived with missing items.',
      reported_by: 'Test User',
    });

    expect(created.id).toBe('incident-1');
    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/daily-call-monitoring/incident-reports');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer incident-token');
    expect(JSON.parse(options.body)).toMatchObject({
      id: 'incident-1',
      contact_id: 'contact-1',
      main_id: 42,
    });
  });

  it('does not attempt a save when the session is missing', async () => {
    await expect(createDailyCallIncidentReport({
      id: 'incident-1',
      contact_id: 'contact-1',
      report_date: '2026-08-26',
      incident_date: '2026-08-25',
      issue_type: 'other',
      description: 'A sufficiently detailed incident description.',
      reported_by: 'Test User',
    })).rejects.toThrow('session has expired');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends an approved return disposition to the authenticated decision endpoint', async () => {
    localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'incident-token',
      context: { main_userid: 42, user: { id: 1, main_userid: 42 } },
      userProfile: { main_userid: 42 },
    }));
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { id: 'incident-1', approval_status: 'approved' } }),
    } as Response);

    await reviewDailyCallIncidentReport('incident-1', {
      decision: 'approved',
      disposition: 'return_to_factory',
      reviewerName: 'Master User',
      note: 'Send defective item back to supplier.',
    });

    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/daily-call-monitoring/incident-reports/incident-1/decision');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toMatchObject({
      main_id: 42,
      decision: 'approved',
      disposition: 'return_to_factory',
      reviewer_name: 'Master User',
    });
  });

  it('sends rejection decisions without a return disposition', async () => {
    localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'incident-token',
      context: { main_userid: 42, user: { id: 1, main_userid: 42 } },
      userProfile: { main_userid: 42 },
    }));
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { id: 'incident-1', approval_status: 'rejected' } }),
    } as Response);

    await reviewDailyCallIncidentReport('incident-1', {
      decision: 'rejected',
      reviewerName: 'Master User',
      note: 'Incident only.',
    });

    const [, options] = (global.fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      main_id: 42,
      decision: 'rejected',
      disposition: undefined,
      reviewer_name: 'Master User',
      note: 'Incident only.',
    });
  });

  it('surfaces review endpoint validation errors', async () => {
    localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'incident-token',
      context: { main_userid: 42, user: { id: 1, main_userid: 42 } },
    }));
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, error: 'This incident has already been reviewed' }),
    } as Response);

    await expect(reviewDailyCallIncidentReport('incident-1', {
      decision: 'approved',
      disposition: 'return_to_stock',
      reviewerName: 'Master User',
    })).rejects.toThrow('This incident has already been reviewed');
  });
});
