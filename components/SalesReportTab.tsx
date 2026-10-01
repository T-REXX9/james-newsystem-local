import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, FileSearch, FileText } from 'lucide-react';
import { fetchDailyCallSalesReports } from '../services/dailyCallCustomerDetailService';
import {
  DailyCallSalesReportRecord,
  normalizeDateValue,
  normalizeProductName,
  normalizeSalesReportRecords,
  openDailyCallSalesInquiry,
} from './dailyCallSalesReportUtils';

import { shouldSuppressAuthError } from '../services/localApiAuth';
interface SalesReportTabProps {
  contactId: string;
  customerName?: string;
  currentUserId?: string;
  onApprove?: (reportId: string) => void;
}

const numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatReportDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || '—'
    : date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: '2-digit' }).replace(/ /g, '\u2011').replace(',', '').toUpperCase();
};

const SalesReportTab: React.FC<SalesReportTabProps> = ({ contactId, customerName, currentUserId, onApprove }) => {
  const [reports, setReports] = useState<DailyCallSalesReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setLoadError(null);
      setFromDate('');
      setToDate('');
      setSelectedProduct('');

      try {
        const data = await fetchDailyCallSalesReports(contactId);
        setReports(normalizeSalesReportRecords(data));
      } catch (err) {
      if (shouldSuppressAuthError(err)) return;
        console.error('Error loading sales inquiry reports:', err);
        setReports([]);
        setLoadError(err instanceof Error ? err.message : 'Sales reports are unavailable.');
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [contactId, currentUserId, onApprove]);

  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();

    reports.forEach((report) => {
      report.products.forEach((product) => {
        const trimmedName = product.name.trim();
        if (!trimmedName) return;

        const normalizedName = normalizeProductName(trimmedName);
        if (!seen.has(normalizedName)) {
          seen.set(normalizedName, trimmedName);
        }
      });
    });

    return Array.from(seen.values()).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' })
    );
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const reportDate = normalizeDateValue(report.date);
      if (fromDate && reportDate && reportDate < fromDate) return false;
      if (toDate && reportDate && reportDate > toDate) return false;
      if ((fromDate || toDate) && !reportDate) return false;

      if (selectedProduct) {
        const selected = normalizeProductName(selectedProduct);
        const matchesProduct = report.products.some((product) => normalizeProductName(product.name) === selected);
        if (!matchesProduct) return false;
      }

      return true;
    });
  }, [fromDate, reports, selectedProduct, toDate]);

  const hasActiveFilters = fromDate !== '' || toDate !== '' || selectedProduct !== '';

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading sales inquiry reports...</div>;
  }

  if (reports.length === 0) {
    if (loadError) {
      return <div className="p-6 text-center text-rose-700" role="alert">{loadError}</div>;
    }
    return (
      <div className="p-6 text-center text-slate-500">
        <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No sales inquiry reports yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-end">
          <div>
            <label htmlFor={`sales-report-from-date-${contactId}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Date From
            </label>
            <input
              id={`sales-report-from-date-${contactId}`}
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40"
            />
          </div>

          <div>
            <label htmlFor={`sales-report-to-date-${contactId}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Date To
            </label>
            <input
              id={`sales-report-to-date-${contactId}`}
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40"
            />
          </div>

          <div>
            <label htmlFor={`sales-report-product-${contactId}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Product
            </label>
            <select
              id={`sales-report-product-${contactId}`}
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40"
            >
              <option value="">All products</option>
              {productOptions.map((productName) => (
                <option key={productName} value={productName}>
                  {productName}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setSelectedProduct('');
            }}
            disabled={!hasActiveFilters}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Clear filters
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredReports.length}</span> of{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{reports.length}</span> report(s)
          </p>
          {hasActiveFilters && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Filters apply to this customer&apos;s inquiry history only.</p>
          )}
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800">
          <FileSearch className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">No sales inquiry reports match the selected filters.</p>
          <p className="mt-1 text-sm">Try adjusting the date range or choosing a different product.</p>
        </div>
      ) : (
        <section id="daily-call-inquiry-report" className="overflow-x-auto rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-[#eee] px-4 py-3 text-center text-[13px] text-[#333] dark:border-slate-700 dark:text-slate-100">
            <strong className="text-[20px]">Inquiry Report</strong>
            <br />
            {fromDate || toDate ? <>Date from <strong>{formatReportDate(fromDate)}</strong> date to <strong>{formatReportDate(toDate)}</strong></> : 'All dates'}
          </div>
          <table className="w-full min-w-[1050px] border-collapse text-[13px] text-[#333] dark:text-slate-100">
            <thead className="bg-[#f9f9f9] dark:bg-slate-800">
              <tr className="border-b border-[#ddd] dark:border-slate-700">
                <th className="w-[4%] px-2 py-2 text-center">#</th>
                <th className="w-[17%] px-2 py-2 text-left">Inquiry#</th>
                <th className="px-2 py-2 text-left">Sold To</th>
                <th className="w-[12%] px-2 py-2 text-left">Date</th>
                <th className="w-[10%] px-2 py-2 text-left">Time</th>
                <th className="w-[14%] px-2 py-2 text-left">Sales Agent</th>
                <th className="w-[11%] px-2 py-2 text-center">Approval</th>
                <th className="w-[14%] px-2 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report, reportIndex) => (
                <React.Fragment key={report.id || reportIndex}>
                  <tr className="border-b border-[#eee] odd:bg-[#f9f9f9] dark:border-slate-800 dark:odd:bg-slate-800/40">
                    <td className="px-2 py-2 text-center">{reportIndex + 1}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => openDailyCallSalesInquiry(contactId, report.inquiryId)}
                        aria-label={`Open sales inquiry report ${report.id}`}
                        className="font-medium text-[#337ab7] underline decoration-transparent underline-offset-2 hover:decoration-current focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Sales Inquiry #{report.inquiryNo || report.id || '—'}
                      </button>
                    </td>
                    <td className="px-2 py-2">{customerName || contactId}</td>
                    <td className="px-2 py-2">{formatReportDate(report.date)}</td>
                    <td className="px-2 py-2">{report.time || '—'}</td>
                    <td className="px-2 py-2">{report.sales_agent || '—'}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        report.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                        report.approval_status === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {report.approval_status === 'approved' && <CheckCircle className="h-3 w-3" />}
                        {report.approval_status === 'pending' && <Clock className="h-3 w-3" />}
                        {report.approval_status === 'rejected' && <AlertCircle className="h-3 w-3" />}
                        {report.approval_status.charAt(0).toUpperCase() + report.approval_status.slice(1)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">{numberFormat.format(report.total_amount)}</td>
                  </tr>
                  <tr className="border-b border-[#eee] dark:border-slate-800">
                    <td colSpan={8} className="px-3 pb-4 pt-1">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] border-collapse text-[11px]">
                          <thead>
                            <tr className="border-b border-[#ccc] bg-[#f5f5f5] dark:border-slate-700 dark:bg-slate-800">
                              <th className="px-2 py-2 text-center">Quantity</th>
                              <th className="px-2 py-2 text-center">Item Code</th>
                              <th className="px-2 py-2 text-center">Location</th>
                              <th className="px-2 py-2 text-center">Part No</th>
                              <th className="px-2 py-2 text-center">Brand</th>
                              <th className="px-2 py-2 text-center">Description</th>
                              <th className="px-2 py-2 text-right">Unit Price</th>
                              <th className="px-2 py-2 text-center">Remark</th>
                              <th className="px-2 py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.products.length === 0 ? (
                              <tr><td colSpan={9} className="px-2 py-4 text-center text-slate-500">No inquiry items recorded.</td></tr>
                            ) : report.products.map((product, itemIndex) => (
                              <tr key={`${report.id}-product-${itemIndex}`} className="border-b border-[#eee] dark:border-slate-800">
                                <td className="px-2 py-2 text-center">{product.quantity}</td>
                                <td className="px-2 py-2 text-center">{product.itemCode || '—'}</td>
                                <td className="px-2 py-2 text-center">{product.location || '—'}</td>
                                <td className="px-2 py-2 text-center">{product.partNo || '—'}</td>
                                <td className="px-2 py-2 text-center">{product.brand || '—'}</td>
                                <td className="px-2 py-2">{product.description || product.name || '—'}</td>
                                <td className="px-2 py-2 text-right">{numberFormat.format(product.price)}</td>
                                <td className="px-2 py-2 text-center">{product.remark || '—'}</td>
                                <td className="px-2 py-2 text-right">{numberFormat.format(product.price * product.quantity)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={8} className="px-2 py-2 text-right">Grand Total</td>
                              <td className="px-2 py-2 text-right font-semibold text-[#d9534f]">{numberFormat.format(report.total_amount)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {report.notes && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300"><strong>Notes:</strong> {report.notes}</p>}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

export default SalesReportTab;
