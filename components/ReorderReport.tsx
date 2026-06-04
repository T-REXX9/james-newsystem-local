import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Printer, RotateCcw, Search, ShoppingCart } from 'lucide-react';
import { purchaseRequestService } from '../services/purchaseRequestService';
import {
  fetchReorderReportEntries,
  hideReorderReportItems,
  restoreReorderReportItems,
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

const tableCellClass = 'border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center text-xs text-slate-700 dark:text-slate-200 print:border-gray-500 print:text-black';
const tableHeadClass = 'border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-1.5 text-center text-xs font-semibold uppercase text-slate-700 dark:text-slate-200 print:border-gray-500 print:bg-gray-100 print:text-black';
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

const ReorderReport: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<ReorderReportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [warehouseType, setWarehouseType] = useState<ReorderWarehouseType>('total');
  const [hideZeroReorder, setHideZeroReorder] = useState(false);
  const [hideZeroReplenish, setHideZeroReplenish] = useState(false);
  const [showHiddenItems, setShowHiddenItems] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddPrModal, setShowAddPrModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'hide' | 'restore' | null>(null);
  const selectedWarehouseLabel = REORDER_WAREHOUSE_OPTIONS.find((option) => option.id === warehouseType)?.label || 'Total Company';
  const isWh1Report = warehouseType === 'wh1';

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReorderReportEntries({
        warehouseType,
        search: '',
        hideZeroReorder,
        hideZeroReplenish,
        showHidden: showHiddenItems,
        page: 1,
        perPage: 200,
      });
      setRows(data.items);
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
  }, [addToast, warehouseType, hideZeroReorder, hideZeroReplenish, showHiddenItems]);

  const handleGenerateReport = async () => {
    await loadReport();
    setGeneratedAt(new Date());
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

  const selectedHiddenCount = useMemo(
    () => selectedRows.filter((row) => row.is_hidden).length,
    [selectedRows]
  );

  const selectedVisibleCount = selectedRows.length - selectedHiddenCount;

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
      await loadReport();
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

  const handleRestoreHidden = async () => {
    if (selectedIds.size === 0) return;

    setProcessing(true);
    try {
      const restoredCount = await restoreReorderReportItems(Array.from(selectedIds));
      addToast({
        type: 'success',
        title: 'Items restored',
        description: `${restoredCount} item(s) restored successfully.`,
        durationMs: 4000,
      });
      await loadReport();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed to restore items',
        description: String(err?.message || 'Unable to restore selected items.'),
        durationMs: 6000,
      });
    } finally {
      setProcessing(false);
    }
  };

  const navigateToModule = (tab: string, payload?: Record<string, string>) => {
    window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab, payload } }));
  };

  const reportTitle = `${selectedWarehouseLabel.toUpperCase()} REORDER REPORT`;
  const dateLabel = generatedAt
    ? generatedAt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: '2-digit' }).toUpperCase()
    : '';

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
      <div className="h-full overflow-auto bg-slate-100 p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl rounded border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h1 className="text-base font-semibold uppercase text-slate-800 dark:text-slate-100">
              Reorder Report
            </h1>
          </div>

          <div className="px-5 py-5">
            <p className="mb-8 text-sm text-slate-600 dark:text-slate-400">
              Field mark with (<span className="text-rose-600">*</span>) is required. Press generate after you select the sorting options
            </p>

            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="pt-2 text-left font-medium text-slate-700 dark:text-slate-300 md:text-right">
                  Warehouse <span className="text-rose-600">*</span>
                </label>
                <select
                  value={warehouseType}
                  onChange={(event) => setWarehouseType(event.target.value as ReorderWarehouseType)}
                  className="w-full max-w-xl rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {reorderOptionWarehouses.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <span />
                <div className="space-y-2 text-slate-700 dark:text-slate-200">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hideZeroReorder}
                      onChange={(event) => setHideZeroReorder(event.target.checked)}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    Don't show zero Re-Order QTY
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hideZeroReplenish}
                      onChange={(event) => setHideZeroReplenish(event.target.checked)}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    Don't show zero Replenish QTY
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showHiddenItems}
                      onChange={(event) => setShowHiddenItems(event.target.checked)}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    Show hidden items
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-2 md:grid-cols-[220px_minmax(0,1fr)]">
                <span />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded bg-brand-blue px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
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
                      setShowHiddenItems(false);
                    }}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <h1 className="text-base font-semibold uppercase text-slate-800 dark:text-slate-100">
            REORDER QUANTITY REPORT
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setGeneratedAt(null)}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              BACK
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              <Printer className="h-4 w-4" />
              PRINT
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-5 text-center text-slate-800 dark:text-slate-100 print:text-black">
            <p className="text-lg font-semibold">{reportTitle}</p>
            <p className="-mt-1 text-sm font-semibold">AS OF {dateLabel}</p>
          </div>

          {rows.length === 0 ? (
            <div className="py-20 text-center">
              <h3 className="text-lg font-semibold text-slate-500 dark:text-slate-400">Empty!</h3>
            </div>
          ) : (
            <div className="overflow-auto print:overflow-visible">
              <table className="w-full min-w-[1120px] border-collapse text-sm print:min-w-0">
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
                      className={`${row.is_hidden ? 'bg-amber-50/60 dark:bg-amber-950/10' : ''}`}
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
                        {row.is_hidden ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            <Eye className="h-3 w-3" />
                            Hidden
                          </span>
                        ) : null}
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

          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setConfirmAction('hide')}
              disabled={selectedVisibleCount === 0 || processing}
              className="inline-flex items-center gap-2 rounded bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
              Mark as Hidden
            </button>
            {showHiddenItems ? (
              <button
                type="button"
                onClick={() => setConfirmAction('restore')}
                disabled={selectedHiddenCount === 0 || processing}
                className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Restore Hidden
              </button>
            ) : null}
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
            void loadReport();
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

      <ConfirmModal
        isOpen={confirmAction === 'restore'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleRestoreHidden}
        title="Restore Hidden Items"
        message={`Restore ${selectedHiddenCount} selected hidden item(s) back into the active reorder report list?`}
        confirmLabel="Restore"
        variant="success"
      />
    </div>
  );
};

export default ReorderReport;
