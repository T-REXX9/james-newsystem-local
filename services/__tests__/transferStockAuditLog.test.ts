import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock activityLogService before importing transferStockService
const mockLogCreate = vi.fn().mockResolvedValue(true);
const mockLogUpdate = vi.fn().mockResolvedValue(true);
const mockLogDelete = vi.fn().mockResolvedValue(true);
const mockLogActivity = vi.fn().mockResolvedValue(true);

vi.mock('../activityLogService', () => ({
  logCreate: (...args: unknown[]) => mockLogCreate(...args),
  logUpdate: (...args: unknown[]) => mockLogUpdate(...args),
  logDelete: (...args: unknown[]) => mockLogDelete(...args),
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
  ENTITY_TYPES: { TRANSFER_STOCK: 'Transfer Stock' },
}));

// Mock localAuthService
vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({ context: { user: { id: 1 } } }),
}));

// Mock fetch for API calls
const mockTransferResponse = {
  ok: true,
  json: async () => ({
    ok: true,
    data: {
      transfer: {
        transfer_refno: 'TR-001',
        transfer_no: 'TR-001',
        transfer_date: '2026-03-23',
        status: 'Pending',
        user_id: '1',
      },
      items: [
        {
          id: '1',
          transfer_id: 'TR-001',
          item_id: '100',
          from_warehouse_id: 'WH1',
          to_warehouse_id: 'WH2',
          transfer_qty: 10,
          notes: 'test item',
          created_at: '2026-03-23',
        },
      ],
    },
  }),
};

const mockDeleteResponse = {
  ok: true,
  json: async () => ({ ok: true, data: null }),
};

describe('Transfer Stock audit logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockTransferResponse));
  });

  it('logs CREATE on successful createTransferStock', async () => {
    const { createTransferStock } = await import('../transferStockService');

    await createTransferStock({
      transfer_no: 'TR-001',
      transfer_date: '2026-03-23',
      items: [
        { item_id: '100', from_warehouse_id: 'WH1', to_warehouse_id: 'WH2', transfer_qty: 10 },
      ],
    } as any);

    expect(mockLogCreate).toHaveBeenCalledWith(
      'Transfer Stock',
      'TR-001',
      expect.objectContaining({
        transfer_no: 'TR-001',
        transfer_refno: 'TR-001',
        status: 'pending',
        items: expect.arrayContaining([
          expect.objectContaining({
            item_id: '100',
            from_warehouse_id: 'WH1',
            to_warehouse_id: 'WH2',
            transfer_qty: 10,
          }),
        ]),
      })
    );
  });

  it('logs UPDATE on successful updateTransferStock', async () => {
    const { updateTransferStock } = await import('../transferStockService');

    await updateTransferStock('TR-001', { notes: 'updated notes' } as any);

    expect(mockLogUpdate).toHaveBeenCalledWith(
      'Transfer Stock',
      'TR-001',
      expect.objectContaining({
        transfer_refno: 'TR-001',
        changed_fields: { notes: 'updated notes' },
      })
    );
  });

  it('logs STATUS_CHANGE on successful submitTransferStock', async () => {
    const { submitTransferStock } = await import('../transferStockService');

    await submitTransferStock('TR-001');

    expect(mockLogActivity).toHaveBeenCalledWith(
      'STATUS_CHANGE',
      'Transfer Stock',
      'TR-001',
      expect.objectContaining({
        old_status: 'pending',
        new_status: 'submitted',
        transfer_refno: 'TR-001',
      })
    );
  });

  it('logs STATUS_CHANGE with item details on successful approveTransferStock', async () => {
    const { approveTransferStock } = await import('../transferStockService');

    await approveTransferStock('TR-001');

    expect(mockLogActivity).toHaveBeenCalledWith(
      'STATUS_CHANGE',
      'Transfer Stock',
      'TR-001',
      expect.objectContaining({
        old_status: 'submitted',
        new_status: 'approved',
        transfer_refno: 'TR-001',
        items: expect.arrayContaining([
          expect.objectContaining({
            item_id: '100',
            from_warehouse_id: 'WH1',
            to_warehouse_id: 'WH2',
            transfer_qty: 10,
          }),
        ]),
      })
    );
  });

  it('logs DELETE on successful deleteTransferStock', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockDeleteResponse));

    const { deleteTransferStock } = await import('../transferStockService');

    await deleteTransferStock('TR-001');

    expect(mockLogDelete).toHaveBeenCalledWith(
      'Transfer Stock',
      'TR-001',
      expect.objectContaining({ transfer_refno: 'TR-001' })
    );
  });

  it('does NOT log when API call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      })
    );

    const { createTransferStock } = await import('../transferStockService');

    await expect(
      createTransferStock({
        transfer_no: 'TR-FAIL',
        transfer_date: '2026-03-23',
        items: [],
      } as any)
    ).rejects.toThrow();

    expect(mockLogCreate).not.toHaveBeenCalled();
  });
});
