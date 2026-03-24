import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, EyeOff, Loader2, Package, Printer, RotateCcw, Search, ShoppingCart } from 'lucide-react';
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

const ReorderReport: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<ReorderReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [warehouseType, setWarehouseType] = useState<ReorderWarehouseType>('total');
  const [hideZeroReorder, setHideZeroReorder] = useState(false);
  const [hideZeroReplenish, setHideZeroReplenish] = useState(false);
  const [showHiddenItems, setShowHiddenItems] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddPrModal, setShowAddPrModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'hide' | 'restore' | null>(null);
  const selectedWarehouseLabel = REORDER_WAREHOUSE_OPTIONS.find((option) => option.id === warehouseType)?.label || 'Total Company';

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReorderReportEntries({
        warehouseType,
        search: debouncedSearch,
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
  }, [addToast, warehouseType, debouncedSearch, hideZeroReorder, hideZeroReplenish, showHiddenItems]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

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

  const exportCsv = () => {
    const headers = [
      'Item Code',
      'Part No',
      'Description',
      'Last Date',
      'Last Qty',
      'Bal Qty',
      'Total RR',
      'Total Return',
      warehouseType === 'total' ? 'Reorder Qty' : 'Replenish Qty',
      'PR',
      'PO',
      'RR',
    ];
    const escape = (value: unknown) => {
      const text = String(value ?? '');
      return text.includes(',') || text.includes('"') || text.includes('\n')
        ? `"${text.replace(/"/g, '""')}"`
        : text;
    };
    const body = rows.map((row) =>
      [
        row.item_code,
        row.part_no,
        row.description,
        row.last_arrival_date,
        row.last_arrival_qty,
        row.current_stock,
        row.total_rr,
        row.total_return,
        row.target_quantity,
        row.pr_no,
        row.po_no,
        row.rr_no,
      ]
        .map(escape)
        .join(',')
    );
    const csv = [headers.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reorder-report-${warehouseType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 p-6 dark:bg-slate-950">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
            <Package className="h-6 w-6 text-blue-600" />
            Reorder Quantity Report
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {selectedWarehouseLabel} • {rows.length} item(s)
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Warehouse Type</label>
          <select
            value={warehouseType}
            onChange={(e) => setWarehouseType(e.target.value as ReorderWarehouseType)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {REORDER_WAREHOUSE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Item code, part no, description"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {loading ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={16} />
            ) : null}
          </div>
        </div>
        <label className="flex items-center gap-2 self-end text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={hideZeroReorder}
            onChange={(e) => setHideZeroReorder(e.target.checked)}
          />
          Hide zero reorder qty
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={hideZeroReplenish}
            onChange={(e) => setHideZeroReplenish(e.target.checked)}
          />
          Hide zero replenish qty
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showHiddenItems}
            onChange={(e) => setShowHiddenItems(e.target.checked)}
          />
          Show hidden items
        </label>
      </div>

      <div className="mb-3 flex items-center gap-2 print:hidden">
        <button
          onClick={() => setConfirmAction('hide')}
          disabled={selectedVisibleCount === 0 || processing}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
          Mark as Hidden
        </button>
        <button
          onClick={() => setConfirmAction('restore')}
          disabled={selectedHiddenCount === 0 || processing}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Restore Hidden
        </button>
        <button
          onClick={() => setShowAddPrModal(true)}
          disabled={selectedVisibleCount === 0 || processing}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <ShoppingCart className="h-4 w-4" />
          Add to PR
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
            <tr className="text-xs uppercase text-slate-600 dark:text-slate-300">
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              </th>
              <th className="px-3 py-2 text-left">Item Code</th>
              <th className="px-3 py-2 text-left">Part No</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-center">Last Date</th>
              <th className="px-3 py-2 text-center">Last Qty</th>
              <th className="px-3 py-2 text-center">Bal Qty</th>
              <th className="px-3 py-2 text-center">RR Qty</th>
              <th className="px-3 py-2 text-center">Return</th>
              <th className="px-3 py-2 text-center">{warehouseType === 'total' ? 'Reorder Qty' : 'Replenish Qty'}</th>
              <th className="px-3 py-2 text-center">PR</th>
              <th className="px-3 py-2 text-center">PO</th>
              <th className="px-3 py-2 text-center">RR</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-3">
                    <CustomLoadingSpinner label="Loading" />
                    <span>Refreshing reorder report...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-slate-500">
                  No items matched the current reorder filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-slate-100 dark:border-slate-800 ${row.is_hidden ? 'bg-amber-50/60 dark:bg-amber-950/10' : ''}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelectRow(row.id)}
                    />
                  </td>
                  <td className="px-3 py-2">{row.item_code}</td>
                  <td className="px-3 py-2">{row.part_no}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{row.description}</span>
                      {row.is_hidden ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          <Eye className="h-3 w-3" />
                          Hidden
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">{row.last_arrival_date ? String(row.last_arrival_date).slice(0, 10) : ''}</td>
                  <td className="px-3 py-2 text-center">{row.last_arrival_qty}</td>
                  <td className="px-3 py-2 text-center">{row.current_stock}</td>
                  <td className="px-3 py-2 text-center">{row.total_rr}</td>
                  <td className="px-3 py-2 text-center">{row.total_return}</td>
                  <td className="px-3 py-2 text-center font-semibold">{row.target_quantity}</td>
                  <td className="px-3 py-2 text-center">
                    {row.pr_refno ? (
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() =>
                          navigateToModule('warehouse-purchasing-purchase-request', { prId: row.pr_refno })
                        }
                      >
                        {row.pr_no || row.pr_refno}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.po_refno ? (
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() =>
                          navigateToModule('warehouse-purchasing-purchase-order', {
                            poId: row.po_refno,
                            poRefNo: row.po_no,
                          })
                        }
                      >
                        {row.po_no || row.po_refno}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.rr_refno ? (
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() =>
                          navigateToModule('warehouse-purchasing-receiving-stock', {
                            rrId: row.rr_refno,
                            rrRefNo: row.rr_no,
                          })
                        }
                      >
                        {row.rr_no || row.rr_refno}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
