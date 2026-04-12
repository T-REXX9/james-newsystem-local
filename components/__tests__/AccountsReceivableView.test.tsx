import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountsReceivableView from '../AccountsReceivableView';

const getReportMock = vi.fn();
const getCustomersMock = vi.fn();

vi.mock('../../services/accountsReceivableService', () => ({
  accountsReceivableService: {
    getReport: (...args: any[]) => getReportMock(...args),
  },
}));

vi.mock('../../services/customerLedgerService', () => ({
  customerLedgerService: {
    getCustomers: (...args: any[]) => getCustomersMock(...args),
  },
}));

describe('AccountsReceivableView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReportMock.mockResolvedValue({
      customers: [],
      grand_total_balance: 0,
      date_type: 'all',
      date_from: null,
      date_to: null,
      debt_type: 'All',
    });
    getCustomersMock.mockImplementation(async (search = '') => {
      const trimmed = String(search).trim().toLowerCase();
      if (trimmed === 'zulu') {
        return [
          { sessionId: 'cust-z', customerCode: 'Z-001', company: 'Zulu Calibration' },
        ];
      }

      return [
        { sessionId: 'cust-a', customerCode: 'A-001', company: 'Alpha Motors' },
        { sessionId: 'cust-b', customerCode: 'B-001', company: 'Beta Diesel' },
      ];
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads customers from live search results instead of only the initial list', async () => {
    const user = userEvent.setup();

    render(<AccountsReceivableView />);

    await waitFor(() => expect(getCustomersMock).toHaveBeenCalledWith(''));

    await user.type(screen.getByPlaceholderText(/search customer/i), 'Zulu');

    await waitFor(() => expect(getCustomersMock).toHaveBeenLastCalledWith('Zulu'));

    const customerField = screen.getByText('Customer').closest('label');
    expect(customerField).toBeTruthy();

    const customerSelect = within(customerField as HTMLElement).getByRole('combobox');
    await waitFor(() => expect(within(customerSelect).getByRole('option', { name: 'Zulu Calibration' })).toBeInTheDocument());

    await user.selectOptions(customerSelect, 'cust-z');
    await user.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => {
      expect(getReportMock).toHaveBeenLastCalledWith({
        customerId: 'cust-z',
        debtType: 'All',
        dateType: 'all',
        dateFrom: undefined,
        dateTo: undefined,
      });
    });
  });
});
