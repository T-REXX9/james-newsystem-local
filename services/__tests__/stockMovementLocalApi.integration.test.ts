import { describe, expect, it } from 'vitest';
import {
  createStockMovementLog,
  deleteStockMovementLog,
  fetchStockMovementLogs,
  updateStockMovementLog,
} from '../stockMovementLocalApiService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8081/api/v1';
const MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const getFirstProductId = async (): Promise<string> => {
  const params = new URLSearchParams({
    main_id: String(MAIN_ID),
    page: '1',
    per_page: '1',
    status: 'all',
  });
  const response = await fetch(`${API_BASE_URL}/products?${params.toString()}`);
  if (!response.ok) throw new Error('Unable to load products');
  const payload = await response.json();
  const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  if (rows.length === 0) throw new Error('No product rows found');
  return String(rows[0].id);
};

const getLogById = async (id: number): Promise<any | null> => {
  const response = await fetch(`${API_BASE_URL}/stock-movements/${id}?main_id=${MAIN_ID}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
  const payload = await response.json();
  return payload?.data || null;
};

describe('Stock Movement local API integration', () => {
  it(
    'completes CRUD flow through stock movement endpoint',
    async () => {
      const productId = await getFirstProductId();
      const seed = Date.now();
      const refNo = `IT-SM-${seed}`;

      const created = await createStockMovementLog({
        user_id: 1,
        item_id: productId,
        date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        transaction_type: 'Stock Adjustment',
        reference_no: refNo,
        warehouse_id: 'WH1',
        status_indicator: '+',
        qty_in: 3,
        unit_price: 0,
        notes: 'stock movement integration create',
      });

      const createdId = Number(created.id);
      expect(createdId).toBeGreaterThan(0);
      expect(created.reference_no).toBe(refNo);

      const listed = await fetchStockMovementLogs({
        item_id: productId,
        search: refNo,
        page: 1,
        per_page: 20,
      });
      expect(Array.isArray(listed.logs)).toBe(true);
      expect(listed.logs.some((row) => Number(row.id) === createdId)).toBe(true);

      const updated = await updateStockMovementLog(createdId, {
        user_id: 1,
        transaction_type: 'Stock Adjustment',
        status_indicator: '-',
        qty_out: 2,
        notes: 'stock movement integration update',
      });
      expect(Number(updated.id)).toBe(createdId);
      expect(updated.status_indicator).toBe('-');
      expect(updated.qty_out).toBe(2);

      const fetchedAfterUpdate = await getLogById(createdId);
      expect(fetchedAfterUpdate).toBeTruthy();
      expect(String(fetchedAfterUpdate.notes)).toContain('integration update');

      const deleted = await deleteStockMovementLog(createdId);
      expect(deleted).toBe(true);

      const afterDelete = await getLogById(createdId);
      expect(afterDelete).toBeNull();
    },
    120000
  );
});

