import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { useToast } from './ToastProvider';
import {
  createInventoryAuditStockAdjustment,
  deleteInventoryAuditItem,
  deleteInventoryAuditStockAdjustment,
  fetchInventoryAuditHeaders,
  fetchInventoryAuditStockDetail,
  postInventoryAuditStockAdjustment,
  saveInventoryAuditCounts,
  updateInventoryAuditDate,
  type InventoryAuditCountEntry,
  type InventoryAuditHeader,
  type InventoryAuditStockDetail,
  type InventoryAuditStockItem,
} from '../services/inventoryAuditService';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatLegacyDate = (value?: string | null): string => {
  if (!value) return '';
  const [datePart] = String(value).split('T');
  const [year, month, day] = datePart.split('-');
  return year && month && day ? `${month}/${day}/${year}` : value;
};

const formatNumber = (value: number, decimals = 2): string =>
  Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

type CountDraft = { physical: string; remarks: string };

const InventoryAuditReport: React.FC = () => {
  const { addToast } = useToast();
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [headers, setHeaders] = useState<InventoryAuditHeader[]>([]);
  const [selectedRefno, setSelectedRefno] = useState('');
  const [detail, setDetail] = useState<InventoryAuditStockDetail | null>(null);
  const [isLoadingHeaders, setIsLoadingHeaders] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [partNoInput, setPartNoInput] = useState('');
  const [itemCodeInput, setItemCodeInput] = useState('');
  const [appliedPartNo, setAppliedPartNo] = useState('');
  const [appliedItemCode, setAppliedItemCode] = useState('');
  const [page, setPage] = useState(1);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDateEditor, setShowDateEditor] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [editingPartNo, setEditingPartNo] = useState('');
  const [modalItems, setModalItems] = useState<InventoryAuditStockItem[]>([]);
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [countDrafts, setCountDrafts] = useState<Record<string, CountDraft>>({});
  const [printItems, setPrintItems] = useState<InventoryAuditStockItem[]>([]);

  const loadHeaders = useCallback(async (preferredRefno?: string) => {
    setIsLoadingHeaders(true);
    try {
      const rows = await fetchInventoryAuditHeaders(filterMonth, filterYear);
      setHeaders(rows);
      setSelectedRefno((current) => {
        const preferred = preferredRefno || current;
        if (preferred && rows.some((row) => row.refno === preferred)) return preferred;
        return rows[0]?.refno || '';
      });
    } catch (error) {
      console.error('Unable to load stock adjustments:', error);
      setHeaders([]);
      setSelectedRefno('');
      addToast({ type: 'error', title: 'Unable to load inventory audits', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoadingHeaders(false);
    }
  }, [addToast, filterMonth, filterYear]);

  const loadDetail = useCallback(async () => {
    if (!selectedRefno) {
      setDetail(null);
      return;
    }
    setIsLoadingDetail(true);
    try {
      const data = await fetchInventoryAuditStockDetail(selectedRefno, {
        partNo: appliedPartNo,
        itemCode: appliedItemCode,
        page,
        perPage: 100,
      });
      setDetail(data);
      setDateDraft(data.header.adjustmentDate);
    } catch (error) {
      console.error('Unable to load stock adjustment detail:', error);
      setDetail(null);
      addToast({ type: 'error', title: 'Unable to load adjustment', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoadingDetail(false);
    }
  }, [addToast, appliedItemCode, appliedPartNo, page, selectedRefno]);

  useEffect(() => {
    void loadHeaders();
  }, [loadHeaders]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const isPending = detail?.header.status.toLowerCase() === 'pending';

  const summary = useMemo(() => {
    return (detail?.items || []).reduce(
      (totals, item) => ({
        inventoryValue: totals.inventoryValue + item.inventoryValue,
        missing: totals.missing + (item.totalMissing < 0 ? item.totalMissing : 0),
        missingValue: totals.missingValue + (item.totalMissing < 0 ? item.missingValue : 0),
      }),
      { inventoryValue: 0, missing: 0, missingValue: 0 }
    );
  }, [detail]);

  const handleCreateNew = async () => {
    setIsSaving(true);
    try {
      const created = await createInventoryAuditStockAdjustment();
      const createdDate = new Date(`${created.adjustmentDate}T00:00:00`);
      setFilterMonth(createdDate.getMonth() + 1);
      setFilterYear(createdDate.getFullYear());
      setHeaders((current) => [created, ...current.filter((row) => row.refno !== created.refno)]);
      setSelectedRefno(created.refno);
      setAppliedPartNo('');
      setAppliedItemCode('');
      setPartNoInput('');
      setItemCodeInput('');
      setPage(1);
      addToast({ type: 'success', title: 'Stock adjustment created', description: `${created.adjustmentNo} is ready for physical counts.` });
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to create adjustment', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedPartNo(partNoInput.trim());
    setAppliedItemCode(itemCodeInput.trim());
  };

  const handleRefresh = () => {
    setPartNoInput('');
    setItemCodeInput('');
    setAppliedPartNo('');
    setAppliedItemCode('');
    setPage(1);
  };

  const openCountEditor = async (partNo: string) => {
    if (!detail) return;
    setEditingPartNo(partNo);
    setIsLoadingModal(true);
    try {
      const data = await fetchInventoryAuditStockDetail(detail.header.refno, { partNo, page: 1, perPage: 250 });
      const rows = data.items.filter((item) => item.partNo === partNo);
      const drafts: Record<string, CountDraft> = {};
      rows.forEach((item) => item.warehouses.forEach((warehouse) => {
        drafts[`${item.itemSession}::${warehouse.warehouse}`] = {
          physical: warehouse.physicalCount === null ? '' : String(warehouse.physicalCount),
          remarks: warehouse.remarks,
        };
      }));
      setModalItems(rows);
      setCountDrafts(drafts);
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to open physical counts', description: error instanceof Error ? error.message : 'Please try again.' });
      setEditingPartNo('');
    } finally {
      setIsLoadingModal(false);
    }
  };

  const closeCountEditor = () => {
    if (isSaving) return;
    setEditingPartNo('');
    setModalItems([]);
    setCountDrafts({});
  };

  const updateDraft = (key: string, field: keyof CountDraft, value: string) => {
    setCountDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] || { physical: '', remarks: '' }), [field]: value },
    }));
  };

  const handleSaveCounts = async () => {
    if (!detail || !isPending) return;
    const entries: InventoryAuditCountEntry[] = [];
    modalItems.forEach((item) => item.warehouses.forEach((warehouse) => {
      const draft = countDrafts[`${item.itemSession}::${warehouse.warehouse}`] || { physical: '', remarks: '' };
      entries.push({
        item_session: item.itemSession,
        warehouse: warehouse.warehouse,
        physical_count: draft.physical.trim() === '' ? null : Number(draft.physical),
        location: warehouse.location,
        remarks: draft.remarks,
      });
    }));
    if (entries.some((entry) => entry.physical_count !== null && !Number.isFinite(entry.physical_count))) {
      addToast({ type: 'warning', title: 'Invalid physical count', description: 'Physical counts must be valid numbers.' });
      return;
    }

    setIsSaving(true);
    try {
      await saveInventoryAuditCounts(detail.header.refno, entries);
      closeCountEditor();
      await Promise.all([loadDetail(), loadHeaders(detail.header.refno)]);
      addToast({ type: 'success', title: 'Physical counts saved', description: 'Inventory balances and discrepancies were updated.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to save counts', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (itemSession: string) => {
    if (!detail || !isPending) return;
    setIsSaving(true);
    try {
      await deleteInventoryAuditItem(detail.header.refno, itemSession);
      closeCountEditor();
      await Promise.all([loadDetail(), loadHeaders(detail.header.refno)]);
      addToast({ type: 'success', title: 'Item adjustment deleted', description: 'The stock change was reversed.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to delete item adjustment', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePost = async () => {
    if (!detail) return;
    setIsSaving(true);
    try {
      await postInventoryAuditStockAdjustment(detail.header.refno);
      setShowPostConfirm(false);
      await Promise.all([loadDetail(), loadHeaders(detail.header.refno)]);
      addToast({ type: 'success', title: 'Adjustment posted', description: 'This SA is now locked from editing and deletion.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to post adjustment', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAdjustment = async () => {
    if (!detail) return;
    setIsSaving(true);
    try {
      await deleteInventoryAuditStockAdjustment(detail.header.refno);
      setShowDeleteConfirm(false);
      setDetail(null);
      setSelectedRefno('');
      await loadHeaders();
      addToast({ type: 'success', title: 'Stock adjustment deleted', description: 'The SA and its inventory changes were removed.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to delete adjustment', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDate = async () => {
    if (!detail || !dateDraft) return;
    setIsSaving(true);
    try {
      await updateInventoryAuditDate(detail.header.refno, dateDraft);
      setShowDateEditor(false);
      await Promise.all([loadDetail(), loadHeaders(detail.header.refno)]);
      addToast({ type: 'success', title: 'Adjustment date updated', description: 'The SA and inventory log dates now match.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to update date', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const loadAllVisibleItems = async (): Promise<InventoryAuditStockItem[]> => {
    if (!detail) return [];
    const first = await fetchInventoryAuditStockDetail(detail.header.refno, { partNo: appliedPartNo, itemCode: appliedItemCode, page: 1, perPage: 250 });
    if (first.meta.totalPages <= 1) return first.items;
    const remaining = await Promise.all(
      Array.from({ length: first.meta.totalPages - 1 }, (_, index) =>
        fetchInventoryAuditStockDetail(detail.header.refno, { partNo: appliedPartNo, itemCode: appliedItemCode, page: index + 2, perPage: 250 })
      )
    );
    return [first.items, ...remaining.map((result) => result.items)].flat();
  };

  const handleExport = async () => {
    if (!detail) return;
    setIsSaving(true);
    try {
      const items = await loadAllVisibleItems();
      const warehouseNames = detail.warehouses;
      const headers = ['Part No.', 'Item Code', 'Description', 'Brand', 'Cost'];
      warehouseNames.forEach((warehouse) => headers.push(`${warehouse} Stock`, `${warehouse} Location`, `${warehouse} Physical Count`, `${warehouse} Discrepancy`));
      headers.push('Total Inventory', 'Inventory Value', 'Total Missing', 'Missing Value');
      const rows = items.map((item) => {
        const row: Array<string | number> = [item.partNo, item.itemCode, item.description, item.brand, item.cost];
        warehouseNames.forEach((warehouseName) => {
          const warehouse = item.warehouses.find((entry) => entry.warehouse === warehouseName);
          row.push(warehouse?.stock ?? 0, warehouse?.location ?? '', warehouse?.physicalCount ?? '', warehouse?.discrepancy ?? '');
        });
        row.push(item.totalInventory, item.inventoryValue, item.totalMissing, item.missingValue);
        return row;
      });
      const escapeCell = (cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = `${detail.header.adjustmentNo}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to export SA', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!detail) return;
    setIsSaving(true);
    try {
      const items = await loadAllVisibleItems();
      setPrintItems(items);
      window.setTimeout(() => window.print(), 150);
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to prepare print view', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const printPartTotals = useMemo(() => {
    const totals = new Map<string, { missing: number; missingValue: number }>();
    printItems.forEach((item) => {
      const current = totals.get(item.partNo) || { missing: 0, missingValue: 0 };
      if (item.totalMissing < 0) {
        current.missing += item.totalMissing;
        current.missingValue += item.missingValue;
      }
      totals.set(item.partNo, current);
    });
    return totals;
  }, [printItems]);

  return (
    <div className="inventory-audit-page min-h-full overflow-y-auto bg-[#f4f4f4] px-5 py-10 text-[#202020] dark:bg-[#f4f4f4] dark:text-[#202020]" style={{ fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        .inventory-audit-scrollbar::-webkit-scrollbar { height: 10px; width: 10px; }
        .inventory-audit-scrollbar::-webkit-scrollbar-track { background: #f4f4f4; }
        .inventory-audit-scrollbar::-webkit-scrollbar-thumb { background: #929292; border-radius: 5px; }
        .inventory-audit-print-area { display: none; }
        @media print {
          @page { size: landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          .inventory-audit-print-area, .inventory-audit-print-area * { visibility: visible !important; }
          .inventory-audit-print-area { display: block !important; position: absolute; inset: 0; width: 1400px; color: #000; background: #fff; font-family: Arial, sans-serif; }
          .inventory-audit-print-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .inventory-audit-print-table th, .inventory-audit-print-table td { border: 1px solid #000; padding: 1px 2px; }
          .inventory-audit-print-table th { text-align: center; font-weight: 400; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1140px] space-y-[26px] print:hidden">
        <section className="overflow-hidden rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex min-h-[82px] flex-col items-center gap-5 border-b border-[#d7d7d7] px-[35px] py-5 sm:flex-row sm:justify-between">
            <button onClick={handleCreateNew} disabled={isSaving} className="rounded-[4px] bg-[#4caf50] px-[14px] py-[9px] text-[14px] text-white hover:bg-[#43a047] disabled:opacity-50">Create New</button>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <span className="mr-3 text-[20px] font-semibold text-[#263f55]">Filter by Month:</span>
              <select value={filterMonth} onChange={(event) => { setFilterMonth(Number(event.target.value)); setSelectedRefno(''); }} className="h-[34px] w-[200px] rounded-[3px] border border-[#cfcfcf] bg-white px-4 text-[13px] outline-none">
                {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
              <input type="number" min="2000" max="2100" value={filterYear} onChange={(event) => { setFilterYear(Number(event.target.value)); setSelectedRefno(''); }} className="h-[34px] w-[100px] rounded-[3px] border border-[#cfcfcf] bg-white px-4 text-[13px] outline-none" />
            </div>
          </div>
          <div className="min-h-[188px] px-[25px] py-[31px]">
            <div className="inventory-audit-scrollbar max-h-[112px] overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <thead><tr className="border-b-2 border-[#d5d5d5] text-left text-[14px] font-semibold"><th className="w-1/3 px-2 pb-2">Date</th><th className="w-1/3 px-2 pb-2">SA No.</th><th className="w-1/3 px-2 pb-2">Status</th></tr></thead>
                <tbody>
                  {isLoadingHeaders ? <tr><td colSpan={3} className="border border-[#d7d7d7] px-2 py-4 text-center text-[#777]">Loading...</td></tr> : headers.length === 0 ? <tr><td colSpan={3} className="border border-[#d7d7d7] px-2 py-5 text-center text-[#888]">No inventory audits found for this month.</td></tr> : headers.map((header) => (
                    <tr key={header.refno} onClick={() => { setSelectedRefno(header.refno); setAppliedPartNo(''); setAppliedItemCode(''); setPartNoInput(''); setItemCodeInput(''); setPage(1); }} className={`cursor-pointer hover:bg-[#f7f7f7] ${selectedRefno === header.refno ? 'bg-[#f7f7f7] text-[#214f77]' : ''}`}>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]">{formatLegacyDate(header.adjustmentDate)}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]"><span className="underline">{header.adjustmentNo}</span></td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]">{header.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="min-h-[213px] overflow-hidden rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex min-h-[63px] items-center justify-between border-b border-[#d7d7d7] px-5">
            <div className="relative flex min-h-[63px] items-center text-[18px] font-semibold text-[#29475f] after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-[140px] after:bg-[#6a92b3]">INVENTORY LIST</div>
            {detail && <div className="flex items-center gap-3 text-[#29475f]">
              {isPending && <button onClick={() => setShowPostConfirm(true)} className="rounded-[3px] bg-[#4caf50] px-3 py-2 text-[12px] font-bold text-white">POST <u>ADJUSTMENT</u></button>}
              <span className="text-[18px] font-semibold">SA No. : {detail.header.adjustmentNo} ({detail.header.status.toUpperCase()})</span>
            </div>}
          </div>

          {detail && <>
            <form onSubmit={handleSearch} className="px-[25px] pt-5">
              <div className="grid grid-cols-[90px_1fr_90px_1fr] items-center gap-x-3 gap-y-3 text-[13px]">
                <div className="font-semibold">Date:</div>
                <div className="col-span-3 flex items-center gap-2">{formatLegacyDate(detail.header.adjustmentDate)}{isPending && <button type="button" onClick={() => setShowDateEditor(true)} className="text-[#4e7392]" aria-label="Edit date"><Pencil className="h-4 w-4" /></button>}</div>
                <label className="font-semibold">Part No.</label>
                <input value={partNoInput} onChange={(event) => setPartNoInput(event.target.value)} className="h-[34px] rounded-[3px] border border-[#ccc] px-3 outline-none" placeholder="Input Part Number" />
                <label className="font-semibold">Item Code</label>
                <input value={itemCodeInput} onChange={(event) => setItemCodeInput(event.target.value)} className="h-[34px] rounded-[3px] border border-[#ccc] px-3 outline-none" placeholder="Select Item Code" />
                <div className="col-span-4 flex justify-end gap-1"><button type="submit" className="rounded-[3px] bg-[#5d82a2] px-3 py-2 text-[12px] text-white">Search</button><button type="button" onClick={handleRefresh} className="rounded-[3px] bg-[#6c757d] px-3 py-2 text-[12px] text-white">Refresh</button></div>
              </div>
            </form>

            <div className="px-[25px] pb-4 pt-5">
              <div className="inventory-audit-scrollbar max-h-[440px] overflow-auto pb-3">
                <table className="w-max min-w-full table-fixed border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-white"><tr className="border-b-2 border-[#d5d5d5] align-bottom font-semibold">
                    {['Part No.', 'Item Code', 'Description', 'Brand', 'Cost'].map((label) => <th key={label} className="w-[100px] px-2 py-2 text-left">{label}</th>)}
                    {detail.warehouses.map((warehouse) => <React.Fragment key={warehouse}><th colSpan={2} className="w-[200px] px-2 py-2 text-center">{warehouse}</th><th className="w-[100px] px-2 py-2 text-left">Physical</th><th className="w-[100px] px-2 py-2 text-left">Discrepancy</th></React.Fragment>)}
                    {['Total Inventory', 'Inventory Value', 'Total Missing', 'Missing Value'].map((label) => <th key={label} className="w-[100px] px-2 py-2 text-left">{label}</th>)}
                  </tr></thead>
                  <tbody>
                    {isLoadingDetail ? <tr><td colSpan={9 + detail.warehouses.length * 4} className="px-3 py-10 text-center text-[#777]">Loading inventory...</td></tr> : detail.items.map((item) => (
                      <tr key={item.itemSession} onClick={() => void openCountEditor(item.partNo)} className="cursor-pointer border-b border-[#ddd] hover:bg-[#f7f7f7]">
                        <td className="w-[100px] break-words px-2 py-2">{item.partNo}</td><td className="w-[100px] break-words px-2 py-2">{item.itemCode}</td><td className="w-[100px] break-words px-2 py-2">{item.description}</td><td className="w-[100px] break-words px-2 py-2">{item.brand}</td><td className="w-[100px] px-2 py-2">{formatNumber(item.cost)}</td>
                        {item.warehouses.map((warehouse) => <React.Fragment key={warehouse.warehouse}><td className="w-[100px] px-2 py-2 text-right">{warehouse.stock}</td><td className="w-[100px] break-words px-2 py-2">{warehouse.location || ' '}</td><td className="w-[100px] px-2 py-2 text-right">{warehouse.physicalCount ?? ''}</td><td className="w-[100px] px-2 py-2 text-right">{warehouse.discrepancy ?? ''}</td></React.Fragment>)}
                        <td className="w-[100px] px-2 py-2 text-right">{formatNumber(item.totalInventory)}</td><td className="w-[100px] px-2 py-2 text-right">{formatNumber(item.inventoryValue)}</td><td className="w-[100px] px-2 py-2 text-right">{formatNumber(item.totalMissing)}</td><td className="w-[100px] px-2 py-2 text-right">{formatNumber(item.missingValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px] text-[#555]"><span>{detail.meta.total.toLocaleString()} items</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-[#ccc] px-3 py-1 disabled:opacity-40">Previous</button><span>Page {detail.meta.page} of {Math.max(1, detail.meta.totalPages)}</span><button disabled={page >= detail.meta.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border border-[#ccc] px-3 py-1 disabled:opacity-40">Next</button></div></div>
              <div className="mt-5 grid grid-cols-3 text-center text-[13px]"><div><strong>Total Inventory: </strong>{formatNumber(summary.inventoryValue)}</div><div><strong>Missing: </strong>{formatNumber(summary.missing)}</div><div><strong>Missing Value: </strong>{formatNumber(summary.missingValue)}</div></div>
            </div>
          </>}
        </section>

        {detail && <section className="flex min-h-[76px] items-center gap-1 rounded-t-[5px] border border-[#d7d7d7] bg-white px-5">
          {isPending && <button onClick={() => setShowDeleteConfirm(true)} className="rounded-[4px] bg-[#d64b47] px-[18px] py-[9px] text-[14px] text-white">Delete SA</button>}
          <button onClick={() => void handleExport()} disabled={isSaving} className="rounded-[4px] bg-[#55b457] px-[18px] py-[9px] text-[14px] text-white disabled:opacity-50">Export SA</button>
          <button onClick={() => void handlePrint()} disabled={isSaving} className="rounded-[4px] bg-[#55b457] px-[18px] py-[9px] text-[14px] text-white disabled:opacity-50">Print SA</button>
        </section>}
      </div>

      {editingPartNo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
        <div className="flex max-h-[90vh] w-[min(1400px,96vw)] flex-col overflow-hidden rounded-[5px] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#ddd] px-5 py-4"><h3 className="text-[22px] font-semibold">Stock Adjustment</h3><div className="flex gap-2">{isPending && <button onClick={() => void handleSaveCounts()} disabled={isSaving} className="rounded bg-[#4caf50] px-4 py-2 text-sm text-white disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button>}<button onClick={closeCountEditor} className="rounded bg-[#6c757d] px-4 py-2 text-sm text-white">Close</button></div></div>
          <div className="inventory-audit-scrollbar overflow-auto p-5">
            {isLoadingModal ? <div className="py-16 text-center">Loading...</div> : <table className="w-max min-w-full table-fixed border-collapse text-[11px]"><thead><tr className="bg-[#f5f5f5]">{isPending && <th className="w-[40px] border border-[#ccc] p-2" />}<th className="w-[90px] border border-[#ccc] p-2 text-left">Part No.</th><th className="w-[90px] border border-[#ccc] p-2 text-left">Item Code</th><th className="w-[120px] border border-[#ccc] p-2 text-left">Description</th>{detail?.warehouses.map((warehouse) => <React.Fragment key={warehouse}><th className="w-[70px] border border-[#ccc] p-2">{warehouse} Stock</th><th className="w-[80px] border border-[#ccc] p-2">Location</th><th className="w-[150px] border border-[#ccc] p-2">Physical Count / Remarks</th></React.Fragment>)}</tr></thead><tbody>{modalItems.map((item) => <tr key={item.itemSession}>{isPending && <td className="border border-[#ccc] p-2 text-center"><button onClick={() => void handleDeleteItem(item.itemSession)} className="text-[#d64b47]" title="Delete Adjustments"><Trash2 className="h-4 w-4" /></button></td>}<td className="border border-[#ccc] p-2">{item.partNo}</td><td className="border border-[#ccc] p-2">{item.itemCode}</td><td className="border border-[#ccc] p-2">{item.description}</td>{item.warehouses.map((warehouse) => { const key = `${item.itemSession}::${warehouse.warehouse}`; const draft = countDrafts[key] || { physical: '', remarks: '' }; return <React.Fragment key={warehouse.warehouse}><td className="border border-[#ccc] p-2 text-right">{warehouse.stock}</td><td className="border border-[#ccc] p-2">{warehouse.location}</td><td className="border border-[#ccc] p-2"><input type="number" disabled={!isPending} value={draft.physical} onChange={(event) => updateDraft(key, 'physical', event.target.value)} placeholder="Input Qty" className="mb-1 h-8 w-full rounded border border-[#ccc] px-2 disabled:bg-[#eee]" /><input disabled={!isPending} value={draft.remarks} onChange={(event) => updateDraft(key, 'remarks', event.target.value)} placeholder="Input Remarks" className="h-8 w-full rounded border border-[#ccc] px-2 disabled:bg-[#eee]" /></td></React.Fragment>; })}</tr>)}</tbody></table>}
          </div>
        </div>
      </div>}

      {(showPostConfirm || showDeleteConfirm || showDateEditor) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden"><div className="w-full max-w-md rounded-[5px] bg-white shadow-xl"><div className="flex items-center justify-between border-b border-[#ddd] px-5 py-4"><h3 className="text-xl font-semibold">{showPostConfirm ? 'Post Adjustment' : showDeleteConfirm ? 'Delete Adjustment' : 'Edit Date'}</h3><button onClick={() => { setShowPostConfirm(false); setShowDeleteConfirm(false); setShowDateEditor(false); }}><X className="h-5 w-5" /></button></div><div className="p-5 text-sm">{showPostConfirm ? <p>Are you sure you want to post this record? This record cannot be edited or deleted once posted.</p> : showDeleteConfirm ? <p>Are you sure you want to delete this record?</p> : <label className="flex items-center gap-4"><span>Date:</span><input type="date" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} className="h-9 flex-1 rounded border border-[#ccc] px-3" /></label>}</div><div className="flex justify-end gap-2 border-t border-[#ddd] px-5 py-4"><button onClick={() => { setShowPostConfirm(false); setShowDeleteConfirm(false); setShowDateEditor(false); }} className="rounded border border-[#ccc] px-4 py-2 text-sm">Close</button><button onClick={() => void (showPostConfirm ? handlePost() : showDeleteConfirm ? handleDeleteAdjustment() : handleSaveDate())} disabled={isSaving} className={`rounded px-4 py-2 text-sm text-white disabled:opacity-50 ${showDeleteConfirm ? 'bg-[#d64b47]' : 'bg-[#5d82a2]'}`}>{showPostConfirm ? 'Post' : showDeleteConfirm ? 'Delete' : 'Save'}</button></div></div></div>}

      {detail && <div className="inventory-audit-print-area">
        <table className="inventory-audit-print-table"><thead><tr><th>PART NO</th><th>ITEM CODE</th><th>DESCRIPTION</th>{detail.warehouses.map((warehouse) => <React.Fragment key={warehouse}><th colSpan={2}>{warehouse.toUpperCase()}</th><th>PCNT</th><th>MSG</th></React.Fragment>)}<th>VAL</th></tr></thead><tbody>{printItems.map((item, index) => { const nextPartNo = printItems[index + 1]?.partNo; const totals = printPartTotals.get(item.partNo) || { missing: 0, missingValue: 0 }; return <React.Fragment key={item.itemSession}><tr><td>{item.partNo}</td><td>{item.itemCode}</td><td>{item.description}</td>{item.warehouses.map((warehouse) => <React.Fragment key={warehouse.warehouse}><td className="text-right">{warehouse.stock}</td><td className="text-right">{warehouse.location}</td><td className="text-right">{warehouse.physicalCount ?? ''}</td><td className="text-right">{warehouse.discrepancy ?? ''}</td></React.Fragment>)}<td className="text-right">{item.inventoryValue}</td></tr>{nextPartNo !== item.partNo && <><tr><td colSpan={detail.warehouses.length * 4 + 3} className="text-right">Total Missing:</td><td>{formatNumber(totals.missing)}</td></tr><tr><td colSpan={detail.warehouses.length * 4 + 3} className="text-right">Total Missing Value:</td><td>{formatNumber(totals.missingValue)}</td></tr><tr><td colSpan={detail.warehouses.length * 4 + 4}>&nbsp;</td></tr></>}</React.Fragment>; })}</tbody></table>
      </div>}
    </div>
  );
};

export default InventoryAuditReport;
