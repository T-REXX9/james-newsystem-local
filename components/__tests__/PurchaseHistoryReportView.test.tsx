import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PurchaseHistoryReportView from '../PurchaseHistoryReportView';

const getCustomersMock = vi.fn();
const getReportMock = vi.fn();

vi.mock('../../services/purchaseHistoryReportService', () => ({
  purchaseHistoryReportService: {
    getCustomers: (...args: unknown[]) => getCustomersMock(...args),
    getReport: (...args: unknown[]) => getReportMock(...args),
  },
}));

describe('PurchaseHistoryReportView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCustomersMock.mockResolvedValue([
      { sessionId: 'customer-1', company: '3R MAN CALIBRATION', customerCode: 'C-001' },
    ]);
    getReportMock.mockResolvedValue({
      customer_session: 'customer-1',
      date_from: '2013-06-01',
      date_to: '2026-08-16',
      generated_at: '2026-08-16T12:07:44',
      customer: {
        company: '3R MAN CALIBRATION',
        old_name: 'xyz manny',
        customer_since: '2014-11-19',
        vip_status: 'GOLD',
        price_code: 'VIP2',
        current_month_sales: 6200,
        outstanding_balance: 85,
        terms: 'AP-TT/BPI',
        credit_limit: 20000,
        agent_name: 'APOSTOL',
      },
      items: [
        {
          source_type: 'INVOICE', source_refno: 'ref-1', source_no: 'D21264', ldate: '2019-06-03',
          litemcode: 'QKM2-024A', lpartno: 'P-6201ZZ', ldesc: 'BEARING-ISHINOMOTO', lbrand: 'ISHINOMOTO',
          lqty: 10, lprice: 25, return_qty: 2, net_qty: 8, line_total: 200,
        },
      ],
    });
  });

  afterEach(cleanup);

  it('matches James’s customer purchase-history fields, detail columns, and totals', async () => {
    render(<PurchaseHistoryReportView />);

    expect(await screen.findByText(/Old Name: xyz manny/)).toBeInTheDocument();
    for (const label of ['Customer Since', 'VIP Status', 'Price Code', 'Total Sales (Current Month)', 'Outstanding Balance', 'Terms', 'Credit Limit']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/Agent:/)).toHaveTextContent('APOSTOL');
    for (const heading of ['#', 'Date', 'Ref #', 'Item Code', 'Part No.', 'Product Description', 'Unit Price', 'Qty Sold', 'Qty Ret.', 'Amount Sold', 'Amount Return']) {
      expect(screen.getAllByRole('columnheader', { name: heading }).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('D21264')).toBeInTheDocument();
    expect(screen.getByText('Grand Total =>')).toBeInTheDocument();
    expect(screen.getByText('Item Total: 1')).toBeInTheDocument();
    expect(screen.getByText('Total Qty: 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});
