import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesReportDataView from '../SalesReportDataView';

const getSalesReportDataMock = vi.fn();

vi.mock('../../services/salesReportService', () => ({
  getSalesReportData: (...args: unknown[]) => getSalesReportDataMock(...args),
}));

const renderReport = () => render(
  <SalesReportDataView
    dateFrom="2026-09-01"
    dateTo="2026-09-30"
    customerId="all"
    reportType="month"
    onBack={vi.fn()}
  />,
);

describe('SalesReportDataView payment terms breakdown', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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

  it('groups the report records without changing their returned amounts', async () => {
    renderReport();

    const breakdown = await screen.findByTestId('payment-terms-breakdown');
    expect(within(breakdown).getByText('AP/TT-PNB')).toBeInTheDocument();
    expect(within(breakdown).getByText('LBC COD')).toBeInTheDocument();
    expect(within(breakdown).getByText('LBC COP')).toBeInTheDocument();
    expect(within(breakdown).getByText('30 DAYS')).toBeInTheDocument();
    expect(within(breakdown).getByText('60 DAYS')).toBeInTheDocument();
    expect(within(breakdown).getByText('CASH SALES TOTAL')).toBeInTheDocument();
    expect(within(breakdown).getByText('TERMS SALES TOTAL')).toBeInTheDocument();
    expect(within(breakdown).getByText('PAYMENT TERMS TOTAL')).toBeInTheDocument();
    expect(within(breakdown).getByText('1,000.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('960.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('920.00')).toBeInTheDocument();
  });

  it('keeps unknown and blank terms visible and included', async () => {
    getSalesReportDataMock.mockResolvedValue({
      transactions: [
        {
          id: 'unknown-term', date: '2026-09-01', customer: 'Customer A', customerId: 'customer-a',
          terms: 'on-account', refNo: 'REF-1', soNo: 'SO-1', soAmount: 60, drAmount: 50, invoiceAmount: 40,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
        {
          id: 'blank-term', date: '2026-09-02', customer: 'Customer A', customerId: 'customer-a',
          terms: '', refNo: 'REF-2', soNo: 'SO-2', soAmount: 70, drAmount: 60, invoiceAmount: 50,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
      ],
      summary: {
        categoryTotals: [], salespersonTotals: [],
        grandTotal: { soAmount: 130, drAmount: 110, invoiceAmount: 90, total: 90 },
      },
    });

    renderReport();

    const breakdown = await screen.findByTestId('payment-terms-breakdown');
    expect(within(breakdown).getByText('ON ACCOUNT')).toBeInTheDocument();
    expect(within(breakdown).getByText('UNSPECIFIED TERMS')).toBeInTheDocument();
    expect(within(breakdown).getAllByText('130.00')).toHaveLength(2);
    expect(within(breakdown).getAllByText('110.00')).toHaveLength(2);
    expect(within(breakdown).getAllByText('90.00')).toHaveLength(2);
  });

  it('uses distinct React keys for terms sharing a display label', async () => {
    getSalesReportDataMock.mockResolvedValue({
      transactions: [
        {
          id: 'slash', date: '2026-09-01', customer: 'Customer A', customerId: 'customer-a',
          terms: '30 DAYS / TT BPI', refNo: 'REF-1', soNo: 'SO-1', soAmount: 100, drAmount: 90, invoiceAmount: 80,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
        {
          id: 'space', date: '2026-09-02', customer: 'Customer A', customerId: 'customer-a',
          terms: '30 DAYS TT BPI', refNo: 'REF-2', soNo: 'SO-2', soAmount: 200, drAmount: 190, invoiceAmount: 180,
          salesperson: 'Alex', category: 'Parts', vatType: null, type: 'invoice',
        },
      ],
      summary: {
        categoryTotals: [], salespersonTotals: [],
        grandTotal: { soAmount: 300, drAmount: 280, invoiceAmount: 260, total: 260 },
      },
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderReport();

    const breakdown = await screen.findByTestId('payment-terms-breakdown');
    expect(within(breakdown).getAllByText('30 DAYS TT BPI')).toHaveLength(2);
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('Encountered two children with the same key');
  });
});
