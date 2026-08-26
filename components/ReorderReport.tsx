import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, Info, Loader2, Printer, Search, ShoppingCart } from 'lucide-react';
import { purchaseRequestService } from '../services/purchaseRequestService';
import {
  fetchReorderSearchOptions,
  fetchReorderReportEntries,
  getReorderWorkflowStages,
  hideReorderReportItems,
  isReorderWorkflowActive,
  ReorderReportEntry,
  ReorderSearchOption,
  ReorderWarehouseType,
} from '../services/reorderReportService';
import { useToast } from './ToastProvider';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import ConfirmModal from './ConfirmModal';
import ModuleRecordLink from './ModuleRecordLink';

interface AddToPrModalProps {
  items: ReorderReportEntry[];
  onClose: () => void;
  onSaved: (created: { id: string; number: string }) => void;
}

const AddToPrModal: React.FC<AddToPrModalProps> = ({ items, onClose, onSaved }) => {
  const { addToast } = useToast();
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingPrId, setExistingPrId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [openAfterSave, setOpenAfterSave] = useState(true);
  const [pendingPRs, setPendingPRs] = useState<Array<{ id: string; pr_number: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; company: string }>>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prs, supplierRows] = await Promise.all([
          purchaseRequestService.getPurchaseRequests({ status: 'Pending' }),
          purchaseRequestService.getSuppliers(),
        ]);
        const pending = (prs || [])
          .filter((row) => String(row?.status || '').toLowerCase() === 'pending')
          .map((row) => ({
            id: String(row.id || ''),
            pr_number: String(row.pr_number || ''),
          }))
          .filter((row) => row.id);
        const supp = (supplierRows || []).map((row: any) => ({
          id: String(row?.id || ''),
          company: String(row?.company || ''),
        }));

        setPendingPRs(pending);
        setSuppliers(supp);
        if (pending.length > 0) setExistingPrId(pending[0].id);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const mapItemsForPR = useCallback(
    (selectedSupplierId: string, selectedSupplierName: string) =>
      items.map((item) => {
        const useOverride = selectedSupplierId !== '';
        return {
          item_id: item.product_session,
          item_code: item.item_code,
          part_number: item.part_no,
          description: item.description,
          quantity: Math.max(1, item.suggested_reorder_qty),
          unit_cost: useOverride ? 0 : item.preferred_supplier_cost,
          supplier_id: useOverride ? selectedSupplierId : item.preferred_supplier_id,
          supplier_name: useOverride ? selectedSupplierName : item.preferred_supplier_name,
          eta_date: '',
        };
      }),
    [items]
  );

  const unresolvedSupplierCount = useMemo(
    () => supplierId ? 0 : items.filter((item) => !item.preferred_supplier_id).length,
    [items, supplierId]
  );

  const filteredSuppliers = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();
    if (!query) return suppliers.slice(0, 50);
    return suppliers
      .filter((supplier) => supplier.company.toLowerCase().includes(query))
      .slice(0, 50);
  }, [supplierSearch, suppliers]);

  const navigateToPR = (prId: string) => {
    if (!prId) return;
    window.dispatchEvent(
      new CustomEvent('workflow:navigate', {
        detail: { tab: 'warehouse-purchasing-purchase-request', payload: { prId } },
      })
    );
  };

  const handleSave = async () => {
    if (mode === 'existing' && !existingPrId) return;
    if (mode === 'new' && unresolvedSupplierCount > 0) return;

    setSaving(true);
    try {
      let targetPrId = existingPrId;
      let targetPrNumber = pendingPRs.find((row) => row.id === existingPrId)?.pr_number || existingPrId;
      const selectedSupplier = suppliers.find((row) => row.id === supplierId);
      const supplierName = selectedSupplier?.company || '';
      const prItems = mapItemsForPR(supplierId, supplierName);

      if (mode === 'new') {
        const prNumber = await purchaseRequestService.generatePRNumber();
        targetPrNumber = prNumber;
        const created = await purchaseRequestService.createPurchaseRequest({
          pr_number: prNumber,
          request_date: new Date().toISOString().slice(0, 10),
          notes: 'Added from Reorder Report',
          reference_no: '',
          items: prItems,
        });
        targetPrId = String(created?.id || '');
      } else {
        for (const item of prItems) {
          await purchaseRequestService.addPRItem(existingPrId, item as any);
        }
      }

      addToast({
        type: 'success',
        title: 'Added to Purchase Request',
        description: `${items.length} item(s) added successfully.`,
        durationMs: 4000,
      });

      if (openAfterSave && targetPrId) navigateToPR(targetPrId);
      onSaved({ id: targetPrId, number: targetPrNumber });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed to add items',
        description: String(err?.message || 'Unable to add selected items to PR.'),
        durationMs: 6000,
      });
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">Add Selected Items to PR</h3>
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <CustomLoadingSpinner label="Loading" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Each line uses the report’s net suggested quantity and recommended supplier. You can override the supplier for all selected lines below.
            </p>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'new' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
              >
                Create New PR
              </button>
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'existing' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
              >
                Use Existing Pending PR
              </button>
            </div>

            {mode === 'new' ? (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Supplier override (optional)</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={supplierSearch}
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      setSupplierId('');
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    onBlur={() => window.setTimeout(() => setShowSupplierDropdown(false), 150)}
                    placeholder="Use each item’s recommended supplier"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  {showSupplierDropdown ? (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      {filteredSuppliers.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No suppliers found</div>
                      ) : (
                        filteredSuppliers.map((supplier) => (
                          <button
                            key={supplier.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setSupplierId(supplier.id);
                              setSupplierSearch(supplier.company);
                              setShowSupplierDropdown(false);
                            }}
                            className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                              supplier.id === supplierId ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {supplier.company}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                {unresolvedSupplierCount > 0 ? (
                  <p className="mt-2 text-xs font-semibold text-amber-700">
                    {unresolvedSupplierCount} item(s) have no recommended supplier. Select an override to continue.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Leave blank to keep each item’s recommended supplier and recorded cost.</p>
                )}
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Pending PR</label>
                <select
                  value={existingPrId}
                  onChange={(e) => setExistingPrId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {pendingPRs.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.pr_number}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={openAfterSave}
                onChange={(e) => setOpenAfterSave(e.target.checked)}
              />
              Open Purchase Request module after save
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || saving || (mode === 'existing' && !existingPrId) || (mode === 'new' && unresolvedSupplierCount > 0)}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const formatReportDate = (date: Date): string => {
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
};

interface ReorderReportHistorySnapshot {
  version: 1;
  rows: ReorderReportEntry[];
  generatedAt: string;
  selectedIds: string[];
  searchInput: string;
  appliedSearch: string;
  page: number;
  meta: { page: number; per_page: number; total: number; total_pages: number };
  latestCreatedPr: { id: string; number: string } | null;
  scrollTop: number;
}

const readReorderHistorySnapshot = (): ReorderReportHistorySnapshot | null => {
  if (typeof window === 'undefined') return null;
  const snapshot = window.history.state?.reorderReport;
  return snapshot?.version === 1 && Array.isArray(snapshot.rows) && snapshot.generatedAt
    ? snapshot as ReorderReportHistorySnapshot
    : null;
};

const isReorderReportHistoryEntry = (): boolean =>
  typeof window !== 'undefined'
  && window.location.hash.replace(/^#\/?/, '').split('?')[0] === 'warehouse-reports-reorder-report';

const ReorderReport: React.FC = () => {
  const { addToast } = useToast();
  const initialSnapshotRef = useRef<ReorderReportHistorySnapshot | null>(readReorderHistorySnapshot());
  const [rows, setRows] = useState<ReorderReportEntry[]>(() => initialSnapshotRef.current?.rows || []);
  const [loading, setLoading] = useState(() => !initialSnapshotRef.current);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const warehouseType: ReorderWarehouseType = 'total';
  const [generatedAt] = useState<Date>(() => {
    const value = initialSnapshotRef.current?.generatedAt;
    return value ? new Date(value) : new Date();
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSnapshotRef.current?.selectedIds || []));
  const [showAddPrModal, setShowAddPrModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'hide' | null>(null);
  const [searchInput, setSearchInput] = useState(() => initialSnapshotRef.current?.searchInput || '');
  const [showReportSearchDropdown, setShowReportSearchDropdown] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<ReorderSearchOption[]>([]);
  const [loadingSearchSuggestions, setLoadingSearchSuggestions] = useState(true);
  const [appliedSearch, setAppliedSearch] = useState(() => initialSnapshotRef.current?.appliedSearch || '');
  const [page, setPage] = useState(() => initialSnapshotRef.current?.page || 1);
  const [meta, setMeta] = useState(() => initialSnapshotRef.current?.meta || { page: 1, per_page: 50, total: 0, total_pages: 1 });
  const [printRows, setPrintRows] = useState<ReorderReportEntry[]>([]);
  const [latestCreatedPr, setLatestCreatedPr] = useState<{ id: string; number: string } | null>(() => initialSnapshotRef.current?.latestCreatedPr || null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const tableScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const initialLoadStartedRef = useRef(false);
  const isWh1Report = false;

  const persistHistorySnapshot = useCallback((scrollTop?: number) => {
    if (!generatedAt || !isReorderReportHistoryEntry()) return;
    const currentState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {};
    const snapshot: ReorderReportHistorySnapshot = {
      version: 1,
      rows,
      generatedAt: generatedAt.toISOString(),
      selectedIds: Array.from(selectedIds),
      searchInput,
      appliedSearch,
      page,
      meta,
      latestCreatedPr,
      scrollTop: scrollTop ?? tableScrollContainerRef.current?.scrollTop ?? initialSnapshotRef.current?.scrollTop ?? 0,
    };
    window.history.replaceState({ ...currentState, reorderReport: snapshot }, '', window.location.href);
  }, [appliedSearch, generatedAt, latestCreatedPr, meta, page, rows, searchInput, selectedIds]);

  useEffect(() => {
    persistHistorySnapshot();
  }, [persistHistorySnapshot]);

  useEffect(() => {
    const restoredScrollTop = initialSnapshotRef.current?.scrollTop || 0;
    if (!generatedAt || restoredScrollTop <= 0) return;
    const frame = window.requestAnimationFrame(() => {
      if (tableScrollContainerRef.current) tableScrollContainerRef.current.scrollTop = restoredScrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [generatedAt]);

  const filteredSearchSuggestions = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    const matches = query
      ? searchSuggestions.filter((option) => option.value.toLowerCase().includes(query))
      : [...searchSuggestions];
    return matches
      .sort((left, right) => {
        const leftPrefix = query && left.value.toLowerCase().startsWith(query) ? 0 : 1;
        const rightPrefix = query && right.value.toLowerCase().startsWith(query) ? 0 : 1;
        return leftPrefix - rightPrefix || left.value.localeCompare(right.value);
      })
      .slice(0, 80);
  }, [searchInput, searchSuggestions]);

  useEffect(() => {
    let active = true;
    setLoadingSearchSuggestions(true);
    fetchReorderSearchOptions()
      .then((options) => {
        if (active) setSearchSuggestions(options);
      })
      .catch((error) => {
        if (!active) return;
        setSearchSuggestions([]);
        addToast({
          type: 'error',
          title: 'Unable to load search suggestions',
          description: String(error?.message || 'Request failed'),
          durationMs: 5000,
        });
      })
      .finally(() => {
        if (active) setLoadingSearchSuggestions(false);
      });

    return () => {
      active = false;
    };
  }, [addToast]);

  const loadReport = useCallback(async (targetPage = 1, targetSearch = '', append = false) => {
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setLoadMoreFailed(false);
    }
    try {
      const data = await fetchReorderReportEntries({
        warehouseType,
        search: targetSearch,
        showHidden: false,
        page: targetPage,
        perPage: 50,
      });
      setRows((current) => {
        if (!append) return data.items;
        const unique = new Map<string, ReorderReportEntry>();
        [...current, ...data.items].forEach((row) => {
          const key = row.product_session || `${row.item_code.trim().toLowerCase()}::${row.part_no.trim().toLowerCase()}`;
          if (!unique.has(key)) unique.set(key, row);
        });
        return Array.from(unique.values());
      });
      setMeta(data.meta);
      setPage(data.meta.page);
      setLoadMoreFailed(false);
      if (!append) setSelectedIds(new Set());
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Unable to load reorder report',
        description: String(err?.message || 'Request failed'),
        durationMs: 6000,
      });
      if (append) setLoadMoreFailed(true);
      else setRows([]);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [addToast, warehouseType]);

  useEffect(() => {
    if (initialSnapshotRef.current || initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void loadReport(1, '');
  }, [loadReport]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextSearch = searchInput.trim().toLowerCase() === 'all' ? '' : searchInput.trim();
    setSearchInput(nextSearch);
    setAppliedSearch(nextSearch);
    await loadReport(1, nextSearch);
  };

  useEffect(() => {
    if (!generatedAt) return;
    const nextSearch = searchInput.trim();
    if (nextSearch === appliedSearch) return;
    const timer = window.setTimeout(() => {
      setAppliedSearch(nextSearch);
      void loadReport(1, nextSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [appliedSearch, generatedAt, loadReport, searchInput]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!generatedAt || !sentinel || loading || loadingMore || loadMoreFailed || page >= meta.total_pages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingMore || page >= meta.total_pages) return;
        void loadReport(page + 1, appliedSearch, true);
      },
      { rootMargin: '300px 0px', threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [appliedSearch, generatedAt, loadMoreFailed, loadReport, loading, loadingMore, meta.total_pages, page]);

  const handlePrint = async () => {
    setPreparingPrint(true);
    try {
      const first = await fetchReorderReportEntries({
        warehouseType,
        search: appliedSearch,
        showHidden: false,
        page: 1,
        perPage: 500,
      });
      const remaining = first.meta.total_pages > 1
        ? await Promise.all(Array.from({ length: first.meta.total_pages - 1 }, (_, index) =>
            fetchReorderReportEntries({
              warehouseType,
              search: appliedSearch,
              hideZeroReorder,
              hideZeroReplenish,
              showHidden: false,
              page: index + 2,
              perPage: 500,
            })
          ))
        : [];
      const unique = new Map<string, ReorderReportEntry>();
      [first.items, ...remaining.map((result) => result.items)].flat().forEach((row) => {
        const key = row.product_session || `${row.item_code}::${row.part_no}`;
        if (!unique.has(key)) unique.set(key, row);
      });
      setPrintRows(Array.from(unique.values()));
      window.setTimeout(() => window.print(), 100);
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Unable to prepare report for printing',
        description: String(error?.message || 'Request failed'),
      });
    } finally {
      setPreparingPrint(false);
    }
  };

  const eligibleRows = useMemo(
    () => rows.filter((row) => !isReorderWorkflowActive(row)),
    [rows]
  );

  const selectedRows = useMemo(
    () => eligibleRows.filter((row) => selectedIds.has(row.id)),
    [eligibleRows, selectedIds]
  );

  const allSelected = eligibleRows.length > 0 && eligibleRows.every((row) => selectedIds.has(row.id));

  const toggleSelectAll = async () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }

    if (page >= meta.total_pages) {
      setSelectedIds(new Set(eligibleRows.map((row) => row.id)));
      return;
    }

    setSelectingAll(true);
    try {
      const first = await fetchReorderReportEntries({
        warehouseType,
        search: appliedSearch,
        showHidden: false,
        page: 1,
        perPage: 100,
      });
      const remaining: Array<Awaited<ReturnType<typeof fetchReorderReportEntries>>> = [];
      for (let nextPage = 2; nextPage <= first.meta.total_pages; nextPage += 1) {
        remaining.push(await fetchReorderReportEntries({
          warehouseType,
          search: appliedSearch,
          showHidden: false,
          page: nextPage,
          perPage: 100,
        }));
      }
      const unique = new Map<string, ReorderReportEntry>();
      [first.items, ...remaining.map((result) => result.items)].flat().forEach((row) => {
        const key = row.product_session || `${row.item_code.trim().toLowerCase()}::${row.part_no.trim().toLowerCase()}`;
        if (!unique.has(key)) unique.set(key, row);
      });
      const allRows = Array.from(unique.values());
      const selectableRows = allRows.filter((row) => !isReorderWorkflowActive(row));

      setRows(allRows);
      setSelectedIds(new Set(selectableRows.map((row) => row.id)));
      setPage(first.meta.total_pages);
      setMeta({ ...first.meta, page: first.meta.total_pages });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Unable to select all items',
        description: String(error?.message || 'Request failed'),
        durationMs: 5000,
      });
    } finally {
      setSelectingAll(false);
    }
  };

  const toggleSelectRow = (id: string) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row || isReorderWorkflowActive(row)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedVisibleCount = selectedRows.length;

  const handleMarkHidden = async () => {
    if (selectedIds.size === 0) return;

    setProcessing(true);
    try {
      const hiddenCount = await hideReorderReportItems(Array.from(selectedIds));
      addToast({
        type: 'success',
        title: 'Items hidden',
        description: `${hiddenCount} item(s) marked as hidden.`,
        durationMs: 4000,
      });
      await loadReport(1, appliedSearch);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed to hide items',
        description: String(err?.message || 'Unable to mark selected items as hidden.'),
        durationMs: 6000,
      });
    } finally {
      setProcessing(false);
    }
  };

  const reportTitle = 'TOTAL COMPANY REORDER REPORT';
  const dateLabel = generatedAt ? formatReportDate(generatedAt) : '';

  const formatQuantity = (value: number): string => new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);

  const formatCurrency = (value: number): string => new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value);

  const renderStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    const color = normalized === 'overdue' || normalized === 'cancelled'
      ? 'bg-rose-100 text-rose-700'
      : normalized === 'completed'
        ? 'bg-emerald-100 text-emerald-700'
        : normalized === 'partially received'
          ? 'bg-purple-100 text-purple-700'
          : normalized === 'ordered' || normalized === 'awaiting po'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-orange-100 text-orange-700';
    return <span className={`inline-flex max-w-full justify-center rounded-full px-2 py-1 text-center text-[10px] font-bold leading-tight ${color}`}>{status}</span>;
  };

  const renderPrDocuments = (row: ReorderReportEntry) => row.pr_documents.length > 0 ? (
    <div className="space-y-2">
      {row.pr_documents.map((document) => (
        <div key={`${document.refno}-${document.number}`} className="break-words">
          <ModuleRecordLink tab="warehouse-purchasing-purchase-request" payload={{ prId: document.refno }} className="font-bold text-brand-blue hover:underline">
            {document.number || document.refno}
          </ModuleRecordLink>
          <div className="text-[11px] text-slate-500">{document.request_date ? document.request_date.slice(0, 10) : 'No date'} · {document.status}</div>
        </div>
      ))}
    </div>
  ) : <span className="text-slate-400">-</span>;

  const renderPoDocuments = (row: ReorderReportEntry) => row.po_documents.length > 0 ? (
    <div className="space-y-2">
      {row.po_documents.map((document) => (
        <div key={`${document.refno}-${document.number}`} className="min-w-0 break-words">
          <ModuleRecordLink tab="warehouse-purchasing-purchase-order" payload={{ poId: document.refno, poRefNo: document.number }} className="font-bold text-brand-blue hover:underline">
            {document.number || document.refno}
          </ModuleRecordLink>
          <div className="text-[11px] text-slate-500">{document.supplier_name || 'No supplier'} · {document.status}</div>
          <div className="text-[11px] text-slate-500">Ordered {document.order_date || '-'} · ETA {document.expected_delivery_date && document.expected_delivery_date !== '1970-01-01' ? document.expected_delivery_date : '-'}</div>
          <div className="text-[11px] text-slate-500">{formatCurrency(document.unit_cost)} / unit</div>
        </div>
      ))}
    </div>
  ) : <span className="text-slate-400">-</span>;

  const renderRrDocuments = (row: ReorderReportEntry) => row.rr_documents.length > 0 ? (
    <div className="space-y-2">
      {row.rr_documents.map((document) => (
        <div key={`${document.refno}-${document.number}`} className="break-words">
          <ModuleRecordLink tab="warehouse-purchasing-receiving-stock" payload={{ rrId: document.refno, rrRefNo: document.number }} className="font-bold text-brand-blue hover:underline">
            {document.number || document.refno}
          </ModuleRecordLink>
          <div className="text-[11px] text-slate-500">{document.receiving_date || 'No date'} · {document.status}</div>
        </div>
      ))}
    </div>
  ) : <span className="text-slate-400">-</span>;

  return (
    <div className="reorder-report-page h-full min-h-0 overflow-hidden bg-[#f7f9fc] text-slate-900">
      <style>{`
        .reorder-report-print { display: none; }
        .reorder-report-table th {
          padding: 0.5rem 0.25rem;
          font-size: 10px;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }
        .reorder-report-table th span { font-size: 9px; }
        .reorder-report-table td {
          padding: 0.55rem 0.3rem;
          font-size: 11px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        @media (min-width: 1536px) {
          .reorder-report-table th { font-size: 11px; }
          .reorder-report-table td { font-size: 12px; }
        }
        @media print {
          @page { size: landscape; margin: 7mm; }
          body * { visibility: hidden !important; }
          .reorder-report-print, .reorder-report-print * { visibility: visible !important; }
          .reorder-report-print { display: block !important; position: absolute; inset: 0; width: 100%; color: #000; background: #fff; font-family: Arial, sans-serif; }
          .reorder-report-print table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .reorder-report-print th, .reorder-report-print td { border: 1px solid #777; padding: 5px; text-align: center; }
          .reorder-report-print th { font-weight: 600; }
        }
      `}</style>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-none flex-col p-4 lg:p-6 print:hidden">
        <header className="mb-6 flex shrink-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><span>Purchasing</span><span>›</span><span>Reports</span><span>›</span><span className="text-slate-700">Reorder Report</span></div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#173c83]">Reorder Report</h1>
            <p className="mt-1 text-sm text-slate-500">Live purchasing control from reorder requirement through PR, PO, partial receiving, and completion.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handlePrint()} disabled={preparingPrint} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              {preparingPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print
            </button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <form onSubmit={handleSearch} className="relative z-40 flex shrink-0 flex-wrap items-center gap-4 border-b border-slate-200 bg-white p-5">
            <div className="flex-1 min-w-[280px]">
              <label htmlFor="reorder-search" className="mb-1 block text-xs font-bold text-slate-700">Smart Search — Item Code / Part No. / Original Part No. / Description / Brand</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="reorder-search"
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setShowReportSearchDropdown(true);
                  }}
                  onFocus={() => setShowReportSearchDropdown(true)}
                  onBlur={() => window.setTimeout(() => setShowReportSearchDropdown(false), 150)}
                  placeholder="Type an item code, part number, description, or brand..."
                  role="combobox"
                  aria-label="Reorder report smart search"
                  aria-autocomplete="list"
                  aria-expanded={showReportSearchDropdown}
                  aria-controls="reorder-report-search-options"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                />
                {showReportSearchDropdown && (
                  <div
                    id="reorder-report-search-options"
                    role="listbox"
                    aria-label="Reorder report smart suggestions"
                    className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl"
                  >
                    {!searchInput.trim() && (
                      <button
                        type="button"
                        role="option"
                        aria-selected={!searchInput.trim()}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSearchInput('');
                          setShowReportSearchDropdown(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        All reorder items
                      </button>
                    )}
                    {filteredSearchSuggestions.map((option) => (
                      <button
                        key={`${option.category}:${option.value}`}
                        type="button"
                        role="option"
                        aria-label={`${option.value} — ${option.category}`}
                        aria-selected={searchInput.toLowerCase() === option.value.toLowerCase()}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSearchInput(option.value);
                          setShowReportSearchDropdown(false);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="truncate font-medium">{option.value}</span>
                        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{option.category}</span>
                      </button>
                    ))}
                    {loadingSearchSuggestions && (
                      <div className="px-3 py-2 text-sm text-slate-500">Loading smart suggestions...</div>
                    )}
                    {!loadingSearchSuggestions && searchInput.trim() && filteredSearchSuggestions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-500">
                        No saved suggestion matches “{searchInput.trim()}”. Live results are still searching every product field.
                      </div>
                    )}
                    {!loadingSearchSuggestions && !searchInput.trim() && searchSuggestions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-500">No search suggestions available.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-end gap-2 pt-5">
              <button type="button" onClick={() => { setSearchInput(''); setAppliedSearch(''); void loadReport(1, ''); }} className="rounded-md border border-[#175fd3] bg-white px-5 py-2.5 text-sm font-bold text-[#175fd3] transition hover:bg-blue-50">Reset</button>
              <button type="submit" disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#175fd3] px-6 text-sm font-bold text-white transition hover:bg-[#0e4fb7] disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Search
              </button>
            </div>
          </form>

          <div data-testid="reorder-selection-actions" className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-700">{selectingAll ? 'Selecting all eligible items...' : `${selectedVisibleCount} item(s) selected`}</span>
              <button type="button" onClick={() => setShowAddPrModal(true)} disabled={selectedVisibleCount === 0 || processing} className="rounded-md border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-600 transition hover:bg-orange-100 disabled:opacity-50">
                <ShoppingCart className="mr-2 inline h-4 w-4" /> Add to PR
              </button>
              {latestCreatedPr ? (
                <ModuleRecordLink tab="warehouse-purchasing-purchase-request" payload={{ prId: latestCreatedPr.id }} className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100">
                  <span>PR Created:</span><span className="underline">{latestCreatedPr.number}</span>
                </ModuleRecordLink>
              ) : null}
            </div>
            <div className="flex items-center gap-2 rounded bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <Info className="h-3.5 w-3.5" /> Pending PRs block duplicates but do not count as on order. Only posted PO balances reduce the suggested quantity.
            </div>
          </div>

          <div ref={tableScrollContainerRef} onScroll={(event) => persistHistorySnapshot(event.currentTarget.scrollTop)} data-testid="reorder-table-scroll-container" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <table className="reorder-report-table w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: '2.5%' }} />
                <col style={{ width: '4.5%' }} />
                <col style={{ width: '5.5%' }} />
                <col style={{ width: '10.5%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4.5%' }} />
                <col style={{ width: '3.5%' }} />
                <col style={{ width: '7.5%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4.5%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '5%' }} />
              </colgroup>
              <thead className="sticky top-0 z-30 shadow-md">
                <tr>
                  <th rowSpan={2} className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-center text-white"><label className="inline-flex items-center justify-center gap-1"><input type="checkbox" checked={allSelected} disabled={selectingAll} onChange={() => void toggleSelectAll()} className="h-4 w-4 rounded border-white/30 bg-white/10 disabled:opacity-60" aria-label="ALL" /> ALL</label></th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-left font-bold uppercase tracking-wide text-white">Item Code</th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-left font-bold uppercase tracking-wide text-white">Part No.</th>
                  <th rowSpan={2} className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-left font-bold uppercase tracking-wide text-white">Description</th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Physical<br />Stock</th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Reserved<br />Stock</th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Available<br />Stock</th>
                  <th rowSpan={2} className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Reorder<br />Level</th>
                  <th rowSpan={2} className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Suggested<br />Reorder</th>
                  <th colSpan={2} className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Recommended Supplier</th>
                  <th colSpan={2} className="border-b border-r border-white/20 bg-orange-500 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">① PR STAGE<br /><span className="text-xs font-normal opacity-90">(Waiting for Approval)</span></th>
                  <th colSpan={4} className="border-b border-r border-white/20 bg-[#175fd3] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">② PO STAGE<br /><span className="text-xs font-normal opacity-90">(Ordered from Supplier)</span></th>
                  <th colSpan={3} className="border-b border-r border-white/20 bg-purple-700 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">③ RECEIVING STOCK<br /><span className="text-xs font-normal opacity-90">(Incoming to Warehouse)</span></th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Overall<br />Status</th>
                </tr>
                <tr>
                  <th className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-left font-bold uppercase tracking-wide text-white">Supplier</th>
                  <th className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-right font-bold uppercase tracking-wide text-white">Cost (P)</th>
                  <th className="border-b border-r border-white/20 bg-orange-500 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">PR #</th>
                  <th className="border-b border-r border-white/20 bg-orange-500 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">PR Qty</th>
                  <th className="border-b border-r border-white/20 bg-[#175fd3] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">PO #</th>
                  <th className="border-b border-r border-white/20 bg-[#175fd3] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Ordered Qty</th>
                  <th className="border-b border-r border-white/20 bg-[#175fd3] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">On Order</th>
                  <th className="border-b border-r border-white/20 bg-[#175fd3] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Outstanding</th>
                  <th className="border-b border-r border-white/20 bg-purple-700 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Receiving #</th>
                  <th className="border-b border-r border-white/20 bg-purple-700 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Received Qty</th>
                  <th className="border-b border-r border-white/20 bg-purple-700 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Accepted Qty</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={21} className="px-4 py-16 text-center text-sm text-slate-500">
                    {loading ? <CustomLoadingSpinner label="Loading" /> : 'No items match the current filters.'}
                  </td></tr>
                ) : rows.map((row) => {
                  const active = isReorderWorkflowActive(row);
                  return (
                    <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                      <td className="border-r border-slate-100 px-3 py-3 text-center">
                        <input type="checkbox" aria-label={`Select ${row.item_code}`} checked={selectedIds.has(row.id)} disabled={active} title={active ? 'This item already has an active purchasing workflow' : 'Select item'} onChange={() => toggleSelectRow(row.id)} className="h-4 w-4 rounded border-slate-300" />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-600">{row.item_code}</td>
                      <td className="px-3 py-3 font-semibold text-[#173c83]">{row.part_no}</td>
                      <td className="border-r border-slate-100 px-3 py-3 font-semibold">{row.description}</td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800">{formatQuantity(row.physical_stock)}</td>
                      <td className="px-3 py-3 text-center font-semibold text-amber-700">{formatQuantity(row.reserved_stock)}</td>
                      <td className="px-3 py-3 text-center font-bold text-rose-600">{formatQuantity(row.available_stock)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-bold text-[#173c83]">{formatQuantity(row.reorder_qty)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-extrabold text-emerald-700">{formatQuantity(row.suggested_reorder_qty)}</td>
                      <td className="px-3 py-3 font-semibold">{row.preferred_supplier_name || '-'}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-right font-semibold">{row.preferred_supplier_cost > 0 ? formatCurrency(row.preferred_supplier_cost) : '-'}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center">{renderPrDocuments(row)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-semibold text-orange-600">{formatQuantity(row.pr_requested_qty ?? row.open_pr_qty)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center">{renderPoDocuments(row)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-semibold text-[#175fd3]">{formatQuantity(row.po_ordered_qty)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-bold text-[#175fd3]">{formatQuantity(row.open_po_qty)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-bold text-rose-600">{formatQuantity(row.remaining_qty)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center">{renderRrDocuments(row)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-semibold text-purple-700">{formatQuantity(row.received_qty)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-bold text-emerald-700">{formatQuantity(row.accepted_qty)}</td>
                      <td className="px-3 py-3 text-center">{renderStatusBadge(row.overall_status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {meta.total > 0 ? (
              <div className="border-t border-slate-200 px-5 py-4 text-center text-sm text-slate-500">
                {loadingMore ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading more items...</span>
                ) : loadMoreFailed ? (
                  <button type="button" onClick={() => void loadReport(page + 1, appliedSearch, true)} className="text-[#175fd3] underline">Unable to load more items. Retry</button>
                ) : page >= meta.total_pages ? (
                  <span>All {rows.length} entries loaded</span>
                ) : (
                  <span>Showing {rows.length} of {meta.total} entries</span>
                )}
              </div>
            ) : null}
            <div ref={loadMoreSentinelRef} data-testid="reorder-load-more-sentinel" className="h-px w-full" aria-hidden="true" />
          </div>
        </section>
      </div>

      {showAddPrModal && selectedRows.length > 0 ? (
        <AddToPrModal
          items={selectedRows}
          onClose={() => setShowAddPrModal(false)}
          onSaved={(created) => {
            setLatestCreatedPr(created);
            setShowAddPrModal(false);
            setSelectedIds(new Set());
            void loadReport(1, appliedSearch);
          }}
        />
      ) : null}

      <ConfirmModal
        isOpen={confirmAction === 'hide'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleMarkHidden}
        title="Mark Items as Hidden"
        message={`Mark ${selectedVisibleCount} selected visible item(s) as hidden? You can restore them later from the reorder report.`}
        confirmLabel="Mark as Hidden"
        variant="warning"
      />

      <div className="reorder-report-print">
        <div className="mb-5 text-center">
          <p className="text-[17px] font-bold">{reportTitle}</p>
          <p className="mt-[-4px] text-[13px] font-bold">AS OF {dateLabel}</p>
        </div>
        <table>
          <thead>
            <tr><th rowSpan={2}>ITEM CODE</th><th rowSpan={2}>PART NO.</th><th rowSpan={2}>DESCRIPTION</th><th colSpan={5}>STOCK POSITION</th><th colSpan={2}>RECOMMENDED SUPPLIER</th><th colSpan={2}>① PR STAGE</th><th colSpan={4}>② PO STAGE</th><th colSpan={3}>③ RECEIVING STOCK</th><th rowSpan={2}>STATUS</th></tr>
            <tr><th>PHYSICAL</th><th>RESERVED</th><th>AVAILABLE</th><th>REORDER</th><th>SUGGESTED</th><th>SUPPLIER</th><th>COST</th><th>PR #</th><th>OPEN PR</th><th>PO #</th><th>ORDERED</th><th>ON ORDER</th><th>OUTSTANDING</th><th>RR #</th><th>RECEIVED</th><th>ACCEPTED</th></tr>
          </thead>
          <tbody>{(printRows.length > 0 ? printRows : rows).map((row) => <tr key={`print-${row.product_session}`}><td>{row.item_code}</td><td>{row.part_no}</td><td>{row.description}</td><td>{formatQuantity(row.physical_stock)}</td><td>{formatQuantity(row.reserved_stock)}</td><td>{formatQuantity(row.available_stock)}</td><td>{formatQuantity(row.reorder_qty)}</td><td>{formatQuantity(row.suggested_reorder_qty)}</td><td>{row.preferred_supplier_name || '-'}</td><td>{row.preferred_supplier_cost > 0 ? formatCurrency(row.preferred_supplier_cost) : '-'}</td><td>{row.pr_documents.map((document) => document.number).join(', ') || '-'}</td><td>{formatQuantity(row.pr_requested_qty ?? row.open_pr_qty)}</td><td>{row.po_documents.map((document) => document.number).join(', ') || '-'}</td><td>{formatQuantity(row.po_ordered_qty)}</td><td>{formatQuantity(row.open_po_qty)}</td><td>{formatQuantity(row.remaining_qty)}</td><td>{row.rr_documents.map((document) => document.number).join(', ') || '-'}</td><td>{formatQuantity(row.received_qty)}</td><td>{formatQuantity(row.accepted_qty)}</td><td>{row.overall_status}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};

export default ReorderReport;
