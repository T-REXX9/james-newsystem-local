import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SalesReturnPrintDocument } from '../SalesReturnPage';
import type { SalesReturnItem, SalesReturnRecord } from '../../services/salesReturnLocalApiService';

const record: SalesReturnRecord = {
  lrefno: 'return-1', lcredit_no: 'CM-001', linvoice_no: 'INV-100', linvoice_refno: 'invoice-1',
  ldate: '2026-06-12', ldaterec: '2026-06-13', lmy_refno: 'ORDER-REF', lsales_address: 'Sample Street', created_at: '', lstatus: 'Posted', ltype: 'Invoice', customer_name: 'Sample Customer',
  customer_id: 'customer-1', sales_person: '', tracking_no: '', ship_via: '', lremark: 'Return remark',
  salesman: 'Sales Agent', lnote: '', lcomplaintnote: '', ltransaction_refno: '', ldiscount_amt: 0,
  ltax_type: 'Inclusive', internal_remarks: 'Return remark', total_qty: 2, total_amount: 250,
};
const items: SalesReturnItem[] = [{
  id: 1, created_at: '', item_code: 'ITEM-1', part_no: 'PART-1', brand: 'Brand', location: 'A1',
  description: 'Returned part', qty: 2, original_qty: 5, unit_price: 125, amount: 250, remark: 'Damaged',
}];

describe('SalesReturnPrintDocument', () => {
  it('renders the selected return header, item rows, and total in print layout', () => {
    render(<SalesReturnPrintDocument record={record} items={items} customerAddress="Sample Street" />);

    expect(screen.getByText('CREDIT MEMO')).toBeInTheDocument();
    expect(screen.getByText('CM-001')).toBeInTheDocument();
    expect(screen.getByText('Sample Street')).toBeInTheDocument();
    expect(screen.getByText('ORDER-REF')).toBeInTheDocument();
    expect(screen.getByText('QUANTITY')).toBeInTheDocument();
    expect(screen.getByText('ORD')).toBeInTheDocument();
    expect(screen.getByText('13 Jun 26')).toBeInTheDocument();
    expect(screen.getByText(/Sample Customer/)).toBeInTheDocument();
    expect(screen.getByText(/Returned part/)).toBeInTheDocument();
    expect(screen.getByText('2.00')).toBeInTheDocument();
    expect(screen.getByText('5.00')).toBeInTheDocument();
    expect(screen.getAllByText('250.00')).toHaveLength(2);
    expect(screen.getByText(/Return remark/)).toBeInTheDocument();
  });
});
