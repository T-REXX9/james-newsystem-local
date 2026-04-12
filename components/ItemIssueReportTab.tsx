import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, FileSearch, PackageSearch } from 'lucide-react';
import { fetchDailyCallSalesReports } from '../services/dailyCallCustomerDetailService';
import {
  DailyCallSalesReportRecord,
  DailyCallSalesReportProductLine,
  normalizeDateValue,
  normalizeProductName,
  normalizeSalesReportRecords,
  openDailyCallSalesInquiry,
} from './dailyCallSalesReportUtils';

type IssueCategory = 'not-listed' | 'no-stock';

interface ItemIssueReportTabProps {
  contactId: string;
}

interface IssueReportRow {
  id: string;
  inquiryId: string;
  inquiryDate: string;
  inquiryTime: string;
  salesAgent: string;
  approvalStatus: string;
  totalAmount: number;
  notes: string;
  product: DailyCallSalesReportProductLine;
}

const ISSUE_CATEGORY_CONFIG: Record<IssueCategory, { label: string; emptyTitle: string; emptyHint: string }> = {
  'not-listed': {
    label: 'Item Not Listed',
    emptyTitle: 'No item-not-listed reports match the selected filters.',
    emptyHint: 'This only includes inquiry items marked as not listed in the product database.',
  },
  'no-stock': {
    label: 'Item No Stock',
    emptyTitle: 'No no-stock reports match the selected filters.',
    emptyHint: 'This only includes inquiry items marked as out of stock.',
  },
};

const isItemNotListed = (remark: string) => remark.trim().toLowerCase() === 'notlisted';
const isItemNoStock = (remark: string) => remark.trim().toLowerCase() === 'outstock';

const ItemIssueReportTab: React.FC<ItemIssueReportTabProps> = ({ contactId }) => {
  const [reports, setReports] = useState<DailyCallSalesReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [activeCategory, setActiveCategory] = useState<IssueCategory>('not-listed');

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setFromDate('');
      setToDate('');
      setSelectedProduct('');
      setActiveCategory('not-listed');

      try {
        const data = await fetchDailyCallSalesReports(contactId);
        setReports(normalizeSalesReportRecords(data));
      } catch (error) {
        console.error('Error loading item issue reports:', error);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [contactId]);

  const allIssueRows = useMemo(() => {
    const rows: IssueReportRow[] = [];

    reports.forEach((report) => {
      report.products.forEach((product, index) => {
        const remark = String(product.remark || '');
        if (!isItemNotListed(remark) && !isItemNoStock(remark)) {
          return;
        }

        rows.push({
          id: `${report.id}-${index}-${remark}`,
          inquiryId: report.id,
          inquiryDate: report.date,
          inquiryTime: report.time,
          salesAgent: report.sales_agent,
          approvalStatus: report.approval_status,
          totalAmount: report.total_amount,
          notes: report.notes || '',
          product,
        });
      });
    });

    return rows;
  }, [reports]);

  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();

    allIssueRows.forEach((row) => {
      const trimmedName = row.product.name.trim();
      if (!trimmedName) return;

      const normalizedName = normalizeProductName(trimmedName);
      if (!seen.has(normalizedName)) {
        seen.set(normalizedName, trimmedName);
      }
    });

    return Array.from(seen.values()).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' })
    );
  }, [allIssueRows]);

  const filteredIssueRows = useMemo(() => {
    return allIssueRows.filter((row) => {
      const reportDate = normalizeDateValue(row.inquiryDate);
      if (fromDate && reportDate && reportDate < fromDate) return false;
      if (toDate && reportDate && reportDate > toDate) return false;
      if ((fromDate || toDate) && !reportDate) return false;

      const matchesCategory = activeCategory === 'not-listed'
        ? isItemNotListed(row.product.remark)
        : isItemNoStock(row.product.remark);
      if (!matchesCategory) return false;

      if (selectedProduct) {
        const selected = normalizeProductName(selectedProduct);
        if (normalizeProductName(row.product.name) !== selected) return false;
      }

      return true;
    });
  }, [activeCategory, allIssueRows, fromDate, selectedProduct, toDate]);

  const issueCounts = useMemo(
    () => ({
      'not-listed': allIssueRows.filter((row) => isItemNotListed(row.product.remark)).length,
      'no-stock': allIssueRows.filter((row) => isItemNoStock(row.product.remark)).length,
    }),
    [allIssueRows]
  );

  const hasActiveFilters = fromDate !== '' || toDate !== '' || selectedProduct !== '';

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading item issue reports...</div>;
  }

  if (allIssueRows.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <Boxes className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No item issue reports yet</p>
        <p className="mt-1 text-sm">This tab shows item-not-listed and no-stock inquiries for this customer.</p>
      </div>
    );
  }

  const activeCategoryMeta = ISSUE_CATEGORY_CONFIG[activeCategory];

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap gap-2">
        {(['not-listed', 'no-stock'] as const).map((category) => {
          const isActive = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <PackageSearch className="h-4 w-4" />
              {ISSUE_CATEGORY_CONFIG[category].label}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-200'
              }`}>
                {issueCounts[category]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-end">
          <div>
            <label htmlFor={`item-issue-from-date-${contactId}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Date From
            </label>
            <input
              id={`item-issue-from-date-${contactId}`}
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40"
            />
          </div>

          <div>
            <label htmlFor={`item-issue-to-date-${contactId}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Date To
            </label>
            <input
              id={`item-issue-to-date-${contactId}`}
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40"
            />
          </div>

          <div>
            <label htmlFor={`item-issue-product-${contactId}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Product
            </label>
            <select
              id={`item-issue-product-${contactId}`}
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
            Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredIssueRows.length}</span> of{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{issueCounts[activeCategory]}</span> {activeCategoryMeta.label.toLowerCase()} row(s)
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Each row opens the exact sales inquiry where this issue happened.</p>
        </div>
      </div>

      {filteredIssueRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800">
          <FileSearch className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">{activeCategoryMeta.emptyTitle}</p>
          <p className="mt-1 text-sm">{activeCategoryMeta.emptyHint}</p>
        </div>
      ) : (
        filteredIssueRows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => openDailyCallSalesInquiry(contactId, row.inquiryId)}
            aria-label={`Open ${activeCategoryMeta.label.toLowerCase()} inquiry ${row.inquiryId}`}
            className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500/50"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h4 className="font-semibold text-slate-800 dark:text-white">
                    {ISSUE_CATEGORY_CONFIG[activeCategory].label} - {new Date(row.inquiryDate).toLocaleDateString()} {row.inquiryTime}
                  </h4>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    row.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                    row.approvalStatus === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {row.approvalStatus.charAt(0).toUpperCase() + row.approvalStatus.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Agent: {row.salesAgent}</p>
                <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">Click to open this exact inquiry</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-800 dark:text-white">
                  ₱{(row.product.price * row.product.quantity).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Inquiry total: ₱{row.totalAmount.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Product</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{row.product.name || row.product.description || 'Unnamed product'}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {row.product.partNo || 'No part no.'} {row.product.itemCode ? `• ${row.product.itemCode}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quantity</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{row.product.quantity}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Issue</p>
                <p className={`text-sm font-semibold ${
                  activeCategory === 'not-listed' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'
                }`}>
                  {activeCategory === 'not-listed' ? 'Not listed in product database' : 'Out of stock'}
                </p>
              </div>
            </div>

            {row.notes && (
              <div className="mt-3 rounded bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Notes:</p>
                {row.notes}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  );
};

export default ItemIssueReportTab;
