import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Download,
  FolderOpen,
  Lightbulb,
  ListFilter,
  Loader2,
  Package,
  Plus,
  Search,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  addSuggestedStockItemsToKiv,
  createPurchaseRequestFromSuggestions,
  markSuggestedStockItemsAddedToPr,
  removeSuggestedStockItemsFromKiv,
  SuggestedStockItem,
  SuggestedStockSortOption,
} from '../services/suggestedStockService';
import {
  formatSuggestedStockDate,
  suggestedStockRowKey,
  useSuggestedStockReportQuery,
} from '../hooks/useSuggestedStockReportQuery';
import { useToast } from './ToastProvider';

interface SuggestedStockReportProps {
  currentUser?: UserProfile | null;
}

const SORT_OPTIONS: Array<{ value: SuggestedStockSortOption; label: string }> = [
  { value: 'qty-desc', label: 'Qty requested (total) — highest first' },
  { value: 'description-asc', label: 'Descriptions' },
  { value: 'inquiries-desc', label: 'Customer requests — highest first' },
  { value: 'inquiries-asc', label: 'Customer requests — lowest first' },
  { value: 'description-desc', label: 'Description — Z to A' },
];

const SuggestedStockReport: React.FC<SuggestedStockReportProps> = ({ currentUser: _currentUser }) => {
  const { addToast } = useToast();
  const query = useSuggestedStockReportQuery();
  const {
    period,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    setPeriod,
    setPeriodAndRange,
    selectedCustomer,
    setSelectedCustomer,
    partNoInput,
    setPartNoInput,
    appliedFilters,
    customers,
    isLoadingCustomers,
    summaryData,
    removeSummaryKeys,
    isLoading,
    isLoadingMore,
    sortOption,
    setSortOption,
    kivFolder,
    setKivFolder,
    visibleSummary,
    visibleItemCount,
    hasMoreRows,
    loadMoreRef,
    loadReport,
    applyFilters,
    applyPartNoSearch,
    resetDateRange,
    dateRangeError,
    uniqueItemCount,
    totalInquiries,
    totalQty,
    uniqueCustomers,
    reportLoadId,
  } = query;

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isUpdatingKiv, setIsUpdatingKiv] = useState(false);
  const [isAddingToPr, setIsAddingToPr] = useState(false);
  const [prQuantities, setPrQuantities] = useState<Record<string, number>>({});
  const isAddingToPrRef = useRef(false);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [reportLoadId]);

  const selectedItems = useMemo(
    () => summaryData.filter((item) => selectedKeys.has(suggestedStockRowKey(item))),
    [selectedKeys, summaryData]
  );
  const allVisibleSelected =
    visibleSummary.length > 0 && visibleSummary.every((item) => selectedKeys.has(suggestedStockRowKey(item)));
  const prSelectedItems = selectedItems.filter((item) => item.productCreated);

  const toggleSelectRow = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleSummary.forEach((item) => next.delete(suggestedStockRowKey(item)));
        return next;
      }
      visibleSummary.forEach((item) => next.add(suggestedStockRowKey(item)));
      return next;
    });
  };

  const updatePrQuantity = (item: SuggestedStockItem, value: string) => {
    const parsed = Number(value);
    setPrQuantities((current) => ({
      ...current,
      [item.id]: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
    }));
  };

  const handleAddSelectedItemsToPr = async () => {
    if (selectedItems.length === 0 || isAddingToPr || isAddingToPrRef.current) return;
    const notCreated = selectedItems.filter((item) => !item.productCreated);
    if (notCreated.length > 0) {
      addToast({ type: 'warning', title: 'Create the product first', description: 'Only rows marked Product Created can be added to a purchase request.' });
      return;
    }
    const invalidQty = selectedItems.find((item) => Number(prQuantities[item.id] ?? item.totalQty) <= 0);
    if (invalidQty) {
      addToast({ type: 'warning', title: 'Enter a PR quantity', description: `Enter a quantity greater than zero for ${invalidQty.partNo || invalidQty.description}.` });
      return;
    }

    isAddingToPrRef.current = true;
    setIsAddingToPr(true);
    try {
      const request = await createPurchaseRequestFromSuggestions(prSelectedItems, prQuantities);
      await markSuggestedStockItemsAddedToPr(prSelectedItems);
      setSelectedKeys(new Set());
      setPrQuantities({});
      await loadReport();
      addToast({
        type: 'success',
        title: 'Items added to purchase request',
        description: `${prSelectedItems.length} item${prSelectedItems.length === 1 ? '' : 's'} added to ${request.pr_number || 'the new PR'}.`,
        durationMs: 7000,
      });
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to add items to PR', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      isAddingToPrRef.current = false;
      setIsAddingToPr(false);
    }
  };

  const handleKivSelection = async () => {
    if (selectedItems.length === 0 || isUpdatingKiv) return;
    setIsUpdatingKiv(true);
    try {
      if (kivFolder) {
        const restored = await removeSuggestedStockItemsFromKiv(selectedItems);
        addToast({
          type: 'success',
          title: 'Restored from KIV folder',
          description: `${restored} item${restored === 1 ? '' : 's'} are back on the report.`,
        });
      } else {
        const added = await addSuggestedStockItemsToKiv(selectedItems);
        addToast({
          type: 'success',
          title: 'Moved to KIV folder',
          description: `${added} item${added === 1 ? '' : 's'} will stay off this report until restored.`,
        });
      }
      const movedKeys = new Set(selectedItems.map((item) => suggestedStockRowKey(item)));
      setSelectedKeys(new Set());
      removeSummaryKeys(movedKeys);
      await loadReport();
    } catch (error) {
      addToast({
        type: 'error',
        title: kivFolder ? 'Unable to restore items' : 'Unable to move items to KIV',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsUpdatingKiv(false);
    }
  };

  const exportCsv = () => {
    const escape = (value: unknown) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = [
      'Part Number',
      'Item Code',
      'Description',
      'Brand',
      'Total Inquiries',
      'Total Qty Requested',
      'Customers',
      'Last Requested',
      'KIV',
    ];
    const rows = summaryData.map((item) => [
      item.partNo,
      item.itemCode,
      item.description,
      item.brand,
      item.inquiryCount,
      item.totalQty,
      item.customerCount,
      item.lastInquiryDate,
      kivFolder || item.isKiv ? 'Yes' : 'No',
    ]);
    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `item-suggested-for-stock-${appliedFilters.dateFrom}-to-${appliedFilters.dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateProduct = (item: SuggestedStockItem) => {
    const params = new URLSearchParams({
      create: '1',
      suggestedFrom: '1',
      partNo: item.partNo,
      description: item.description,
      suggestedInquiryItemId: item.id,
    });
    if (item.itemCode) params.set('itemCode', item.itemCode);
    const productDatabaseUrl = new URL(window.location.href);
    productDatabaseUrl.hash = `#/warehouse-inventory-product-database?${params.toString()}`;
    const productWindow = window.open(productDatabaseUrl.toString(), '_blank', 'noopener,noreferrer');

    if (!productWindow) {
      addToast({
        type: 'warning',
        title: 'New tab was blocked',
        description: 'Please allow pop-ups for this system to open Product Database in a separate tab.',
        durationMs: 5000,
      });
    }
  };

  const emptyMessage = kivFolder
    ? 'No items in the KIV folder for this date range.'
    : appliedFilters.partNo
      ? 'No active items match that part number.'
      : 'No active suggested stock items found.';
  const emptyHint = kivFolder
    ? 'Select items on the main report and move them here when you are not ready to buy.'
    : 'Create the product first, then select the Product Created row to add it to a PR.';

  return (
    <div className="h-full overflow-y-auto bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><span>Purchasing</span><span>›</span><span>Reports</span><span>›</span><span className="text-slate-700">Item Suggested for Stock Report</span></div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#173c83]">Item Suggested for Stock Report</h1>
            <p className="mt-1 text-sm text-slate-500">
              Register a requested product, then select its Product Created row and add it directly to a purchase request.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button type="button" onClick={() => void handleAddSelectedItemsToPr()} disabled={selectedItems.length === 0 || selectedItems.length !== prSelectedItems.length || isAddingToPr} title={selectedItems.length > prSelectedItems.length ? 'Create every selected product before adding the selection to a PR.' : undefined} className="inline-flex items-center gap-2 rounded-md bg-[#173c83] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#102f76] disabled:cursor-not-allowed disabled:opacity-50">
              {isAddingToPr ? 'Adding to PR...' : `Add Selected Items to PR (${prSelectedItems.length})`}
            </button>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-[#f8fafb] p-4 shadow-sm xl:order-1">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-bold uppercase text-[#173c83]">Workflow</h2>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li><span className="font-bold text-[#173c83]">1.</span> Review active customer demand below.</li>
              <li><span className="font-bold text-[#173c83]">2.</span> Create the product in Product Database.</li>
              <li><span className="font-bold text-[#173c83]">3.</span> Park items you are not buying now in the KIV folder.</li>
              <li><span className="font-bold text-[#173c83]">4.</span> Select Product Created rows, then add them to a PR.</li>
            </ol>
          </aside>

          <main className="min-w-0 xl:order-2">
            <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{kivFolder ? 'Items in KIV folder' : 'Active items in report'}</p><p className="mt-1 text-2xl font-extrabold text-[#173c83]">{uniqueItemCount}</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total inquiries</p><p className="mt-1 text-2xl font-extrabold text-[#175fd3]">{totalInquiries}</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quantity requested</p><p className="mt-1 text-2xl font-extrabold text-slate-700">{totalQty}</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Customers / prospects</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{uniqueCustomers}</p></div>
            </section>

            <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-label="Report filters and sorting">
              <div className="grid gap-4 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <ListFilter className="h-4 w-4 text-[#175fd3]" /> Sort By
                  </span>
                  <select
                    aria-label="Sort suggested stock items"
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value as SuggestedStockSortOption)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <div className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <FolderOpen className="h-4 w-4 text-[#175fd3]" /> View
                  </span>
                  <button
                    type="button"
                    aria-label="KIV folder"
                    aria-pressed={kivFolder}
                    onClick={() => setKivFolder((current) => !current)}
                    className={`h-10 w-full rounded-md border px-3 text-sm font-semibold transition ${
                      kivFolder
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    KIV folder
                  </button>
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <Search className="h-4 w-4 text-[#175fd3]" /> Search by part number
                  </span>
                  <input
                    aria-label="Search by part number"
                    value={partNoInput}
                    onChange={(event) => setPartNoInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        applyPartNoSearch();
                      }
                    }}
                    placeholder="Type a part number..."
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Customer
                  </span>
                  <select
                    aria-label="Filter by customer"
                    value={selectedCustomer}
                    onChange={(event) => setSelectedCustomer(event.target.value)}
                    disabled={isLoadingCustomers}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  >
                    <option value="all">All customers</option>
                    {customers.map((customer) => (
                      <option key={`${customer.id}-${customer.company}`} value={customer.id}>
                        {customer.company} ({customer.inquiryCount})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <CalendarDays className="h-4 w-4 text-[#175fd3]" /> Date Range
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">Use a quick range or choose exact start and end dates.</p>
                  </div>
                  <div className="flex flex-wrap overflow-hidden rounded-md border border-slate-300">
                    {(['today', 'week', 'month', 'year'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPeriodAndRange(option)}
                        className={`border-r border-slate-200 px-3 py-2 text-xs font-bold last:border-r-0 ${
                          period === option ? 'bg-[#175fd3] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option === 'today' ? 'Today' : option === 'week' ? 'Last 7 Days' : option === 'month' ? 'This Month' : 'This Year'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-600">Start date</span>
                    <input
                      aria-label="Start date"
                      type="date"
                      value={dateFrom}
                      onChange={(event) => { setDateFrom(event.target.value); setPeriod('custom'); }}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-600">End date</span>
                    <input
                      aria-label="End date"
                      type="date"
                      value={dateTo}
                      onChange={(event) => { setDateTo(event.target.value); setPeriod('custom'); }}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyFilters}
                    disabled={Boolean(dateRangeError)}
                    className="h-10 rounded-md bg-[#175fd3] px-4 text-sm font-bold text-white transition hover:bg-[#0e4fb7] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    onClick={resetDateRange}
                    className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Reset
                  </button>
                </div>
                {dateRangeError ? (
                  <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{dateRangeError}</p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-[#173c83]">
                    Showing {formatSuggestedStockDate(appliedFilters.dateFrom)} through {formatSuggestedStockDate(appliedFilters.dateTo)}
                    {appliedFilters.partNo ? ` • Part number: ${appliedFilters.partNo}` : ''}
                    {kivFolder ? ' • KIV folder' : ''}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
                <p className="text-sm font-bold text-slate-700">
                  {kivFolder
                    ? `${uniqueItemCount} item${uniqueItemCount === 1 ? '' : 's'} in KIV folder`
                    : `${uniqueItemCount} active item${uniqueItemCount === 1 ? '' : 's'} in the product-to-PR workflow`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleKivSelection()}
                    disabled={selectedItems.length === 0 || isUpdatingKiv}
                    className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {isUpdatingKiv
                      ? 'Updating...'
                      : kivFolder
                        ? `Restore selected from KIV (${selectedItems.length})`
                        : `Move selected to KIV folder (${selectedItems.length})`}
                  </button>
                  <div className="flex items-center gap-2 rounded bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    {kivFolder ? (
                      <>
                        <FolderOpen className="h-3.5 w-3.5 text-amber-500" /> Restore items when you are ready to buy them.
                      </>
                    ) : (
                      <>
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Select items you do not want to buy yet and move them to the KIV folder.
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="flex h-56 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-[#175fd3]" /> Loading report data...
                </div>
              ) : visibleSummary.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center text-center">
                  <Package className="mb-2 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">{emptyMessage}</p>
                  <p className="mt-1 text-xs text-slate-400">{emptyHint}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[56rem] border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">
                          <label className="inline-flex items-center justify-center gap-1">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={toggleSelectAllVisible}
                              aria-label="Select all visible items"
                              className="h-4 w-4 rounded border-white/30"
                            />
                            All
                          </label>
                        </th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-left font-bold uppercase tracking-wide text-white">Part No</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-left font-bold uppercase tracking-wide text-white">Description</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Customer Requests</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Qty Requested (Total)</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Customers</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Last Requested</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Status</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">PR Qty</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSummary.map((item) => {
                        const rowKey = suggestedStockRowKey(item);
                        return (
                          <tr key={rowKey} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedKeys.has(rowKey)}
                                onChange={() => toggleSelectRow(rowKey)}
                                aria-label={`Select ${item.partNo || item.description || 'item'}`}
                                title={
                                  kivFolder
                                    ? 'Select to restore from KIV'
                                    : item.productCreated
                                      ? 'Select for purchase request or KIV'
                                      : 'Select to move to KIV folder, or create the product first for PR'
                                }
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#e85c41]">{item.partNo || '-'}</td>
                            <td className="px-4 py-3 font-semibold text-[#173c83]">{item.description || '-'}</td>
                            <td className="px-4 py-3 text-center font-bold text-[#175fd3]">{item.inquiryCount} requests</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">{item.totalQty} pcs</td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.customerCount} customers</td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.lastInquiryDate ? new Date(item.lastInquiryDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}</td>
                            <td className="px-4 py-3 text-center">
                              {item.productCreated ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">Product Created</span>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Needs Product</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.productCreated ? (
                                <input
                                  aria-label={`PR quantity for ${item.partNo || item.description || 'item'}`}
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={prQuantities[item.id] ?? (item.totalQty || 1)}
                                  onChange={(event) => updatePrQuantity(item, event.target.value)}
                                  className="h-8 w-20 rounded border border-slate-300 px-2 text-center font-bold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                                />
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.productCreated ? (
                                <span className="text-xs font-semibold text-emerald-700">Ready for PR</span>
                              ) : (
                                <button type="button" onClick={() => handleCreateProduct(item)} className="inline-flex items-center gap-1 rounded-md border border-[#175fd3] bg-white px-3 py-1.5 text-xs font-bold text-[#175fd3] transition hover:bg-blue-50">
                                  <Plus className="h-3.5 w-3.5" /> Create
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="sticky left-0 flex min-w-full flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Showing 1 to {visibleItemCount} of {summaryData.length} items
                      {selectedItems.length > 0 ? ` • ${selectedItems.length} selected` : ''}
                    </p>
                    <div ref={loadMoreRef} className="flex min-h-7 items-center gap-2 text-sm font-semibold text-[#175fd3]">
                      {(hasMoreRows || isLoadingMore) && (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {isLoadingMore ? 'Loading more items...' : 'Scroll to load more'}</>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SuggestedStockReport;
