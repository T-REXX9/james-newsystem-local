import { describe, expect, it } from 'vitest';
import {
  getReorderWorkflowStages,
  isReorderWorkflowActive,
  type ReorderReportEntry,
} from '../reorderReportService';

const row = (updates: Partial<ReorderReportEntry> = {}): ReorderReportEntry => ({
  id: '1', product_session: 'session-1', item_code: 'ITEM-1', part_no: 'PART-1',
  description: 'Item', is_hidden: false, reorder_qty: 10, replenish_qty: 10,
  current_stock: 1, total_rr: 0, total_return: 0, target_quantity: 10,
  pr_refno: '', pr_no: '', pr_status: '', po_refno: '', po_no: '', po_status: '',
  rr_refno: '', rr_no: '', rr_status: '', last_arrival_date: '', last_arrival_qty: 0,
  ...updates,
});

describe('reorder purchasing workflow stages', () => {
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

  it('shows all three stage statuses', () => {
    expect(getReorderWorkflowStages(row({
      pr_refno: 'PR-1', pr_status: 'Approved',
      po_refno: 'PO-1', po_status: 'Posted',
    }))).toEqual({ pr: 'Approved', po: 'Posted', receiving: 'Not started' });
  });
});
