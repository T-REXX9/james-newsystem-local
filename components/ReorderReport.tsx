import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EyeOff, Loader2, Printer, Search, ShoppingCart } from 'lucide-react';
import { purchaseRequestService } from '../services/purchaseRequestService';
import {
  fetchReorderReportEntries,
  hideReorderReportItems,
  REORDER_WAREHOUSE_OPTIONS,
  ReorderReportEntry,
  ReorderWarehouseType,
} from '../services/reorderReportService';
import { useToast } from './ToastProvider';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import ConfirmModal from './ConfirmModal';

interface AddToPrModalProps {
  items: ReorderReportEntry[];
  onClose: () => void;
  onSaved: () => void;
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
      const selectedSupplier = suppliers.find((row) => row.id === supplierId);
      const supplierName = selectedSupplier?.company || '';
      const prItems = mapItemsForPR(supplierId, supplierName);

      if (mode === 'new') {
        const prNumber = await purchaseRequestService.generatePRNumber();
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
      onSaved();
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
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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

const tableCellClass = 'border border-[#d9d9d9] px-3 py-[26px] text-center text-[18px] leading-[27px] text-[#333]';
const tableHeadClass = 'border border-[#d9d9d9] border-b-[3px] border-b-[#333] bg-white px-3 py-[18px] text-center text-[18px] font-semibold uppercase leading-[27px] text-[#333]';
const reorderOptionWarehouses = REORDER_WAREHOUSE_OPTIONS.filter((option) => option.id === 'total' || option.id === 'wh1');

const formatShortDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
};

const formatReportDate = (date: Date): string => {
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
};

const ReorderReport: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<ReorderReportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const [warehouseType, setWarehouseType] = useState<ReorderWarehouseType>('total');
  const [hideZeroReorder, setHideZeroReorder] = useState(false);
  const [hideZeroReplenish, setHideZeroReplenish] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddPrModal, setShowAddPrModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'hide' | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, per_page: 10, total: 0, total_pages: 1 });
  const [printRows, setPrintRows] = useState<ReorderReportEntry[]>([]);
  const isWh1Report = warehouseType === 'wh1';

  const loadReport = useCallback(async (targetPage = 1, targetSearch = '') => {
    setLoading(true);
    try {
      const data = await fetchReorderReportEntries({
        warehouseType,
        search: targetSearch,
        hideZeroReorder,
        hideZeroReplenish,
        showHidden: false,
        page: targetPage,
        perPage: 10,
      });
      setRows(data.items);
      setMeta(data.meta);
      setPage(data.meta.page);
      setSelectedIds(new Set());
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Unable to load reorder report',
        description: String(err?.message || 'Request failed'),
        durationMs: 6000,
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, warehouseType, hideZeroReorder, hideZeroReplenish]);

  const handleGenerateReport = async () => {
    setSearchInput('');
    setAppliedSearch('');
    await loadReport(1, '');
    setGeneratedAt(new Date());
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextSearch = searchInput.trim();
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

  const changePage = async (nextPage: number) => {
    if (nextPage < 1 || nextPage > meta.total_pages || loading) return;
    await loadReport(nextPage, appliedSearch);
  };

  const handlePrint = async () => {
    setPreparingPrint(true);
    try {
      const first = await fetchReorderReportEntries({
        warehouseType,
        search: appliedSearch,
        hideZeroReorder,
        hideZeroReplenish,
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

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.id)),
    [rows, selectedIds]
  );

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((row) => row.id)));
  };

  const toggleSelectRow = (id: string) => {
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
      await loadReport(page, appliedSearch);
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

  const navigateToModule = (tab: string, payload?: Record<string, string>) => {
    window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab, payload } }));
  };

  const reportTitle = 'TOTAL COMPANY REORDER REPORT';
  const dateLabel = generatedAt ? formatReportDate(generatedAt) : '';

  const renderPrLink = (row: ReorderReportEntry) => row.pr_refno ? (
    <button
      type="button"
      className="text-brand-blue hover:underline"
      onClick={() => navigateToModule('warehouse-purchasing-purchase-request', { prId: row.pr_refno })}
    >
      {row.pr_no || row.pr_refno}
    </button>
  ) : null;

  const renderPoLink = (row: ReorderReportEntry) => row.po_refno ? (
    <button
      type="button"
      className="text-brand-blue hover:underline"
      onClick={() =>
        navigateToModule('warehouse-purchasing-purchase-order', {
          poId: row.po_refno,
          poRefNo: row.po_no,
        })
      }
    >
      {row.po_no || row.po_refno}
    </button>
  ) : null;

  const renderRrLink = (row: ReorderReportEntry) => row.rr_refno ? (
    <button
      type="button"
      className="text-brand-blue hover:underline"
      onClick={() =>
        navigateToModule('warehouse-purchasing-receiving-stock', {
          rrId: row.rr_refno,
          rrRefNo: row.rr_no,
        })
      }
    >
      {row.rr_no || row.rr_refno}
    </button>
  ) : null;

  if (!generatedAt) {
    return (
      <div className="min-h-full overflow-auto bg-[#f4f4f4] px-5 py-10 text-[#222]" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="mx-auto min-h-[363px] w-full max-w-[1140px] rounded-[5px] border border-[#d7d7d7] bg-white">
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
              <div className="grid grid-cols-[155px_435px] items-center gap-[30px] max-md:grid-cols-[135px_minmax(0,1fr)]">
                <label className="text-right font-semibold text-[#222]">
                  Warehouse <span className="text-rose-600">*</span>
                </label>
                <select
                  value={warehouseType}
                  onChange={(event) => setWarehouseType(event.target.value as ReorderWarehouseType)}
                  className="h-[35px] w-full rounded-[3px] border border-[#c9c9c9] bg-white px-4 text-[13px] text-[#555] outline-none"
                >
                  {reorderOptionWarehouses.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 grid grid-cols-[155px_435px] gap-[30px] max-md:grid-cols-[135px_minmax(0,1fr)]">
                <span />
                <div className="space-y-[7px] text-[#222]">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={hideZeroReorder}
                      onChange={(event) => setHideZeroReorder(event.target.checked)}
                      className="h-[13px] w-[13px] accent-[#555]"
                    />
                    Don't show zero Re-Order QTY
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={hideZeroReplenish}
                      onChange={(event) => setHideZeroReplenish(event.target.checked)}
                      className="h-[13px] w-[13px] accent-[#555]"
                    />
                    Don't show zero Replenish QTY
                  </label>
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
                      setWarehouseType('total');
                      setHideZeroReorder(false);
                      setHideZeroReplenish(false);
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
    <div className="reorder-report-page min-h-full overflow-auto bg-[#f4f4f4] px-5 py-[62px] text-[#222]" style={{ fontFamily: 'Arial, sans-serif' }}>
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
      <div className="mx-auto w-[90%] max-w-[1800px] rounded-[5px] border border-[#d7d7d7] bg-white print:hidden">
        <div className="flex min-h-[99px] items-center justify-between border-b border-[#d7d7d7] px-[32px]">
          <h1 className="relative flex h-full min-h-[99px] items-center text-[24px] font-semibold text-[#29475f] after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-[350px] after:bg-[#6a92b3]" style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}>
            REORDER QUANTITY REPORT
          </h1>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setGeneratedAt(null)}
              className="h-[48px] rounded-[4px] bg-[#4caf50] px-[18px] text-[18px] text-white hover:bg-[#43a047]"
            >
              ↶ BACK
            </button>
            <button
              type="button"
              onClick={() => void handlePrint()}
              disabled={preparingPrint}
              className="inline-flex h-[48px] items-center gap-2 rounded-[4px] bg-[#5d82a2] px-[18px] text-[18px] text-white hover:bg-[#4e7392]"
            >
              {preparingPrint ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
              {preparingPrint ? 'PREPARING' : 'PRINT'}
            </button>
          </div>
        </div>

        <div className="px-[40px] pb-[40px] pt-[50px]">
          <div className="mb-[25px] text-center text-[#222]">
            <p className="text-[26px] font-bold">{reportTitle}</p>
            <p className="mt-2 text-[19px] font-bold">AS OF {dateLabel}</p>
          </div>

          <form onSubmit={handleSearch} className="mb-[25px] flex items-center justify-end gap-3 text-[17px]">
            <label htmlFor="reorder-search">Search:</label>
            <input id="reorder-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="h-[48px] w-[320px] rounded-[4px] border border-[#ccc] px-3 outline-none focus:border-[#777]" />
          </form>

          {rows.length === 0 ? (
            <div className="py-20 text-center">
              <h3 className="text-lg font-semibold text-slate-500 dark:text-slate-400">Empty!</h3>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1120px] border-collapse">
                <thead>
                  <tr>
                    <th className={tableHeadClass}>
                      <label className="inline-flex items-center justify-center gap-1">
                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                        ALL
                      </label>
                    </th>
                    <th className={tableHeadClass}>ITEM CODE</th>
                    <th className={tableHeadClass}>PART NO.</th>
                    <th className={tableHeadClass}>DESCRIPTION</th>
                    <th className={tableHeadClass}>{isWh1Report ? 'TRANS DATE' : 'RR DATE'}</th>
                    <th className={tableHeadClass}>{isWh1Report ? 'TRANS QTY' : 'LAST ARRIVAL'}</th>
                    <th className={tableHeadClass}>BAL QTY</th>
                    <th className={tableHeadClass}>{isWh1Report ? 'RR QTY' : 'LAST RR'}</th>
                    <th className={tableHeadClass}>RETURN</th>
                    <th className={tableHeadClass}>{isWh1Report ? 'REPLENISH QTY' : 'RE-ORDER QTY'}</th>
                    <th className={tableHeadClass}>PR</th>
                    <th className={tableHeadClass}>PO</th>
                    <th className={tableHeadClass}>RR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="odd:bg-white even:bg-[#f8f8f8] hover:bg-[#f5f5f5]"
                    >
                      <td className={tableCellClass}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelectRow(row.id)}
                        />
                      </td>
                      <td className={tableCellClass}>{row.item_code}</td>
                      <td className={tableCellClass}>{row.part_no}</td>
                      <td className={`${tableCellClass} text-left`}>
                        <span>{row.description}</span>
                      </td>
                      <td className={tableCellClass}>{formatShortDate(row.last_arrival_date)}</td>
                      <td className={tableCellClass}>{row.last_arrival_qty}</td>
                      <td className={tableCellClass}>{row.current_stock}</td>
                      <td className={tableCellClass}>{row.total_rr}</td>
                      <td className={tableCellClass}>{row.total_return}</td>
                      <td className={`${tableCellClass} font-semibold`}>{isWh1Report ? row.replenish_qty : row.reorder_qty}</td>
                      <td className={tableCellClass}>{renderPrLink(row)}</td>
                      <td className={tableCellClass}>{renderPoLink(row)}</td>
                      <td className={tableCellClass}>{renderRrLink(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta.total > 0 ? (
            <div className="mt-4 flex items-center justify-between text-[13px] text-[#555]">
              <span>Showing {(meta.page - 1) * meta.per_page + 1} to {Math.min(meta.page * meta.per_page, meta.total)} of {meta.total} entries</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => void changePage(page - 1)} className="rounded border border-[#ccc] px-3 py-1.5 disabled:opacity-40">Previous</button>
                <span>Page {page} of {Math.max(1, meta.total_pages)}</span>
                <button type="button" disabled={page >= meta.total_pages || loading} onClick={() => void changePage(page + 1)} className="rounded border border-[#ccc] px-3 py-1.5 disabled:opacity-40">Next</button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction('hide')}
              disabled={selectedVisibleCount === 0 || processing}
              className="inline-flex items-center gap-2 rounded bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
              Mark as Hidden
            </button>
            <button
              type="button"
              onClick={() => setShowAddPrModal(true)}
              disabled={selectedVisibleCount === 0 || processing}
              className="inline-flex items-center gap-2 rounded bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to PR
            </button>
          </div>
        </div>
      </div>

      {showAddPrModal && selectedRows.length > 0 ? (
        <AddToPrModal
          items={selectedRows}
          onClose={() => setShowAddPrModal(false)}
          onSaved={() => {
            setShowAddPrModal(false);
            setSelectedIds(new Set());
            void loadReport(page, appliedSearch);
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
            <tr><th colSpan={3} /><th colSpan={2}>{isWh1Report ? 'LAST TRANSFER' : 'LAST ARRIVAL'}</th><th>BAL</th><th>TOTAL</th><th>TOTAL</th><th>{isWh1Report ? 'REPLENISH' : 'REORDER'}</th></tr>
            <tr><th>ITEM CODE</th><th>PART NO.</th><th>DESCRIPTION</th><th>DATE</th><th>QTY</th><th>QTY</th><th>RR</th><th>RETURN</th><th>QTY</th></tr>
          </thead>
          <tbody>{(printRows.length > 0 ? printRows : rows).map((row) => <tr key={`print-${row.product_session}`}><td>{row.item_code}</td><td>{row.part_no}</td><td>{row.description}</td><td>{formatShortDate(row.last_arrival_date)}</td><td>{row.last_arrival_qty}</td><td>{row.current_stock}</td><td>{row.total_rr}</td><td>{row.total_return}</td><td>{isWh1Report ? row.replenish_qty : row.reorder_qty}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};

export default ReorderReport;
