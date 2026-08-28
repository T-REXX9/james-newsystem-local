import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  fetchInventoryReport,
  fetchInventoryReportOptions,
  InventoryReportRow,
  InventoryReportFilters,
} from '../services/inventoryReportService';
import {
  Printer,
  Loader2,
  Search,
  Download,
  AlertCircle,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { formatCurrency, formatDateFull } from '../utils/formatUtils';

const tableCellClass = 'border border-[#ddd] px-2 py-[6px] text-[12px] text-[#333] print:border-black';
const tableHeadClass = 'border border-[#ddd] bg-[#f5f5f5] px-2 py-2 text-[12px] font-semibold uppercase text-[#333] print:border-black';
const formRowClass = 'grid items-start gap-4 md:grid-cols-[220px_minmax(0,1fr)]';
const formLabelClass = 'pt-2 text-left text-[13px] font-semibold text-[#333] md:text-right';
const formControlClass = 'h-[34px] w-full max-w-[590px] rounded-[3px] border border-[#ccc] bg-white px-3 text-[13px] text-[#333] shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]';
type DateCovered = 'All' | 'Today' | 'Week' | 'Month' | 'Year' | 'Custom';

const getProductDatabaseUrl = (row: InventoryReportRow): string => {
  const params = new URLSearchParams({
    productId: row.id,
    partNo: row.partNo,
  });
  const productDatabaseUrl = new URL(window.location.href);
  productDatabaseUrl.hash = `#/warehouse-inventory-product-database?${params.toString()}`;
  return productDatabaseUrl.toString();
};

const openProductDatabaseRecord = (row: InventoryReportRow) => {
  if (!row.id || !row.partNo) return;
  window.open(getProductDatabaseUrl(row), '_blank', 'noopener,noreferrer');
};

const PartNumberCell = ({ row }: { row: InventoryReportRow }) => (
  <td className={tableCellClass}>
    {row.partNo ? (
      <button
        type="button"
        onDoubleClick={() => openProductDatabaseRecord(row)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') openProductDatabaseRecord(row);
        }}
        className="cursor-pointer font-semibold text-[#175fd3] underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
        title="Double-click to open this Product Database record in a new tab"
        aria-label={`Open ${row.partNo} in Product Database`}
      >
        {row.partNo}
      </button>
    ) : '—'}
  </td>
);

const InventoryRow = memo(({ row, index }: { row: InventoryReportRow; index: number }) => (
  <tr>
    <td className={`${tableCellClass} text-center`}>{index + 1}</td>
    <td className={tableCellClass}>{row.description || '—'}</td>
    <PartNumberCell row={row} />
    <td className={tableCellClass}>{row.itemCode || '—'}</td>
    <td className={`${tableCellClass} text-right font-mono`}>
      {row.cost != null ? formatCurrency(Number(row.cost), true) : '—'}
    </td>
    <td className={tableCellClass}>{row.location || '—'}</td>
    <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateFull(row.lastTransactionDate)}</td>
    <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateFull(row.lastRrDate)}</td>
    <td className={`${tableCellClass} text-center font-mono`}>{row.reorderQuantity}</td>
    <td className={`${tableCellClass} text-center font-mono`}>{row.totalStock}</td>
    <td className={`${tableCellClass} text-right font-mono`}>
      {row.value != null ? formatCurrency(Number(row.value), true) : '—'}
    </td>
  </tr>
));

const ProductRow = memo(({ row, index }: { row: InventoryReportRow; index: number }) => (
  <tr>
    <td className={`${tableCellClass} text-center`}>{index + 1}</td>
    <td className={tableCellClass}>{row.description || '—'}</td>
    <td className={tableCellClass}>{row.category || '—'}</td>
    <PartNumberCell row={row} />
    <td className={tableCellClass}>{row.itemCode || '—'}</td>
    <td className={tableCellClass}>{row.location || '—'}</td>
    <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateFull(row.lastTransactionDate)}</td>
    <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateFull(row.lastRrDate)}</td>
    <td className={`${tableCellClass} text-center font-mono`}>{row.reorderQuantity}</td>
    <td className={`${tableCellClass} text-center font-mono`}>{row.totalStock}</td>
  </tr>
));

const InventoryReport: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [reportData, setReportData] = useState<InventoryReportRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [partNumbers, setPartNumbers] = useState<{ id: string; partNo: string }[]>([]);
  const [dateCovered, setDateCovered] = useState<DateCovered>('All');
  const [includeHidden, setIncludeHidden] = useState(false);

  const [filters, setFilters] = useState<InventoryReportFilters>({
    description: '',
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
        setDescriptions(options.descriptions);
        setPartNumbers(options.partNumbers);
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
    try {
      const requestFilters = {
        ...filters,
        ...getDateRange(),
      };
      const data = await fetchInventoryReport(requestFilters);
      setReportData(data.rows);
      setGeneratedAt(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [filters, getDateRange]);

  const handleClearFilters = () => {
    setFilters({
      description: '',
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
      headers = ['Part No', 'Item Code', 'Description', 'Location', 'Last Transaction Date', 'Last RR Date', 'Reorder Quantity', 'VIP 1 Price', 'Total Stock', 'Value'];
      csvRows = [
        headers.join(','),
        ...reportData.map((row) => {
          const values = [
            row.partNo,
            row.itemCode,
            row.description,
            row.location || '',
            row.lastTransactionDate || '',
            row.lastRrDate || '',
            row.reorderQuantity,
            row.cost ?? 0,
            row.totalStock,
            row.value ?? 0,
          ];
          return values.map(escapeCSV).join(',');
        }),
      ];
    } else {
      headers = ['Part No', 'Category', 'Item Code', 'Description', 'Location', 'Last Transaction Date', 'Last RR Date', 'Reorder Quantity', 'Total Stock'];
      csvRows = [
        headers.join(','),
        ...reportData.map((row) => {
          const values = [row.partNo, row.category, row.itemCode, row.description, row.location || '', row.lastTransactionDate || '', row.lastRrDate || '', row.reorderQuantity, row.totalStock];
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
      <div className="flex h-full items-center justify-center bg-[#f4f4f4]">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  if (!generatedAt) {
    return (
      <div className="min-h-full overflow-auto bg-[#f4f4f4] px-4 py-10 text-[#333] print:bg-white">
        <div className="mx-auto max-w-[1140px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
          <div className="min-h-[64px] border-b border-[#e5e5e5] px-5">
            <h1 className="inline-block border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase leading-none text-[#315574]">
              Inventory Report
            </h1>
          </div>

          <div className="px-5 py-5">
            <p className="mb-10 text-[13px]">
              Field mark with (<span className="text-[#d9534f]">*</span>) is required. Press generate after you select the sorting options
            </p>

            <div className="mx-auto max-w-[900px] space-y-[15px] text-[13px]">
              <div className={formRowClass}>
                <label className={formLabelClass}>Report Type</label>
                <div className="flex flex-wrap items-center gap-5 pt-2 text-[#333]">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="reportType"
                      checked={filters.reportType === 'inventory'}
                      onChange={() => setFilters({ ...filters, reportType: 'inventory' })}
                      className="accent-[#428bca]"
                    />
                    Inventory
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="reportType"
                      checked={filters.reportType === 'product'}
                      onChange={() => setFilters({ ...filters, reportType: 'product' })}
                      className="accent-[#428bca]"
                    />
                    Products
                  </label>
                </div>
              </div>

              <div className={formRowClass}>
                <label className={formLabelClass}>
                  Date Covered <span className="text-[#d9534f]">*</span>
                </label>
                <select
                  value={dateCovered}
                  onChange={(e) => setDateCovered(e.target.value as DateCovered)}
                  className={formControlClass}
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
                  <div className={formRowClass}>
                    <label className={formLabelClass}>
                      Date From <span className="text-[#d9534f]">*</span>
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
                      className={formControlClass}
                    />
                  </div>
                  <div className={formRowClass}>
                    <label className={formLabelClass}>
                      Date To<span className="text-[#d9534f]">*</span>
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo || ''}
                      min={filters.dateFrom || undefined}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      className={formControlClass}
                    />
                  </div>
                </>
              )}

              <div className={formRowClass}>
                <label className={formLabelClass}>Description</label>
                <select
                  value={filters.description}
                  onChange={(e) => setFilters({ ...filters, description: e.target.value })}
                  className={formControlClass}
                >
                  <option value="">All descriptions</option>
                  {descriptions.map((description) => (
                    <option key={description} value={description}>
                      {description}
                    </option>
                  ))}
                </select>
              </div>

              <div className={formRowClass}>
                <label className={formLabelClass}>Part Number</label>
                <div className="relative w-full max-w-[590px]">
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
                    className={`${formControlClass} pr-9`}
                  />
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
                  {showPartNumberDropdown && filteredPartNumbers.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-[3px] border border-[#ccc] bg-white shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setPartNumberSearch('');
                          setFilters({ ...filters, partNumber: '' });
                          setShowPartNumberDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] text-[#333] hover:bg-[#f5f5f5]"
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
                          className="w-full px-3 py-2 text-left text-[13px] text-[#333] hover:bg-[#f5f5f5]"
                        >
                          {p.partNo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={formRowClass}>
                <label className={formLabelClass}>Stock Option</label>
                <div className="space-y-1 pt-1 text-[#333]">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="stockStatus"
                      checked={filters.stockStatus === 'all'}
                      onChange={() => setFilters({ ...filters, stockStatus: 'all' })}
                      className="accent-[#428bca]"
                    />
                    All
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="stockStatus"
                      checked={filters.stockStatus === 'with_stock'}
                      onChange={() => setFilters({ ...filters, stockStatus: 'with_stock' })}
                      className="accent-[#428bca]"
                    />
                    With Stock Only
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="stockStatus"
                      checked={filters.stockStatus === 'without_stock'}
                      onChange={() => setFilters({ ...filters, stockStatus: 'without_stock' })}
                      className="accent-[#428bca]"
                    />
                    Without Stock Only
                  </label>
                </div>
              </div>

              <div className={formRowClass}>
                <label className={formLabelClass}>Other Options</label>
                <label className="flex items-center gap-2 pt-2 text-[#333]">
                  <input
                    type="checkbox"
                    checked={!includeHidden}
                    onChange={(e) => setIncludeHidden(!e.target.checked)}
                    className="accent-[#428bca]"
                  />
                  Don't Include Hidden
                </label>
              </div>

              <div className="grid gap-4 pt-1 md:grid-cols-[220px_minmax(0,1fr)]">
                <span />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    disabled={isLoading || (dateCovered === 'Custom' && (!filters.dateFrom || !filters.dateTo))}
                    className="inline-flex items-center gap-2 rounded-[3px] border border-[#285e8e] bg-[#428bca] px-3 py-[7px] text-[13px] font-semibold text-white hover:bg-[#3276b1] disabled:cursor-not-allowed disabled:bg-[#999]"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Generate Report
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded-[3px] border border-[#ccc] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#333] hover:bg-[#ebebeb]"
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
    <div className="min-h-full overflow-auto bg-[#f4f4f4] px-4 py-10 text-[#333] print:bg-white print:p-0">
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] print:max-w-none print:border-none print:shadow-none">
        <div className="min-h-[64px] border-b border-[#e5e5e5] px-5 print:hidden">
          <h1 className="inline-block border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase leading-none text-[#315574]">
            Inventory Report View
          </h1>
        </div>

        <div className="px-5 py-4">
          <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setGeneratedAt(null)}
              className="rounded-[3px] border border-[#398439] bg-[#5cb85c] px-[10px] py-[5px] text-[12px] font-semibold text-white hover:bg-[#47a447]"
            >
              Back to Option
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={reportData.length === 0}
              className="inline-flex items-center gap-1 rounded-[3px] border border-[#285e8e] bg-[#428bca] px-[10px] py-[5px] text-[12px] font-semibold text-white hover:bg-[#3276b1] disabled:cursor-not-allowed disabled:bg-[#999]"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={reportData.length === 0}
              className="ml-auto inline-flex items-center gap-1 rounded-[3px] border border-[#ccc] bg-white px-[10px] py-[5px] text-[12px] font-semibold text-[#333] hover:bg-[#ebebeb] disabled:cursor-not-allowed disabled:text-[#999]"
            >
              <Printer className="h-4 w-4" />
              Print Preview
            </button>
          </div>

          <hr className="mb-5 border-[#eee] print:hidden" />

          <div id="print_area">
            <div className="mb-5 text-center text-[#333] print:text-black">
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
                <h3 className="text-base font-semibold text-[#555]">No Products Found</h3>
                <p className="mt-1 text-[13px] text-[#777]">
                  No products match the selected filter criteria.
                </p>
              </div>
            ) : isInventoryView ? (
              <div className="overflow-auto print:overflow-visible">
                <table className="w-full min-w-[1360px] border-collapse text-left print:min-w-0">
                  <thead>
                    <tr>
                      <th className={tableHeadClass} style={{ width: '1%' }}>#</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>PRODUCT NAME</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>PART NO</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>CODE</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>VIP 1 PRICE</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>LOC</th>
                      <th className={tableHeadClass} style={{ width: '8%' }}>LAST TRANSACTION DATE</th>
                      <th className={tableHeadClass} style={{ width: '8%' }}>LAST RR DATE</th>
                      <th className={tableHeadClass} style={{ width: '6%' }}>REORDER QUANTITY</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>BALANCE</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, index) => (
                      <InventoryRow key={row.id || `${row.partNo}-${index}`} row={row} index={index} />
                    ))}
                    <tr>
                      <td colSpan={10} className={`${tableCellClass} text-right font-semibold`}>
                        Total Value:
                      </td>
                      <td className={`${tableCellClass} text-right font-mono font-semibold`}>
                        {formatCurrency(summaryStats.totalValue, true)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-auto print:overflow-visible">
                <table className="w-full min-w-[1100px] border-collapse text-left print:min-w-0">
                  <thead>
                    <tr>
                      <th className={tableHeadClass} style={{ width: '1%' }}>#</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>PRODUCT NAME</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>CATEGORY</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>PART NO</th>
                      <th className={tableHeadClass} style={{ width: '10%' }}>CODE</th>
                      <th className={tableHeadClass} style={{ width: '5%' }}>LOC</th>
                      <th className={tableHeadClass} style={{ width: '8%' }}>LAST TRANSACTION DATE</th>
                      <th className={tableHeadClass} style={{ width: '8%' }}>LAST RR DATE</th>
                      <th className={tableHeadClass} style={{ width: '6%' }}>REORDER QUANTITY</th>
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
