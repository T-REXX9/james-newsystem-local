import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchReorderReportEntries,
  getReorderWorkflowStages,
  isReorderWorkflowActive,
  mapReorderItemToPrLine,
  sharedSupplierCogOptions,
  type ReorderReportEntry,
} from '../reorderReportService';

const row = (updates: Partial<ReorderReportEntry> = {}): ReorderReportEntry => ({
  id: '1', product_session: 'session-1', item_code: 'ITEM-1', part_no: 'PART-1',
  description: 'Item', is_hidden: false, reorder_qty: 10, replenish_qty: 10,
  current_stock: 1, physical_stock: 1, reserved_stock: 0, available_stock: 1,
  total_rr: 0, total_return: 0, target_quantity: 10, suggested_reorder_qty: 9,
  pr_requested_qty: 0,
  open_pr_qty: 0, po_ordered_qty: 0, open_po_qty: 0, received_qty: 0,
  accepted_qty: 0, remaining_qty: 0, preferred_supplier_id: '',
  preferred_supplier_name: '', preferred_supplier_cost: 0,
  supplier_costs: [],
  overall_status: '', can_create_pr: true, pr_documents: [], po_documents: [], rr_documents: [],
  pr_refno: '', pr_no: '', pr_status: '', po_refno: '', po_no: '', po_status: '',
  rr_refno: '', rr_no: '', rr_status: '', last_arrival_date: '', last_arrival_qty: 0,
  ...updates,
});

describe('reorder purchasing workflow stages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes negative available stock from the API to zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          items: [{ id: 1, product_session: 'session-negative', available_stock: -2 }],
          meta: { page: 1, per_page: 100, total: 1, total_pages: 1 },
        },
      }),
    }));

    const result = await fetchReorderReportEntries({ warehouseType: 'total' });

    expect(result.items[0]?.available_stock).toBe(0);
  });

  it('blocks another request while PR, PO, or Receiving is active', () => {
    expect(isReorderWorkflowActive(row({ pr_refno: 'PR-1', pr_status: 'Pending' }))).toBe(true);
    expect(isReorderWorkflowActive(row({ po_refno: 'PO-1', po_status: 'Posted' }))).toBe(true);
    expect(isReorderWorkflowActive(row({ rr_refno: 'RR-1', rr_status: 'Pending' }))).toBe(true);
  });

  it.each(['Posted', 'Received', 'Delivered', 'Completed'])(
    'releases the item after Receiving is %s',
    (receivingStatus) => {
      expect(isReorderWorkflowActive(row({
        pr_refno: 'PR-1', pr_status: 'Approved',
        po_refno: 'PO-1', po_status: 'Posted',
        rr_refno: 'RR-1', rr_status: receivingStatus,
      }))).toBe(false);
    },
  );

  it('allows selection when the report marks an item for PR despite an old pending receiving reference', () => {
    expect(isReorderWorkflowActive(row({
      can_create_pr: true,
      overall_status: 'Needs PR',
      rr_refno: 'OLD-RR-1',
      rr_status: 'Pending',
    }))).toBe(false);
  });

  it('blocks selection when the report marks the current purchasing workflow as active', () => {
    expect(isReorderWorkflowActive(row({
      can_create_pr: false,
      overall_status: 'Ordered',
      po_refno: 'PO-1',
      po_status: 'Posted',
    }))).toBe(true);
  });

  it('shows all three stage statuses', () => {
    expect(getReorderWorkflowStages(row({
      pr_refno: 'PR-1', pr_status: 'Approved',
      po_refno: 'PO-1', po_status: 'Posted',
    }))).toEqual({ pr: 'Approved', po: 'Posted', receiving: 'Not started' });
  });
});

const qkyt = { supplier_id: '11', supplier_code: 'QKYT', supplier_name: 'QKYT', supplier_cost: 48 };
const qjso = { supplier_id: '22', supplier_code: 'QJSO', supplier_name: 'QJSO', supplier_cost: 55 };
const qkhb = { supplier_id: '33', supplier_code: 'QKHB', supplier_name: 'QKHB', supplier_cost: 99 };

describe('Reorder Report Supplier COG for Purchase Request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps every Product Database Supplier COG on the report row', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          items: [{
            id: 1,
            product_session: 'session-valve',
            preferred_supplier_id: '11',
            preferred_supplier_name: 'QKYT',
            preferred_supplier_cost: 48,
            supplier_costs: [qkyt, qjso, qkhb],
          }],
          meta: { page: 1, per_page: 100, total: 1, total_pages: 1 },
        },
      }),
    }));

    const result = await fetchReorderReportEntries({ warehouseType: 'total' });

    expect(result.items[0]?.supplier_costs).toEqual([qkyt, qjso, qkhb]);
    expect(result.items[0]?.preferred_supplier_id).toBe('11');
  });

  it('writes the chosen Supplier COG and its recorded cost onto the Purchase Request line', () => {
    const item = row({
      preferred_supplier_id: qkyt.supplier_id,
      preferred_supplier_name: qkyt.supplier_name,
      preferred_supplier_cost: qkyt.supplier_cost,
      supplier_costs: [qkyt, qjso, qkhb],
    });

    expect(mapReorderItemToPrLine(item).supplier_id).toBe('11');
    expect(mapReorderItemToPrLine(item).unit_cost).toBe(48);
    expect(mapReorderItemToPrLine(item, qjso.supplier_id)).toEqual(expect.objectContaining({
      supplier_id: '22',
      supplier_name: 'QJSO',
      unit_cost: 55,
    }));
  });

  it('does not apply a company supplier that has no Supplier COG on the product', () => {
    const item = row({
      preferred_supplier_id: qkyt.supplier_id,
      preferred_supplier_name: qkyt.supplier_name,
      preferred_supplier_cost: qkyt.supplier_cost,
      supplier_costs: [qkyt, qjso, qkhb],
    });

    expect(mapReorderItemToPrLine(item, 'HQ')).toEqual(expect.objectContaining({
      supplier_id: '11',
      supplier_name: 'QKYT',
      unit_cost: 48,
    }));
  });

  it('limits a bulk override to Supplier COG shared by every selected item', () => {
    const valve = row({
      id: '1',
      item_code: 'VALVE',
      supplier_costs: [qkyt, qjso, qkhb],
    });
    const bearing = row({
      id: '2',
      item_code: 'BEARING',
      product_session: 'session-2',
      supplier_costs: [qkyt, { supplier_id: '44', supplier_code: 'QAOJ', supplier_name: 'QAOJ', supplier_cost: 12 }],
    });

    expect(sharedSupplierCogOptions([valve, bearing])).toEqual([qkyt]);
  });
});
