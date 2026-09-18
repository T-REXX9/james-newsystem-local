import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesReportDataView from '../SalesReportDataView';

const getSalesReportDataMock = vi.fn();

vi.mock('../../services/salesReportService', () => ({
  getSalesReportData: (...args: unknown[]) => getSalesReportDataMock(...args),
}));

describe('SalesReportDataView legacy report display', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    getSalesReportDataMock.mockReset();
    getSalesReportDataMock.mockResolvedValue({
      transactions: [
        {
          id: 'invoice-1',
          date: '2026-09-01',
          customer: 'Customer A',
          customerId: 'customer-a',
          terms: 'AP/TT-PNB',
          refNo: 'INV-1',
          soNo: 'SO-1',
          soAmount: 125,
          drAmount: 0,
          invoiceAmount: 125,
          salesperson: 'Alex',
          category: 'Parts',
          vatType: null,
          type: 'invoice',
        },
      ],
      summary: {
        categoryTotals: [],
        salespersonTotals: [{
          salesperson: 'Alex',
          categories: [{ category: 'Parts', soAmount: 125, drAmount: 0, invoiceAmount: 0 }],
          total: 125,
        }],
        grandTotal: { soAmount: 125, drAmount: 0, invoiceAmount: 125, total: 125 },
      },
    });
  });

  it('renders the old report sections without the non-legacy payment breakdown', async () => {
    render(
      <SalesReportDataView
        dateFrom="2026-09-01"
        dateTo="2026-09-30"
        customerId="all"
        reportType="month"
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText('MONTHLY SALES')).toBeInTheDocument();
    expect(screen.getByText('DATE COVERED: SEP-01-2026 TO SEP-30-2026')).toBeInTheDocument();
    expect(screen.getByText('09/01/2026')).toBeInTheDocument();
    expect(screen.getByText('GRAND TOTAL -->')).toBeInTheDocument();
    expect(screen.getByText('Checked and Audited by/ Date:')).toBeInTheDocument();
    expect(screen.getByText('Noted by/ Date:')).toBeInTheDocument();

    const salespersonSummary = screen.getByTestId('salesperson-category-summary');
    expect(within(salespersonSummary).getByText('Alex')).toBeInTheDocument();
    expect(within(salespersonSummary).getByText('Parts')).toBeInTheDocument();
    expect(within(salespersonSummary).getAllByText('125.00')).toHaveLength(3);

    expect(screen.queryByText('PAYMENT TERMS BREAKDOWN')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payment-terms-breakdown')).not.toBeInTheDocument();
    expect(screen.queryByText('CASH SALES TOTAL')).not.toBeInTheDocument();
    expect(screen.queryByText('TERMS SALES TOTAL')).not.toBeInTheDocument();
  });
});
