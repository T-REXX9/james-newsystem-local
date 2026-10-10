import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import CustomerMetricsView from '../CustomerMetricsView';
import PurchaseHistoryTab from '../PurchaseHistoryTab';

const fetchCustomerMetricsMock = vi.fn();
const fetchDailyCallPurchaseHistoryMock = vi.fn();

vi.mock('../../services/dailyCallCustomerDetailService', () => ({
  fetchDailyCallCustomerMetrics: (...args: unknown[]) => fetchCustomerMetricsMock(...args),
  fetchDailyCallPurchaseHistory: (...args: unknown[]) => fetchDailyCallPurchaseHistoryMock(...args),
}));

describe('customer detail data tabs', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads metrics through the Daily Call customer scope', async () => {
    fetchCustomerMetricsMock.mockResolvedValue({
      contact_id: 'contact-1',
      total_purchases: 12000,
      average_order_value: 6000,
      last_purchase_date: '2026-09-01',
      outstanding_balance: 2500,
      credit_limit: 50000,
      currency: 'PHP',
    });

    render(<CustomerMetricsView contactId="contact-1" />);

    expect(await screen.findByText('₱12,000')).toBeInTheDocument();
    expect(fetchCustomerMetricsMock).toHaveBeenCalledWith('contact-1');
  });

  it('shows purchase-history failures instead of an empty-history message', async () => {
    fetchDailyCallPurchaseHistoryMock.mockRejectedValueOnce(new Error('Purchase history unavailable'));

    render(<PurchaseHistoryTab contactId="contact-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Purchase history unavailable');
    expect(screen.queryByText('No purchase history yet')).not.toBeInTheDocument();
  });

  it('groups purchases by month and shows monthly and grand totals', async () => {
    fetchDailyCallPurchaseHistoryMock.mockResolvedValueOnce([
      {
        id: 'txn-2',
        purchase_date: '2026-09-18',
        invoice_number: 'INV-102',
        total_amount: '2500',
        payment_status: 'paid',
        products: [{ name: 'Brake Pad', quantity: 2, price: 1250 }],
      },
      {
        id: 'txn-1',
        purchase_date: '2026-08-04',
        invoice_number: 'INV-101',
        total_amount: 1000,
        payment_status: 'pending',
        products: [],
      },
    ]);

    render(<PurchaseHistoryTab contactId="contact-1" />);

    expect(await screen.findByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
    expect(screen.getByText('Brake Pad')).toBeInTheDocument();
    expect(screen.getByText('September 2026 Total')).toBeInTheDocument();
    expect(screen.getByText('Grand Total: ₱3,500.00')).toBeInTheDocument();
  });

  it('never shows an internal transaction ID when no invoice reference exists', async () => {
    fetchDailyCallPurchaseHistoryMock.mockResolvedValueOnce([{
      id: '2026091118412169759',
      purchase_date: '2026-09-11',
      invoice_number: '',
      total_amount: 100,
      payment_status: 'pending',
      products: [],
    }]);

    render(<PurchaseHistoryTab contactId="contact-1" />);

    expect(await screen.findByText('Reference unavailable')).toBeInTheDocument();
    expect(screen.queryByText('2026091118412169759')).not.toBeInTheDocument();
  });
});
