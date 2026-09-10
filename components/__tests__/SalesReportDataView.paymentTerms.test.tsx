import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesReportDataView from '../SalesReportDataView';

const getSalesReportDataMock = vi.fn();

vi.mock('../../services/salesReportService', () => ({
  getSalesReportData: (...args: unknown[]) => getSalesReportDataMock(...args),
}));

describe('SalesReportDataView payment terms breakdown', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    getSalesReportDataMock.mockReset();
    getSalesReportDataMock.mockResolvedValue({
      transactions: [
        {
          id: 'cash-pnb', date: '2026-09-01', customer: 'Customer A', customerId: 'customer-a',
          terms: 'ap / tt-pnb', refNo: 'REF-1', soNo: 'SO-1', soAmount: 100, drAmount: 90, invoiceAmount: 80,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
        {
          id: 'cash-cod', date: '2026-09-02', customer: 'Customer A', customerId: 'customer-a',
          terms: 'LBC COD', refNo: 'REF-2', soNo: 'SO-2', soAmount: 200, drAmount: 190, invoiceAmount: 180,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
        {
          id: 'terms-30', date: '2026-09-03', customer: 'Customer A', customerId: 'customer-a',
          terms: '30days', refNo: 'REF-3', soNo: 'SO-3', soAmount: 300, drAmount: 290, invoiceAmount: 280,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
        {
          id: 'terms-60', date: '2026-09-04', customer: 'Customer A', customerId: 'customer-a',
          terms: '60 DAYS', refNo: 'REF-4', soNo: 'SO-4', soAmount: 400, drAmount: 390, invoiceAmount: 380,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
      ],
      summary: {
        categoryTotals: [],
        salespersonTotals: [],
        grandTotal: { soAmount: 1000, drAmount: 960, invoiceAmount: 920, total: 920 },
      },
    });
  });

  it('shows cash and term totals by normalized payment term', async () => {
    render(
      <SalesReportDataView
        dateFrom="2026-09-01"
        dateTo="2026-09-30"
        customerId="all"
        reportType="month"
        onBack={vi.fn()}
      />,
    );

    const breakdown = await screen.findByTestId('payment-terms-breakdown');
    expect(within(breakdown).getByText('CASH SALES')).toBeInTheDocument();
    expect(within(breakdown).getByText('AP/TT-PNB')).toBeInTheDocument();
    expect(within(breakdown).getByText('LBC COD')).toBeInTheDocument();
    expect(within(breakdown).getByText('30 DAYS')).toBeInTheDocument();
    expect(within(breakdown).getByText('60 DAYS')).toBeInTheDocument();

    await waitFor(() => {
      expect(within(breakdown).getAllByText('300.00').length).toBeGreaterThan(0);
      expect(within(breakdown).getByText('700.00')).toBeInTheDocument();
      expect(within(breakdown).getByText('1,000.00')).toBeInTheDocument();
    });

    expect(within(breakdown).getByText('CASH SALES TOTAL')).toBeInTheDocument();
    expect(within(breakdown).getByText('TERMS SALES TOTAL')).toBeInTheDocument();
    expect(within(breakdown).getByText('PAYMENT TERMS TOTAL')).toBeInTheDocument();
  });

  it('keeps LBC COP and unknown or blank terms accounted for', async () => {
    getSalesReportDataMock.mockResolvedValue({
      transactions: [
        {
          id: 'cash-cop', date: '2026-09-01', customer: 'Customer A', customerId: 'customer-a',
          terms: 'lbc-cop', refNo: 'REF-1', soNo: 'SO-1', soAmount: 50, drAmount: 40, invoiceAmount: 30,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
        {
          id: 'unknown-term', date: '2026-09-02', customer: 'Customer A', customerId: 'customer-a',
          terms: 'on-account', refNo: 'REF-2', soNo: 'SO-2', soAmount: 60, drAmount: 50, invoiceAmount: 40,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
        {
          id: 'unknown-term-variant', date: '2026-09-02', customer: 'Customer A', customerId: 'customer-a',
          terms: 'ON ACCOUNT', refNo: 'REF-2B', soNo: 'SO-2B', soAmount: 10, drAmount: 5, invoiceAmount: 4,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
        {
          id: 'blank-term', date: '2026-09-03', customer: 'Customer A', customerId: 'customer-a',
          terms: '', refNo: 'REF-3', soNo: 'SO-3', soAmount: 70, drAmount: 60, invoiceAmount: 50,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
      ],
      summary: {
        categoryTotals: [],
        salespersonTotals: [],
        grandTotal: { soAmount: 190, drAmount: 155, invoiceAmount: 124, total: 124 },
      },
    });

    render(
      <SalesReportDataView
        dateFrom="2026-09-01"
        dateTo="2026-09-30"
        customerId="all"
        reportType="month"
        onBack={vi.fn()}
      />,
    );

    const breakdown = await screen.findByTestId('payment-terms-breakdown');
    expect(within(breakdown).getByText('AP/TT-PNB')).toBeInTheDocument();
    expect(within(breakdown).getByText('LBC COD')).toBeInTheDocument();
    expect(within(breakdown).getByText('LBC COP')).toBeInTheDocument();
    expect(within(breakdown).getByText('ON ACCOUNT')).toBeInTheDocument();
    expect(within(breakdown).getByText('UNSPECIFIED TERMS')).toBeInTheDocument();
    expect(within(breakdown).getByText('190.00')).toBeInTheDocument();
    expect(within(breakdown).getAllByText('70.00').length).toBeGreaterThan(0);
  });
});
