import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, Calendar, Filter, RefreshCw, Package, ArrowRight, ArrowLeft,
  ChevronDown, AlertCircle, FileText, X
} from 'lucide-react';
import type { Product, InventoryLog, InventoryLogWithProduct, InventoryLogFilters } from '../types';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { fetchProducts } from '../services/supabaseService';
import { getInventoryLogsByItem, fetchInventoryLogs } from '../services/inventoryLogService';
import { useRealtimeList } from '../hooks/useRealtimeList';
import InventoryLogRow from './InventoryLogRow';

const WAREHOUSES = ['WH1', 'WH2', 'WH3', 'WH4', 'WH5', 'WH6'];
const TRANSACTION_TYPES = ['Purchase Order', 'Invoice', 'Order Slip', 'Transfer Receipt', 'Credit Memo', 'Stock Adjustment'];

const StockMovementView: React.FC = () => {
  // State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [referenceSearch, setReferenceSearch] = useState<string>('');
  const [itemSearch, setItemSearch] = useState<string>('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logs, setLogs] = useState<InventoryLogWithProduct[]>([]);

  // Fetch products
  const { data: products, isLoading: loadingProducts } = useRealtimeList<Product>({
    tableName: 'products',
    initialFetchFn: fetchProducts,
    sortFn: (a, b) => a.part_no.localeCompare(b.part_no),
  });

  // Filter products for autocomplete
  const filteredProducts = useMemo(() => {
    if (!itemSearch) return products.slice(0, 50); // Limit initial results
    const query = itemSearch.toLowerCase();
    return products.filter(p =>
      p.part_no.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      p.item_code.toLowerCase().includes(query)
    ).slice(0, 50);
  }, [products, itemSearch]);

  // Fetch logs when product or filters change
  useEffect(() => {
    const fetchLogs = async () => {
      if (!selectedProduct) {
        setLogs([]);
        return;
      }

      setIsLoadingLogs(true);
      try {
        const filters: InventoryLogFilters = {
          item_id: selectedProduct.id,
        };

        if (warehouseFilter !== 'all') {
          filters.warehouse_id = warehouseFilter;
        }

        if (transactionTypeFilter !== 'all') {
          filters.transaction_type = transactionTypeFilter;
        }

        if (dateFrom) {
          filters.date_from = dateFrom;
        }

        if (dateTo) {
          filters.date_to = dateTo;
        }

        const fetchedLogs = await fetchInventoryLogs(filters);
        
        // Calculate running balance
        let runningBalance = 0;
        const logsWithBalance = fetchedLogs.map(log => {
          if (log.status_indicator === '+') {
            runningBalance += log.qty_in;
          } else {
            runningBalance -= log.qty_out;
          }
          return { ...log, balance: runningBalance };
        });

        setLogs(logsWithBalance);
      } catch (error) {
        console.error('Error fetching inventory logs:', error);
      } finally {
        setIsLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [selectedProduct, warehouseFilter, transactionTypeFilter, dateFrom, dateTo]);

  // Filter logs by reference search
  const filteredLogs = useMemo(() => {
    if (!referenceSearch) return logs;
    const query = referenceSearch.toLowerCase();
    return logs.filter(log =>
      log.reference_no.toLowerCase().includes(query) ||
      log.partner.toLowerCase().includes(query)
    );
  }, [logs, referenceSearch]);

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
    const routeMap: Record<string, string> = {
      'Invoice': 'sales-transaction-invoice',
      'Order Slip': 'sales-transaction-order-slip',
      'Sales Order': 'sales-transaction-sales-order',
      'Purchase Order': 'warehouse-purchasing-purchase-order',
    };

    const route = routeMap[log.transaction_type];
    if (route) {
      window.dispatchEvent(new CustomEvent('workflow:navigate', {
        detail: { tab: route, payload: { documentId: log.reference_no } }
      }));
    }
  }, []);

  // Handle product selection
  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setItemSearch('');
    setShowItemDropdown(false);
    // Reset filters when changing product
    setWarehouseFilter('all');
    setTransactionTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setReferenceSearch('');
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedProduct(null);
    setItemSearch('');
    setShowItemDropdown(false);
    // Reset filters when clearing selection
    setWarehouseFilter('all');
    setTransactionTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setReferenceSearch('');
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!selectedProduct || filteredLogs.length === 0) {
      return { totalIn: 0, totalOut: 0, netMovement: 0 };
    }

    const totalIn = filteredLogs.reduce((sum, log) => sum + (log.status_indicator === '+' ? log.qty_in : 0), 0);
    const totalOut = filteredLogs.reduce((sum, log) => sum + (log.status_indicator === '-' ? log.qty_out : 0), 0);

    return {
      totalIn,
      totalOut,
      netMovement: totalIn - totalOut,
    };
  }, [selectedProduct, filteredLogs]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
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
            <button
              onClick={handleClearSelection}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
              title="Clear selection and return to product list"
            >
              <X className="w-4 h-4" />
              <span>Clear Selection</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col gap-4">
          
          {/* Item Selection Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
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
                {showItemDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {filteredProducts.map(product => (
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
                    <option value="all">All Warehouses</option>
                    {WAREHOUSES.map(wh => (
                      <option key={wh} value={wh}>{wh}</option>
                    ))}
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
                      setWarehouseFilter('all');
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
            ) : filteredLogs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-lg font-medium">No movement logs found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-xs">
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
                    <div className="text-slate-400">
                      {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                      <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-3 w-32">Date</th>
                        <th className="p-3 w-32">Type</th>
                        <th className="p-3 w-32">Reference</th>
                        <th className="p-3 w-40">Partner</th>
                        <th className="p-3 w-20 text-right">Qty</th>
                        <th className="p-3 w-24 text-right">Price</th>
                        <th className="p-3 w-20 text-center">Warehouse</th>
                        <th className="p-3 w-24 text-right">Balance</th>
                        <th className="p-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(log => (
                        <InventoryLogRow
                          key={log.id}
                          log={log}
                          showWarehouse={warehouseFilter === 'all'}
                          onReferenceClick={handleReferenceClick}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockMovementView;
