import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesReportDataView from '../SalesReportDataView';

const getSalesReportDataMock = vi.fn();

vi.mock('../../services/salesReportService', () => ({
  getSalesReportData: (...args: unknown[]) => getSalesReportDataMock(...args),
}));

vi.mock('../../services/staffLocalApiService', () => ({
  fetchAssignableStaff: vi.fn().mockResolvedValue([
    { id: 'staff-taylor', role: 'Sales Agent', monthly_quota: 10000 },
  ]),
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
          currentAgentId: 'staff-alex',
          customerType: 'new',
          category: 'Parts',
          vatType: null,
          type: 'invoice',
        },
      ],
      summary: {
        categoryTotals: [],
        salespersonTotals: [{
          id: 'deleted-account',
          salesperson: 'test',
          categories: [],
          total: 999,
        }, {
          id: 'staff-alex',
          salesperson: 'Alex',
          categories: [{ category: 'Parts', soAmount: 125, drAmount: 0, invoiceAmount: 0 }],
          total: 125,
        }, {
          id: 'staff-taylor',
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
        currentUser={{ id: 'staff-taylor', role: 'Sales Agent', monthly_quota: 10000 }}
        activeSalesAgents={[
          { id: 'staff-alex', email: 'alex@example.com', full_name: 'Alex', role: 'Sales Agent' },
          { id: 'staff-taylor', email: 'taylor@example.com', full_name: 'Taylor', role: 'Sales Agent', monthly_quota: 10000 },
        ]}
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
    const summaryOnlyAgentCard = within(agentBreakdown).getByRole('article', { name: 'Taylor sales performance' });
    expect(summaryOnlyAgentCard).toHaveTextContent('0.00');
    expect(summaryOnlyAgentCard).toHaveTextContent('10,000.00');
    expect(within(summaryOnlyAgentCard).getByText('MONTHLY QUOTA')).toBeInTheDocument();
    expect(within(agentCard).queryByText('MONTHLY QUOTA')).not.toBeInTheDocument();

    expect(screen.queryByTestId('salesperson-category-summary')).not.toBeInTheDocument();
    expect(within(agentBreakdown).queryByRole('article', { name: 'test sales performance' })).not.toBeInTheDocument();

    const paymentTerms = screen.getByTestId('payment-terms-breakdown');
    expect(within(paymentTerms).getByText('PAYMENT TERMS BREAKDOWN')).toBeInTheDocument();
    expect(within(paymentTerms).getByText('CASH SALES TOTAL')).toBeInTheDocument();
    expect(within(paymentTerms).getByText('TERMS SALES TOTAL')).toBeInTheDocument();
  });

  it('does not show another agent’s quota to non-owner staff', async () => {
    render(
      <SalesReportDataView
        dateFrom="2026-09-01"
        dateTo="2026-09-30"
        customerId="all"
        reportType="month"
        onBack={vi.fn()}
        currentUser={{ id: 'staff-other', role: 'Warehouse Personnel' }}
      />,
    );

    const agentBreakdown = await screen.findByTestId('agent-customer-type-breakdown');
    expect(within(agentBreakdown).queryByText('MONTHLY QUOTA')).not.toBeInTheDocument();
  });
});
