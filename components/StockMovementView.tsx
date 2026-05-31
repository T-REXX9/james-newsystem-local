import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Search, Filter, ArrowRight, ArrowLeft, AlertCircle, FileText, X, Printer
} from 'lucide-react';
import type { Product, InventoryLogWithProduct } from '../types';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import {
  fetchStockMovementLogs,
  searchStockMovementProducts,
  type StockMovementProductSearchFilters,
} from '../services/stockMovementLocalApiService';
import InventoryLogRow from './InventoryLogRow';
import { resolveStockMovementNavigationTarget } from '../utils/stockMovementNavigation';

const WAREHOUSES = ['WH1', 'WH2', 'WH3', 'WH4', 'WH5', 'WH6'];
const TRANSACTION_TYPES = ['Purchase Order', 'Invoice', 'Order Slip', 'Transfer Product', 'Transfer Receipt', 'Credit Memo', 'Stock Adjustment'];
type MovementViewMode = 'audit' | 'legacy';
type ProductSearchFilters = {
  partNo: string;
  itemCode: string;
  description: string;
  application: string;
  originalPn: string;
};

const EMPTY_PRODUCT_SEARCH: ProductSearchFilters = {
  partNo: '',
  itemCode: '',
  description: '',
  application: '',
  originalPn: '',
};

const toProductSearchParams = (filters: ProductSearchFilters): StockMovementProductSearchFilters => ({
  part_no: filters.partNo.trim(),
  item_code: filters.itemCode.trim(),
  description: filters.description.trim(),
  application: filters.application.trim(),
  original_pn: filters.originalPn.trim(),
});

const hasProductSearchValue = (filters: ProductSearchFilters) =>
  Object.values(filters).some(value => value.trim() !== '');

const includesSearch = (value: string, search: string) =>
  search.trim() === '' || value.toLowerCase().includes(search.trim().toLowerCase());

const matchesProductSearch = (product: Product, filters: ProductSearchFilters) =>
  includesSearch(product.part_no, filters.partNo) &&
  includesSearch(product.item_code, filters.itemCode) &&
  includesSearch(product.description, filters.description) &&
  includesSearch(product.application || '', filters.application) &&
  includesSearch(product.original_pn_no || '', filters.originalPn);

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
  const [highlightedProduct, setHighlightedProduct] = useState<Product | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string>('WH1');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [referenceSearch, setReferenceSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<MovementViewMode>('audit');
  const [searchFilters, setSearchFilters] = useState<ProductSearchFilters>(EMPTY_PRODUCT_SEARCH);
  const [activeSearchFilters, setActiveSearchFilters] = useState<ProductSearchFilters>(EMPTY_PRODUCT_SEARCH);
  const [hasSearchedProducts, setHasSearchedProducts] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [logs, setLogs] = useState<InventoryLogWithProduct[]>([]);
  const [productOptions, setProductOptions] = useState<Product[]>([]);
  const [debouncedReferenceSearch, setDebouncedReferenceSearch] = useState('');
  const didMountProductSearchFields = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedReferenceSearch(referenceSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [referenceSearch]);

  useEffect(() => {
    if (!didMountProductSearchFields.current) {
      didMountProductSearchFields.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightedProduct(null);
      setSelectedProduct(null);
      setLogs([]);

      if (!hasProductSearchValue(searchFilters)) {
        setActiveSearchFilters(EMPTY_PRODUCT_SEARCH);
        setHasSearchedProducts(false);
        return;
      }

      setActiveSearchFilters(searchFilters);
      setHasSearchedProducts(true);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchFilters]);

  useEffect(() => {
    if (!hasSearchedProducts) {
      setProductOptions([]);
      return;
    }

    let isMounted = true;
    const timer = window.setTimeout(async () => {
      try {
        setIsLoadingProducts(true);
        const rows = await searchStockMovementProducts(toProductSearchParams(activeSearchFilters), 100);
        if (isMounted) setProductOptions(rows.filter(product => matchesProductSearch(product, activeSearchFilters)));
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
  }, [activeSearchFilters, hasSearchedProducts]);

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
    setHighlightedProduct(product);
  };

  const handleViewMovement = () => {
    if (!highlightedProduct) return;
    setSelectedProduct(highlightedProduct);
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
    setHighlightedProduct(null);
    // Reset filters when clearing selection
    setWarehouseFilter('WH1');
    setTransactionTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setReferenceSearch('');
    setViewMode('audit');
  };

  const handleBackToSearchResults = () => {
    setSelectedProduct(null);
    setLogs([]);
    setWarehouseFilter('WH1');
    setTransactionTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setReferenceSearch('');
    setViewMode('audit');
  };

  const handleSearchFieldChange = (field: keyof ProductSearchFilters, value: string) => {
    setSearchFilters(previous => ({ ...previous, [field]: value }));
  };

  const handleProductSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    setHighlightedProduct(null);
    setSelectedProduct(null);
    setLogs([]);
    setHasSearchedProducts(true);
    setActiveSearchFilters(searchFilters);
  };

  const handleRefresh = () => {
    setSearchFilters(EMPTY_PRODUCT_SEARCH);
    setActiveSearchFilters(EMPTY_PRODUCT_SEARCH);
    setHasSearchedProducts(false);
    handleClearSelection();
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

          .stock-movement-legacy-head th {
            position: relative;
            z-index: 20;
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
      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col gap-4">
          
          <div className="relative z-20 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-4">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold uppercase tracking-normal text-slate-700 dark:text-slate-100">
                  {selectedProduct ? 'Inventory Logs' : 'Stock Movement'}
                </h1>
                <div className="mt-3 h-px w-60 bg-slate-300 dark:bg-slate-700" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleProductSearch}
                  className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white bg-[#416d8a] hover:bg-[#365d77] disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
                <button
                  type="button"
                  onClick={handleViewMovement}
                  disabled={!highlightedProduct}
                  className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white bg-[#8ca8b8] hover:bg-[#7898aa] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileText className="h-4 w-4" />
                  View Movement
                </button>
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={handleBackToSearchResults}
                    className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white bg-[#416d8a] hover:bg-[#365d77]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                )}
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white bg-[#416d8a] hover:bg-[#365d77]"
                    title="Print stock movement report"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white bg-[#416d8a] hover:bg-[#365d77]"
                >
                  <X className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>

            <form onSubmit={handleProductSearch} className="px-4 py-6">
              <div className="grid grid-cols-1 gap-x-12 gap-y-4 xl:grid-cols-2">
                <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3">
                  <label htmlFor="stock-search-part-no" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Part No.</label>
                  <input
                    id="stock-search-part-no"
                    type="text"
                    value={searchFilters.partNo}
                    onChange={(event) => handleSearchFieldChange('partNo', event.target.value)}
                    placeholder="Search Part No."
                    className="h-11 rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#416d8a] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3">
                  <label htmlFor="stock-search-item-code" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Item Code</label>
                  <input
                    id="stock-search-item-code"
                    type="text"
                    value={searchFilters.itemCode}
                    onChange={(event) => handleSearchFieldChange('itemCode', event.target.value)}
                    placeholder="Search Item Code"
                    className="h-11 rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#416d8a] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3">
                  <label htmlFor="stock-search-description" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Description</label>
                  <input
                    id="stock-search-description"
                    type="text"
                    value={searchFilters.description}
                    onChange={(event) => handleSearchFieldChange('description', event.target.value)}
                    placeholder="Search Item Description"
                    className="h-11 rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#416d8a] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3">
                  <label htmlFor="stock-search-application" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Application</label>
                  <input
                    id="stock-search-application"
                    type="text"
                    value={searchFilters.application}
                    onChange={(event) => handleSearchFieldChange('application', event.target.value)}
                    placeholder="Search Item Application"
                    className="h-11 rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#416d8a] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3">
                  <label htmlFor="stock-search-original-pn" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Original P/N</label>
                  <input
                    id="stock-search-original-pn"
                    type="text"
                    value={searchFilters.originalPn}
                    onChange={(event) => handleSearchFieldChange('originalPn', event.target.value)}
                    placeholder="Search Original P/N"
                    className="h-11 rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#416d8a] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>
            </form>
          </div>

          {selectedProduct && (
            <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
              <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2 xl:grid-cols-4">
                <div><span className="font-semibold">Item Code:</span> {selectedProduct.item_code}</div>
                <div><span className="font-semibold">Part No:</span> {selectedProduct.part_no}</div>
                <div><span className="font-semibold">Brand:</span> {selectedProduct.brand}</div>
                <div><span className="font-semibold">Reorder Qty:</span> {selectedProduct.reorder_quantity}</div>
                <div className="md:col-span-2"><span className="font-semibold">Description:</span> {selectedProduct.description}</div>
                <div className="md:col-span-2"><span className="font-semibold">Application:</span> {selectedProduct.application || '-'}</div>
              </div>
            </div>
          )}

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
              <div className="flex-1 overflow-auto">
                {!hasSearchedProducts ? (
                  <div className="min-h-64" />
                ) : isLoadingProducts ? (
                  <div className="flex h-full min-h-64 items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <CustomLoadingSpinner label="Loading" />
                      <span>Loading products...</span>
                    </div>
                  </div>
                ) : productOptions.length === 0 ? (
                  <div className="flex h-full min-h-64 flex-col items-center justify-center text-slate-500">
                    <AlertCircle className="mb-3 h-12 w-12 text-slate-300" />
                    <p className="text-lg font-medium">No products found</p>
                    <p className="text-sm">Try adjusting the search fields above</p>
                  </div>
                ) : (
                  <table className="w-full min-w-[1450px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm dark:bg-slate-900">
                      <tr className="text-slate-600 dark:text-slate-300">
                        <th className="border border-slate-200 px-3 py-3 font-semibold dark:border-slate-800">Part No.</th>
                        <th className="border border-slate-200 px-3 py-3 font-semibold dark:border-slate-800">Item Code</th>
                        <th className="border border-slate-200 px-3 py-3 font-semibold dark:border-slate-800">Description</th>
                        <th className="border border-slate-200 px-3 py-3 font-semibold dark:border-slate-800">Brand</th>
                        <th className="border border-slate-200 px-3 py-3 font-semibold dark:border-slate-800">Application</th>
                        <th className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">Reorder Qty</th>
                        <th className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">Regular Price</th>
                        <th className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">AA</th>
                        <th className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">BB</th>
                        <th className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">CC</th>
                        <th className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">DD</th>
                        <th className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">VIP 1</th>
                        <th className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">VIP2</th>
                        {WAREHOUSES.map(warehouse => (
                          <th key={warehouse} className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">{warehouse}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {productOptions.map(product => {
                        const isHighlighted = highlightedProduct?.id === product.id;
                        const price = (value: number) => Number(value || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                        return (
                          <React.Fragment key={product.id}>
                            <tr
                              data-testid={`stock-product-row-${product.id}-A`}
                              onClick={() => handleProductSelect(product)}
                              className={`cursor-pointer text-slate-700 transition-colors dark:text-slate-200 ${
                                isHighlighted
                                  ? 'bg-blue-50 text-blue-700 underline dark:bg-blue-950/40 dark:text-blue-200'
                                  : 'odd:bg-white even:bg-slate-50 hover:bg-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-900/70 dark:hover:bg-slate-800'
                              }`}
                            >
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 font-semibold align-middle dark:border-slate-800">{product.part_no}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 align-middle dark:border-slate-800">{product.item_code}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 align-middle dark:border-slate-800">
                                <div>{product.description}</div>
                                {product.original_pn_no && (
                                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">ORIG P/N No: {product.original_pn_no}</div>
                                )}
                              </td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 align-middle dark:border-slate-800">{product.brand}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 align-middle dark:border-slate-800">{product.application || '-'}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 text-right align-middle dark:border-slate-800">{product.reorder_quantity}</td>
                              <td className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">A</td>
                              <td className="border border-slate-200 px-3 py-3 text-right dark:border-slate-800">{price(product.price_aa)}</td>
                              <td className="border border-slate-200 px-3 py-3 text-right dark:border-slate-800">{price(product.price_bb)}</td>
                              <td className="border border-slate-200 px-3 py-3 text-right dark:border-slate-800">{price(product.price_cc)}</td>
                              <td className="border border-slate-200 px-3 py-3 text-right dark:border-slate-800">{price(product.price_dd)}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 text-right align-middle dark:border-slate-800">{price(product.price_vip1)}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 text-right align-middle dark:border-slate-800">{price(product.price_vip2)}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 text-right align-middle dark:border-slate-800">{product.stock_wh1}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 text-right align-middle dark:border-slate-800">{product.stock_wh2}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 text-right align-middle dark:border-slate-800">{product.stock_wh3}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 text-right align-middle dark:border-slate-800">{product.stock_wh4}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 text-right align-middle dark:border-slate-800">{product.stock_wh5}</td>
                              <td rowSpan={2} className="border border-slate-200 px-3 py-3 text-right align-middle dark:border-slate-800">{product.stock_wh6}</td>
                            </tr>
                            <tr
                              data-testid={`stock-product-row-${product.id}-B`}
                              onClick={() => handleProductSelect(product)}
                              className={`cursor-pointer text-slate-700 transition-colors dark:text-slate-200 ${
                                isHighlighted
                                  ? 'bg-blue-50 text-blue-700 underline dark:bg-blue-950/40 dark:text-blue-200'
                                  : 'odd:bg-white even:bg-slate-50 hover:bg-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-900/70 dark:hover:bg-slate-800'
                              }`}
                            >
                              <td className="border border-slate-200 px-3 py-3 text-right font-semibold dark:border-slate-800">B</td>
                              <td className="border border-slate-200 px-3 py-3 text-right dark:border-slate-800">{price(product.price_baa || 0)}</td>
                              <td className="border border-slate-200 px-3 py-3 text-right dark:border-slate-800">{price(product.price_bbb || 0)}</td>
                              <td className="border border-slate-200 px-3 py-3 text-right dark:border-slate-800">{price(product.price_bcc || 0)}</td>
                              <td className="border border-slate-200 px-3 py-3 text-right dark:border-slate-800">{price(product.price_bdd || 0)}</td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
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
                      <thead className="stock-movement-legacy-head sticky top-0 z-20 bg-white shadow-sm dark:bg-slate-900">
                        <tr className="text-xs uppercase text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <th className="p-3 text-center bg-emerald-50 dark:bg-emerald-950/30 border-b border-slate-200 dark:border-slate-700" colSpan={5}>RECEIVED / RETURNED</th>
                          <th className="p-3 text-center bg-rose-50 dark:bg-rose-950 border-l-4 border-l-slate-400 dark:border-l-slate-500 border-b border-slate-200 dark:border-slate-700" colSpan={6}>RELEASED</th>
                          <th className="p-3 w-24 text-right bg-slate-100 dark:bg-slate-800 border-l-4 border-l-slate-400 dark:border-l-slate-500 border-b border-slate-200 dark:border-slate-700" rowSpan={2}>Bal</th>
                        </tr>
                        <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <th className="p-3 w-28 bg-emerald-50 dark:bg-emerald-950 border-b border-slate-200 dark:border-slate-700">Date</th>
                          <th className="p-3 w-32 bg-emerald-50 dark:bg-emerald-950 border-b border-slate-200 dark:border-slate-700">Source</th>
                          <th className="p-3 bg-emerald-50 dark:bg-emerald-950 border-b border-slate-200 dark:border-slate-700">Supplier/Customer</th>
                          <th className="p-3 w-20 text-right bg-emerald-50 dark:bg-emerald-950 border-b border-slate-200 dark:border-slate-700">Qty</th>
                          <th className="p-3 w-24 text-center bg-emerald-50 dark:bg-emerald-950 border-b border-slate-200 dark:border-slate-700">Warehouse</th>
                          <th className="p-3 w-28 bg-rose-50 dark:bg-rose-950 border-l-4 border-l-slate-400 dark:border-l-slate-500 border-b border-slate-200 dark:border-slate-700">Date</th>
                          <th className="p-3 w-32 bg-rose-50 dark:bg-rose-950 border-b border-slate-200 dark:border-slate-700">Source</th>
                          <th className="p-3 bg-rose-50 dark:bg-rose-950 border-b border-slate-200 dark:border-slate-700">Customer</th>
                          <th className="p-3 w-20 text-right bg-rose-50 dark:bg-rose-950 border-b border-slate-200 dark:border-slate-700">Qty</th>
                          <th className="p-3 w-24 text-right bg-rose-50 dark:bg-rose-950 border-b border-slate-200 dark:border-slate-700">Unit Price</th>
                          <th className="p-3 w-24 text-center bg-rose-50 dark:bg-rose-950 border-b border-slate-200 dark:border-slate-700">Warehouse</th>
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
              <h5>Application: {selectedProduct.application || '-'}</h5>
              <h5>Reorder Qty: {selectedProduct.reorder_quantity}</h5>
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
