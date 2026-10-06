import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StatementOfAccountView from '../StatementOfAccountView';

const getCustomersMock = vi.fn();
const getStatementMock = vi.fn();

vi.mock('../../services/statementOfAccountService', () => ({
  statementOfAccountService: {
    getCustomers: (...args: unknown[]) => getCustomersMock(...args),
    getStatement: (...args: unknown[]) => getStatementMock(...args),
  },
}));

describe('StatementOfAccountView', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    getCustomersMock.mockResolvedValue([
      { sessionId: 'customer-1', customerCode: 'C-001', company: 'Alpha Motors' },
    ]);
    getStatementMock.mockResolvedValue({
      customer: { session_id: 'customer-1', customer_code: 'C-001', company: 'Alpha Motors', terms: '', credit_limit: 0 },
      report_type: 'detailed',
      date_type: 'all',
      date_from: null,
      date_to: null,
      rows: [{ id: 7, terms: '30 Days', date: '2026-10-06', datetime: '', created_at: '2026-10-06 13:05:09', reference: 'INV-7', amount: 125, amount_paid: 25, balance: 100, remarks: '' }],
      summary_rows: [],
      totals: { amount: 125, amount_paid: 25, balance: 100, row_count: 1 },
    });
  });

  it('requires an explicit customer selection before allowing a report', async () => {
    render(<StatementOfAccountView />);

    expect(screen.queryByPlaceholderText(/leave it blank to show all customers/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search customer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate report/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /search customer/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Alpha Motors' }));

    expect(screen.getByRole('button', { name: 'Alpha Motors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate report/i })).toBeEnabled();
  });

  it('does not replace the selected customer when new search results arrive', async () => {
    render(<StatementOfAccountView />);

    fireEvent.click(screen.getByRole('button', { name: /search customer/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Alpha Motors' }));

    getCustomersMock.mockImplementation((query = '') => Promise.resolve(
      String(query).toLowerCase() === 'beta'
        ? [{ sessionId: 'customer-2', customerCode: 'C-002', company: 'Beta Motors' }]
        : [{ sessionId: 'customer-1', customerCode: 'C-001', company: 'Alpha Motors' }],
    ));

    fireEvent.click(screen.getAllByRole('button', { name: 'Alpha Motors' })[0]);
    fireEvent.change(screen.getByPlaceholderText('Search customer...'), { target: { value: 'beta' } });

    expect(await screen.findByRole('button', { name: 'Beta Motors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alpha Motors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate report/i })).toBeEnabled();
  });

  it('shows the exact creation timestamp in detailed statement records', async () => {
    render(<StatementOfAccountView />);

    fireEvent.click(screen.getByRole('button', { name: /search customer/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Alpha Motors' }));
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    expect(await screen.findByText('01:05:09 PM')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Timestamp' })).toBeInTheDocument();
  });
});
