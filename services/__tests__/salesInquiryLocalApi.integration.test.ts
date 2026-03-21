import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { convertToOrder, createSalesInquiry } from '../salesInquiryLocalApiService';
import { getSalesOrderByInquiry } from '../salesOrderLocalApiService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);
const AUTH_STORAGE_KEY = 'local_api_auth_session';

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

const getAnyItemRefnos = async (): Promise<[string, string]> => {
  const response = await fetch(
    `${API_BASE_URL}/products?main_id=${MAIN_ID}&status=all&page=1&per_page=2`
  );
  if (!response.ok) throw new Error('Unable to load products');
  const payload = await response.json();
  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const first = String(items[0]?.product_session || items[0]?.id || '');
  const second = String(items[1]?.product_session || items[1]?.id || '');
  if (!first || !second) throw new Error('Need at least two products for conversion test');
  return [first, second];
};

describe('Sales Inquiry local API conversion', () => {
  beforeEach(() => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'integration-test-token',
        context: {
          token: 'integration-test-token',
          user: { id: 1, main_userid: MAIN_ID, email: 'integration@example.com' },
          main_userid: MAIN_ID,
          user_type: '1',
          session_branch: 'mainbranch',
          logintype: 'admin',
          industry: 'general',
        },
        userProfile: {
          id: '1',
          email: 'integration@example.com',
          main_id: MAIN_ID,
          main_userid: MAIN_ID,
          full_name: 'Integration User',
          role: 'Owner',
          access_rights: ['*'],
          monthly_quota: 0,
        },
      })
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it(
    'converts only approved inquiry items and reuses the linked order on repeat conversion',
    async () => {
      const contactId = await getAnyContactId();
      const [approvedItemRefno, pendingItemRefno] = await getAnyItemRefnos();
      const seed = Date.now();
      const referenceNo = `IT-INQ-CONVERT-${seed}`;

      const inquiry = await createSalesInquiry({
        contact_id: contactId,
        sales_date: new Date().toISOString().slice(0, 10),
        sales_person: 'Integration Test',
        delivery_address: 'Integration Address',
        reference_no: referenceNo,
        customer_reference: referenceNo,
        send_by: '',
      price_group: 'gold',
        credit_limit: 0,
      terms: 'gold',
        promise_to_pay: '',
        po_number: '',
        remarks: 'conversion regression test',
        inquiry_type: '',
        urgency: '',
        urgency_date: '',
        grand_total: 0,
        created_by: '1',
        status: 'Submitted',
        items: [
          {
            item_id: approvedItemRefno,
            qty: 1,
            part_no: 'APPROVED-PART',
            item_code: 'APPROVED-CODE',
            location: 'MAIN',
            description: 'approved item',
            unit_price: 10.5,
            amount: 10.5,
            remark: 'OnStock',
            approval_status: 'approved',
          },
          {
            item_id: pendingItemRefno,
            qty: 3,
            part_no: 'PENDING-PART',
            item_code: 'PENDING-CODE',
            location: 'MAIN',
            description: 'pending item',
            unit_price: 20,
            amount: 60,
            remark: 'OnStock',
            approval_status: 'pending',
          },
        ],
      } as any);

      const converted = await convertToOrder(inquiry.id);
      expect(converted.id).toBeTruthy();
      expect(converted.inquiry_id).toBe(inquiry.id);
      expect(converted.items).toHaveLength(1);
      expect(converted.items[0]?.item_id).toBe(approvedItemRefno);
      expect(converted.items[0]?.description).toBe('approved item');

      const convertedAgain = await convertToOrder(inquiry.id);
      expect(convertedAgain.id).toBe(converted.id);

      const linkedOrder = await getSalesOrderByInquiry(inquiry.id);
      expect(linkedOrder?.id).toBe(converted.id);
      expect(linkedOrder?.items).toHaveLength(1);
      expect(linkedOrder?.items[0]?.item_id).toBe(approvedItemRefno);
    },
    120000
  );
});
