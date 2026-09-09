import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerYearlySales from '../CustomerYearlySales';

const row = (id: number, date: string, refType: string, debit: number) => ({
  id, date, datetime: `${date}T10:00:00`, reference: `REF-${id}`, ref_no: `ref-${id}`, ref_type: refType,
  check_no: '', check_date: null, dcr: '', debit, credit: 0, pdc: 0, balance: 0, remarks: '', promise_to_pay: '',
});

describe('CustomerYearlySales', () => {
  it('shows ledger-backed yearly totals and expands months in calendar order', async () => {
    const user = userEvent.setup();
    render(<CustomerYearlySales rows={[
      row(1, '2024-12-31', 'Invoice', 100),
      row(2, '2024-12-31', 'Order Slip', 250),
      row(3, '2025-01-01', 'Invoice', 400),
      row(4, '2025-07-15', 'Invoice', 50),
      row(5, '2025-06-15', 'Collection', 999),
    ]} today={new Date('2025-08-01T12:00:00')} />);

    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('Year to date')).toBeInTheDocument();
    expect(screen.getByText('₱450.00')).toBeInTheDocument();
    expect(screen.getByText('₱350.00')).toBeInTheDocument();
    expect(screen.getByText('January')).toBeInTheDocument();
    expect(screen.getByText('July')).toBeInTheDocument();
    expect(screen.queryByText('December')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /2024/ }));
    expect(screen.getByText('December')).toBeInTheDocument();
    expect(screen.queryByText('January')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2024/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('explains when the ledger has no posted sales', () => {
    render(<CustomerYearlySales rows={[row(1, '2025-01-01', 'Collection', 500)]} today={new Date('2025-08-01T12:00:00')} />);
    expect(screen.getByText('No posted sales found in the customer ledger.')).toBeInTheDocument();
  });
});
