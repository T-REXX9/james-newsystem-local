import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Loader2,
  Minus,
  Package,
  Search,
  Warehouse,
  X,
} from 'lucide-react';
import type { Product } from '../types';
import { fetchProductsPage } from '../services/productLocalApiService';
import { useToast } from './ToastProvider';

type WarehouseLabelMap = {
  wh1: string;
  wh2: string;
  wh3: string;
  wh4: string;
  wh5: string;
  wh6: string;
};

const DEFAULT_WAREHOUSE_LABELS: WarehouseLabelMap = {
  wh1: 'WH1',
  wh2: 'WH2',
  wh3: 'WH3',
  wh4: 'WH4',
  wh5: 'WH5',
  wh6: 'WH6',
};

const PRODUCT_RESULT_LIMIT = 80;

const normalizeText = (value: string) => value.trim().toLowerCase();

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
};

const scoreField = (fieldValue: string, query: string, startsWithWeight: number, includesWeight: number) => {
  const normalizedField = normalizeText(fieldValue);
  if (!normalizedField || !query) return 0;
  if (normalizedField === query) return startsWithWeight + 120;
  if (normalizedField.startsWith(query)) return startsWithWeight;
  if (normalizedField.includes(query)) return includesWeight;
  return 0;
};

const getProductScore = (product: Product, query: string) => {
  if (!query) {
    return (
      (product.stock_wh1 || 0) +
      (product.stock_wh2 || 0) +
      (product.stock_wh3 || 0) +
      (product.stock_wh4 || 0) +
      (product.stock_wh5 || 0) +
      (product.stock_wh6 || 0)
    );
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  return tokens.reduce((total, token) => {
    return total +
      scoreField(product.part_no, token, 140, 70) +
      scoreField(product.item_code, token, 135, 68) +
      scoreField(product.brand, token, 110, 55) +
      scoreField(product.description, token, 90, 45) +
      scoreField(product.oem_no, token, 95, 48) +
      scoreField(product.original_pn_no, token, 95, 48) +
      scoreField(product.application, token, 75, 36) +
      scoreField(product.descriptive_inquiry, token, 70, 32) +
      scoreField(product.barcode, token, 80, 40);
  }, 0);
};

const highlightMatch = (value: string, query: string) => {
  if (!query.trim()) return value;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return value;
  const parts = value.split(new RegExp(`(${escaped})`, 'ig'));
  return (
    <>
      {parts.map((part, index) => (
        <span
          key={`${part}-${index}`}
          className={part.toLowerCase() === query.toLowerCase() ? 'rounded bg-brand-blue/15 px-0.5 text-brand-blue font-semibold' : undefined}
        >
          {part}
        </span>
      ))}
    </>
  );
};

const ProductQuickSearchLauncher: React.FC = () => {
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [warehouseLabels, setWarehouseLabels] = useState<WarehouseLabelMap>(DEFAULT_WAREHOUSE_LABELS);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const latestRequestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isMinimized) {
        setIsOpen(false);
        setIsMinimized(false);
        return;
      }

      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() || '';
      const isTypingField = tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;
      if (isTypingField) {
        return;
      }

      event.preventDefault();
      setIsOpen((prev) => !prev);
      setIsMinimized(false);
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isMinimized, isOpen]);

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (!isOpen) return;

    const requestId = ++latestRequestRef.current;
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const page = await fetchProductsPage({
          search: debouncedQuery,
          status: 'all',
          page: 1,
          perPage: PRODUCT_RESULT_LIMIT,
        });

        if (requestId !== latestRequestRef.current) {
          return;
        }

        const nextLabels = page.meta.warehouse_labels || DEFAULT_WAREHOUSE_LABELS;
        setWarehouseLabels(nextLabels);

        const normalizedQuery = normalizeText(debouncedQuery);
        const ranked = [...page.items].sort((left, right) => {
          const scoreDiff = getProductScore(right, normalizedQuery) - getProductScore(left, normalizedQuery);
          if (scoreDiff !== 0) return scoreDiff;
          return left.part_no.localeCompare(right.part_no) || left.item_code.localeCompare(right.item_code);
        });

        setResults(ranked);
        setHasLoadedOnce(true);
        setSelectedProductId((current) => {
          if (current && ranked.some((product) => product.id === current)) {
            return current;
          }
          return ranked[0]?.id || null;
        });
      } catch (error) {
        if (requestId !== latestRequestRef.current) {
          return;
        }
        setResults([]);
        addToast({
          type: 'error',
          title: 'Unable to search products',
          description: error instanceof Error ? error.message : 'Please try again.',
        });
      } finally {
        if (requestId === latestRequestRef.current) {
          setIsLoading(false);
        }
      }
    };

    void loadProducts();
  }, [addToast, debouncedQuery, isOpen]);

  const selectedProduct = useMemo(
    () => results.find((product) => product.id === selectedProductId) || null,
    [results, selectedProductId]
  );

  const selectedWarehouseStocks = useMemo(() => {
    if (!selectedProduct) return [];
    return [
      { key: 'wh1', label: warehouseLabels.wh1, quantity: selectedProduct.stock_wh1 || 0 },
      { key: 'wh2', label: warehouseLabels.wh2, quantity: selectedProduct.stock_wh2 || 0 },
      { key: 'wh3', label: warehouseLabels.wh3, quantity: selectedProduct.stock_wh3 || 0 },
      { key: 'wh4', label: warehouseLabels.wh4, quantity: selectedProduct.stock_wh4 || 0 },
      { key: 'wh5', label: warehouseLabels.wh5, quantity: selectedProduct.stock_wh5 || 0 },
      { key: 'wh6', label: warehouseLabels.wh6, quantity: selectedProduct.stock_wh6 || 0 },
    ];
  }, [selectedProduct, warehouseLabels]);

  const totalStock = useMemo(
    () => selectedWarehouseStocks.reduce((sum, warehouse) => sum + warehouse.quantity, 0),
    [selectedWarehouseStocks]
  );

  const stockedLocations = useMemo(
    () => selectedWarehouseStocks.filter((warehouse) => warehouse.quantity > 0),
    [selectedWarehouseStocks]
  );

  const openFullProductDatabase = () => {
    window.dispatchEvent(new CustomEvent('workflow:navigate', {
      detail: { tab: 'warehouse-inventory-product-database' },
    }));
    setIsOpen(false);
    setIsMinimized(false);
  };

  const toggleLauncher = () => {
    setIsOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen) {
        setIsMinimized(false);
      }
      return nextOpen;
    });
  };

  const launcherButton = (
    <button
      onClick={toggleLauncher}
      className={`relative rounded-full p-2 transition-colors ${
        isOpen && !isMinimized
          ? 'bg-white/15 text-white'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
      title="Quick Product Search"
      aria-label="Quick Product Search"
    >
      <Package className="h-5 w-5" />
    </button>
  );

  const modal = isOpen && !isMinimized && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed bottom-4 right-4 z-[1200] flex h-[min(640px,76vh)] w-[min(1080px,94vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 max-md:inset-x-2 max-md:bottom-2 max-md:top-20 max-md:h-auto max-md:w-auto max-md:flex-col"
          role="dialog"
          aria-modal="false"
          aria-label="Quick product search"
        >
          <aside className="flex w-[360px] flex-col border-r border-slate-200 bg-slate-50/80 max-md:h-[320px] max-md:w-full max-md:border-b max-md:border-r-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Quick Product Search</h2>
                <p className="text-xs text-slate-500">Search by part no, item code, brand, description, OEM, or application</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Minimize product search"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Close product search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Tip: Press `Ctrl/Cmd + K` anywhere outside text fields to open this panel.
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading && !hasLoadedOnce ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading products...
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">
                  {debouncedQuery ? `No products found for "${debouncedQuery}".` : 'No products available.'}
                </div>
              ) : (
                results.map((product) => {
                  const total = (
                    (product.stock_wh1 || 0) +
                    (product.stock_wh2 || 0) +
                    (product.stock_wh3 || 0) +
                    (product.stock_wh4 || 0) +
                    (product.stock_wh5 || 0) +
                    (product.stock_wh6 || 0)
                  );
                  const isSelected = selectedProductId === product.id;

                  return (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProductId(product.id)}
                      className={`w-full border-b border-slate-100 px-4 py-3 text-left transition ${
                        isSelected ? 'bg-brand-blue/10' : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm font-semibold text-slate-900">
                            {highlightMatch(product.part_no || 'No Part No.', debouncedQuery)}
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-600">
                            {highlightMatch(product.description || 'No description', debouncedQuery)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            <span>Code: <span className="font-mono text-slate-700">{highlightMatch(product.item_code || '—', debouncedQuery)}</span></span>
                            <span>Brand: <span className="font-medium text-slate-700">{highlightMatch(product.brand || '—', debouncedQuery)}</span></span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-semibold text-slate-700">
                            {formatCurrency(product.price_aa || 0)}
                          </div>
                          <div className={`text-sm font-semibold ${total > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {total}
                          </div>
                          <div className="text-[11px] text-slate-400">total stock</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-white max-md:min-h-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {selectedProduct ? selectedProduct.description || selectedProduct.part_no : 'Select a product'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {selectedProduct
                    ? `${selectedProduct.part_no || 'No Part No.'} • ${selectedProduct.item_code || 'No Item Code'}`
                    : 'Choose a product from the search results to inspect stock and location.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openFullProductDatabase}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Open Product Database
                </button>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Collapse product search"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-50/50 px-4 py-4 max-md:overflow-y-auto">
              {!selectedProduct ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                  Search and select a product to view stock, warehouse locations, and quick identifiers.
                </div>
              ) : (
                <div className="grid h-full gap-3 max-md:h-auto">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.45fr)_220px]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Product</p>
                          <h3 className="mt-1.5 text-lg font-semibold text-slate-900">{selectedProduct.description || 'Unnamed Product'}</h3>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-slate-700">
                              {selectedProduct.part_no || 'No Part No.'}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-slate-700">
                              {selectedProduct.item_code || 'No Item Code'}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                              {selectedProduct.brand || 'No Brand'}
                            </span>
                            <span className={`rounded-full px-3 py-1 font-medium ${
                              selectedProduct.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}>
                              {selectedProduct.status}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl bg-brand-blue px-3 py-2.5 text-right text-white">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">Total Stock</div>
                          <div className="mt-1 text-2xl font-semibold leading-none">{totalStock}</div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">OEM No.</div>
                          <div className="mt-1.5 truncate text-sm font-medium text-slate-800">{selectedProduct.oem_no || '—'}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Original P/N</div>
                          <div className="mt-1.5 truncate text-sm font-medium text-slate-800">{selectedProduct.original_pn_no || '—'}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Application</div>
                          <div className="mt-1.5 truncate text-sm font-medium text-slate-800">{selectedProduct.application || '—'}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Descriptive Inquiry</div>
                          <div className="mt-1.5 truncate text-sm font-medium text-slate-800">{selectedProduct.descriptive_inquiry || '—'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-brand-blue/15 bg-brand-blue/[0.06] p-4 shadow-sm">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue/70">Product Price</div>
                      <div className="mt-3 grid gap-2">
                        <div className="rounded-2xl bg-white/90 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Regular</div>
                          <div className="mt-1.5 text-base font-semibold text-slate-900">{formatCurrency(selectedProduct.price_aa || 0)}</div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                          <div className="rounded-2xl bg-white/90 p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Silver</div>
                            <div className="mt-1.5 text-sm font-semibold text-slate-900">{formatCurrency(selectedProduct.price_vip1 || 0)}</div>
                          </div>
                          <div className="rounded-2xl bg-white/90 p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Gold</div>
                            <div className="mt-1.5 text-sm font-semibold text-slate-900">{formatCurrency(selectedProduct.price_vip2 || 0)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-brand-blue" />
                        <p className="text-sm font-semibold text-slate-900">Warehouse Locations</p>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Warehouses currently holding stock for this item.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {stockedLocations.length > 0 ? stockedLocations.map((warehouse) => (
                          <div
                            key={warehouse.key}
                            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                          >
                            <div className="font-semibold leading-none">{warehouse.label}</div>
                            <div className="mt-1 text-[11px] text-emerald-700">{warehouse.quantity} on hand</div>
                          </div>
                        )) : (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            No warehouse stock available
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Stock by Warehouse</p>
                          <p className="text-[11px] text-slate-500">Compact stock visibility across all warehouse locations.</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 grid-cols-2 xl:grid-cols-3">
                        {selectedWarehouseStocks.map((warehouse) => (
                          <div
                            key={warehouse.key}
                            className={`rounded-2xl border px-3 py-2.5 ${
                              warehouse.quantity > 0
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-slate-200 bg-slate-50'
                            }`}
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{warehouse.label}</div>
                            <div className={`mt-1.5 text-xl font-semibold leading-none ${
                              warehouse.quantity > 0 ? 'text-emerald-700' : 'text-slate-500'
                            }`}>
                              {warehouse.quantity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="hidden rounded-2xl border border-brand-blue/15 bg-brand-blue/[0.04] px-4 py-3 text-[11px] text-slate-500 xl:block">
                    Quick view mode keeps pricing, stock, and product identifiers visible without needing to scroll.
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body
      )
    : null;

  const minimizedBar = isOpen && isMinimized && typeof document !== 'undefined'
    ? createPortal(
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-4 right-4 z-[1200] flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 shadow-xl shadow-slate-900/20 transition hover:bg-slate-50"
        >
          <Package className="h-4 w-4 text-brand-blue" />
          <span className="text-sm font-medium text-slate-800">Product Search</span>
        </button>,
        document.body
      )
    : null;

  return (
    <>
      {launcherButton}
      {modal}
      {minimizedBar}
    </>
  );
};

export default ProductQuickSearchLauncher;
