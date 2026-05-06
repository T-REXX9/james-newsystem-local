import React, { useMemo } from 'react';
import { Printer, XCircle } from 'lucide-react';
import { Contact, OrderSlip } from '../types';
import { getLocalAuthSession } from '../services/localAuthService';

interface OrderSlipPrintPreviewProps {
  orderSlip: OrderSlip;
  customer: Contact | null;
  onClose: () => void;
}

const numberFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const printStyles = `
  @page {
    size: auto;
    margin: 0.5cm;
  }

  .order-slip-print-root {
    font-family: Arial, Helvetica, sans-serif;
  }

  .order-slip-preview-controls,
  .order-slip-preview-note {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .order-slip-print-sheet {
    width: min(100%, 1100px);
    background: #fff;
    color: #000;
    padding: 1.25rem 1.5rem 1.5rem;
    box-sizing: border-box;
  }

  .order-slip-print-body {
    font-size: 14px;
    line-height: 1.35;
  }

  .order-slip-title {
    text-align: center;
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 0.75rem;
    letter-spacing: 0.03em;
  }

  .order-slip-number {
    text-align: right;
    font-size: 18px;
    margin: 0 0 0.75rem;
  }

  .order-slip-meta-table,
  .order-slip-item-table {
    width: 100%;
    border-collapse: collapse;
  }

  .order-slip-meta-table th,
  .order-slip-item-table th,
  .order-slip-item-table td {
    padding: 0.45rem 0.65rem;
    border: 1px solid #d4d4d8;
    vertical-align: top;
  }

  .order-slip-meta-table th {
    background: #f8fafc;
    font-weight: 700;
    text-align: left;
  }

  .order-slip-item-table thead th {
    background: #f8fafc;
    font-weight: 700;
    text-align: left;
  }

  .order-slip-item-table tbody tr:nth-child(odd) {
    background: #fafafa;
  }

  .order-slip-amount,
  .order-slip-unit-price {
    text-align: right;
    white-space: nowrap;
  }

  .order-slip-total-row td {
    font-weight: 700;
  }

  .order-slip-total-pill {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: #dbeafe;
    color: #1d4ed8;
    font-weight: 700;
  }

  .order-slip-remarks {
    margin-top: 0.75rem;
    min-height: 1.25rem;
  }

  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #000 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body * {
      visibility: hidden;
    }

    .order-slip-print-root,
    .order-slip-print-root * {
      visibility: visible;
    }

    .order-slip-print-root {
      position: absolute !important;
      inset: 0 !important;
      background: #fff !important;
      padding: 0 !important;
      overflow: visible !important;
    }

    .order-slip-preview-controls,
    .order-slip-preview-note {
      display: none !important;
    }

    .order-slip-print-sheet {
      width: 100% !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
    }
  }
`;

const formatMoney = (value: number): string => numberFormatter.format(Number.isFinite(value) ? value : 0);

const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const hasTime = /T|\d{1,2}:\d{2}/.test(value);
  return hasTime
    ? parsed.toLocaleString('en-US')
    : parsed.toLocaleDateString('en-US');
};

const OrderSlipPrintPreview: React.FC<OrderSlipPrintPreviewProps> = ({ orderSlip, customer, onClose }) => {
  const currentUserName = useMemo(() => {
    const session = getLocalAuthSession();
    return String(session?.userProfile?.full_name || '').trim();
  }, []);

  const totalAmount = useMemo(
    () => orderSlip.items.reduce((sum, item) => sum + Number(item.amount || Number(item.qty || 0) * Number(item.unit_price || 0)), 0),
    [orderSlip.items]
  );

  const soldTo = customer?.company || orderSlip.customer_name || '';
  const address = customer?.address || orderSlip.delivery_address || '';
  const referenceLabel = currentUserName || orderSlip.sales_person || '';
  const dateLabel = formatDateTime(orderSlip.sales_date || orderSlip.created_at);

  return (
    <div className="order-slip-print-root fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-6 pt-24 print:bg-white print:p-0">
      <style>{printStyles}</style>

      <div className="order-slip-preview-controls mx-auto mb-4 flex max-w-[1100px] items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:bg-slate-900/95">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Legacy Order Slip Print Template</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            React port of the old system order slip print layout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white"
          >
            <Printer className="h-4 w-4" />
            Print Now
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            <XCircle className="h-4 w-4" />
            Close
          </button>
        </div>
      </div>

      <div className="order-slip-preview-note mx-auto mb-4 max-w-[1100px] rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        This version follows the old PHP order slip print template, including the simple header block, striped item
        table, and right-aligned total amount row.
      </div>

      <div className="order-slip-print-sheet mx-auto border border-dashed border-slate-300 shadow-2xl">
        <div className="order-slip-print-body">
          <h1 className="order-slip-title">ORDER SLIP</h1>
          <p className="order-slip-number">
            <strong>DR No.:</strong> {orderSlip.slip_no || '-'}
          </p>

          <table className="order-slip-meta-table">
            <tbody>
              <tr>
                <th>Sold To : {soldTo}</th>
                <th style={{ width: '30%' }}>Date / Time : {dateLabel}</th>
              </tr>
              <tr>
                <th>Address : {address}</th>
                <th>Reference : {referenceLabel}</th>
              </tr>
              <tr>
                <th>&nbsp;</th>
                <th>Remarks : {orderSlip.remarks || ''}</th>
              </tr>
            </tbody>
          </table>

          <table className="order-slip-item-table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th style={{ width: '14%' }}>Quantity</th>
                <th>Description</th>
                <th style={{ width: '18%' }}>Unit Price</th>
                <th style={{ width: '20%', textAlign: 'center' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {orderSlip.items.map((item, index) => {
                const amount = Number(item.amount || Number(item.qty || 0) * Number(item.unit_price || 0));
                return (
                  <tr key={item.id || `${item.item_code || item.part_no || 'item'}-${index}`}>
                    <td>{item.qty}</td>
                    <td>{item.description || item.item_code || item.part_no || '-'}</td>
                    <td className="order-slip-unit-price">{formatMoney(Number(item.unit_price || 0))}</td>
                    <td className="order-slip-amount">
                      <strong>{formatMoney(amount)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="order-slip-total-row">
                <td colSpan={3} style={{ textAlign: 'right' }}>Total =&gt; &nbsp;</td>
                <td className="order-slip-amount">
                  <span className="order-slip-total-pill">{formatMoney(totalAmount)}</span>
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="order-slip-remarks" />
        </div>
      </div>
    </div>
  );
};

export default OrderSlipPrintPreview;
