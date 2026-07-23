import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TransferStockView from '../TransferStockView';

const { addToastMock } = vi.hoisted(() => ({ addToastMock: vi.fn() }));

const transfer = {
  id: 'transfer-ref-1',
  transfer_no: 'TR-10321',
  transfer_date: '2026-07-23',
  status: 'pending' as const,
  created_at: '2026-07-23 10:00:00',
  updated_at: '2026-07-23 10:00:00',
  is_deleted: false,
  items: [{
    id: '81',
    transfer_id: 'transfer-ref-1',
    item_id: '22',
    part_no: 'P-DLLA157SN725',
    item_code: 'QK2-1850',
    from_item_session: 'item-session-1',
    from_warehouse_id: 'WH1',
    from_original_qty: 6,
    to_item_session: 'item-session-1',
    to_warehouse_id: 'WH2',
    to_original_qty: 2,
    transfer_qty: 1,
    edited: 1,
    created_at: '2026-07-23 10:00:00',
  }],
};

vi.mock('../../services/transferStockService', () => ({
  addTransferStockPartNumbers: vi.fn(),
  approveTransferStock: vi.fn(),
  createTransferStockFromPartNumbers: vi.fn(),
  deleteTransferStock: vi.fn(),
  deleteTransferStockItem: vi.fn(),
  fetchTransferStocks: vi.fn(async () => [{ ...transfer, items: [] }]),
  generateTransferNo: vi.fn(async () => 'TR-10322'),
  getTransferStock: vi.fn(async () => transfer),
  submitTransferStock: vi.fn(),
  updateTransferStock: vi.fn(),
  updateTransferStockItem: vi.fn(),
}));

vi.mock('../../services/productLocalApiService', () => ({
  fetchProducts: vi.fn(async () => [{
    id: 'item-session-1',
    part_no: 'P-DLLA157SN725',
    item_code: 'QK2-1850',
    description: 'NOZZLE',
    brand: 'ISHINOMOTO',
    status: 'Active',
    stock_wh1: 6,
    stock_wh2: 2,
    stock_wh3: 0,
    stock_wh4: 0,
    stock_wh5: 0,
    stock_wh6: 0,
  }]),
}));

vi.mock('../../services/localAuthService', () => ({
  getLocalAuthSession: vi.fn(() => ({
    userProfile: { id: '1', role: 'Owner' },
    context: { user: { id: 1, main_id: 1 } },
  })),
}));

vi.mock('../../services/notificationLocalApiService', () => ({
  dispatchWorkflowNotification: vi.fn(),
  markNotificationsAsReadByEntityKey: vi.fn(),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

describe('TransferStockView legacy parity', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the legacy editable record workflow for a pending transfer', async () => {
    render(<TransferStockView />);

    await waitFor(() => expect(screen.getByText('TR No. : TR-10321')).toBeInTheDocument());
    expect(screen.getAllByText('Transfer Date:').length).toBeGreaterThan(0);
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Destination')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SUBMIT TRANSFER' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Part No' })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('QK2-1850')).toHaveLength(2);
  });

  it('switches Create New to the legacy part-number-first screen', async () => {
    render(<TransferStockView />);
    await waitFor(() => expect(screen.getByText('TR No. : TR-10321')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Create New' }));

    await waitFor(() => expect(screen.getByText('TR No. : 10322')).toBeInTheDocument());
    expect(screen.getByText('Part Number:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Transfer' })).toBeInTheDocument();
    expect(screen.queryByText('Transfer Date:')).not.toBeInTheDocument();
  });
});
