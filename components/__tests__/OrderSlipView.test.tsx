import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import OrderSlipView from '../OrderSlipView';
import { OrderSlipStatus } from '../../types';

const getAllOrderSlipsMock = vi.fn();
const fetchContactsMock = vi.fn();

vi.mock('../../services/orderSlipLocalApiService', () => ({
  cancelOrderSlip: vi.fn(),
  finalizeOrderSlip: vi.fn(),
  getOrderSlip: vi.fn(),
  getAllOrderSlips: (...args: unknown[]) => getAllOrderSlipsMock(...args),
  printOrderSlip: vi.fn(),
  updateOrderSlip: vi.fn(),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContactById: vi.fn(),
  fetchContacts: (...args: unknown[]) => fetchContactsMock(...args),
}));

vi.mock('../../services/salesOrderLocalApiService', () => ({
  isOrderSlipAllowedForTransactionType: () => true,
  syncDocumentPolicyState: vi.fn(),
  unpostSalesOrder: vi.fn(),
}));

vi.mock('../../services/localAuthService', () => ({
  getLocalAuthSession: vi.fn(() => ({ context: { user: { type: 'Owner' } } })),
}));

vi.mock('../../services/notificationLocalApiService', () => ({
  dispatchWorkflowNotification: vi.fn(),
  markNotificationsAsReadByEntityKey: vi.fn(),
  resolveNotificationUserId: vi.fn(),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('../ModuleRecordAction', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../ModuleRecordLink', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

describe('OrderSlipView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchContactsMock.mockResolvedValue([{ id: 'contact-1', company: 'Acme Corp', transactionType: 'Invoice' }]);
  });

  afterEach(cleanup);

  it('keeps every Order Slip list column visible without desktop horizontal scrolling', async () => {
    getAllOrderSlipsMock.mockResolvedValue([
      {
        id: 'slip-1',
        slip_no: 'OS26-1001',
        order_id: 'so-1',
        sales_no: 'SO26-1001',
        contact_id: 'contact-1',
        sales_date: '2026-09-05',
        sales_person: 'Jane',
        debit_memo_no: 'DM-1',
        tracking_no: 'TRACK-1',
        status: OrderSlipStatus.DRAFT,
        items: [],
      },
    ]);

    render(<OrderSlipView />);

    await screen.findByText('OS26-1001');

    const list = screen.getByTestId('order-slip-list');
    expect(list).toHaveClass('overflow-x-auto', 'lg:overflow-x-hidden');
    expect(list.querySelectorAll('table')).toHaveLength(1);
    expect(list.querySelector('table')).toHaveClass('min-w-[1100px]', 'lg:min-w-0');
    ['Date', 'Customer', 'SO No.', 'OS No.', 'DM No.', 'Tracking No.', 'Sales Person', 'Status'].forEach((heading) => {
      expect(within(list).getByText(heading)).toBeVisible();
    });
  });
});
