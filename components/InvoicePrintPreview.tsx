import React, { useMemo } from 'react';
import { Printer, XCircle } from 'lucide-react';
import { Contact, Invoice } from '../types';

interface InvoicePrintPreviewProps {
  invoice: Invoice;
  customer: Contact | null;
  onClose: () => void;
}

const numberFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const LEGACY_COMPANY = {
  name: 'TND OPC',
  city: 'Taguig City',
};

const MAX_ITEM_ROWS = 18;

const printStyles = `
  @page {
    size: 24.4cm 27.8cm;
    margin: 0.5cm;
  }

  .invoice-print-root {
    font-family: Tahoma, Verdana, Arial, sans-serif;
  }

  .invoice-print-sheet {
    width: 24.4cm;
    min-height: 27.8cm;
    background: #fff;
    color: #000;
    padding: 0.25cm 0.4cm 0.2cm;
    box-sizing: border-box;
  }

  .invoice-old-print-body {
    font-size: 13px;
    line-height: 1.1;
  }

  .invoice-old-print-body table {
    border-collapse: collapse;
    width: 100%;
  }

  .invoice-company-header {
    text-align: center;
    font-size: 15px;
  }

  .invoice-company-header p {
    margin: 0;
  }

  .invoice-meta-table td {
    vertical-align: top;
    padding: 0;
  }

  .invoice-item-list {
    border: none;
    width: 100%;
    text-align: left;
  }

  .invoice-item-list td,
  .invoice-item-list th {
    border: none;
  }

  .invoice-item-list tbody td {
    font-size: 13px;
  }

  .invoice-item-list thead th {
    color: transparent;
    font-size: 12pt;
    font-weight: bold;
    text-align: center;
    height: 0;
    line-height: 0;
    padding: 0;
  }

  .invoice-item-row {
    height: 15px;
  }

  .invoice-item-description {
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .invoice-grand-total {
    text-decoration: overline;
  }

  .invoice-summary-float {
    float: right;
    text-align: right;
    margin-top: 0.1cm;
  }

  .invoice-summary-float p {
    font-size: 8pt;
    margin: 0;
    font-weight: bold;
    line-height: 1.2;
  }

  .invoice-preview-controls,
  .invoice-preview-note,
  .invoice-preview-warning {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
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

const legacyItemAmount = (item: Invoice['items'][number]): number => {
  const amount = Number(item.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return Number(item.qty || 0) * Number(item.unit_price || 0);
};

const InvoicePrintPreview: React.FC<InvoicePrintPreviewProps> = ({ invoice, customer, onClose }) => {
  const lineGrandTotal = useMemo(
    () => invoice.items.reduce((sum, item) => sum + legacyItemAmount(item), 0),
    [invoice.items]
  );

  const vatType = customer?.vatType || 'Exclusive';
  const displayedItems = invoice.items.slice(0, MAX_ITEM_ROWS);
  const overflowCount = Math.max(0, invoice.items.length - MAX_ITEM_ROWS);
  const totalQty = invoice.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  const summary = useMemo(() => {
    if (vatType === 'Inclusive') {
      const totalSales = lineGrandTotal;
      const lessVat = lineGrandTotal - lineGrandTotal / 1.12;
      const total = lineGrandTotal - lessVat;
      const totalAmountDue = lineGrandTotal;
      const vatableSale = total;
      const addVat = Math.abs(lessVat);
      const finalTotal = lineGrandTotal;
      return {
        taxName: '(VAT Inclusive)',
        totalSales,
        lessVat,
        total,
        totalAmountDue,
        vatableSale,
        addVat,
        finalTotal,
      };
    }

    if (vatType === 'Exclusive') {
      const totalSales = lineGrandTotal;
      const lessVat = 0;
      const total = lineGrandTotal;
      const totalAmountDue = lineGrandTotal;
      const vatableSale = total;
      const addVat = lineGrandTotal * 1.12 - totalSales;
      const finalTotal = lineGrandTotal * 1.12;
      return {
        taxName: '(VAT Exclusive)',
        totalSales,
        lessVat,
        total,
        totalAmountDue,
        vatableSale,
        addVat,
        finalTotal,
      };
    }

    return {
      taxName: '( )',
      totalSales: 0,
      lessVat: 0,
      total: 0,
      totalAmountDue: 0,
      vatableSale: 0,
      addVat: 0,
      finalTotal: 0,
    };
  }, [lineGrandTotal, vatType]);

  const productType = customer?.businessLine || invoice.price_group || '';
  const soldTo = customer?.company || '';
  const soldToAddress = customer?.address || invoice.delivery_address || '';
  const deliverTo = invoice.delivery_address || customer?.deliveryAddress || '';
  const yourReference = invoice.customer_reference || '';
  const ourReference = invoice.reference_no || '';
  const terms = invoice.terms || '';
  const poNumber = invoice.po_number || '';
  const tin = customer?.tin || '';
  const businessLine = customer?.businessLine || '';
  const salesman = invoice.sales_person || customer?.salesman || '';
  const shippedVia = invoice.send_by || '';

  return (
    <div className="invoice-print-root fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-6 pt-24 print:bg-white print:p-0">
      <style>{printStyles}</style>

      <div className="invoice-preview-controls mx-auto mb-4 flex max-w-[1100px] items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:bg-slate-900/95">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Legacy Invoice Print Template</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            React port of the old system invoice print layout.
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

      <div className="invoice-preview-note mx-auto mb-4 max-w-[1100px] rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        This version follows the old PHP invoice template much more directly, including the same table widths,
        line spacing, VAT summary order, and item row rhythm.
      </div>

      {overflowCount > 0 && (
        <div className="invoice-preview-warning mx-auto mb-4 max-w-[1100px] rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {overflowCount} additional item{overflowCount === 1 ? '' : 's'} exceed the first-page legacy layout.
        </div>
      )}

      <div className="invoice-print-sheet mx-auto border border-dashed border-slate-300 shadow-2xl">
        <div className="invoice-old-print-body">
          <div style={{ height: '0.8cm' }} />

          <div className="invoice-company-header">
            <p>{LEGACY_COMPANY.name}</p>
            <p>{LEGACY_COMPANY.city}</p>
          </div>

          <div style={{ height: '0.7cm' }} />
          <div style={{ height: '0.7cm' }} />

          <table className="invoice-meta-table" style={{ fontSize: 13, width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '70%', paddingLeft: '3.1cm', fontWeight: 400 }}>{soldTo}</td>
                <td colSpan={2} />
              </tr>
              <tr>
                <td style={{ width: '70%', paddingLeft: '4.1cm' }}>{soldToAddress}</td>
                <td style={{ width: '15%', paddingLeft: '1.1cm' }}>{formatDate(invoice.sales_date || invoice.created_at)}</td>
                <td style={{ width: '15%', paddingLeft: '0.5cm' }}>{yourReference}</td>
              </tr>
              <tr>
                <td style={{ width: '70%', color: '#fff' }}>.</td>
                <td style={{ width: '15%' }} />
                <td style={{ width: '15%' }} />
              </tr>
              <tr>
                <td style={{ width: '70%', color: '#fff' }}>.</td>
                <td style={{ width: '15%' }}>{ourReference}</td>
                <td style={{ width: '15%', paddingLeft: '1.3cm' }}>{terms}</td>
              </tr>
              <tr>
                <td style={{ width: '70%', paddingLeft: '5.2cm' }}>{businessLine}</td>
                <td style={{ width: '15%' }} />
                <td style={{ width: '15%' }} />
              </tr>
              <tr>
                <td style={{ width: '70%', paddingLeft: '4cm' }}>{tin}</td>
                <td style={{ width: '15%' }}>{poNumber}</td>
                <td style={{ width: '15%' }} />
              </tr>
              <tr>
                <td style={{ width: '70%', color: '#fff' }}>.</td>
                <td style={{ width: '15%' }} />
                <td style={{ width: '15%' }} />
              </tr>
              <tr>
                <td style={{ width: '70%', paddingLeft: '2.9cm' }}>{deliverTo}</td>
                <td style={{ width: '15%' }}>{shippedVia}</td>
                <td style={{ width: '15%', paddingLeft: '0.8cm' }}>{salesman}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ height: '0.35cm' }} />
          <div style={{ height: '0.55cm' }} />

          <div style={{ minHeight: '300px', maxHeight: '300px' }}>
            <table className="invoice-item-list">
              <thead>
                <tr>
                  <th />
                  <th />
                  <th />
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td />
                  <td />
                  <td style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>
                    <u>{productType || '-'}</u>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 700 }}>
                    <u>PESOS</u>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 700 }}>
                    <u>PESOS</u>
                  </td>
                </tr>
              </tbody>
              <tbody>
                {displayedItems.map((item, index) => {
                  const rowAmount = legacyItemAmount(item);
                  return (
                    <tr key={item.id || `${item.item_code}-${index}`} className="invoice-item-row">
                      <td style={{ textAlign: 'left', width: '10%' }}>{item.qty}</td>
                      <td style={{ textAlign: 'center', width: '10%' }}>{item.item_code}</td>
                      <td className="invoice-item-description" style={{ width: '40%' }}>
                        {[item.part_no, item.description].filter(Boolean).join(' ')}
                      </td>
                      <td style={{ textAlign: 'right', width: '20%' }}>{formatMoney(Number(item.unit_price) || 0)}</td>
                      <td style={{ textAlign: 'right', width: '20%', fontWeight: 700 }}>{formatMoney(rowAmount)}</td>
                    </tr>
                  );
                })}
                {Array.from({ length: Math.max(0, MAX_ITEM_ROWS - displayedItems.length) }).map((_, index) => (
                  <tr key={`blank-${index}`} className="invoice-item-row">
                    <td style={{ width: '10%' }} />
                    <td style={{ width: '10%' }} />
                    <td style={{ width: '40%' }} />
                    <td style={{ width: '20%' }} />
                    <td style={{ width: '20%' }} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} />
                  <td className="invoice-grand-total" style={{ textAlign: 'right', width: '20%', fontWeight: 700 }}>
                    {formatMoney(lineGrandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="invoice-summary-float">
            <p>{formatMoney(summary.totalSales)}</p>
            <p>{formatMoney(summary.lessVat)}</p>
            <p>{formatMoney(summary.total)}</p>
            <p>0.00</p>
            <p>{formatMoney(summary.totalAmountDue)}</p>
            <p>{formatMoney(summary.vatableSale)}</p>
            <p>0.00</p>
            <p>{formatMoney(summary.addVat)}</p>
            <p>0.00</p>
            <p>{formatMoney(summary.finalTotal)}</p>
          </div>

          <div style={{ clear: 'both' }} />

          <table style={{ width: '100%', marginTop: '0.1cm' }}>
            <tbody>
              <tr>
                <td style={{ width: '70%', fontSize: 9, color: '#fff' }}>
                  condition placeholder
                </td>
                <td style={{ width: '30%' }}>
                  <table style={{ fontSize: 9, fontWeight: 700, borderCollapse: 'separate', borderSpacing: '8px' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '140px' }}>Total Sales {summary.taxName}</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>{formatMoney(summary.totalSales)}</td>
                      </tr>
                      <tr>
                        <td>Less VAT</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>{formatMoney(summary.lessVat)}</td>
                      </tr>
                      <tr>
                        <td>Total</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>{formatMoney(summary.total)}</td>
                      </tr>
                      <tr>
                        <td>Less: SC/PWD Discount</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>0.00</td>
                      </tr>
                      <tr>
                        <td>Total Amount Due</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>{formatMoney(summary.totalAmountDue)}</td>
                      </tr>
                      <tr>
                        <td>VATable Sale</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>{formatMoney(summary.vatableSale)}</td>
                      </tr>
                      <tr>
                        <td>VAT Exemt Sale</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>0.00</td>
                      </tr>
                      <tr>
                        <td>VAT Zero Rated Sale</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>0.00</td>
                      </tr>
                      <tr>
                        <td>Add : 12% VAT</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>{formatMoney(summary.addVat)}</td>
                      </tr>
                      <tr>
                        <td>Less :W/H Tax</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>0.00</td>
                      </tr>
                      <tr>
                        <td>Total</td>
                        <td style={{ fontSize: 11, textAlign: 'right' }}>{formatMoney(summary.finalTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '0.5cm', fontSize: 9 }}>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ width: '15%' }} />
                  <td style={{ width: '40%', textAlign: 'center' }}>
                    <strong>Receivied the above in good order and condition.</strong>
                  </td>
                  <td style={{ width: '40%', textAlign: 'center' }}>
                    <strong>Receivied the above in good order and condition.</strong>
                    <div style={{ marginTop: '0.45cm' }}>______________________</div>
                    <h6 style={{ margin: '0.15cm 0 0', fontSize: 9 }}>AUTHORIZED SIGNATURE</h6>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '0.25cm', fontSize: 10, fontWeight: 700 }}>
            Total Qty: {totalQty}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrintPreview;
