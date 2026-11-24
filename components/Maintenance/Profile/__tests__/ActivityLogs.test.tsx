import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivityLogs from '../ActivityLogs';

const { list } = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../../../services/activityLogsLocalApiService', () => ({
  activityLogsLocalApiService: {
    list,
    users: vi.fn().mockResolvedValue([]),
    modules: vi.fn().mockResolvedValue([]),
    deletionDetail: vi.fn(),
  },
}));

describe('ActivityLogs record reference display', () => {
  beforeEach(() => {
    list.mockResolvedValue({
      items: [{
        lid: 1,
        lmain_id: '1',
        luser_id: '7',
        lpage: 'Freight Charges',
        laction: 'Post Freight Charges',
        lrefno: '2026100309124865799',
        display_refno: 'DM26-12861',
        lreason: 'Pending → Posted',
        lold_status: 'Pending',
        lnew_status: 'Posted',
        ldatetime: '2026-11-24 10:57:00',
        userfname: 'Jenny',
        userlname: 'Mae',
        deletion_audit_id: 0,
        deletion_contact_id: '',
        deletion_customer_name: '',
        deletion_thread_id: '',
        deletion_message_id: '',
        deletion_record_type: '',
        deletion_actor_user_id: '',
        deletion_actor_name: '',
        deletion_actor_role: '',
        deletion_reason: '',
        deletion_original_payload: '',
        deletion_deleted_at: '',
      }],
      meta: { page: 1, per_page: 100, total: null, total_pages: null, has_more: false, filters: {} },
    });
  });

  it('shows the familiar record number and never renders the internal reference', async () => {
    render(<ActivityLogs />);

    expect(await screen.findByText('DM26-12861')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Record No.' })).toBeInTheDocument();
    expect(screen.queryByText('2026100309124865799')).not.toBeInTheDocument();
  });
});
