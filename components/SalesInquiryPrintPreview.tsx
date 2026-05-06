import React, { useMemo } from 'react';
import { Printer, XCircle } from 'lucide-react';
import { Contact, SalesInquiry } from '../types';

interface SalesInquiryPrintPreviewProps {
  inquiry: SalesInquiry;
  customer: Contact | null;
  inquiryNumberLabel: string;
  preparedBy: string;
  onClose: () => void;
}

const moneyFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const LEGACY_COMPANY = {
  name: 'TND OPC',
  address: 'Taguig City',
  mobile: '',
  phone: '',
  email: '',
};

const printStyles = `
  @page {
    size: auto;
    margin: 0.5cm;
  }

  .sales-inquiry-print-root {
    font-family: Arial, Helvetica, sans-serif;
  }

  .sales-inquiry-preview-controls,
  .sales-inquiry-preview-note {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .sales-inquiry-print-sheet {
    width: min(100%, 1100px);
    background: #fff;
    color: #000;
    padding: 1.25rem 1.5rem 1.5rem;
    box-sizing: border-box;
  }

  .sales-inquiry-print-body {
    font-size: 14px;
    line-height: 1.35;
  }

  .sales-inquiry-company {
    text-align: center;
    font-size: 15px;
    margin-bottom: 0.75rem;
  }

  .sales-inquiry-company p {
    margin: 0;
  }

  .sales-inquiry-title-table,
  .sales-inquiry-meta-table,
  .sales-inquiry-item-table {
    width: 100%;
    border-collapse: collapse;
  }

  .sales-inquiry-meta-table td {
    padding: 0.5rem 0.75rem;
    vertical-align: top;
  }

  .sales-inquiry-label {
    font-weight: 700;
    white-space: nowrap;
  }

  .sales-inquiry-item-table th,
  .sales-inquiry-item-table td {
    border: 1px solid #cbd5e1;
    padding: 0.45rem 0.55rem;
    vertical-align: top;
  }

  .sales-inquiry-item-table thead th {
    background: #f8fafc;
    font-weight: 700;
    text-align: left;
  }

  .sales-inquiry-item-table tbody tr:nth-child(odd) {
    background: #fafafa;
  }

  .sales-inquiry-item-table .amount,
  .sales-inquiry-item-table .price {
    text-align: right;
    white-space: nowrap;
  }

  .sales-inquiry-prepared {
    margin-top: 1rem;
    font-size: 14px;
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

    .sales-inquiry-print-root,
    .sales-inquiry-print-root * {
      visibility: visible;
    }

    .sales-inquiry-print-root {
      position: absolute !important;
      inset: 0 !important;
      background: #fff !important;
      padding: 0 !important;
      overflow: visible !important;
    }

    .sales-inquiry-preview-controls,
    .sales-inquiry-preview-note {
      display: none !important;
    }

    .sales-inquiry-print-sheet {
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
  return parsed.toLocaleDateString('en-US');
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US');
};

const SalesInquiryPrintPreview: React.FC<SalesInquiryPrintPreviewProps> = ({
  inquiry,
  customer,
  inquiryNumberLabel,
  preparedBy,
  onClose,
}) => {
  const lineItems = inquiry.items || [];
  const totalAmount = useMemo(
    () => lineItems.reduce((sum, item) => sum + Number(item.amount || Number(item.qty || 0) * Number(item.unit_price || 0)), 0),
    [lineItems]
  );

  const companyLines = [
    LEGACY_COMPANY.name,
    LEGACY_COMPANY.address,
    LEGACY_COMPANY.mobile,
    LEGACY_COMPANY.phone,
    LEGACY_COMPANY.email,
  ].filter(Boolean);

  return (
    <div className="sales-inquiry-print-root fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-6 pt-24 print:bg-white print:p-0">
      <style>{printStyles}</style>

      <div className="sales-inquiry-preview-controls mx-auto mb-4 flex max-w-[1100px] items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:bg-slate-900/95">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Legacy Sales Inquiry Print Template</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            React port of the old system customer inquiry print layout.
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

      <div className="sales-inquiry-preview-note mx-auto mb-4 max-w-[1100px] rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        This version follows the old PHP sales inquiry print layout, including the header block, inquiry detail table,
        item list, grand total row, and prepared-by footer.
      </div>

      <div className="sales-inquiry-print-sheet mx-auto border border-dashed border-slate-300 shadow-2xl">
        <div className="sales-inquiry-print-body">
          <div style={{ height: '0.5rem' }} />

          <div className="sales-inquiry-company">
            {companyLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <table className="sales-inquiry-title-table">
            <tbody>
              <tr>
                <td style={{ width: '33%' }}>&nbsp;</td>
                <td style={{ width: '34%', textAlign: 'center' }}>
                  <h3 style={{ margin: 0 }}>
                    <u>CUSTOMER INQUIRY</u>
                  </h3>
                </td>
                <td style={{ width: '33%', textAlign: 'right' }}>
                  <h5 style={{ margin: 0 }}>{inquiryNumberLabel || inquiry.inquiry_no || '-'}</h5>
                </td>
              </tr>
            </tbody>
          </table>

          <table className="sales-inquiry-meta-table" style={{ marginTop: '0.4rem' }}>
            <tbody>
              <tr>
                <td className="sales-inquiry-label" style={{ width: '20%' }}>Sold to:</td>
                <td style={{ width: '40%' }}><b>{customer?.company || '-'}</b></td>
                <td className="sales-inquiry-label" style={{ width: '20%' }}>Sales Person:</td>
                <td><b>{inquiry.sales_person || '-'}</b></td>
              </tr>
              <tr>
                <td className="sales-inquiry-label">Delivery Address:</td>
                <td><b>{inquiry.delivery_address || customer?.deliveryAddress || customer?.address || '-'}</b></td>
                <td className="sales-inquiry-label">Your Reference:</td>
                <td><b>{inquiry.customer_reference || '-'}</b></td>
              </tr>
              <tr>
                <td className="sales-inquiry-label">Our Reference:</td>
                <td><b>{inquiry.reference_no || '-'}</b></td>
                <td className="sales-inquiry-label">Date:</td>
                <td><b>{formatDate(inquiry.sales_date || inquiry.created_at)}</b></td>
              </tr>
              <tr>
                <td className="sales-inquiry-label">Terms Strictly:</td>
                <td><b>{inquiry.terms || '-'}</b></td>
                <td />
                <td />
              </tr>
              <tr>
                <td className="sales-inquiry-label">PO No.:</td>
                <td><b>{inquiry.po_number || '-'}</b></td>
                <td className="sales-inquiry-label">Credit Limit:</td>
                <td><b>{formatMoney(Number(inquiry.credit_limit || 0))}</b></td>
              </tr>
              <tr>
                <td className="sales-inquiry-label">Send By:</td>
                <td>{inquiry.send_by || '-'}</td>
                <td className="sales-inquiry-label" style={{ color: '#dc2626' }}>Urgency/Type:</td>
                <td>{inquiry.urgency || '-'}</td>
              </tr>
              <tr>
                <td className="sales-inquiry-label">Inquiry Type:</td>
                <td>{inquiry.inquiry_type || '-'}</td>
                <td className="sales-inquiry-label" style={{ color: '#dc2626' }}>Urgency/Date:</td>
                <td>{formatDate(inquiry.urgency_date)}</td>
              </tr>
              <tr>
                <td className="sales-inquiry-label">Promise to Pay:</td>
                <td colSpan={3}>{inquiry.promise_to_pay || '-'}</td>
              </tr>
              <tr>
                <td className="sales-inquiry-label">Remark:</td>
                <td colSpan={3}>{inquiry.remarks || '-'}</td>
              </tr>
            </tbody>
          </table>

          <hr style={{ margin: '0.75rem 0' }} />

          <h3 style={{ margin: '0 0 0.6rem' }}>Item List</h3>
          <table className="sales-inquiry-item-table">
            <thead>
              <tr>
                <th style={{ width: '1%' }}></th>
                <th>Qty</th>
                <th>Item Code</th>
                <th>Part No</th>
                <th>Description</th>
                <th>Unit Price</th>
                <th style={{ textAlign: 'center' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => {
                const lineTotal = Number(item.amount || Number(item.qty || 0) * Number(item.unit_price || 0));
                return (
                  <tr key={item.id || `${item.item_code || item.part_no || 'item'}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{item.qty}</td>
                    <td>{item.item_code || '-'}</td>
                    <td>{item.part_no || '-'}</td>
                    <td>{item.description || '-'}</td>
                    <td className="price">{formatMoney(Number(item.unit_price || 0))}</td>
                    <td className="amount"><strong>{formatMoney(lineTotal)}</strong></td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={6} style={{ textAlign: 'right' }}>
                  <strong>Grand Total</strong>
                </td>
                <td className="amount">
                  <strong>{formatMoney(totalAmount)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="sales-inquiry-prepared">
            <b>Prepared By :</b> {preparedBy || inquiry.sales_person || '-'}{' '}
            <b>Date/Time :</b> {formatDateTime(inquiry.created_at || inquiry.sales_date)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesInquiryPrintPreview;
