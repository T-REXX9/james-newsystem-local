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

interface SalesReportTabProps {
  contactId: string;
  currentUserId?: string;
  onApprove?: (reportId: string) => void;
}

const SalesReportTab: React.FC<SalesReportTabProps> = ({ contactId, currentUserId, onApprove }) => {
  const [reports, setReports] = useState<DailyCallSalesReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setFromDate('');
      setToDate('');
      setSelectedProduct('');

      try {
        const data = await fetchDailyCallSalesReports(contactId);
        setReports(normalizeSalesReportRecords(data));
      } catch (err) {
        console.error('Error loading sales inquiry reports:', err);
        setReports([]);
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
        filteredReports.map((report) => (
          <button
            key={report.id}
            type="button"
            onClick={() => openDailyCallSalesInquiry(contactId, report.id)}
            aria-label={`Open sales inquiry report ${report.id}`}
            className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500/50"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h4 className="font-semibold text-slate-800 dark:text-white">
                    Sales Inquiry Report - {new Date(report.date).toLocaleDateString()} {report.time}
                  </h4>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    report.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                    report.approval_status === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {report.approval_status === 'approved' && <CheckCircle className="h-3 w-3" />}
                    {report.approval_status === 'pending' && <Clock className="h-3 w-3" />}
                    {report.approval_status === 'rejected' && <AlertCircle className="h-3 w-3" />}
                    {report.approval_status.charAt(0).toUpperCase() + report.approval_status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Agent: {report.sales_agent}</p>
                <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">Click to open this exact inquiry</p>
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-white">
                ₱{report.total_amount.toLocaleString()}
              </p>
            </div>

            <div className="mb-3">
              <h5 className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Products:</h5>
              <div className="space-y-1">
                {report.products.map((product, idx) => (
                  <div key={`${report.id}-product-${idx}`} className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">
                      {product.name} x{product.quantity}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      ₱{(product.price * product.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {report.notes && (
              <div className="mb-3 rounded bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Notes:</p>
                {report.notes}
              </div>
            )}

            {report.approval_status === 'pending' && (
              <div className="border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Approval actions are unavailable in local MySQL read mode.
              </div>
            )}
          </button>
        ))
      )}
    </div>
  );
};

export default SalesReportTab;
