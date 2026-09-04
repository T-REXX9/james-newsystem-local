import React, { useEffect, useRef } from 'react';
import { Printer, XCircle } from 'lucide-react';
import { Contact, SalesOrder } from '../types';

interface SalesOrderPrintPreviewProps {
  order: SalesOrder;
  customer: Contact | null;
  onClose: () => void;
  /** When true, hide preview chrome and mount off-screen for JPEG capture. */
  captureMode?: boolean;
  onSheetReady?: (sheet: HTMLElement) => void;
}

const moneyFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const printStyles = `
  @page {
    size: auto;
    margin: 0.5cm;
  }

  .sales-order-print-root {
    font-family: Arial, Helvetica, sans-serif;
  }

  .sales-order-print-sheet {
    width: min(100%, 1100px);
    background: #fff;
    color: #000;
    padding: 1rem 1.25rem 1.25rem;
    box-sizing: border-box;
  }

  .sales-order-print-body {
    font-size: 13px;
    line-height: 1.3;
  }

  .sales-order-title {
    text-align: center;
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0 0 0.35rem;
    letter-spacing: 0.03em;
  }

  .sales-order-number {
    text-align: right;
    font-size: 0.95rem;
    margin: 0 0 0.65rem;
  }

  .sales-order-meta-table,
  .sales-order-item-table {
    width: 100%;
    border-collapse: collapse;
  }

  .sales-order-meta-table td {
    padding: 0.28rem 0.55rem;
    vertical-align: top;
  }

  .sales-order-label {
    font-weight: 700;
    white-space: nowrap;
    width: 8.5rem;
  }

  .sales-order-item-table th,
  .sales-order-item-table td {
    border: 1px solid #cbd5e1;
    padding: 0.35rem 0.5rem;
    vertical-align: top;
  }

  .sales-order-item-table thead th {
    background: #f8fafc;
    font-weight: 700;
    text-align: left;
  }

  .sales-order-item-table tbody tr:nth-child(odd) {
    background: #fafafa;
  }

  .sales-order-item-table .amount,
  .sales-order-item-table .price,
  .sales-order-item-table .qty {
    text-align: right;
    white-space: nowrap;
  }

  .sales-order-print-divider {
    margin: 0.65rem 0;
    border: none;
    border-top: 1px solid #cbd5e1;
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

    .sales-order-print-root,
    .sales-order-print-root * {
      visibility: visible;
    }

    .sales-order-print-root {
      position: absolute !important;
      inset: 0 !important;
      background: #fff !important;
      padding: 0 !important;
      overflow: visible !important;
      left: 0 !important;
      top: 0 !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      z-index: 1 !important;
    }

    .sales-order-preview-controls,
    .sales-order-preview-note {
      display: none !important;
    }

    .sales-order-print-sheet {
      width: 100% !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
    }
  }
`;

const formatMoney = (value: number): string => moneyFormatter.format(Number.isFinite(value) ? value : 0);

const formatDate = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

type OrderWithExtras = SalesOrder & {
  tracking_no?: string;
  delivered_to?: string;
  delivery_to?: string;
  sales_type?: string;
};

const SalesOrderPrintPreview: React.FC<SalesOrderPrintPreviewProps> = ({
  order,
  customer,
  onClose,
  captureMode = false,
  onSheetReady,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const legacyOrder = order as OrderWithExtras;
  const lineItems = order.items || [];
  const totalAmount = lineItems.reduce(
    (sum, item) => sum + Number(item.amount || Number(item.qty || 0) * Number(item.unit_price || 0)),
    0
  );
  const totalQty = lineItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  useEffect(() => {
    if (!captureMode || !onSheetReady) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const frame = window.requestAnimationFrame(() => onSheetReady(sheet));
    return () => window.cancelAnimationFrame(frame);
  }, [captureMode, onSheetReady, order]);

  return (
    <div
      className={
        captureMode
          ? 'sales-order-print-root pointer-events-none fixed top-0 z-[-1] bg-white p-0'
          : 'sales-order-print-root fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-6 pt-24 print:bg-white print:p-0'
      }
      aria-hidden={captureMode || undefined}
      style={captureMode ? { left: '-10000px' } : undefined}
    >
      <style>{printStyles}</style>

      {!captureMode && (
        <>
          <div className="sales-order-preview-controls mx-auto mb-4 flex max-w-[1100px] items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:bg-slate-900/95">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Sales Order Print</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Same layout used for print and JPEG export.
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

          <div className="sales-order-preview-note mx-auto mb-4 max-w-[1100px] rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Clean sales order sheet without company header — matches Export JPEG output.
          </div>
        </>
      )}

      <div
        ref={sheetRef}
        className={
          captureMode
            ? 'sales-order-print-sheet'
            : 'sales-order-print-sheet mx-auto border border-dashed border-slate-300 shadow-2xl'
        }
        style={captureMode ? { width: '1100px' } : undefined}
      >
        <div className="sales-order-print-body">
          <h1 className="sales-order-title">
            <u>SALES ORDER</u>
          </h1>
          <p className="sales-order-number">
            <strong>SO No.:</strong> {order.order_no || '-'}
          </p>

          <table className="sales-order-meta-table">
            <tbody>
              <tr>
                <td className="sales-order-label">Sold to:</td>
                <td style={{ width: '40%' }}><b>{customer?.company || '-'}</b></td>
                <td className="sales-order-label">Date:</td>
                <td><b>{formatDate(order.sales_date || order.created_at)}</b></td>
              </tr>
              <tr>
                <td className="sales-order-label">Address:</td>
                <td><b>{order.delivery_address || customer?.deliveryAddress || customer?.address || '-'}</b></td>
                <td className="sales-order-label">Terms Strictly:</td>
                <td><b>{order.terms || customer?.terms || '-'}</b></td>
              </tr>
              <tr>
                <td className="sales-order-label">Reference No.:</td>
                <td><b>{order.reference_no || '-'}</b></td>
                <td className="sales-order-label">Salesperson:</td>
                <td><b>{order.sales_person || '-'}</b></td>
              </tr>
              <tr>
                <td className="sales-order-label">Send By:</td>
                <td>{order.send_by || '-'}</td>
                <td className="sales-order-label">Tracking No.:</td>
                <td>{legacyOrder.tracking_no || '-'}</td>
              </tr>
              <tr>
                <td className="sales-order-label">PO No.:</td>
                <td>{order.po_number || '-'}</td>
                <td className="sales-order-label">Del. to:</td>
                <td>{legacyOrder.delivered_to || legacyOrder.delivery_to || '-'}</td>
              </tr>
              <tr>
                <td className="sales-order-label">Sales Type:</td>
                <td colSpan={3}>{legacyOrder.sales_type || 'Regular SO'}</td>
              </tr>
            </tbody>
          </table>

          <hr className="sales-order-print-divider" />

          <h3 style={{ margin: '0 0 0.45rem', fontSize: '1rem' }}>Item List</h3>
          <table className="sales-order-item-table">
            <thead>
              <tr>
                <th style={{ width: '1%' }}></th>
                <th>Item Code</th>
                <th className="qty">Qty</th>
                <th>Location</th>
                <th>Part No.</th>
                <th>Description</th>
                <th>Unit Price</th>
                <th>Remark</th>
                <th style={{ textAlign: 'center' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => {
                const lineTotal = Number(item.amount || Number(item.qty || 0) * Number(item.unit_price || 0));
                return (
                  <tr key={item.id || `${item.item_code || item.part_no || 'item'}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{item.item_code || '-'}</td>
                    <td className="qty">{item.qty}</td>
                    <td>{item.location || '-'}</td>
                    <td>{item.part_no || '-'}</td>
                    <td>{item.description || '-'}</td>
                    <td className="price">{formatMoney(Number(item.unit_price || 0))}</td>
                    <td>{item.remark || item.approval_status || '-'}</td>
                    <td className="amount"><strong>{formatMoney(lineTotal)}</strong></td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={2} style={{ textAlign: 'right' }}><strong>Total Qty</strong></td>
                <td className="qty"><strong>{formatMoney(totalQty)}</strong></td>
                <td colSpan={5} style={{ textAlign: 'right' }}><strong>Grand Total</strong></td>
                <td className="amount">
                  <strong>{formatMoney(Number(order.grand_total || totalAmount))}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesOrderPrintPreview;
