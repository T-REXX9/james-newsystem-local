import { describe, expect, it } from 'vitest';
import { dailyCollectionService } from '../dailyCollectionService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8081/api/v1';
const MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const getAnyCustomerId = async (): Promise<string> => {
  const response = await fetch(
    `${API_BASE_URL}/customer-database?main_id=${MAIN_ID}&status=all&page=1&per_page=1`
  );
  if (!response.ok) throw new Error('Unable to load customer-database');
  const payload = await response.json();
  const row = payload?.data?.items?.[0];
  const sessionId = String(row?.session_id || '');
  if (!sessionId) throw new Error('No customer session id found');
  return sessionId;
};

describe('dailyCollectionService integration', () => {
  it(
    'communicates with collections endpoints for create/list/show/payment/action flow',
    async () => {
      const customerId = await getAnyCustomerId();

      const created = await dailyCollectionService.createCollection();
      expect(created.lrefno).toBeTruthy();
      expect(created.lcolection_no).toContain('DCR');

      const list = await dailyCollectionService.listCollections();
      expect(Array.isArray(list)).toBe(true);
      expect(list.some((row) => row.lrefno === created.lrefno)).toBe(true);

      const record = await dailyCollectionService.getCollection(created.lrefno);
      expect(record).toBeTruthy();
      expect(record?.lstatus).toBe('Pending');

      const unpaid = await dailyCollectionService.getUnpaidTransactions(customerId);
      const transactions = unpaid.slice(0, 2).map((row) => ({
        transaction_type: row.transactionType,
        transaction_refno: row.lrefno,
        transaction_no: row.linvoice_no,
        transaction_amount: row.totalAmount,
      }));

      await dailyCollectionService.addPayment(created.lrefno, {
        customerId,
        type: 'Cash',
        bank: '',
        checkNo: '',
        checkDate: new Date().toISOString().slice(0, 10),
        amount: 1,
        status: 'Cleared',
        remarks: 'integration test payment line',
        collectDate: new Date().toISOString().slice(0, 10),
        transactions,
      });

      const items = await dailyCollectionService.getCollectionItems(created.lrefno);
      expect(items.length).toBeGreaterThan(0);
      const createdItem = items.find((item) => String(item.lcustomer) === customerId) || items[0];
      expect(createdItem?.lid).toBeTruthy();

      await dailyCollectionService.deleteItem(createdItem.lid);
      const afterDelete = await dailyCollectionService.getCollectionItems(created.lrefno);
      expect(afterDelete.some((item) => item.lid === createdItem.lid)).toBe(false);

      await dailyCollectionService.runAction(created.lrefno, 'submitrecord');
      const submitted = await dailyCollectionService.getCollection(created.lrefno);
      expect(submitted?.lstatus).toBe('Submitted');
    },
    120000
  );
});

