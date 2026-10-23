import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateSalesReturnPostedAmount, SourceDocAutocomplete } from '../SalesReturnPage';
import type { Contact } from '../../types';
import { mapSalesReturnRecord, salesReturnService, type SalesReturnSourceDocument } from '../../services/salesReturnLocalApiService';

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

afterEach(() => vi.unstubAllGlobals());

describe('Sales Return source-document autocomplete', () => {
  it('searches, displays, and selects historical order slip D24116', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const source: SalesReturnSourceDocument = {
      id: '200807081917831971',
      doc_no: 'D24116',
      type: 'OR',
      contact_id: '82481553820200807132657',
      customer_name: 'Test Customer',
      sales_person: 'Agent',
      sales_date: '2020-02-24',
      status: 'Posted',
      grand_total: 1800,
      item_count: 1,
    };
    const customer = {
      id: source.contact_id,
      company: 'Test Customer',
    } as Contact;
    const onSearch = vi.fn().mockResolvedValue([source]);

    render(
      <SourceDocAutocomplete
        documents={[]}
        customers={[customer]}
        selectedDoc={null}
        onSelect={onSelect}
        onSearch={onSearch}
      />
    );

    await user.type(screen.getByPlaceholderText('Search invoice or OR number...'), 'D24116');

    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('D24116'));
    expect(await screen.findByText('D24116')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getByText('Test Customer')).toBeInTheDocument();

    await user.click(screen.getByText('D24116'));
    expect(onSelect).toHaveBeenCalledWith(source);
  });
});

describe('Sales Return header values and posted amount', () => {
  it('matches posting math for no discount, exhausted discount, over-discount, and exclusive tax', () => {
    expect(calculateSalesReturnPostedAmount(100, 0, 'Exclusive')).toBeCloseTo(112);
    expect(calculateSalesReturnPostedAmount(100, 100, 'Exclusive')).toBe(0);
    expect(calculateSalesReturnPostedAmount(100, 125, 'Exclusive')).toBe(0);
    expect(calculateSalesReturnPostedAmount(100, 10, 'Inclusive')).toBe(90);
    expect(calculateSalesReturnPostedAmount(100, 10, 'None')).toBe(90);
  });

  it('maps saved header fields and sends editable values through the update request', async () => {
    const returned = {
      lrefno: 'cm-1', lcredit_no: 'CM-1', linvoice_no: 'INV-1', linvoice_refno: 'src-1',
      ldate: '2026-10-22', created_at: '', lstatus: 'Pending', ltype: 'Invoice', lcustomer: 'cust-1',
      customer_name: 'Customer One', salesman: 'Agent One', tracking_no: 'TRK-1', ship_via: 'Courier',
      lremark: 'Return', lnote: 'Note', lcomplaintnote: 'Complaint', ltransaction_refno: 'txn-1',
      ldiscount_amt: '10.50', ltax_type: 'Exclusive', internal_remarks: 'Internal', total_qty: 1, total_amount: 100,
    };
    const mapped = mapSalesReturnRecord(returned);
    expect(mapped).toMatchObject({
      linvoice_refno: 'src-1', salesman: 'Agent One', lnote: 'Note', lcomplaintnote: 'Complaint',
      ltransaction_refno: 'txn-1', ldiscount_amt: 10.5, ltax_type: 'Exclusive', internal_remarks: 'Internal',
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: returned }) });
    vi.stubGlobal('fetch', fetchMock);
    const payload = {
      customer_id: 'cust-1', invoice_refno: 'src-1', invoice_no: 'INV-1', type: 'Invoice',
      transaction_refno: 'txn-1', discount_amt: 10.5, tax_type: 'Exclusive', date: '2026-10-22',
      salesman: 'Agent One', ship_via: 'Courier', tracking_no: 'TRK-1', remark: 'Return', note: 'Note',
      complaint_note: 'Complaint',
    };
    await salesReturnService.update('cm-1', payload);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject(payload);
  });
});
