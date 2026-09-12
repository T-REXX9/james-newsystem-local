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
});
