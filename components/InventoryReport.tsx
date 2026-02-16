import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchInventoryReport,
  fetchCategories,
  fetchPartNumbers,
  fetchItemCodes,
  WAREHOUSES,
  InventoryReportRow,
  InventoryReportFilters,
} from '../services/inventoryReportService';
import {
  Package,
  Printer,
  Loader2,
  Search,
  Filter,
  Download,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';

const InventoryReport: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [reportData, setReportData] = useState<InventoryReportRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [partNumbers, setPartNumbers] = useState<{ id: string; partNo: string }[]>([]);
  const [itemCodes, setItemCodes] = useState<{ id: string; itemCode: string }[]>([]);

  const [filters, setFilters] = useState<InventoryReportFilters>({
    category: '',
    partNumber: '',
    itemCode: '',
    stockStatus: 'all',
    reportType: 'inventory',
  });

  const [partNumberSearch, setPartNumberSearch] = useState('');
  const [itemCodeSearch, setItemCodeSearch] = useState('');
  const [showPartNumberDropdown, setShowPartNumberDropdown] = useState(false);
  const [showItemCodeDropdown, setShowItemCodeDropdown] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsInitializing(true);
      try {
        const [cats, parts, codes] = await Promise.all([
          fetchCategories(),
          fetchPartNumbers(),
          fetchItemCodes(),
        ]);
        setCategories(cats);
        setPartNumbers(parts);
        setItemCodes(codes);
      } finally {
        setIsInitializing(false);
      }
    };
    loadInitialData();
  }, []);

  const handleGenerateReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchInventoryReport(filters);
      setReportData(data);
      setGeneratedAt(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const handleClearFilters = () => {
    setFilters({
      category: '',
      partNumber: '',
      itemCode: '',
      stockStatus: 'all',
      reportType: 'inventory',
    });
    setPartNumberSearch('');
    setItemCodeSearch('');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (reportData.length === 0) return;

    const headers = ['Part No', 'Item Code', 'Description', 'Category', ...WAREHOUSES.map((wh) => wh.name), 'Total Stock'];
    
    const escapeCSV = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(','),
      ...reportData.map((row) => {
        const values = [
          row.partNo,
          row.itemCode,
          row.description,
          row.category,
          ...WAREHOUSES.map((wh) => row.warehouseStock[wh.id] || 0),
          row.totalStock,
        ];
        return values.map(escapeCSV).join(',');
      }),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_report_${new Date().toISOString().split('T')[0]}.csv`;
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

  const filteredItemCodes = useMemo(() => {
    if (!itemCodeSearch) return itemCodes.slice(0, 50);
    return itemCodes
      .filter((c) => c.itemCode.toLowerCase().includes(itemCodeSearch.toLowerCase()))
      .slice(0, 50);
  }, [itemCodes, itemCodeSearch]);

  const summaryStats = useMemo(() => {
    const totalItems = reportData.length;
    const withStock = reportData.filter((r) => r.totalStock > 0).length;
    const withoutStock = reportData.filter((r) => r.totalStock === 0).length;
    const totalQuantity = reportData.reduce((sum, r) => sum + r.totalStock, 0);
    return { totalItems, withStock, withoutStock, totalQuantity };
  }, [reportData]);

  if (isInitializing) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-8 animate-fadeIn print:p-0 print:bg-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2 print:text-black">
            <Package className="w-6 h-6 text-brand-blue print:text-black" />
            Inventory Report
          </h1>
          {generatedAt && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 print:text-gray-600">
              Generated on: {generatedAt.toLocaleDateString()} {generatedAt.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handleExportExcel}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-6 print:hidden">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-700 dark:text-slate-200">Filter Options</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Part Number
            </label>
            <div className="relative">
              <input
                type="text"
                value={partNumberSearch}
                onChange={(e) => {
                  setPartNumberSearch(e.target.value);
                  setFilters({ ...filters, partNumber: e.target.value });
                }}
                onFocus={() => setShowPartNumberDropdown(true)}
                onBlur={() => setTimeout(() => setShowPartNumberDropdown(false), 200)}
                placeholder="Search part number..."
                className="w-full px-3 py-2 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            {showPartNumberDropdown && filteredPartNumbers.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredPartNumbers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPartNumberSearch(p.partNo);
                      setFilters({ ...filters, partNumber: p.partNo });
                      setShowPartNumberDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    {p.partNo}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Item Code
            </label>
            <div className="relative">
              <input
                type="text"
                value={itemCodeSearch}
                onChange={(e) => {
                  setItemCodeSearch(e.target.value);
                  setFilters({ ...filters, itemCode: e.target.value });
                }}
                onFocus={() => setShowItemCodeDropdown(true)}
                onBlur={() => setTimeout(() => setShowItemCodeDropdown(false), 200)}
                placeholder="Search item code..."
                className="w-full px-3 py-2 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            {showItemCodeDropdown && filteredItemCodes.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredItemCodes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setItemCodeSearch(c.itemCode);
                      setFilters({ ...filters, itemCode: c.itemCode });
                      setShowItemCodeDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    {c.itemCode}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Stock Status
            </label>
            <select
              value={filters.stockStatus}
              onChange={(e) =>
                setFilters({ ...filters, stockStatus: e.target.value as 'all' | 'with_stock' | 'without_stock' })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
            >
              <option value="all">All Items</option>
              <option value="with_stock">With Stock</option>
              <option value="without_stock">Without Stock</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Report Type:</span>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setFilters({ ...filters, reportType: 'inventory' })}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  filters.reportType === 'inventory'
                    ? 'bg-brand-blue text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Inventory View
              </button>
              <button
                onClick={() => setFilters({ ...filters, reportType: 'product' })}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  filters.reportType === 'product'
                    ? 'bg-brand-blue text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Product View
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-brand-blue hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Generate Report
          </button>
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-medium transition-colors"
          >
            <X className="w-4 h-4" /> Clear Filters
          </button>
        </div>
      </div>

      {generatedAt && reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 print:hidden">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Items</p>
            <h4 className="text-2xl font-bold text-slate-800 dark:text-white">{summaryStats.totalItems}</h4>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">With Stock</p>
            <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summaryStats.withStock}</h4>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Without Stock</p>
            <h4 className="text-2xl font-bold text-rose-600 dark:text-rose-400">{summaryStats.withoutStock}</h4>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Quantity</p>
            <h4 className="text-2xl font-bold text-brand-blue">{summaryStats.totalQuantity.toLocaleString()}</h4>
          </div>
        </div>
      )}

      {generatedAt && (
        <div className="hidden print:block mb-4 p-4 bg-gray-100 border border-gray-300">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-semibold">Category:</span> {filters.category || 'All'}
            </div>
            <div>
              <span className="font-semibold">Part Number:</span> {filters.partNumber || 'All'}
            </div>
            <div>
              <span className="font-semibold">Item Code:</span> {filters.itemCode || 'All'}
            </div>
            <div>
              <span className="font-semibold">Stock Status:</span>{' '}
              {filters.stockStatus === 'all' ? 'All' : filters.stockStatus === 'with_stock' ? 'With Stock' : 'Without Stock'}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm print:shadow-none print:border-none print:overflow-visible">
        {!generatedAt ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
              No Report Generated
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Select your filter criteria above and click "Generate Report" to view inventory data across all warehouses.
            </p>
          </div>
        ) : reportData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
              No Products Found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              No products match the selected filter criteria. Try adjusting your filters.
            </p>
          </div>
        ) : (
          <div className="h-full overflow-auto custom-scrollbar print:overflow-visible print:h-auto">
            <table className="w-full text-left border-collapse print:text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 print:static print:bg-gray-100">
                <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 print:text-black print:border-gray-300">
                  <th className="p-3 print:p-1">Part No</th>
                  <th className="p-3 print:p-1">Item Code</th>
                  <th className="p-3 print:p-1">Description</th>
                  <th className="p-3 print:p-1">Category</th>
                  {WAREHOUSES.map((wh) => (
                    <th key={wh.id} className="p-3 text-center print:p-1">
                      {wh.name}
                    </th>
                  ))}
                  <th className="p-3 text-center print:p-1 bg-slate-100 dark:bg-slate-700 print:bg-gray-200">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-gray-200">
                {reportData.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors print:hover:bg-transparent"
                  >
                    <td className="p-3 font-mono font-medium text-slate-800 dark:text-white print:p-1 print:text-black">
                      {row.partNo}
                    </td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-300 print:p-1 print:text-black">
                      {row.itemCode || '—'}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300 print:p-1 print:text-black max-w-xs truncate">
                      {row.description || '—'}
                    </td>
                    <td className="p-3 print:p-1 print:text-black">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-xs font-medium print:bg-transparent print:text-black">
                        {row.category || '—'}
                      </span>
                    </td>
                    {WAREHOUSES.map((wh) => {
                      const qty = row.warehouseStock[wh.id] || 0;
                      return (
                        <td
                          key={wh.id}
                          className={`p-3 text-center font-mono print:p-1 print:text-black ${
                            qty === 0 ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {qty}
                        </td>
                      );
                    })}
                    <td
                      className={`p-3 text-center font-mono font-bold print:p-1 bg-slate-50 dark:bg-slate-800/50 print:bg-gray-100 ${
                        row.totalStock === 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-800 dark:text-white print:text-black'
                      }`}
                    >
                      {row.totalStock}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-800 font-semibold print:bg-gray-200">
                <tr className="border-t-2 border-slate-300 dark:border-slate-600 print:border-gray-400">
                  <td colSpan={4} className="p-3 text-slate-700 dark:text-slate-300 print:p-1 print:text-black">
                    Total ({reportData.length} items)
                  </td>
                  {WAREHOUSES.map((wh) => {
                    const whTotal = reportData.reduce((sum, row) => sum + (row.warehouseStock[wh.id] || 0), 0);
                    return (
                      <td key={wh.id} className="p-3 text-center font-mono print:p-1 print:text-black">
                        {whTotal.toLocaleString()}
                      </td>
                    );
                  })}
                  <td className="p-3 text-center font-mono font-bold text-brand-blue print:p-1 print:text-black">
                    {summaryStats.totalQuantity.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="hidden print:block mt-8 text-center text-xs text-gray-500">
        <p>End of Report -- TND-OPC System</p>
      </div>
    </div>
  );
};

export default InventoryReport;
