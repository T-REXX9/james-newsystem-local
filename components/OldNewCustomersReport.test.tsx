import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import OldNewCustomersReport from './OldNewCustomersReport';

vi.mock('../services/oldNewCustomersReportService', () => ({
  fetchOldNewCustomersReport: vi.fn(),
}));

import { fetchOldNewCustomersReport } from '../services/oldNewCustomersReportService';

const fetchOldNewCustomersReportMock = fetchOldNewCustomersReport as unknown as ReturnType<typeof vi.fn>;

describe('OldNewCustomersReport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders grouped old and new customers from the local API', async () => {
    fetchOldNewCustomersReportMock.mockResolvedValue({
      items: [
        {
          id: 'old-1',
          customerName: 'Legacy Motors',
          customerCode: 'OLD-001',
          customerGroup: 'Dealer',
          salesPerson: 'Agent Old',
          customerSince: '2023-01-15',
          customerType: 'old',
        },
        {
          id: 'new-1',
          customerName: 'Fresh Parts',
          customerCode: 'NEW-001',
          customerGroup: 'Retail',
          salesPerson: 'Agent New',
          customerSince: '2026-01-20',
          customerType: 'new',
        },
      ],
      summary: {
        oldCount: 1,
        newCount: 1,
        totalCount: 2,
        cutoffYears: 1,
        cutoffDate: '2025-03-17',
      },
      meta: {
        page: 1,
        perPage: 100,
        total: 2,
        totalPages: 1,
        status: 'all',
        search: '',
      },
    });

    render(<OldNewCustomersReport />);

    expect(screen.getByText('Old/New Customers')).toBeInTheDocument();
    await waitFor(() => expect(fetchOldNewCustomersReportMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Legacy Motors')).toBeInTheDocument();
    expect(screen.getByText('Fresh Parts')).toBeInTheDocument();
    expect(screen.getAllByText('Old Customers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('New Customers').length).toBeGreaterThan(0);
  });

  it('renders empty-state messaging when the API returns no rows', async () => {
    fetchOldNewCustomersReportMock.mockResolvedValue({
      items: [],
      summary: {
        oldCount: 0,
        newCount: 0,
        totalCount: 0,
        cutoffYears: 1,
        cutoffDate: '2025-03-17',
      },
      meta: {
        page: 1,
        perPage: 100,
        total: 0,
        totalPages: 1,
        status: 'all',
        search: '',
      },
    });

    render(<OldNewCustomersReport />);

    await waitFor(() => expect(fetchOldNewCustomersReportMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText('No old customers for the selected filters.')).toBeInTheDocument();
    expect(screen.getByText('No new customers for the selected filters.')).toBeInTheDocument();
  });
});
