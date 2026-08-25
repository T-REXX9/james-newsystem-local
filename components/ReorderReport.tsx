import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, Info, Loader2, Printer, Search, ShoppingCart } from 'lucide-react';
import { purchaseRequestService } from '../services/purchaseRequestService';
import {
  fetchReorderReportEntries,
  getReorderWorkflowStages,
  hideReorderReportItems,
  isReorderWorkflowActive,
  ReorderReportEntry,
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
        if (supp.length > 0) {
          setSupplierId(supp[0].id);
          setSupplierSearch(supp[0].company);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const mapItemsForPR = useCallback(
    (selectedSupplierId: string, selectedSupplierName: string) =>
      items.map((item) => ({
        item_id: item.product_session,
        item_code: item.item_code,
        part_number: item.part_no,
        description: item.description,
        quantity: 1,
        unit_cost: 0,
        supplier_id: selectedSupplierId || '',
        supplier_name: selectedSupplierName || '',
        eta_date: '',
      })),
    [items]
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
    if (mode === 'new' && !supplierId) return;

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
              {items.length} item(s) will be added with quantity `1` each (old-system behavior).
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
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Supplier</label>
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
                    placeholder="Search supplier..."
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
            disabled={loading || saving || (mode === 'existing' && !existingPrId) || (mode === 'new' && !supplierId)}
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

const DESCRIPTION_SUGGESTIONS = ['Nozzle', 'Plunger', 'DV', 'Control Valve'];

const ReorderReport: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<ReorderReportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const warehouseType: ReorderWarehouseType = 'total';
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddPrModal, setShowAddPrModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'hide' | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [showDescriptionDropdown, setShowDescriptionDropdown] = useState(false);
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, per_page: 50, total: 0, total_pages: 1 });
  const [printRows, setPrintRows] = useState<ReorderReportEntry[]>([]);
  const [latestCreatedPr, setLatestCreatedPr] = useState<{ id: string; number: string } | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const isWh1Report = false;

  const filteredDescriptionSuggestions = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) return DESCRIPTION_SUGGESTIONS;
    return DESCRIPTION_SUGGESTIONS.filter((description) =>
      description.toLowerCase().includes(query)
    );
  }, [searchInput]);

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

  const handleGenerateReport = async () => {
    const descriptionSearch = searchInput.trim().toLowerCase() === 'all' ? '' : searchInput.trim();
    setSearchInput(descriptionSearch);
    setAppliedSearch(descriptionSearch);
    await loadReport(1, descriptionSearch);
    setGeneratedAt(new Date());
  };

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

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(eligibleRows.map((row) => row.id)));
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

  const renderPrLink = (row: ReorderReportEntry) => row.pr_refno ? (
    <ModuleRecordLink tab="warehouse-purchasing-purchase-request" payload={{ prId: row.pr_refno }} className="font-semibold text-brand-blue hover:underline">
      {row.pr_no || row.pr_refno}
    </ModuleRecordLink>
  ) : <span className="text-slate-400">-</span>;

  const renderPoLink = (row: ReorderReportEntry) => row.po_refno ? (
    <ModuleRecordLink tab="warehouse-purchasing-purchase-order" payload={{ poId: row.po_refno, poRefNo: row.po_no }} className="font-semibold text-brand-blue hover:underline">
      {row.po_no || row.po_refno}
    </ModuleRecordLink>
  ) : <span className="text-slate-400">-</span>;

  const renderRrLink = (row: ReorderReportEntry) => row.rr_refno ? (
    <ModuleRecordLink tab="warehouse-purchasing-receiving-stock" payload={{ rrId: row.rr_refno, rrRefNo: row.rr_no }} className="font-semibold text-brand-blue hover:underline">
      {row.rr_no || row.rr_refno}
    </ModuleRecordLink>
  ) : <span className="text-slate-400">-</span>;

  if (!generatedAt) {
    return (
      <div className="min-h-full overflow-auto bg-[#f4f4f4] px-3 py-5 text-[#222] lg:px-5 lg:py-6" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="mx-auto min-h-[363px] w-full max-w-none rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="relative flex h-[63px] items-center border-b border-[#d7d7d7] px-5">
            <h1 className="text-[18px] font-semibold text-[#29475f] after:absolute after:bottom-[-1px] after:left-5 after:h-px after:w-[135px] after:bg-[#6a92b3]" style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}>
              Reorder Report
            </h1>
          </div>

          <div className="px-[25px] py-[33px]">
            <p className="text-[13px] text-[#222]">
              Field mark with (<span className="text-rose-600">*</span>) is required. Press generate after you select the sorting options
            </p>

            <div className="ml-[96px] mt-[50px] w-full max-w-[620px] text-[13px] max-md:mx-auto">
              <div className="grid grid-cols-[155px_435px] items-start gap-[30px] max-md:grid-cols-[135px_minmax(0,1fr)]">
                <label className="pt-2 text-right font-semibold text-[#222]">Description</label>
                <div className="text-[#222]">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(event) => {
                        setSearchInput(event.target.value);
                        setShowDescriptionDropdown(true);
                      }}
                      onFocus={() => setShowDescriptionDropdown(true)}
                      onBlur={() => window.setTimeout(() => setShowDescriptionDropdown(false), 150)}
                      placeholder="All descriptions"
                      role="combobox"
                      aria-label="Description smart search"
                      aria-autocomplete="list"
                      aria-expanded={showDescriptionDropdown}
                      aria-controls="reorder-description-options"
                      className="h-[35px] w-full rounded-[3px] border border-[#c9c9c9] bg-white py-2 pl-4 pr-9 text-[13px] text-[#555] outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]"
                    />
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
                    {showDescriptionDropdown && (
                      <div
                        id="reorder-description-options"
                        role="listbox"
                        aria-label="Description suggestions"
                        className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-[3px] border border-[#ccc] bg-white py-1 shadow-lg"
                      >
                        {(!searchInput.trim() || 'all descriptions'.includes(searchInput.trim().toLowerCase())) && (
                          <button
                            type="button"
                            role="option"
                            aria-selected={!searchInput.trim()}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setSearchInput('');
                              setShowDescriptionDropdown(false);
                            }}
                            className="block w-full px-3 py-2 text-left text-[13px] text-[#333] hover:bg-[#f5f5f5]"
                          >
                            All descriptions
                          </button>
                        )}
                        {filteredDescriptionSuggestions.map((description) => (
                          <button
                            key={description}
                            type="button"
                            role="option"
                            aria-selected={searchInput.toLowerCase() === description.toLowerCase()}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setSearchInput(description);
                              setShowDescriptionDropdown(false);
                            }}
                            className="block w-full px-3 py-2 text-left text-[13px] text-[#333] hover:bg-[#f5f5f5]"
                          >
                            {description}
                          </button>
                        ))}
                        {searchInput.trim() && filteredDescriptionSuggestions.length === 0 && (
                          <div className="px-3 py-2 text-[13px] text-[#777]">
                            Press Generate Report to search for “{searchInput.trim()}”.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[12px] text-[#666]">
                    Select All or enter a description such as nozzle, plunger, DV, or control valve.
                  </p>
                </div>
              </div>

              <div className="mt-[25px] grid grid-cols-[155px_435px] gap-[30px] max-md:grid-cols-[135px_minmax(0,1fr)]">
                <span />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    disabled={loading}
                    className="inline-flex h-[35px] items-center gap-2 rounded-[4px] border border-[#d43f3a] bg-[#d9534f] px-[13px] text-[14px] text-white hover:bg-[#c9302c] disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Generate Report
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setAppliedSearch('');
                    }}
                    className="h-[35px] rounded-[4px] border border-[#ccc] bg-white px-[13px] text-[14px] text-[#333] hover:bg-[#eee]"
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
    <div className="reorder-report-page min-h-full overflow-y-auto bg-[#f7f9fc] text-slate-900">
      <style>{`
        .reorder-report-print { display: none; }
        @media print {
          @page { margin: 10mm; }
          body * { visibility: hidden !important; }
          .reorder-report-print, .reorder-report-print * { visibility: visible !important; }
          .reorder-report-print { display: block !important; position: absolute; inset: 0; width: 100%; color: #000; background: #fff; font-family: Arial, sans-serif; }
          .reorder-report-print table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .reorder-report-print th, .reorder-report-print td { border: 1px solid #777; padding: 5px; text-align: center; }
          .reorder-report-print th { font-weight: 600; }
        }
      `}</style>
      <div className="mx-auto w-full max-w-none p-4 lg:p-6 print:hidden">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><span>Purchasing</span><span>›</span><span>Reports</span><span>›</span><span className="text-slate-700">Reorder Report</span></div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#173c83]">Reorder Report</h1>
            <p className="mt-1 text-sm text-slate-500">Items that need to be reordered. (Current Stock + Receiving Qty is below Reorder Level)</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setGeneratedAt(null)} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Back to Filter</button>
            <button type="button" onClick={() => void handlePrint()} disabled={preparingPrint} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              {preparingPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print
            </button>
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
            <div className="flex-1 min-w-[280px]">
              <label htmlFor="reorder-search" className="mb-1 block text-xs font-bold text-slate-700">Search Item / Part No.</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="reorder-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search item or part no..." className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
            <div className="flex items-end gap-2 pt-5">
              <button type="button" onClick={() => { setSearchInput(''); setAppliedSearch(''); void loadReport(1, ''); }} className="rounded-md border border-[#175fd3] bg-white px-5 py-2.5 text-sm font-bold text-[#175fd3] transition hover:bg-blue-50">Reset</button>
              <button type="submit" disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#175fd3] px-6 text-sm font-bold text-white transition hover:bg-[#0e4fb7] disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Search
              </button>
            </div>
          </form>

          <div data-testid="reorder-selection-actions" className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-700">{selectedVisibleCount} item(s) selected</span>
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
              <Info className="h-3.5 w-3.5" /> Items with active purchasing workflow are already in process and cannot be selected.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] border-collapse text-sm">
              <thead>
                <tr>
                  <th rowSpan={2} className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-center text-white"><label className="inline-flex items-center justify-center gap-1"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-white/30 bg-white/10" aria-label="ALL" /> ALL</label></th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-left font-bold uppercase tracking-wide text-white">Item Code</th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-left font-bold uppercase tracking-wide text-white">Part No.</th>
                  <th rowSpan={2} className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-left font-bold uppercase tracking-wide text-white">Description</th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Current<br />Stock</th>
                  <th rowSpan={2} className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Reorder<br />Level</th>
                  <th colSpan={2} className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Recommended Supplier</th>
                  <th colSpan={2} className="border-b border-r border-white/20 bg-orange-500 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">① PR STAGE<br /><span className="text-xs font-normal opacity-90">(Waiting for Approval)</span></th>
                  <th colSpan={2} className="border-b border-r border-white/20 bg-[#175fd3] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">② PO STAGE<br /><span className="text-xs font-normal opacity-90">(Ordered from Supplier)</span></th>
                  <th colSpan={2} className="border-b border-r border-white/20 bg-purple-700 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">③ RECEIVING STOCK<br /><span className="text-xs font-normal opacity-90">(Incoming to Warehouse)</span></th>
                  <th rowSpan={2} className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Recommended<br />Action</th>
                </tr>
                <tr>
                  <th className="border-b border-slate-200 bg-[#102f76] px-3 py-3 text-left font-bold uppercase tracking-wide text-white">Supplier</th>
                  <th className="border-b border-r border-slate-200 bg-[#102f76] px-3 py-3 text-right font-bold uppercase tracking-wide text-white">Cost (P)</th>
                  <th className="border-b border-r border-white/20 bg-orange-500 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">PR #</th>
                  <th className="border-b border-r border-white/20 bg-orange-500 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">PR Qty</th>
                  <th className="border-b border-r border-white/20 bg-[#175fd3] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">PO #</th>
                  <th className="border-b border-r border-white/20 bg-[#175fd3] px-3 py-3 text-center font-bold uppercase tracking-wide text-white">PO Qty</th>
                  <th className="border-b border-r border-white/20 bg-purple-700 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Receiving #</th>
                  <th className="border-b border-r border-white/20 bg-purple-700 px-3 py-3 text-center font-bold uppercase tracking-wide text-white">Receiving Qty</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={15} className="px-4 py-16 text-center text-sm text-slate-500">No items match the current filters.</td></tr>
                ) : rows.map((row) => {
                  const active = isReorderWorkflowActive(row);
                  const isForReceiving = active && row.po_refno && !row.rr_refno;
                  const isForPo = active && row.pr_refno && !row.po_refno;
                  const actionLabel = isForReceiving ? 'For Receiving' : isForPo ? 'For PO' : 'For PR';
                  const actionColor = isForReceiving ? 'text-purple-700' : isForPo ? 'text-[#175fd3]' : 'text-orange-600';
                  return (
                    <tr key={row.id} className={`border-b border-slate-100 hover:bg-slate-50 ${active ? 'opacity-70' : ''}`}>
                      <td className="border-r border-slate-100 px-3 py-3 text-center">
                        <input type="checkbox" aria-label={`Select ${row.item_code}`} checked={selectedIds.has(row.id)} disabled={active} title={active ? 'This item already has an active purchasing workflow' : 'Select item'} onChange={() => toggleSelectRow(row.id)} className="h-4 w-4 rounded border-slate-300" />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-600">{row.item_code}</td>
                      <td className="px-3 py-3 font-semibold text-[#173c83]">{row.part_no}</td>
                      <td className="border-r border-slate-100 px-3 py-3 font-semibold">{row.description}</td>
                      <td className="px-3 py-3 text-center font-bold text-rose-600">{row.current_stock}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-bold text-[#173c83]">{isWh1Report ? row.replenish_qty : row.reorder_qty}</td>
                      <td className="px-3 py-3 font-semibold">-</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-right font-semibold">-</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center">{renderPrLink(row)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-semibold text-orange-600">{row.pr_refno ? '-' : ''}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center">{renderPoLink(row)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-semibold text-[#175fd3]">{row.po_refno ? '-' : ''}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center">{renderRrLink(row)}</td>
                      <td className="border-r border-slate-100 px-3 py-3 text-center font-semibold text-purple-700">{row.rr_refno ? '-' : ''}</td>
                      <td className="px-3 py-3 text-center font-bold">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${actionColor}`}>
                          <ShoppingCart className="h-4 w-4" /> {actionLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
            <tr><th rowSpan={2}>ITEM CODE</th><th rowSpan={2}>PART NO.</th><th rowSpan={2}>DESCRIPTION</th><th rowSpan={2}>CURRENT STOCK</th><th rowSpan={2}>REORDER LEVEL</th><th colSpan={2}>RECOMMENDED SUPPLIER</th><th colSpan={2}>① PR STAGE</th><th colSpan={2}>② PO STAGE</th><th colSpan={2}>③ RECEIVING STOCK</th></tr>
            <tr><th>SUPPLIER</th><th>COST (P)</th><th>PR #</th><th>PR QTY</th><th>PO #</th><th>PO QTY</th><th>RECEIVING #</th><th>RECEIVING QTY</th></tr>
          </thead>
          <tbody>{(printRows.length > 0 ? printRows : rows).map((row) => <tr key={`print-${row.product_session}`}><td>{row.item_code}</td><td>{row.part_no}</td><td>{row.description}</td><td>{row.current_stock}</td><td>{isWh1Report ? row.replenish_qty : row.reorder_qty}</td><td>-</td><td>-</td><td>{row.pr_no || row.pr_refno || '-'}</td><td>{row.pr_refno ? '-' : ''}</td><td>{row.po_no || row.po_refno || '-'}</td><td>{row.po_refno ? '-' : ''}</td><td>{row.rr_no || row.rr_refno || '-'}</td><td>{row.rr_refno ? '-' : ''}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};

export default ReorderReport;
