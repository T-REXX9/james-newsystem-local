import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DailyCollectionEntryView from '../DailyCollectionEntryView';
import { dailyCollectionService } from '../../services/dailyCollectionService';

vi.mock('../../services/dailyCollectionService', async () => {
  const actual = await vi.importActual<typeof import('../../services/dailyCollectionService')>(
    '../../services/dailyCollectionService',
  );
  return {
    ...actual,
    dailyCollectionService: {
      listCollections: vi.fn(),
      getCollection: vi.fn(),
      getCollectionItems: vi.fn(),
      getApproverLogs: vi.fn(),
      getCustomers: vi.fn(),
      getUnpaidTransactions: vi.fn(),
    },
  };
});

vi.mock('../../services/localAuthService', () => ({
  getLocalAuthSession: () => ({
    userProfile: { id: 'staff-1', role: 'Staff' },
    context: { permissions: { web: [] } },
  }),
}));

vi.mock('../../services/notificationLocalApiService', () => ({
  dispatchWorkflowNotification: vi.fn(),
  markNotificationsAsReadByEntityKey: vi.fn(),
}));

describe('DailyCollectionEntryView scrolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dailyCollectionService.listCollections).mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        lrefno: `REF-${index + 1}`,
        lcolection_no: `DCR-${index + 1}`,
        lstatus: 'Pending',
        ldatetime: '2026-08-04',
        total_amt: index + 1,
        created_by: 'staff-1',
        approved_by: '',
      })),
    );
    vi.mocked(dailyCollectionService.getCollection).mockResolvedValue({
      lrefno: 'REF-1',
      lcolection_no: 'DCR-1',
      lstatus: 'Pending',
      ldatetime: '2026-08-04',
      total_amt: 465,
      created_by: 'staff-1',
      approved_by: '',
    });
    vi.mocked(dailyCollectionService.getCollectionItems).mockResolvedValue(
      Array.from({ length: 30 }, (_, index) => ({
        lid: index + 1,
        lrefno: 'REF-1',
        lcustomer: `customer-${index + 1}`,
        lcustomer_fname: `Customer ${index + 1}`,
        lcustomer_lname: '',
        ltype: 'Cash',
        lbank: '',
        lchk_no: '',
        lchk_date: '',
        lamt: index + 1,
        lstatus: 'Pending',
        lremarks: '',
        lcollect_date: '2026-08-04',
        lpost: 0,
        lcollection_status: 'Pending',
        ltransaction_no: `INV-${index + 1}`,
      })),
    );
    vi.mocked(dailyCollectionService.getApproverLogs).mockResolvedValue([]);
    vi.mocked(dailyCollectionService.getCustomers).mockResolvedValue([]);
    vi.mocked(dailyCollectionService.getUnpaidTransactions).mockResolvedValue([]);
  });

  it('provides vertical scrolling for the page, record list, and detail rows', async () => {
    render(<DailyCollectionEntryView />);

    const pageScroller = screen.getByTestId('daily-collection-scroll-container');
    expect(pageScroller).toHaveClass('h-full', 'min-h-0', 'overflow-y-auto');
    expect(screen.getByTestId('daily-collection-list-scroll')).toHaveClass('overflow-y-auto');

    await waitFor(() => expect(screen.getByText('DCR-20')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Customer 30')).toBeInTheDocument());

    expect(screen.getByTestId('daily-collection-detail-scroll')).toHaveClass(
      'overflow-x-auto',
      'overflow-y-auto',
    );
    expect(screen.getByText('INV-30')).toBeInTheDocument();
  });
});
