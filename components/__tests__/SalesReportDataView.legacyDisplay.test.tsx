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
          customerType: 'new',
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
        }, {
          salesperson: 'Taylor',
          categories: [],
          total: 0,
        }],
        grandTotal: { soAmount: 125, drAmount: 0, invoiceAmount: 125, total: 125 },
      },
    });
  });

  it('renders the legacy report sections with the payment terms summary', async () => {
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
    expect(screen.getByText('FOR THE MONTH OF SEPTEMBER')).toBeInTheDocument();
    expect(screen.getByText('09/01/2026')).toBeInTheDocument();
    expect(screen.getByText('GRAND TOTAL -->')).toBeInTheDocument();
    expect(screen.getByText('Checked and Audited by/ Date:')).toBeInTheDocument();
    expect(screen.getByText('Noted by/ Date:')).toBeInTheDocument();

    const agentBreakdown = screen.getByTestId('agent-customer-type-breakdown');
    expect(within(agentBreakdown).getByText('SALES PERFORMANCE BY AGENT')).toBeInTheDocument();
    const agentCard = within(agentBreakdown).getByRole('article', { name: 'Alex sales performance' });
    expect(agentCard).toHaveTextContent(/1 posted transaction · 1 customer/);
    expect(within(agentBreakdown).getAllByText('New customers')).toHaveLength(3);
    expect(within(agentBreakdown).getAllByText('Existing customers')).toHaveLength(3);
    expect(within(agentBreakdown).getAllByText('Unclassified')).toHaveLength(3);
    expect(within(agentBreakdown).getByRole('article', { name: 'Taylor sales performance' })).toHaveTextContent('0.00');

    const salespersonSummary = screen.getByTestId('salesperson-category-summary');
    expect(within(salespersonSummary).getByText('Alex')).toBeInTheDocument();
    expect(within(salespersonSummary).getByText('Parts')).toBeInTheDocument();
    expect(within(salespersonSummary).getAllByText('125.00')).toHaveLength(3);

    const paymentTerms = screen.getByTestId('payment-terms-breakdown');
    expect(within(paymentTerms).getByText('PAYMENT TERMS BREAKDOWN')).toBeInTheDocument();
    expect(within(paymentTerms).getByText('CASH SALES TOTAL')).toBeInTheDocument();
    expect(within(paymentTerms).getByText('TERMS SALES TOTAL')).toBeInTheDocument();
  });
});
