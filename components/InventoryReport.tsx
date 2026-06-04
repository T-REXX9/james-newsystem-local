import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  fetchInventoryReport,
  fetchInventoryReportOptions,
  WAREHOUSES,
  InventoryReportRow,
  InventoryReportFilters,
  WarehouseOption,
} from '../services/inventoryReportService';
import {
  Printer,
  Loader2,
  Search,
  Download,
  AlertCircle,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';

const tableCellClass = 'border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 print:border-gray-500 print:text-black';
const tableHeadClass = 'border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-slate-200 print:border-gray-500 print:bg-gray-100 print:text-black';
type DateCovered = 'All' | 'Today' | 'Week' | 'Month' | 'Year' | 'Custom';

const InventoryRow = memo(({ row, warehouses, index }: { row: InventoryReportRow; warehouses: WarehouseOption[]; index: number }) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 print:hover:bg-transparent">
    <td className={`${tableCellClass} text-center`}>{index + 1}</td>
    <td className={tableCellClass}>{row.description || '—'}</td>
    <td className={tableCellClass}>{row.partNo || '—'}</td>
    <td className={tableCellClass}>{row.itemCode || '—'}</td>
    <td className={`${tableCellClass} text-right font-mono`}>
      {row.cost != null ? Number(row.cost).toFixed(2) : '—'}
    </td>
    <td className={tableCellClass}>{row.location || '—'}</td>
    <td className={`${tableCellClass} text-center font-mono`}>{row.totalStock}</td>
    {warehouses.map((wh) => {
      const qty = row.warehouseStock[wh.name] || row.warehouseStock[wh.id] || 0;
      return (
        <td key={wh.id} className={`${tableCellClass} text-center font-mono ${qty === 0 ? 'text-slate-400 dark:text-slate-500' : ''}`}>
          {qty}
        </td>
      );
    })}
    <td className={`${tableCellClass} text-right font-mono`}>
      {row.value != null ? Number(row.value).toFixed(2) : '—'}
    </td>
  </tr>
));

const ProductRow = memo(({ row, index }: { row: InventoryReportRow; index: number }) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 print:hover:bg-transparent">
    <td className={`${tableCellClass} text-center`}>{index + 1}</td>
    <td className={tableCellClass}>{row.description || '—'}</td>
    <td className={tableCellClass}>{row.category || '—'}</td>
    <td className={tableCellClass}>{row.partNo || '—'}</td>
    <td className={tableCellClass}>{row.itemCode || '—'}</td>
    <td className={tableCellClass}>{row.location || '—'}</td>
    <td className={`${tableCellClass} text-center font-mono`}>{row.totalStock}</td>
  </tr>
));

const InventoryReport: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [reportData, setReportData] = useState<InventoryReportRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [dataWarning, setDataWarning] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [partNumbers, setPartNumbers] = useState<{ id: string; partNo: string }[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>(WAREHOUSES);
  const [dateCovered, setDateCovered] = useState<DateCovered>('All');
  const [includeHidden, setIncludeHidden] = useState(false);

  const [filters, setFilters] = useState<InventoryReportFilters>({
    category: '',
    partNumber: '',
    itemCode: '',
    dateFrom: '',
    dateTo: '',
    stockStatus: 'all',
    reportType: 'inventory',
  });

  const [partNumberSearch, setPartNumberSearch] = useState('');
  const [showPartNumberDropdown, setShowPartNumberDropdown] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsInitializing(true);
      try {
        const options = await fetchInventoryReportOptions();
        setCategories(options.categories);
        setPartNumbers(options.partNumbers);
        if (options.warehouses.length > 0) {
          setWarehouses(options.warehouses);
        }
      } finally {
        setIsInitializing(false);
      }
    };
    loadInitialData();
  }, []);

  const getDateRange = useCallback((): Pick<InventoryReportFilters, 'dateFrom' | 'dateTo'> => {
    const today = new Date();
    const toDateInput = (date: Date) => date.toISOString().slice(0, 10);
    const addDays = (days: number) => {
      const next = new Date(today);
      next.setDate(today.getDate() + days);
      return next;
    };
    const addMonths = (months: number) => {
      const next = new Date(today);
      next.setMonth(today.getMonth() + months);
      return next;
    };
    const addYears = (years: number) => {
      const next = new Date(today);
      next.setFullYear(today.getFullYear() + years);
      return next;
    };

    if (dateCovered === 'Today') {
      const value = toDateInput(today);
      return { dateFrom: value, dateTo: value };
    }
    if (dateCovered === 'Week') return { dateFrom: toDateInput(addDays(-7)), dateTo: toDateInput(today) };
    if (dateCovered === 'Month') return { dateFrom: toDateInput(addMonths(-1)), dateTo: toDateInput(today) };
    if (dateCovered === 'Year') return { dateFrom: toDateInput(addYears(-1)), dateTo: toDateInput(today) };
    if (dateCovered === 'Custom') return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
    return { dateFrom: '', dateTo: '' };
  }, [dateCovered, filters.dateFrom, filters.dateTo]);

  const handleGenerateReport = useCallback(async () => {
    setIsLoading(true);
    setDataWarning(null);
    try {
      const requestFilters = {
        ...filters,
        ...getDateRange(),
      };
      const data = await fetchInventoryReport(requestFilters);
      setReportData(data.rows);
      if (data.warehouses.length > 0) {
        setWarehouses(data.warehouses);
      }

      // Validate that each row has warehouse stock entries for all warehouses
      const activeWarehouses = data.warehouses.length > 0 ? data.warehouses : warehouses;
      const missingEntries: string[] = [];
      for (const row of data.rows) {
        for (const wh of activeWarehouses) {
          if (!(wh.name in row.warehouseStock) && !(wh.id in row.warehouseStock)) {
            missingEntries.push(`Item "${row.partNo || row.id}" missing warehouse "${wh.name}"`);
          }
        }
      }
      if (missingEntries.length > 0) {
        console.warn('Incomplete warehouse stock data detected:', missingEntries);
        setDataWarning(`${missingEntries.length} warehouse stock entries are missing from the report data.`);
      }

      setGeneratedAt(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [filters, getDateRange, warehouses]);

  const handleClearFilters = () => {
    setFilters({
      category: '',
      partNumber: '',
      itemCode: '',
      dateFrom: '',
      dateTo: '',
      stockStatus: 'all',
      reportType: 'inventory',
    });
    setPartNumberSearch('');
    setDateCovered('All');
    setIncludeHidden(false);
    setGeneratedAt(null);
    setReportData([]);
  };

  const handlePrint = () => {
    window.print();
  };

  const isInventoryView = filters.reportType === 'inventory';
  const reportTitle = isInventoryView ? 'Inventory Report' : 'Product Report';
  const dateRange = getDateRange();

  const handleExportExcel = () => {
    if (reportData.length === 0) return;

    const escapeCSV = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let headers: string[];
    let csvRows: string[];

    if (isInventoryView) {
      headers = ['Part No', 'Item Code', 'Description', 'Location', 'Cost', ...warehouses.map((wh) => wh.name), 'Total Stock', 'Value'];
      csvRows = [
        headers.join(','),
        ...reportData.map((row) => {
          const values = [
            row.partNo,
            row.itemCode,
            row.description,
            row.location || '',
            row.cost ?? 0,
            ...warehouses.map((wh) => row.warehouseStock[wh.name] || row.warehouseStock[wh.id] || 0),
            row.totalStock,
            row.value ?? 0,
          ];
          return values.map(escapeCSV).join(',');
        }),
      ];
    } else {
      headers = ['Part No', 'Category', 'Item Code', 'Description', 'Location', 'Total Stock'];
      csvRows = [
        headers.join(','),
        ...reportData.map((row) => {
          const values = [row.partNo, row.category, row.itemCode, row.description, row.location || '', row.totalStock];
          return values.map(escapeCSV).join(',');
        }),
      ];
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_report_${filters.reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredPartNumbers = useMemo(() => {
    if (!partNumberSearch) return partNumbers.slice(0, 50);
    return partNumbers
      .filter((p) => p.partNo.toLowerCase().includes(partNumberSearch.toLowerCase()))
      .slice(0, 50);
  }, [partNumbers, partNumberSearch]);

  const summaryStats = useMemo(() => {
    const totalItems = reportData.length;
    const withStock = reportData.filter((r) => r.totalStock > 0).length;
    const withoutStock = reportData.filter((r) => r.totalStock === 0).length;
    const totalQuantity = reportData.reduce((sum, r) => sum + r.totalStock, 0);
    const totalValue = reportData.reduce((sum, r) => sum + (r.value ?? 0), 0);
    return { totalItems, withStock, withoutStock, totalQuantity, totalValue };
  }, [reportData]);

  if (isInitializing) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  if (!generatedAt) {
    return (
      <div className="h-full overflow-auto bg-slate-100 dark:bg-slate-950 p-6 print:bg-white">
        <div className="mx-auto max-w-6xl rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
            <h1 className="text-base font-semibold uppercase text-slate-800 dark:text-slate-100">
              Product and Inventory Report
            </h1>
          </div>

          <div className="px-5 py-5">
            <p className="mb-8 text-sm text-slate-600 dark:text-slate-400">
              Field mark with (<span className="text-rose-600">*</span>) is required. Press generate after you select the sorting options
            </p>

            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="pt-2 text-left font-medium text-slate-700 dark:text-slate-300 md:text-right">Report Type</label>
                <div className="flex flex-wrap items-center gap-5 pt-2 text-slate-700 dark:text-slate-200">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="reportType"
                      checked={filters.reportType === 'inventory'}
                      onChange={() => setFilters({ ...filters, reportType: 'inventory' })}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    Inventory
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="reportType"
                      checked={filters.reportType === 'product'}
                      onChange={() => setFilters({ ...filters, reportType: 'product' })}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    Products
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="pt-2 text-left font-medium text-slate-700 dark:text-slate-300 md:text-right">
                  Date Covered <span className="text-rose-600">*</span>
                </label>
                <select
                  value={dateCovered}
                  onChange={(e) => setDateCovered(e.target.value as DateCovered)}
                  className="w-full max-w-xl rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="All">All</option>
                  <option value="Today">Today</option>
                  <option value="Week">This Week</option>
                  <option value="Month">This Month</option>
                  <option value="Year">This Year</option>
                  <option value="Custom">Custom Date</option>
                </select>
              </div>

              {dateCovered === 'Custom' && (
                <>
                  <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                    <label className="pt-2 text-left font-medium text-slate-700 dark:text-slate-300 md:text-right">
                      Date From <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom || ''}
                      max={filters.dateTo || undefined}
                      onChange={(e) => {
                        const newFrom = e.target.value;
                        setFilters({
                          ...filters,
                          dateFrom: newFrom,
                          dateTo: filters.dateTo && newFrom && filters.dateTo < newFrom ? newFrom : filters.dateTo,
                        });
                      }}
                      className="w-full max-w-xl rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                    <label className="pt-2 text-left font-medium text-slate-700 dark:text-slate-300 md:text-right">
                      Date To <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo || ''}
                      min={filters.dateFrom || undefined}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      className="w-full max-w-xl rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="pt-2 text-left font-medium text-slate-700 dark:text-slate-300 md:text-right">Product Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full max-w-xl rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">Leave blank to display all</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="pt-2 text-left font-medium text-slate-700 dark:text-slate-300 md:text-right">Part Number</label>
                <div className="relative w-full max-w-xl">
                  <input
                    type="text"
                    value={partNumberSearch}
                    onChange={(e) => {
                      setPartNumberSearch(e.target.value);
                      setFilters({ ...filters, partNumber: e.target.value });
                    }}
                    onFocus={() => setShowPartNumberDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPartNumberDropdown(false), 200)}
                    placeholder="All"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 pr-9 text-sm text-slate-700 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  {showPartNumberDropdown && filteredPartNumbers.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setPartNumberSearch('');
                          setFilters({ ...filters, partNumber: '' });
                          setShowPartNumberDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        All
                      </button>
                      {filteredPartNumbers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPartNumberSearch(p.partNo);
                            setFilters({ ...filters, partNumber: p.partNo });
                            setShowPartNumberDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {p.partNo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="pt-1 text-left font-medium text-slate-700 dark:text-slate-300 md:text-right">Stock Option</label>
                <div className="space-y-2 text-slate-700 dark:text-slate-200">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="stockStatus"
                      checked={filters.stockStatus === 'all'}
                      onChange={() => setFilters({ ...filters, stockStatus: 'all' })}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    All
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="stockStatus"
                      checked={filters.stockStatus === 'with_stock'}
                      onChange={() => setFilters({ ...filters, stockStatus: 'with_stock' })}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    With Stock Only
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="stockStatus"
                      checked={filters.stockStatus === 'without_stock'}
                      onChange={() => setFilters({ ...filters, stockStatus: 'without_stock' })}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    Without Stock Only
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="pt-1 text-left font-medium text-slate-700 dark:text-slate-300 md:text-right">Other Options</label>
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={!includeHidden}
                    onChange={(e) => setIncludeHidden(!e.target.checked)}
                    className="h-4 w-4 accent-brand-blue"
                  />
                  Don't Include Hidden
                </label>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <span />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    disabled={isLoading || (dateCovered === 'Custom' && (!filters.dateFrom || !filters.dateTo))}
                    className="inline-flex items-center gap-2 rounded bg-brand-blue px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Generate Report
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-slate-100 p-6 dark:bg-slate-950 print:bg-white print:p-0">
      <div className="mx-auto max-w-none rounded border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 print:hidden">
          <h1 className="text-base font-semibold uppercase text-slate-800 dark:text-slate-100">
            Inventory Report View
          </h1>
        </div>

        <div className="px-5 py-4">
          <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setGeneratedAt(null)}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Back to Option
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={reportData.length === 0}
              className="inline-flex items-center gap-2 rounded bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={reportData.length === 0}
              className="ml-auto inline-flex items-center gap-2 rounded bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Printer className="h-4 w-4" />
              Print Preview
            </button>
          </div>

          <hr className="mb-5 border-slate-200 dark:border-slate-800 print:hidden" />

          {dataWarning && (
            <div className="mb-4 flex items-center gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 print:hidden">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{dataWarning}</span>
            </div>
          )}

          <div id="print_area">
            <div className="mb-5 text-center text-slate-800 dark:text-slate-100 print:text-black">
              <strong className="text-xl">{reportTitle}</strong>
              {dateRange.dateFrom && dateRange.dateTo && (
                <div className="mt-1 text-sm">
                  Date from <strong>{dateRange.dateFrom}</strong> date to <strong>{dateRange.dateTo}</strong>
                </div>
              )}
              <div className="mt-1 text-sm">
                System generated <strong>{generatedAt.toLocaleString()}</strong>
              </div>
            </div>

            {reportData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="mb-3 h-8 w-8 text-amber-500" />
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">No Products Found</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  No products match the selected filter criteria.
                </p>
              </div>
            ) : isInventoryView ? (
              <div className="overflow-auto print:overflow-visible">
                <table className="w-full min-w-[1050px] border-collapse text-left print:min-w-0">
                  <thead>
                    <tr>
                      <th className={tableHeadClass} style={{ width: '1%' }}>#</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>PRODUCT NAME</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>PART NO</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>CODE</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>COST</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>LOC</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>BALANCE</th>
                      {warehouses.map((wh) => (
                        <th key={wh.id} className={tableHeadClass} style={{ width: '5%' }}>{wh.name}</th>
                      ))}
                      <th className={tableHeadClass} style={{ width: '5%' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, index) => (
                      <InventoryRow key={row.id || `${row.partNo}-${index}`} row={row} warehouses={warehouses} index={index} />
                    ))}
                    <tr>
                      <td colSpan={7 + warehouses.length} className={`${tableCellClass} text-right font-semibold`}>
                        Total Value:
                      </td>
                      <td className={`${tableCellClass} text-right font-mono font-semibold`}>
                        {summaryStats.totalValue.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-auto print:overflow-visible">
                <table className="w-full min-w-[760px] border-collapse text-left print:min-w-0">
                  <thead>
                    <tr>
                      <th className={tableHeadClass} style={{ width: '1%' }}>#</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>PRODUCT NAME</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>CATEGORY</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>PART NO</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>CODE</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>LOC</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>STOCK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, index) => (
                      <ProductRow key={row.id || `${row.partNo}-${index}`} row={row} index={index} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryReport;
