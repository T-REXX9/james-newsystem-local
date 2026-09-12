import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerYearlySales from '../CustomerYearlySales';

const row = (id: number, date: string, refType: string, debit: number) => ({
  id, date, datetime: `${date}T10:00:00`, reference: `REF-${id}`, ref_no: `ref-${id}`, ref_type: refType,
  check_no: '', check_date: null, dcr: '', debit, credit: 0, pdc: 0, balance: 0, remarks: '', promise_to_pay: '',
});

describe('CustomerYearlySales', () => {
  afterEach(() => {
    cleanup();
  });
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

  it('renders compact years in vertical columns of ten', () => {
    const years = Array.from({ length: 12 }, (_, index) => {
      const year = 2013 + index;
      return {
        year,
        total: (index + 1) * 10000,
        months: [],
      };
    });

    render(
      <CustomerYearlySales
        compact
        entries={years}
        today={new Date('2025-08-01T12:00:00')}
      />
    );

    const yearlySales = screen.getByTestId('customer-yearly-sales');
    expect(yearlySales).toHaveAttribute('data-compact', 'true');
    expect(yearlySales).toHaveAttribute('data-year-count', '12');
    expect(yearlySales).toHaveAttribute('data-years-per-column', '10');

    const columns = screen.getAllByTestId('customer-yearly-sales-column');
    expect(columns).toHaveLength(2);
    expect(columns[0].querySelectorAll('[role="listitem"]')).toHaveLength(10);
    expect(columns[1].querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(columns[0]).toHaveTextContent('2013');
    expect(columns[0]).toHaveTextContent('2022');
    expect(columns[1]).toHaveTextContent('2023');
    expect(columns[1]).toHaveTextContent('2024');

    for (const year of years) {
      expect(screen.getByText(String(year.year))).toBeInTheDocument();
    }
    expect(screen.getByText('₱10,000')).toBeInTheDocument();
    expect(screen.getByText('₱120,000')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('January')).not.toBeInTheDocument();
  });
});
