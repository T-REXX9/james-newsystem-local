import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
    expect(getReportMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, perPage: 50 }));
  });

  it('loads every page automatically and shows the full history range', async () => {
    const firstRow = {
      source_type: 'INVOICE', source_refno: 'ref-1', source_no: 'D1', ldate: '2026-09-08',
      litemcode: 'ITEM-1', lpartno: 'P-1', ldesc: 'First item', lbrand: 'BRAND',
      lqty: 1, lprice: 10, return_qty: 0, net_qty: 1, line_total: 10,
    };
    const secondRow = { ...firstRow, source_refno: 'ref-2', source_no: 'D2', litemcode: 'ITEM-2', lpartno: 'P-2', ldesc: 'Second item' };
    const customer = { company: '3R MAN CALIBRATION', old_name: '', customer_since: '', vip_status: 'REGULAR', price_code: 'VIP1', current_month_sales: 0, outstanding_balance: 0, terms: '', credit_limit: 0, agent_name: '' };
    getReportMock
      .mockResolvedValueOnce({ customer_session: 'customer-1', date_from: '2026-09-08', date_to: '2026-09-08', generated_at: '', customer, items: [firstRow], pagination: { page: 1, per_page: 50, has_more: true } })
      .mockResolvedValueOnce({
        customer_session: 'customer-1', date_from: '2026-09-08', date_to: '2026-09-08', generated_at: '',
        customer,
        items: [secondRow], pagination: { page: 2, per_page: 50, has_more: false },
      });

    render(<PurchaseHistoryReportView />);
    expect((await screen.findAllByText('First item')).length).toBeGreaterThan(0);

    expect((await screen.findAllByText('Second item')).length).toBeGreaterThan(0);
    await waitFor(() => expect(getReportMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2, perPage: 50 })));
    expect(screen.getByText(/Customer Purchase History for the Period/)).toHaveTextContent('SEP‑08‑26 and SEP‑08‑26');
  });

  it('shows the first page while the rest of a long history is still loading', async () => {
    const firstRow = {
      source_type: 'INVOICE', source_refno: 'ref-1', source_no: 'D1', ldate: '2026-09-08',
      litemcode: 'ITEM-1', lpartno: 'P-1', ldesc: 'First page item', lbrand: 'BRAND',
      lqty: 1, lprice: 10, return_qty: 0, net_qty: 1, line_total: 10,
    };
    const customer = { company: '3R MAN CALIBRATION', old_name: '', customer_since: '', vip_status: 'REGULAR', price_code: 'VIP1', current_month_sales: 0, outstanding_balance: 0, terms: '', credit_limit: 0, agent_name: '' };
    const pendingNextPage = new Promise<never>(() => {});
    getReportMock
      .mockResolvedValueOnce({
        customer_session: 'customer-1', date_from: null, date_to: null, generated_at: '',
        customer,
        items: [firstRow], pagination: { page: 1, per_page: 50, has_more: true },
      })
      .mockReturnValueOnce(pendingNextPage);

    render(<PurchaseHistoryReportView />);

    expect((await screen.findAllByText('First page item', {}, { timeout: 500 })).length).toBeGreaterThan(0);
    expect(screen.getByText(/Loading more purchase history/)).toBeInTheDocument();
  });

  it('keeps CM CALIBRATION CENTER responsive with thousands of history rows', async () => {
    const items = Array.from({ length: 3_404 }, (_, index) => ({
      source_type: 'INVOICE', source_refno: `ref-${index}`, source_no: `D-${index}`, ldate: '2026-09-08',
      litemcode: `ITEM-${index}`, lpartno: `PART-${index}`, ldesc: `Product ${index}`, lbrand: 'BRAND',
      lqty: 1, lprice: 10, return_qty: 0, net_qty: 1, line_total: 10,
    }));
    getReportMock.mockResolvedValueOnce({
      customer_session: 'customer-1', date_from: '2026-09-08', date_to: '2026-09-08', generated_at: '',
      customer: { company: 'CM CALIBRATION CENTER', old_name: '', customer_since: '', vip_status: 'REGULAR', price_code: 'VIP1', current_month_sales: 0, outstanding_balance: 0, terms: '', credit_limit: 0, agent_name: '' },
      items,
      pagination: { page: 1, per_page: 3_404, has_more: false },
    });

    render(<PurchaseHistoryReportView />);

    expect(await screen.findByText('Showing 100 of 3,404 rows')).toBeInTheDocument();
    expect(screen.getByText('Showing 100 of 3,404 part numbers')).toBeInTheDocument();
    expect(screen.queryByText('D-150')).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Product \d+$/)).toHaveLength(200);
  });
});
