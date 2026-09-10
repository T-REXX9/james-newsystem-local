import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import OrderSlipView from '../OrderSlipView';
import { OrderSlipStatus } from '../../types';

const getAllOrderSlipsMock = vi.fn();
const getOrderSlipMock = vi.fn();
const fetchContactByIdMock = vi.fn();
const fetchContactsMock = vi.fn();

vi.mock('../../services/orderSlipLocalApiService', () => ({
  cancelOrderSlip: vi.fn(),
  finalizeOrderSlip: vi.fn(),
  getOrderSlip: (...args: unknown[]) => getOrderSlipMock(...args),
  getAllOrderSlips: (...args: unknown[]) => getAllOrderSlipsMock(...args),
  printOrderSlip: vi.fn(),
  updateOrderSlip: vi.fn(),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContactById: (...args: unknown[]) => fetchContactByIdMock(...args),
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
    getOrderSlipMock.mockResolvedValue(null);
    fetchContactByIdMock.mockResolvedValue(null);
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

  it('loads an initial Order Slip directly when it is outside the current month list', async () => {
    getAllOrderSlipsMock.mockResolvedValue([
      {
        id: 'slip-current-month',
        slip_no: 'N-CURRENT',
        order_id: 'so-current',
        contact_id: 'contact-1',
        sales_date: '2026-09-08',
        created_at: '2026-09-08T10:00:00',
        sales_person: 'Jane',
        status: OrderSlipStatus.FINALIZED,
        items: [],
      },
    ]);
    getOrderSlipMock.mockResolvedValue({
      id: 'slip-old',
      slip_no: 'N-OLD',
      order_id: 'so-old',
      contact_id: 'contact-1',
      sales_date: '2025-12-15',
      created_at: '2025-12-15T10:00:00',
      sales_person: 'Jane',
      status: OrderSlipStatus.FINALIZED,
      items: [],
    });

    render(<OrderSlipView initialSlipId="slip-old" initialMonth="9" initialYear="2026" />);

    await waitFor(() => expect(getOrderSlipMock).toHaveBeenCalledWith('slip-old'));
    expect(screen.getByDisplayValue('N-OLD')).toBeInTheDocument();
  });

  it('finishes opening a deep-linked order slip under React Strict Mode when it is outside the list', async () => {
    getAllOrderSlipsMock.mockResolvedValue([]);
    getOrderSlipMock.mockResolvedValue({
      id: 'slip-ledger',
      slip_no: 'N-LEDGER',
      order_id: 'so-ledger',
      contact_id: 'contact-1',
      sales_date: '2025-12-15',
      created_at: '2025-12-15T10:00:00',
      sales_person: 'Jane',
      status: OrderSlipStatus.FINALIZED,
      items: [],
    });

    render(
      <React.StrictMode>
        <OrderSlipView initialSlipId="slip-ledger" />
      </React.StrictMode>
    );

    expect(await screen.findByDisplayValue('N-LEDGER')).toBeInTheDocument();
  });
});
