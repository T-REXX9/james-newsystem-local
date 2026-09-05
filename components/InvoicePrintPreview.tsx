import React, { useEffect, useMemo, useRef } from 'react';
import { Printer, XCircle } from 'lucide-react';
import { Contact, Invoice } from '../types';
import { buildInvoiceVipSummary } from '../utils/invoiceVipTotals';
import { vipTierPrintLabel } from '../utils/vipDocumentDiscount';

interface InvoicePrintPreviewProps {
  invoice: Invoice;
  customer: Contact | null;
  onClose: () => void;
  /** When true, hide preview chrome and mount off-screen for JPEG capture. */
  captureMode?: boolean;
  onSheetReady?: (sheet: HTMLElement) => void;
}

const numberFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const COMPANY = {
  name: 'TND OPC',
  city: 'Taguig City',
};

const MAX_ITEM_ROWS = 12;

const printStyles = `
  @page {
    size: A5 portrait;
    margin: 0.4cm;
  }

  .invoice-print-root {
    font-family: Tahoma, Verdana, Arial, sans-serif;
  }

  .invoice-print-sheet {
    width: 14.8cm;
    min-height: 21cm;
    background: #fff;
    color: #000;
    padding: 0.35cm 0.4cm 0.3cm;
    box-sizing: border-box;
  }

  .invoice-a5-body {
    font-size: 0.7rem;
    line-height: 1.2;
  }

  .invoice-a5-body table {
    border-collapse: collapse;
    width: 100%;
  }

  .invoice-company-header {
    text-align: center;
  }

  .invoice-company-header h1 {
    margin: 0;
    font-size: 1.05rem;
    letter-spacing: 0.04em;
  }

  .invoice-company-header p {
    margin: 0;
  }

  .invoice-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin: 0.35rem 0 0.4rem;
    gap: 0.5rem;
  }

  .invoice-doc-title {
    margin: 0;
    font-size: 0.95rem;
    letter-spacing: 0.08em;
  }

  .invoice-sale-type {
    display: flex;
    gap: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .invoice-box {
    display: inline-block;
    min-width: 0.7rem;
    text-align: center;
    border: 1px solid #000;
    margin-right: 0.2rem;
    font-weight: 700;
  }

  .invoice-meta-grid {
    width: 100%;
    margin-bottom: 0.35rem;
  }

  .invoice-meta-grid td {
    vertical-align: top;
    padding: 0.08rem 0.15rem;
  }

  .invoice-label {
    font-weight: 700;
    white-space: nowrap;
    width: 18%;
  }

  .invoice-item-grid {
    border: 1px solid #000;
  }

  .invoice-item-grid th,
  .invoice-item-grid td {
    border: 1px solid #000;
    padding: 0.12rem 0.18rem;
  }

  .invoice-item-grid th {
    font-size: 0.65rem;
    text-transform: uppercase;
  }

  .invoice-item-grid .qty,
  .invoice-item-grid .price,
  .invoice-item-grid .amount {
    text-align: right;
    white-space: nowrap;
  }

  .invoice-bottom {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.35rem;
    align-items: flex-start;
  }

  .invoice-tax-box,
  .invoice-totals-box {
    border: 1px solid #000;
    padding: 0.3rem 0.35rem;
  }

  .invoice-tax-box {
    width: 42%;
  }

  .invoice-totals-box {
    width: 58%;
  }

  .invoice-totals-box table td {
    padding: 0.08rem 0.1rem;
  }

  .invoice-totals-box .amount {
    text-align: right;
    font-weight: 700;
    white-space: nowrap;
  }

  .invoice-signature {
    margin-top: 0.55rem;
    text-align: center;
  }

  @media print {
    html, body {
      background: #fff !important;
      color: #000 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body * {
      visibility: hidden;
    }

    .invoice-print-root,
    .invoice-print-root * {
      visibility: visible;
    }

    .invoice-print-root {
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

    .invoice-preview-controls,
    .invoice-preview-note,
    .invoice-preview-warning {
      display: none !important;
    }

    .invoice-print-sheet {
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
  }
`;

const formatMoney = (value: number): string => numberFormatter.format(Number.isFinite(value) ? value : 0);

const formatDate = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
};

const lineAmount = (item: Invoice['items'][number]): number => {
  const amount = Number(item.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return Number(item.qty || 0) * Number(item.unit_price || 0);
};

const InvoicePrintPreview: React.FC<InvoicePrintPreviewProps> = ({
  invoice,
  customer,
  onClose,
  captureMode = false,
  onSheetReady,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const lineGrandTotal = useMemo(
    () => invoice.items.reduce((sum, item) => sum + lineAmount(item), 0),
    [invoice.items]
  );

  const displayedItems = invoice.items.slice(0, MAX_ITEM_ROWS);
  const overflowCount = Math.max(0, invoice.items.length - MAX_ITEM_ROWS);
  const totalQty = invoice.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const isCash = /cash|cod/i.test(String(invoice.terms || customer?.terms || ''));

  const summary = useMemo(
    () =>
      buildInvoiceVipSummary({
        lineGrandTotal,
        vatType: customer?.vatType,
        vip_applied: invoice.vip_applied,
        vip_tier: invoice.vip_tier,
        vip_percentage: invoice.vip_percentage,
        vip_discount_amount: invoice.vip_discount_amount,
      }),
    [customer?.vatType, invoice.vip_applied, invoice.vip_discount_amount, invoice.vip_percentage, invoice.vip_tier, lineGrandTotal]
  );

  const soldTo = customer?.company || '';
  const soldToAddress = customer?.address || invoice.delivery_address || '';
  const tin = customer?.tin || '';
  const businessLine = customer?.businessLine || invoice.price_group || '';
  const discountLabel = summary.discount.applied
    ? `Less: Discount (${vipTierPrintLabel(summary.discount.tier)})`
    : 'Less: Discount';

  useEffect(() => {
    if (!captureMode || !onSheetReady) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const frame = window.requestAnimationFrame(() => onSheetReady(sheet));
    return () => window.cancelAnimationFrame(frame);
  }, [captureMode, onSheetReady, invoice]);

  return (
    <div
      className={
        captureMode
          ? 'invoice-print-root pointer-events-none fixed top-0 z-[-1] bg-white p-0'
          : 'invoice-print-root fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-6 pt-24 print:bg-white print:p-0'
      }
      aria-hidden={captureMode || undefined}
      style={captureMode ? { left: '-10000px' } : undefined}
    >
      <style>{printStyles}</style>

      {!captureMode && (
        <>
          <div className="invoice-preview-controls mx-auto mb-4 flex max-w-[40rem] items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:bg-slate-900/95">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">A5 TND OPC Sales Invoice</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                BIR-style A5 print. JPEG capture uses this same sheet.
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

          {overflowCount > 0 && (
            <div className="invoice-preview-warning mx-auto mb-4 max-w-[40rem] rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {overflowCount} additional item{overflowCount === 1 ? '' : 's'} exceed the first-page A5 layout.
            </div>
          )}
        </>
      )}

      <div
        ref={sheetRef}
        className={
          captureMode
            ? 'invoice-print-sheet'
            : 'invoice-print-sheet mx-auto border border-dashed border-slate-300 shadow-2xl'
        }
      >
        <div className="invoice-a5-body">
          <div className="invoice-company-header">
            <h1>{COMPANY.name}</h1>
            <p>{COMPANY.city}</p>
            <p>VAT REGISTERED</p>
          </div>

          <div className="invoice-title-row">
            <h2 className="invoice-doc-title">SALES INVOICE</h2>
            <div className="invoice-sale-type">
              <span>
                <span className="invoice-box">{isCash ? 'X' : ''}</span>
                CASH SALES
              </span>
              <span>
                <span className="invoice-box">{isCash ? '' : 'X'}</span>
                CHARGE SALES
              </span>
            </div>
          </div>

          <table className="invoice-meta-grid">
            <tbody>
              <tr>
                <td className="invoice-label">Sold To:</td>
                <td>{soldTo}</td>
                <td className="invoice-label">Date:</td>
                <td>{formatDate(invoice.sales_date || invoice.created_at)}</td>
              </tr>
              <tr>
                <td className="invoice-label">Address:</td>
                <td>{soldToAddress}</td>
                <td className="invoice-label">Terms:</td>
                <td>{invoice.terms || customer?.terms || ''}</td>
              </tr>
              <tr>
                <td className="invoice-label">TIN:</td>
                <td>{tin}</td>
                <td className="invoice-label">P.O. No.:</td>
                <td>{invoice.po_number || ''}</td>
              </tr>
              <tr>
                <td className="invoice-label">Bus. Style:</td>
                <td>{businessLine}</td>
                <td className="invoice-label">INV No.:</td>
                <td>{invoice.invoice_no || ''}</td>
              </tr>
            </tbody>
          </table>

          <table className="invoice-item-grid">
            <thead>
              <tr>
                <th style={{ width: '12%' }}>Qty</th>
                <th style={{ width: '14%' }}>Unit</th>
                <th>Articles</th>
                <th style={{ width: '18%' }}>Unit Price</th>
                <th style={{ width: '18%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item, index) => (
                <tr key={item.id || `${item.item_code || item.part_no || 'item'}-${index}`}>
                  <td className="qty">{item.qty}</td>
                  <td>PC</td>
                  <td>{item.description || item.item_code || item.part_no || '-'}</td>
                  <td className="price">{formatMoney(Number(item.unit_price || 0))}</td>
                  <td className="amount">{formatMoney(lineAmount(item))}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, MAX_ITEM_ROWS - displayedItems.length) }).map((_, index) => (
                <tr key={`blank-${index}`}>
                  <td>&nbsp;</td>
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
              <tr>
                <td colSpan={4} style={{ textAlign: 'right' }}>
                  <strong>Grand Total</strong>
                </td>
                <td className="amount">
                  <strong>{formatMoney(lineGrandTotal)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="invoice-bottom">
            <div className="invoice-tax-box">
              <div><strong>SC/PWD ID No.:</strong></div>
              <div><strong>SC/PWD TIN:</strong></div>
              <div><strong>OSCA/PWD ID No.:</strong></div>
              <p style={{ margin: '0.35rem 0 0' }}>
                Total Qty: {totalQty}
              </p>
            </div>
            <div className="invoice-totals-box">
              <table>
                <tbody>
                  <tr>
                    <td>Total Sales {summary.taxName}</td>
                    <td className="amount">{formatMoney(summary.totalSales)}</td>
                  </tr>
                  <tr>
                    <td>Less VAT</td>
                    <td className="amount">{formatMoney(summary.lessVat)}</td>
                  </tr>
                  <tr>
                    <td>Total</td>
                    <td className="amount">{formatMoney(summary.total)}</td>
                  </tr>
                  <tr>
                    <td>{discountLabel}</td>
                    <td className="amount">{formatMoney(summary.discount.discountAmount)}</td>
                  </tr>
                  <tr>
                    <td><strong>TOTAL AMOUNT DUE</strong></td>
                    <td className="amount">{formatMoney(summary.totalAmountDue)}</td>
                  </tr>
                  <tr>
                    <td>VATable Sale</td>
                    <td className="amount">{formatMoney(summary.vatableSale)}</td>
                  </tr>
                  <tr>
                    <td>VAT Exempt Sale</td>
                    <td className="amount">0.00</td>
                  </tr>
                  <tr>
                    <td>VAT Zero Rated Sale</td>
                    <td className="amount">0.00</td>
                  </tr>
                  <tr>
                    <td>Add : 12% VAT</td>
                    <td className="amount">{formatMoney(summary.addVat)}</td>
                  </tr>
                  <tr>
                    <td>Less : W/H Tax</td>
                    <td className="amount">0.00</td>
                  </tr>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td className="amount">{formatMoney(summary.finalTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="invoice-signature">
            <div>Received the above in good order and condition.</div>
            <div style={{ marginTop: '0.7rem' }}>______________________</div>
            <div>AUTHORIZED SIGNATURE</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrintPreview;
