import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerYearlySales from '../CustomerYearlySales';

const row = (id: number, date: string, refType: string, debit: number) => ({
  id, date, datetime: `${date}T10:00:00`, reference: `REF-${id}`, ref_no: `ref-${id}`, ref_type: refType,
  check_no: '', check_date: null, dcr: '', debit, credit: 0, pdc: 0, balance: 0, remarks: '', promise_to_pay: '',
});

describe('CustomerYearlySales', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      private callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        const minWidth = Number.parseInt((target as HTMLElement).parentElement?.style.minWidth || '0', 10);
        const width = Math.max(480, minWidth);
        const contentRect = { x: 0, y: 0, width, height: 176, top: 0, right: width, bottom: 176, left: 0, toJSON: () => ({}) } as DOMRectReadOnly;
        this.callback([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }

      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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

  it('renders a yearly trend chart with year labels and exact annual totals', async () => {
    const years = [
      { year: 2022, total: 1200, months: [] },
      { year: 2024, total: 600, months: [] },
      { year: 2025, total: 1800, months: [] },
    ];

    render(<CustomerYearlySales compact entries={years} today={new Date('2025-08-01T12:00:00')} />);

    const yearlySales = screen.getByTestId('customer-yearly-sales');
    expect(yearlySales).toHaveAttribute('data-compact', 'true');
    expect(yearlySales).toHaveAttribute('data-year-count', '3');
    expect(screen.getByRole('heading', { name: /Yearly Sales Trend/i })).toBeInTheDocument();

    const chart = screen.getByTestId('customer-yearly-sales-chart');
    expect(chart).toHaveAttribute('data-year-count', '4');
    expect(chart).toHaveAttribute('tabindex', '0');
    expect(chart).toHaveAttribute('aria-describedby');
    await waitFor(() => expect(chart.querySelector('path.recharts-line-curve')).not.toBeNull());
    const chartLabels = Array.from(chart.querySelectorAll('svg text')).map((tick) => tick.textContent);
    expect(chartLabels).toEqual(expect.arrayContaining(['2022', '2023', '2024', '2025']));
    expect(chartLabels).not.toContain('Jan');
    expect(chart).toHaveTextContent('2022 full year: ₱1,200.00');
    expect(chart).toHaveTextContent('2023 full year: ₱0.00');
    expect(chart).toHaveTextContent('2024 full year: ₱600.00');
    expect(chart).toHaveTextContent('2025 year to date: ₱1,800.00');
    expect(screen.getByText('₱1,800.00')).toBeInTheDocument();
  });

  it('includes a zero YTD point and keeps every year label visible for long histories', async () => {
    const years = Array.from({ length: 31 }, (_, index) => ({
      year: 1994 + index,
      total: 10000 + index * 100,
      months: [],
    }));

    render(<CustomerYearlySales compact entries={years} today={new Date('2025-08-01T12:00:00')} />);

    const chart = screen.getByTestId('customer-yearly-sales-chart');
    expect(chart).toHaveAttribute('data-year-count', '32');
    await waitFor(() => expect(chart.querySelector('path.recharts-line-curve')).not.toBeNull());
    expect(chart).toHaveTextContent('2024 full year: ₱13,000.00');
    expect(chart).toHaveTextContent('2025 year to date: ₱0.00');

    const yearTicks = Array.from(chart.querySelectorAll('svg text'))
      .map((tick) => tick.textContent || '')
      .filter((label) => /^\d{4}$/.test(label));
    expect(yearTicks[0]).toBe('1994');
    expect(yearTicks[yearTicks.length - 1]).toBe('2025');
    expect(yearTicks).toEqual(Array.from({ length: 32 }, (_, index) => String(1994 + index)));
    expect(chart.querySelector('.recharts-responsive-container')?.parentElement).toHaveStyle({ minWidth: '2048px' });
  });
});
