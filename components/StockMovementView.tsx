import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, Filter, Package, ArrowRight, ArrowLeft, AlertCircle, FileText, X, Printer
} from 'lucide-react';
import type { Product, InventoryLogWithProduct } from '../types';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { fetchStockMovementLogs, searchStockMovementProducts } from '../services/stockMovementLocalApiService';
import InventoryLogRow from './InventoryLogRow';
import { resolveStockMovementNavigationTarget } from '../utils/stockMovementNavigation';

const WAREHOUSES = ['WH1', 'WH2', 'WH3', 'WH4', 'WH5', 'WH6'];
const TRANSACTION_TYPES = ['Purchase Order', 'Invoice', 'Order Slip', 'Transfer Product', 'Transfer Receipt', 'Credit Memo', 'Stock Adjustment'];
type MovementViewMode = 'audit' | 'legacy';

const formatLegacyDate = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
};

const formatLegacyPrice = (log: InventoryLogWithProduct) => {
  if (log.transaction_type.toLowerCase() === 'stock adjustment') return '0.00';
  return Number(log.unit_price || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const StockMovementView: React.FC = () => {
  // State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string>('WH1');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [referenceSearch, setReferenceSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<MovementViewMode>('audit');
  const [itemSearch, setItemSearch] = useState<string>('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [logs, setLogs] = useState<InventoryLogWithProduct[]>([]);
  const [productOptions, setProductOptions] = useState<Product[]>([]);
  const [debouncedReferenceSearch, setDebouncedReferenceSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedReferenceSearch(referenceSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [referenceSearch]);

  useEffect(() => {
    let isMounted = true;
    const timer = window.setTimeout(async () => {
      try {
        setIsLoadingProducts(true);
        const rows = await searchStockMovementProducts(itemSearch.trim(), 50);
        if (isMounted) setProductOptions(rows);
      } catch (error) {
        console.error('Error loading stock movement products:', error);
        if (isMounted) setProductOptions([]);
      } finally {
        if (isMounted) setIsLoadingProducts(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [itemSearch]);

  // Fetch logs when product or filters change
  useEffect(() => {
    const fetchLogs = async () => {
      if (!selectedProduct) {
        setLogs([]);
        return;
      }

      setIsLoadingLogs(true);
      try {
        const result = await fetchStockMovementLogs({
          item_id: selectedProduct.id,
          warehouse_id: warehouseFilter,
          transaction_type: transactionTypeFilter,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          search: debouncedReferenceSearch || undefined,
          page: 1,
          per_page: 1000,
        });
        setLogs(result.logs);
      } catch (error) {
        console.error('Error fetching inventory logs:', error);
        setLogs([]);
      } finally {
        setIsLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [selectedProduct, warehouseFilter, transactionTypeFilter, dateFrom, dateTo, debouncedReferenceSearch]);

  // Calculate total stock for selected product
  const totalStock = useMemo(() => {
    if (!selectedProduct) return 0;
    return (
      selectedProduct.stock_wh1 +
      selectedProduct.stock_wh2 +
      selectedProduct.stock_wh3 +
      selectedProduct.stock_wh4 +
      selectedProduct.stock_wh5 +
      selectedProduct.stock_wh6
    );
  }, [selectedProduct]);

  // Handle reference click for navigation
  const handleReferenceClick = useCallback((log: InventoryLogWithProduct) => {
    const target = resolveStockMovementNavigationTarget(log);
    if (!target) return;
    window.dispatchEvent(new CustomEvent('workflow:navigate', {
      detail: { tab: target.tab, payload: target.payload }
    }));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Handle product selection
  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setItemSearch('');
    setShowItemDropdown(false);
    // Reset filters when changing product
    setWarehouseFilter('WH1');
    setTransactionTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setReferenceSearch('');
    setViewMode('audit');
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedProduct(null);
    setItemSearch('');
    setShowItemDropdown(false);
    // Reset filters when clearing selection
    setWarehouseFilter('WH1');
    setTransactionTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setReferenceSearch('');
    setViewMode('audit');
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!selectedProduct || logs.length === 0) {
      return { totalIn: 0, totalOut: 0, netMovement: 0 };
    }

    const totalIn = logs.reduce((sum, log) => sum + (log.status_indicator === '+' ? log.qty_in : 0), 0);
    const totalOut = logs.reduce((sum, log) => sum + (log.status_indicator === '-' ? log.qty_out : 0), 0);

    return {
      totalIn,
      totalOut,
      netMovement: totalIn - totalOut,
    };
  }, [selectedProduct, logs]);

  const renderLegacyPrintRow = (log: InventoryLogWithProduct) => {
    const isStockIn = log.status_indicator === '+';
    const source = log.processed_by || log.reference_no || '';
    return (
      <tr key={log.id}>
        <td>{isStockIn ? formatLegacyDate(log.date) : ''}</td>
        <td>{isStockIn ? source : ''}</td>
        <td>{isStockIn ? log.partner : ''}</td>
        <td>{isStockIn ? log.qty_in : ''}</td>
        <td>{isStockIn ? log.warehouse_id : ''}</td>
        <td>{!isStockIn ? formatLegacyDate(log.date) : ''}</td>
        <td>{!isStockIn ? source : ''}</td>
        <td>{!isStockIn ? log.partner : ''}</td>
        <td>{!isStockIn ? log.qty_out : ''}</td>
        <td>{!isStockIn ? formatLegacyPrice(log) : ''}</td>
        <td>{!isStockIn ? log.warehouse_id : ''}</td>
        <td>{log.balance ?? ''}</td>
      </tr>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <style>
        {`
          .stock-movement-print-area {
            display: none;
          }

          @media print {
            @page {
              size: landscape;
              margin: 10mm;
            }

            body * {
              visibility: hidden !important;
            }

            .stock-movement-print-area,
            .stock-movement-print-area * {
              visibility: visible !important;
            }

            .stock-movement-print-area {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0;
              color: #111;
              background: #fff;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11px;
              line-height: 1.25;
            }

            .stock-movement-print-area h3 {
              margin: 0 0 8px;
              font-size: 20px;
              font-weight: 700;
              text-align: right;
            }

            .stock-movement-print-area h5 {
              margin: 0 0 5px;
              font-size: 12px;
              font-weight: 600;
            }

            .stock-movement-print-area hr {
              border: 0;
              border-top: 1px solid #999;
              margin: 10px 0 12px;
            }

            .stock-movement-print-header {
              display: grid;
              grid-template-columns: 1fr 240px;
              gap: 24px;
              align-items: start;
            }

            .stock-movement-print-title {
              text-align: right;
            }

            .stock-movement-print-sections {
              display: grid;
              grid-template-columns: 1fr 1fr;
              margin-bottom: 6px;
            }

            .stock-movement-print-sections h5 {
              text-align: center;
            }

            .stock-movement-print-table {
              width: 100%;
              border-collapse: collapse;
            }

            .stock-movement-print-table th,
            .stock-movement-print-table td {
              border: 1px solid #777;
              padding: 5px 6px;
              vertical-align: top;
              font-size: 10px;
            }

            .stock-movement-print-table th {
              font-weight: 700;
              text-align: left;
            }
          }
        `}
      </style>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded bg-white/10">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">Stock Movement</h1>
              <p className="text-xs text-slate-300">Chronological audit trail</p>
            </div>
          </div>
          {selectedProduct && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
                title="Print stock movement report"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                onClick={handleClearSelection}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
                title="Clear selection and return to product list"
              >
                <X className="w-4 h-4" />
                <span>Clear Selection</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col gap-4">
          
          {/* Item Selection Card */}
          <div className="relative z-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Product Autocomplete */}
              <div className="flex-1 relative">
                <label className="block text-xs font-medium text-slate-500 mb-1">Select Product</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by part no, brand, or description..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:border-brand-blue outline-none transition-all"
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      setShowItemDropdown(true);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
                  />
                </div>

                {/* Dropdown */}
                {showItemDropdown && (
                  <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {isLoadingProducts ? (
                      <div className="p-3 text-xs text-slate-500">Loading products...</div>
                    ) : productOptions.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">No products found</div>
                    ) : productOptions.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleProductSelect(product)}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-white text-sm">{product.part_no}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] rounded uppercase font-bold">{product.brand}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{product.description}</p>
                        <div className="flex gap-2 mt-1 text-[10px] text-slate-400">
                          <span>Code: {product.item_code}</span>
                          <span>•</span>
                          <span>Total Stock: {(
                            product.stock_wh1 + product.stock_wh2 + product.stock_wh3 +
                            product.stock_wh4 + product.stock_wh5 + product.stock_wh6
                          )}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Product Info */}
              {selectedProduct && (
                <div className="flex-1 lg:flex-none lg:w-96 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 dark:text-white">{selectedProduct.part_no}</span>
                        <span className="px-1.5 py-0.5 bg-brand-blue/10 text-brand-blue text-[10px] rounded font-bold uppercase">{selectedProduct.brand}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{selectedProduct.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-slate-500">Code: {selectedProduct.item_code}</span>
                        {selectedProduct.oem_no && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">OEM: {selectedProduct.oem_no}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-[10px] text-slate-500 uppercase font-semibold">Current Stock</p>
                      <p className="text-2xl font-bold text-brand-blue">{totalStock.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          {selectedProduct && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Filter className="w-4 h-4" />
                  <span className="text-xs font-medium">Filters</span>
                </div>

                {/* Warehouse Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Warehouse:</label>
                  <select
                    value={warehouseFilter}
                    onChange={(e) => setWarehouseFilter(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-brand-blue"
                  >
                    {WAREHOUSES.map(wh => (
                      <option key={wh} value={wh}>{wh}</option>
                    ))}
                    <option value="all">All Warehouses</option>
                  </select>
                </div>

                {/* Date From */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">From:</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-brand-blue"
                  />
                </div>

                {/* Date To */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">To:</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-brand-blue"
                  />
                </div>

                {/* Transaction Type Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Type:</label>
                  <select
                    value={transactionTypeFilter}
                    onChange={(e) => setTransactionTypeFilter(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-brand-blue"
                  >
                    <option value="all">All Types</option>
                    {TRANSACTION_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Reference Search */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search reference or partner..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:border-brand-blue outline-none transition-all"
                      value={referenceSearch}
                      onChange={(e) => setReferenceSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                {(warehouseFilter !== 'all' || dateFrom || dateTo || transactionTypeFilter !== 'all' || referenceSearch) && (
                  <button
                    onClick={() => {
                      setWarehouseFilter('WH1');
                      setDateFrom('');
                      setDateTo('');
                      setTransactionTypeFilter('all');
                      setReferenceSearch('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Movement Log Table */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            {!selectedProduct ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <Package className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-lg font-medium">Select a product to view stock movements</p>
                <p className="text-sm">Use the search above to find products</p>
              </div>
            ) : isLoadingLogs ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <CustomLoadingSpinner label="Loading" />
                  <span>Loading movement logs...</span>
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-lg font-medium">No movement logs found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                {/* Summary Stats and View Mode */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4 text-emerald-500" />
                        <span className="text-slate-500">Total In:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{summaryStats.totalIn.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-rose-500" />
                        <span className="text-slate-500">Total Out:</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">{summaryStats.totalOut.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Net Movement:</span>
                        <span className={`font-bold ${summaryStats.netMovement >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {summaryStats.netMovement >= 0 ? '+' : ''}{summaryStats.netMovement.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
                        <button
                          type="button"
                          onClick={() => setViewMode('audit')}
                          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                            viewMode === 'audit'
                              ? 'bg-brand-blue text-white'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          Audit Trail
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('legacy')}
                          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                            viewMode === 'legacy'
                              ? 'bg-brand-blue text-white'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          Legacy Report
                        </button>
                      </div>
                      <div className="text-slate-400">
                        {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                  {viewMode === 'audit' ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                        <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <th className="p-3 w-32">Date</th>
                          <th className="p-3 w-32">Type</th>
                          <th className="p-3 w-32">Reference</th>
                          <th className="p-3">Notes</th>
                          <th className="p-3 w-40">Supplier</th>
                          <th className="p-3 w-20 text-right">Qty</th>
                          <th className="p-3 w-24 text-right">Price</th>
                          <th className="p-3 w-20 text-center">Warehouse</th>
                          <th className="p-3 w-24 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map(log => (
                          <InventoryLogRow
                            key={log.id}
                            log={log}
                            showWarehouse
                            onReferenceClick={handleReferenceClick}
                          />
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full min-w-[1100px] text-left border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="text-xs uppercase text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <th className="p-3 text-center bg-emerald-50 dark:bg-emerald-950/30 border-b border-slate-200 dark:border-slate-700" colSpan={5}>RECEIVED / RETURNED</th>
                          <th className="p-3 text-center bg-rose-50 dark:bg-rose-950/30 border-l-4 border-l-slate-400 dark:border-l-slate-500 border-b border-slate-200 dark:border-slate-700" colSpan={6}>RELEASED</th>
                          <th className="p-3 w-24 text-right bg-slate-100 dark:bg-slate-800 border-l-4 border-l-slate-400 dark:border-l-slate-500 border-b border-slate-200 dark:border-slate-700" rowSpan={2}>Bal</th>
                        </tr>
                        <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <th className="p-3 w-28 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-slate-200 dark:border-slate-700">Date</th>
                          <th className="p-3 w-32 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-slate-200 dark:border-slate-700">Source</th>
                          <th className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-slate-200 dark:border-slate-700">Supplier/Customer</th>
                          <th className="p-3 w-20 text-right bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-slate-200 dark:border-slate-700">Qty</th>
                          <th className="p-3 w-24 text-center bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-slate-200 dark:border-slate-700">Warehouse</th>
                          <th className="p-3 w-28 bg-rose-50/70 dark:bg-rose-950/20 border-l-4 border-l-slate-400 dark:border-l-slate-500 border-b border-slate-200 dark:border-slate-700">Date</th>
                          <th className="p-3 w-32 bg-rose-50/70 dark:bg-rose-950/20 border-b border-slate-200 dark:border-slate-700">Source</th>
                          <th className="p-3 bg-rose-50/70 dark:bg-rose-950/20 border-b border-slate-200 dark:border-slate-700">Customer</th>
                          <th className="p-3 w-20 text-right bg-rose-50/70 dark:bg-rose-950/20 border-b border-slate-200 dark:border-slate-700">Qty</th>
                          <th className="p-3 w-24 text-right bg-rose-50/70 dark:bg-rose-950/20 border-b border-slate-200 dark:border-slate-700">Unit Price</th>
                          <th className="p-3 w-24 text-center bg-rose-50/70 dark:bg-rose-950/20 border-b border-slate-200 dark:border-slate-700">Warehouse</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => {
                          const isStockIn = log.status_indicator === '+';
                          const sourceText = log.processed_by || log.reference_no || '-';
                          const canNavigate = resolveStockMovementNavigationTarget(log) !== null;
                          const source = canNavigate ? (
                            <button
                              type="button"
                              onClick={() => handleReferenceClick(log)}
                              className="text-brand-blue hover:underline font-medium"
                              title={`Navigate to ${log.transaction_type}`}
                            >
                              {sourceText}
                            </button>
                          ) : (
                            <span>{sourceText}</span>
                          );

                          return (
                            <tr
                              key={log.id}
                              data-testid={`legacy-stock-movement-row-${log.id}`}
                              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-xs"
                            >
                              <td className="p-3 text-slate-600 dark:text-slate-300">{isStockIn ? formatLegacyDate(log.date) : ''}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{isStockIn ? source : ''}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{isStockIn ? log.partner : ''}</td>
                              <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{isStockIn ? log.qty_in : ''}</td>
                              <td className="p-3 text-center text-slate-600 dark:text-slate-300">{isStockIn ? log.warehouse_id : ''}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 border-l-4 border-l-slate-300 dark:border-l-slate-600 bg-rose-50/20 dark:bg-rose-950/10">{!isStockIn ? formatLegacyDate(log.date) : ''}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 bg-rose-50/20 dark:bg-rose-950/10">{!isStockIn ? source : ''}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{!isStockIn ? log.partner : ''}</td>
                              <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">{!isStockIn ? log.qty_out : ''}</td>
                              <td className="p-3 text-right text-slate-600 dark:text-slate-300">{!isStockIn ? formatLegacyPrice(log) : ''}</td>
                              <td className="p-3 text-center text-slate-600 dark:text-slate-300">{!isStockIn ? log.warehouse_id : ''}</td>
                              <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-200 border-l-4 border-l-slate-300 dark:border-l-slate-600 bg-slate-50 dark:bg-slate-800/60">{log.balance ?? ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {selectedProduct && (
        <div id="print_area" data-testid="stock-movement-print-area" className="stock-movement-print-area">
          <div className="stock-movement-print-header">
            <div>
              <h5>Item Code: {selectedProduct.item_code}</h5>
              <h5>Part No: {selectedProduct.part_no}</h5>
              <h5>Brand: {selectedProduct.brand}</h5>
              <h5>Description: {selectedProduct.description}</h5>
            </div>
            <div className="stock-movement-print-title">
              <h3>STOCK MOVEMENT</h3>
              <h5>Warehouse:</h5>
              <h5>{warehouseFilter === 'all' ? 'All' : warehouseFilter}</h5>
            </div>
          </div>

          <hr />

          <div className="stock-movement-print-sections">
            <h5>RECEIVED / RETURNED</h5>
            <h5>RELEASED</h5>
          </div>

          <table className="stock-movement-print-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Supplier/Customer</th>
                <th>Qty</th>
                <th>Warehouse</th>
                <th>Date</th>
                <th>Source</th>
                <th>Customer</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Warehouse</th>
                <th>Bal</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(renderLegacyPrintRow)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockMovementView;
