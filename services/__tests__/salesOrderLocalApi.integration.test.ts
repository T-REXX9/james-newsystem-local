import { describe, expect, it } from 'vitest';
import { confirmSalesOrder, getAllSalesOrders, getSalesOrder } from '../salesOrderLocalApiService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const getAnyContactId = async (): Promise<string> => {
  const response = await fetch(
    `${API_BASE_URL}/customer-database?main_id=${MAIN_ID}&status=all&page=1&per_page=1`
  );
  if (!response.ok) throw new Error('Unable to load customer-database');
  const payload = await response.json();
  const row = payload?.data?.items?.[0];
  const sessionId = String(row?.session_id || '');
  if (!sessionId) throw new Error('No contact/session id found');
  return sessionId;
};

const getAnyItemRefno = async (): Promise<string> => {
  const response = await fetch(
    `${API_BASE_URL}/products?main_id=${MAIN_ID}&status=all&page=1&per_page=1`
  );
  if (!response.ok) throw new Error('Unable to load products');
  const payload = await response.json();
  const row = payload?.data?.items?.[0];
  const itemRefno = String(row?.product_session || row?.id || '');
  if (!itemRefno) throw new Error('No product session/id found');
  return itemRefno;
};

describe('Sales Order local API integration', () => {
  it(
    'loads sales orders and completes approve/cancel action flow',
    async () => {
      const contactId = await getAnyContactId();
      const itemRefno = await getAnyItemRefno();
      const seed = Date.now();
      const refNo = `IT-SO-${seed}`;

      const createPayload = {
        main_id: MAIN_ID,
        user_id: 1,
        contact_id: contactId,
        sales_date: new Date().toISOString().slice(0, 10),
        sales_person: 'Integration Test',
        delivery_address: 'Integration Address',
        reference_no: refNo,
        customer_reference: refNo,
        price_group: 'VIP2',
        terms: 'VIP2',
        terms_condition: 'LBC COD',
        status: 'Pending',
        items: [
          {
            item_refno: itemRefno,
            qty: 1,
            unit_price: 10.5,
            remark: 'OnStock',
          },
        ],
      };

      const createResponse = await fetch(`${API_BASE_URL}/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });
      expect(createResponse.ok).toBe(true);
      const createdPayload = await createResponse.json();
      const salesRefno = String(createdPayload?.data?.order?.sales_refno || '');
      expect(salesRefno).not.toBe('');

      const allOrders = await getAllSalesOrders();
      expect(Array.isArray(allOrders)).toBe(true);
      expect(allOrders.length).toBeGreaterThan(0);

      const loaded = await getSalesOrder(salesRefno);
      expect(loaded).toBeTruthy();
      expect(loaded?.id).toBe(salesRefno);
      expect(Array.isArray(loaded?.items)).toBe(true);
      expect((loaded?.items || []).length).toBeGreaterThan(0);

      const approved = await confirmSalesOrder(salesRefno);
      expect(approved).toBeTruthy();
      expect(approved?.status).toBe('Submitted');

      const approvedSecond = await confirmSalesOrder(salesRefno);
      expect(approvedSecond).toBeTruthy();
      expect(approvedSecond?.status).toBe('Approved');

      const cancelResponse = await fetch(
        `${API_BASE_URL}/sales-orders/${encodeURIComponent(salesRefno)}/actions/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ main_id: MAIN_ID, reason: 'integration test cleanup' }),
        }
      );
      expect(cancelResponse.ok).toBe(true);

      const cancelled = await getSalesOrder(salesRefno);
      expect(cancelled).toBeTruthy();
      expect(cancelled?.status).toBe('Cancelled');
    },
    120000
  );
});
