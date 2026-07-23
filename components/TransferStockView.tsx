import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import {
  addTransferStockPartNumbers,
  approveTransferStock,
  createTransferStockFromPartNumbers,
  deleteTransferStock,
  deleteTransferStockItem,
  fetchTransferStocks,
  generateTransferNo,
  getTransferStock,
  submitTransferStock,
  updateTransferStock,
  updateTransferStockItem,
} from '../services/transferStockService';
import { fetchProducts } from '../services/productLocalApiService';
import { getLocalAuthSession } from '../services/localAuthService';
import {
  dispatchWorkflowNotification,
  markNotificationsAsReadByEntityKey,
} from '../services/notificationLocalApiService';
import type { Product, TransferStock, TransferStockItem, UserProfile } from '../types';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

const TRANSFER_STOCK_TAB_ID = 'warehouse-inventory-transfer-stock';
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WAREHOUSES = ['WH1', 'WH2', 'WH3', 'WH4', 'WH5', 'WH6'];

type DialogKind = 'submit' | 'approve' | 'delete-transfer' | 'delete-item' | 'edit-date' | null;

interface TransferStockViewProps {
  initialTransferId?: string;
  initialTransferNo?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const formatLegacyDate = (value?: string | null): string => {
  if (!value) return '';
  const date = String(value).slice(0, 10).split('-');
  return date.length === 3 ? `${date[1]}/${date[2]}/${date[0]}` : String(value);
};

const statusLabel = (value?: string): string => {
  const normalized = String(value || 'pending').toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizedPartNo = (value?: string): string => String(value || '').trim().toUpperCase();

const warehouseStock = (product: Product | undefined, warehouse: string): number => {
  if (!product) return 0;
  const key = `stock_wh${warehouse.replace(/\D/g, '')}` as keyof Product;
  const value = Number(product[key] || 0);
  return Number.isFinite(value) ? value : 0;
};

const TransferStockView: React.FC<TransferStockViewProps> = ({ initialTransferId, initialTransferNo }) => {
  const { addToast } = useToast();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<TransferStock[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferStock | null>(null);
  const [draftItems, setDraftItems] = useState<TransferStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [nextTransferNo, setNextTransferNo] = useState('');
  const [filterMonth, setFilterMonth] = useState(() => new Date().getMonth());
  const [filterYear, setFilterYear] = useState(() => new Date().getFullYear());
  const [partSearch, setPartSearch] = useState('');
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [partPickerOpen, setPartPickerOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pendingItemId, setPendingItemId] = useState('');
  const [editedDate, setEditedDate] = useState('');

  const partNumbers = useMemo(
    () => Array.from(new Set(products.map((product) => String(product.part_no || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const matchingParts = useMemo(() => {
    const query = partSearch.trim().toLowerCase();
    return partNumbers
      .filter((partNo) => !selectedParts.includes(partNo))
      .filter((partNo) => !query || partNo.toLowerCase().includes(query))
      .slice(0, 30);
  }, [partNumbers, partSearch, selectedParts]);

  const filterYears = useMemo(() => {
    const values = new Set<number>([filterYear, new Date().getFullYear()]);
    transfers.forEach((transfer) => {
      const value = Number(String(transfer.transfer_date || '').slice(0, 4));
      if (value > 0) values.add(value);
    });
    return Array.from(values).sort((a, b) => b - a);
  }, [filterYear, transfers]);

  const filteredTransfers = useMemo(() => transfers.filter((transfer) => {
    const [year, month] = String(transfer.transfer_date || '').split('-').map(Number);
    return year === filterYear && month === filterMonth + 1;
  }), [filterMonth, filterYear, transfers]);

  const productVariants = useCallback((partNo: string) => products.filter(
    (product) => normalizedPartNo(product.part_no) === normalizedPartNo(partNo)
  ), [products]);

  const productForSession = useCallback((session?: string, partNo?: string, itemCode?: string) => {
    const exact = products.find((product) => String(product.id) === String(session || ''));
    if (exact) return exact;
    return products.find((product) =>
      normalizedPartNo(product.part_no) === normalizedPartNo(partNo)
      && (!itemCode || String(product.item_code).trim() === String(itemCode).trim())
    );
  }, [products]);

  const refreshTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchTransferStocks({ status: 'all' });
      setTransfers(rows);
      return rows;
    } catch (error) {
      console.error('Unable to load transfer stocks:', error);
      addToast({
        type: 'error',
        title: 'Unable to load transfers',
        description: parseSupabaseError(error, 'transfer stock'),
        durationMs: 5000,
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const openTransfer = useCallback(async (transfer: TransferStock) => {
    setCreateMode(false);
    setSelectedParts([]);
    setPartSearch('');
    setSelectedTransfer(transfer);
    const detail = await getTransferStock(transfer.id);
    if (!detail) return;
    setSelectedTransfer(detail);
    setDraftItems(detail.items || []);
    setTransfers((rows) => rows.map((row) => row.id === detail.id ? { ...row, ...detail } : row));
  }, []);

  useEffect(() => {
    const session = getLocalAuthSession();
    setCurrentUser((session?.userProfile || null) as UserProfile | null);
    void Promise.all([
      refreshTransfers(),
      fetchProducts('active').then(setProducts).catch((error) => {
        console.error('Unable to load transfer products:', error);
        setProducts([]);
      }),
    ]);
  }, [refreshTransfers]);

  useEffect(() => {
    if (!transfers.length || selectedTransfer || createMode) return;
    const requested = transfers.find((transfer) =>
      (initialTransferId && transfer.id === initialTransferId)
      || (initialTransferNo && transfer.transfer_no.toLowerCase() === initialTransferNo.toLowerCase())
    );
    const firstForMonth = filteredTransfers[0];
    if (requested || firstForMonth) void openTransfer(requested || firstForMonth);
  }, [
    createMode,
    filteredTransfers,
    initialTransferId,
    initialTransferNo,
    openTransfer,
    selectedTransfer,
    transfers,
  ]);

  useEffect(() => {
    if (!selectedTransfer?.id || !currentUser?.id) return;
    void markNotificationsAsReadByEntityKey(String(currentUser.id), {
      entityType: 'transfer_stock',
      entityId: selectedTransfer.id,
    });
  }, [currentUser?.id, selectedTransfer?.id]);

  const startCreate = async () => {
    setCreateMode(true);
    setSelectedTransfer(null);
    setDraftItems([]);
    setSelectedParts([]);
    setPartSearch('');
    setDialog(null);
    try {
      setNextTransferNo(await generateTransferNo());
    } catch {
      setNextTransferNo('');
    }
  };

  const addSelectedPart = (partNo: string) => {
    setSelectedParts((parts) => parts.includes(partNo) ? parts : [...parts, partNo]);
    setPartSearch('');
    setPartPickerOpen(true);
  };

  const notify = async (
    title: string,
    message: string,
    action: string,
    status: string,
    transferId: string,
    targetRoles: string[] = [],
    targetUserIds: string[] = []
  ) => {
    await dispatchWorkflowNotification({
      title,
      message,
      type: 'success',
      action,
      status,
      entityType: 'transfer_stock',
      entityId: transferId,
      actionUrl: TRANSFER_STOCK_TAB_ID,
      actorId: currentUser?.id,
      actorRole: currentUser?.role || 'Unknown',
      targetRoles,
      targetUserIds,
      includeActor: false,
      metadata: { transfer_stock_id: transferId, action_url: TRANSFER_STOCK_TAB_ID },
    });
  };

  const createTransfer = async () => {
    if (!selectedParts.length) {
      addToast({
        type: 'warning',
        title: 'Select Part Number',
        description: 'Select at least one part number before adding the transfer.',
        durationMs: 4000,
      });
      return;
    }
    setBusy(true);
    try {
      const created = await createTransferStockFromPartNumbers(selectedParts, today());
      setFilterMonth(Number(created.transfer_date.slice(5, 7)) - 1);
      setFilterYear(Number(created.transfer_date.slice(0, 4)));
      await refreshTransfers();
      await openTransfer(created);
      addToast({
        type: 'success',
        title: 'Transfer created',
        description: `${created.transfer_no} is ready for transfer details.`,
        durationMs: 3500,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to create transfer',
        description: parseSupabaseError(error, 'transfer stock'),
        durationMs: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const addPartsToRecord = async () => {
    if (!selectedTransfer || !selectedParts.length) return;
    setBusy(true);
    try {
      const updated = await addTransferStockPartNumbers(selectedTransfer.id, selectedParts);
      setSelectedTransfer(updated);
      setDraftItems(updated.items || []);
      setSelectedParts([]);
      setPartSearch('');
      await refreshTransfers();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to add part number',
        description: parseSupabaseError(error, 'transfer stock'),
        durationMs: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const updateDraftItem = (id: string, updates: Partial<TransferStockItem>) => {
    setDraftItems((rows) => rows.map((row) => row.id === id ? { ...row, ...updates } : row));
  };

  const chooseItemCode = (row: TransferStockItem, side: 'from' | 'to', session: string) => {
    const product = productForSession(session);
    if (!product) return;
    const warehouse = side === 'from'
      ? (row.from_warehouse_id || WAREHOUSES[0])
      : (row.to_warehouse_id || WAREHOUSES[0]);
    updateDraftItem(row.id, side === 'from'
      ? {
          from_item_session: product.id,
          from_warehouse_id: warehouse,
          from_original_qty: warehouseStock(product, warehouse),
        }
      : {
          to_item_session: product.id,
          to_warehouse_id: warehouse,
          to_original_qty: warehouseStock(product, warehouse),
        });
  };

  const chooseWarehouse = (row: TransferStockItem, side: 'from' | 'to', warehouse: string) => {
    const session = side === 'from' ? row.from_item_session : row.to_item_session;
    const product = productForSession(session, row.part_no, row.item_code);
    updateDraftItem(row.id, side === 'from'
      ? { from_warehouse_id: warehouse, from_original_qty: warehouseStock(product, warehouse) }
      : { to_warehouse_id: warehouse, to_original_qty: warehouseStock(product, warehouse) });
  };

  const saveItems = async () => {
    if (!selectedTransfer) return;
    setBusy(true);
    try {
      for (const row of draftItems) {
        const variants = productVariants(row.part_no || '');
        const defaultVariant = variants[0];
        const fromProduct = productForSession(row.from_item_session, row.part_no, row.item_code) || defaultVariant;
        const toProduct = productForSession(row.to_item_session, row.part_no, row.item_code) || defaultVariant;
        const fromWarehouse = row.from_warehouse_id || WAREHOUSES[0];
        const toWarehouse = row.to_warehouse_id || WAREHOUSES[0];
        const quantity = Number(row.transfer_qty || 0);

        // This mirrors the old model: rows with zero quantity remain unedited.
        if (quantity <= 0 || !fromProduct || !toProduct) continue;
        await updateTransferStockItem(row.id, {
          from_item_session: fromProduct.id,
          from_warehouse_id: fromWarehouse,
          from_original_qty: warehouseStock(fromProduct, fromWarehouse),
          to_item_session: toProduct.id,
          to_warehouse_id: toWarehouse,
          to_original_qty: warehouseStock(toProduct, toWarehouse),
          transfer_qty: quantity,
        });
      }
      const refreshed = await getTransferStock(selectedTransfer.id);
      if (refreshed) {
        setSelectedTransfer(refreshed);
        setDraftItems(refreshed.items || []);
      }
      addToast({
        type: 'success',
        title: 'Transfer saved',
        description: 'Transfer item details were saved.',
        durationMs: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to save transfer',
        description: parseSupabaseError(error, 'transfer stock'),
        durationMs: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const performSubmit = async () => {
    if (!selectedTransfer) return;
    setBusy(true);
    try {
      const updated = await submitTransferStock(selectedTransfer.id);
      if (updated) {
        setSelectedTransfer(updated);
        setDraftItems((updated.items || []).filter((item) => Number(item.edited) === 1));
        await refreshTransfers();
        await notify(
          'Transfer Submitted',
          `Transfer ${selectedTransfer.transfer_no} is submitted and waiting for your approval.`,
          'submit_transfer_stock',
          'submitted',
          selectedTransfer.id,
          ['Owner']
        );
      }
      setDialog(null);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to submit transfer',
        description: parseSupabaseError(error, 'transfer stock'),
        durationMs: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const performApprove = async () => {
    if (!selectedTransfer) return;
    setBusy(true);
    try {
      const updated = await approveTransferStock(selectedTransfer.id);
      if (updated) {
        setSelectedTransfer(updated);
        setDraftItems((updated.items || []).filter((item) => Number(item.edited) === 1));
        await refreshTransfers();
        const creatorId = String(updated.processed_by_profile_id || '').trim();
        await notify(
          'Transfer Approved',
          `Transfer ${selectedTransfer.transfer_no} has been approved.`,
          'approve_transfer_stock',
          'approved',
          selectedTransfer.id,
          [],
          creatorId ? [creatorId] : []
        );
      }
      setDialog(null);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to approve transfer',
        description: parseSupabaseError(error, 'transfer stock'),
        durationMs: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const performDeleteTransfer = async () => {
    if (!selectedTransfer) return;
    setBusy(true);
    try {
      await deleteTransferStock(selectedTransfer.id);
      setSelectedTransfer(null);
      setDraftItems([]);
      setDialog(null);
      const rows = await refreshTransfers();
      const next = rows.find((transfer) => {
        const [year, month] = transfer.transfer_date.split('-').map(Number);
        return year === filterYear && month === filterMonth + 1;
      });
      if (next) await openTransfer(next);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to delete transfer',
        description: parseSupabaseError(error, 'transfer stock'),
        durationMs: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const performDeleteItem = async () => {
    if (!selectedTransfer || !pendingItemId) return;
    setBusy(true);
    try {
      await deleteTransferStockItem(pendingItemId);
      const refreshed = await getTransferStock(selectedTransfer.id);
      if (refreshed) {
        setSelectedTransfer(refreshed);
        setDraftItems(refreshed.items || []);
      }
      setDialog(null);
      setPendingItemId('');
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to delete item',
        description: parseSupabaseError(error, 'transfer stock'),
        durationMs: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const saveTransferDate = async () => {
    if (!selectedTransfer || !editedDate) return;
    setBusy(true);
    try {
      const updated = await updateTransferStock(selectedTransfer.id, { transfer_date: editedDate });
      if (updated) {
        setSelectedTransfer(updated);
        setDraftItems(updated.items || []);
        setFilterMonth(Number(editedDate.slice(5, 7)) - 1);
        setFilterYear(Number(editedDate.slice(0, 4)));
        await refreshTransfers();
      }
      setDialog(null);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to edit date',
        description: parseSupabaseError(error, 'transfer stock'),
        durationMs: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const recordItems = selectedTransfer?.status === 'pending'
    ? draftItems
    : draftItems.filter((item) => Number(item.edited) === 1 || Number(item.transfer_qty) > 0);

  const printTransfer = () => {
    if (!selectedTransfer || selectedTransfer.status !== 'approved') {
      addToast({
        type: 'info',
        title: 'Select approved transfer',
        description: 'Only approved transfer records can be printed.',
        durationMs: 3500,
      });
      return;
    }
    window.print();
  };

  return (
    <div
      className="min-h-full overflow-y-auto bg-[#f4f4f4] px-5 py-10 text-[#202020] dark:bg-[#f4f4f4] dark:text-[#202020] print:bg-white print:p-0"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .transfer-print-document, .transfer-print-document * { visibility: visible !important; }
          .transfer-print-document { display: block !important; position: absolute; inset: 0; width: 100%; padding: 28px 36px; background: white; color: black; }
          @page { size: portrait; margin: 12mm; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1140px] space-y-[26px] print:hidden">
        <section className="overflow-hidden rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex min-h-[82px] items-center justify-between border-b border-[#d7d7d7] px-[35px]">
            <button
              type="button"
              onClick={() => void startCreate()}
              className="rounded-[4px] bg-[#4caf50] px-[14px] py-[9px] text-[14px] text-white hover:bg-[#43a047]"
            >
              Create New
            </button>
            <div className="flex items-center">
              <span className="mr-[30px] text-[20px] font-semibold text-[#263f55]">Filter by Month:</span>
              <select
                value={filterMonth}
                onChange={(event) => {
                  setFilterMonth(Number(event.target.value));
                  setSelectedTransfer(null);
                  setDraftItems([]);
                  setCreateMode(false);
                }}
                className="h-[34px] w-[200px] rounded-[3px] border border-[#cfcfcf] bg-white px-4 text-[13px] outline-none"
                aria-label="Filter month"
              >
                {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
              </select>
              <select
                value={filterYear}
                onChange={(event) => {
                  setFilterYear(Number(event.target.value));
                  setSelectedTransfer(null);
                  setDraftItems([]);
                  setCreateMode(false);
                }}
                className="ml-[16px] h-[34px] w-[100px] rounded-[3px] border border-[#cfcfcf] bg-white px-3 text-[13px] outline-none"
                aria-label="Filter year"
              >
                {filterYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
          </div>

          <div className="min-h-[188px] px-[25px] py-[31px]">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-[#d5d5d5] text-left text-[14px] font-semibold">
                  <th className="w-1/3 px-2 pb-2">Date</th>
                  <th className="w-1/3 px-2 pb-2">TR No.</th>
                  <th className="w-1/3 px-2 pb-2">Status</th>
                </tr>
              </thead>
            </table>
            <div className="max-h-[100px] overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="border border-[#d7d7d7] px-2 py-[9px] text-center text-[#777]">Loading...</td></tr>
                  ) : filteredTransfers.length === 0 ? (
                    <tr><td colSpan={3} className="border border-[#d7d7d7] px-2 py-[15px] text-center text-[#888]">No records found.</td></tr>
                  ) : filteredTransfers.map((transfer) => {
                    const selected = selectedTransfer?.id === transfer.id && !createMode;
                    return (
                      <tr
                        key={transfer.id}
                        onClick={() => void openTransfer(transfer)}
                        className={`cursor-pointer hover:bg-[#f7f7f7] ${selected ? 'text-blue-600' : ''}`}
                      >
                        <td className="w-1/3 border border-[#d7d7d7] px-2 py-[9px]">{formatLegacyDate(transfer.transfer_date)}</td>
                        <td className="w-1/3 border border-[#d7d7d7] px-2 py-[9px]"><span className="underline">{transfer.transfer_no}</span></td>
                        <td className="w-1/3 border border-[#d7d7d7] px-2 py-[9px]">{statusLabel(transfer.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="overflow-visible rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex h-[63px] items-center justify-between border-b border-[#d7d7d7] px-5">
            <div className="relative flex h-full items-center text-[18px] font-semibold text-[#29475f] after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-[170px] after:bg-[#6a92b3]">
              TRANSFER PRODUCT
            </div>
            <div className="flex items-center gap-2 text-[23px] font-semibold text-[#29475f]">
              {selectedTransfer?.status === 'pending' && !createMode && (
                <button
                  type="button"
                  onClick={() => setDialog('submit')}
                  className="mr-1 rounded-[4px] bg-[#4caf50] px-[13px] py-[9px] text-[13px] font-bold text-white"
                >
                  SUBMIT <u>TRANSFER</u>
                </button>
              )}
              {selectedTransfer?.status === 'submitted' && !createMode && (
                <button
                  type="button"
                  onClick={() => setDialog('approve')}
                  className="mr-1 rounded-[4px] bg-[#4caf50] px-[13px] py-[9px] text-[13px] font-bold text-white"
                >
                  APPROVE <u>TRANSFER</u>
                </button>
              )}
              <span>
                TR No. : {createMode
                  ? nextTransferNo.replace(/^TR-/i, '')
                  : (selectedTransfer?.transfer_no || '')}
              </span>
            </div>
          </div>

          {createMode || !selectedTransfer ? (
            <div className="min-h-[238px] px-[25px] pb-[45px] pt-[31px]">
              <div className="ml-[85px] flex max-w-[700px] items-start gap-[18px]">
                <label className="w-[160px] pt-[2px] text-[16px] font-semibold text-[#29475f]">Part Number:</label>
                <div className="relative w-full max-w-[420px]">
                  <div className="flex min-h-[35px] flex-wrap items-center gap-1 rounded-[4px] border border-[#c9c9c9] bg-white px-2">
                    {selectedParts.map((partNo) => (
                      <span key={partNo} className="flex items-center gap-1 rounded bg-[#e8eef3] px-2 py-1 text-[11px]">
                        {partNo}
                        <button type="button" onClick={() => setSelectedParts((parts) => parts.filter((part) => part !== partNo))}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                    <input
                      value={partSearch}
                      onChange={(event) => { setPartSearch(event.target.value); setPartPickerOpen(true); }}
                      onFocus={() => setPartPickerOpen(true)}
                      className="min-w-[120px] flex-1 border-0 px-1 py-2 text-[13px] outline-none"
                      aria-label="Part Number"
                    />
                  </div>
                  {partPickerOpen && (partSearch || selectedParts.length === 0) && (
                    <div className="absolute z-30 mt-1 max-h-[190px] w-full overflow-y-auto rounded border border-[#ccc] bg-white shadow-lg">
                      {matchingParts.map((partNo) => (
                        <button key={partNo} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addSelectedPart(partNo)} className="block w-full border-b border-[#eee] px-3 py-2 text-left text-[12px] hover:bg-[#eee]">
                          {partNo}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void createTransfer()}
                    disabled={busy}
                    className="mt-[18px] rounded-[3px] bg-[#5d82a2] px-[12px] py-[7px] text-[12px] text-white disabled:opacity-50"
                  >
                    Add Transfer
                  </button>
                </div>
              </div>
              <div className="mt-[20px] border-t border-[#e5e5e5] pt-[28px]">
                <table className="w-full table-fixed border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b-2 border-[#d5d5d5] text-left text-[14px] font-semibold">
                      <th className="w-[210px] px-2 pb-2">Item Code</th>
                      {WAREHOUSES.map((warehouse) => <th key={warehouse} className="px-2 pb-2 text-center">{warehouse}</th>)}
                    </tr>
                  </thead>
                </table>
              </div>
            </div>
          ) : (
            <div className="px-[25px] pb-[43px] pt-[31px]">
              <div className="grid grid-cols-2 border-b border-[#e5e5e5] pb-[28px] text-[#29475f]">
                <div className="flex items-center pl-[32px]">
                  <span className="mr-[30px] text-[16px] font-semibold">Transfer Date:</span>
                  <span className="text-[16px] font-semibold">{formatLegacyDate(selectedTransfer.transfer_date)}</span>
                  <button
                    type="button"
                    onClick={() => { setEditedDate(selectedTransfer.transfer_date); setDialog('edit-date'); }}
                    className="ml-1 text-[#2d7db5]"
                    aria-label="Edit transfer date"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center pl-[55px]">
                  <span className="mr-[26px] text-[16px] font-semibold">Status:</span>
                  <span className="text-[16px] font-semibold">{statusLabel(selectedTransfer.status)}</span>
                </div>
              </div>

              <div className="mt-[28px] overflow-x-auto">
                <table className="w-full min-w-[1010px] table-fixed border-collapse text-[12px]">
                  <thead>
                    <tr className="text-[13px] font-semibold">
                      <th className="w-[42px]" rowSpan={2}></th>
                      <th className="w-[155px] px-2 pb-2 text-left" rowSpan={2}>Part No.</th>
                      <th className="border-b-2 border-[#d5d5d5] pb-2 text-center" colSpan={2}>Source</th>
                      <th className="border-b-2 border-[#d5d5d5] pb-2 text-center" colSpan={2}>Destination</th>
                      <th className="w-[255px] px-2 pb-2 text-left" rowSpan={2}>Quantity</th>
                    </tr>
                    <tr className="border-b-2 border-[#d5d5d5] text-left text-[13px] font-semibold">
                      <th className="w-[155px] px-2 pb-2">Item Code</th>
                      <th className="w-[155px] px-2 pb-2">Warehouse</th>
                      <th className="w-[155px] px-2 pb-2">Item Code</th>
                      <th className="w-[155px] px-2 pb-2">Warehouse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordItems.map((row) => {
                      const variants = productVariants(row.part_no || '');
                      const defaultVariant = variants[0];
                      const fromSession = row.from_item_session || defaultVariant?.id || '';
                      const toSession = row.to_item_session || defaultVariant?.id || '';
                      const fromProduct = productForSession(fromSession, row.part_no, row.item_code) || defaultVariant;
                      const toProduct = productForSession(toSession, row.part_no, row.item_code) || defaultVariant;
                      const fromWarehouse = row.from_warehouse_id || WAREHOUSES[0];
                      const toWarehouse = row.to_warehouse_id || WAREHOUSES[0];
                      const editable = selectedTransfer.status === 'pending';
                      return (
                        <tr key={row.id} className="border-b border-[#e2e2e2]">
                          <td className="px-2 py-[9px]">
                            {editable && (
                              <button
                                type="button"
                                onClick={() => { setPendingItemId(row.id); setDialog('delete-item'); }}
                                className="text-[#d9534f]"
                                aria-label={`Delete ${row.part_no}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                          <td className="px-2 py-[9px]">{row.part_no}</td>
                          <td className="px-2 py-[9px]">
                            {editable ? (
                              <select value={fromSession} onChange={(event) => chooseItemCode(row, 'from', event.target.value)} className="h-[35px] w-full rounded-[3px] border border-[#ccc] bg-white px-3">
                                {variants.map((product) => <option key={product.id} value={product.id}>{product.item_code}</option>)}
                              </select>
                            ) : (fromProduct?.item_code || row.item_code)}
                          </td>
                          <td className="px-2 py-[9px]">
                            {editable ? (
                              <select value={fromWarehouse} onChange={(event) => chooseWarehouse(row, 'from', event.target.value)} className="h-[35px] w-full rounded-[3px] border border-[#ccc] bg-white px-3">
                                {WAREHOUSES.map((warehouse) => <option key={warehouse} value={warehouse}>{warehouse} ({warehouseStock(fromProduct, warehouse)})</option>)}
                              </select>
                            ) : `${fromWarehouse} (${Number(row.from_original_qty || 0)})`}
                          </td>
                          <td className="px-2 py-[9px]">
                            {editable ? (
                              <select value={toSession} onChange={(event) => chooseItemCode(row, 'to', event.target.value)} className="h-[35px] w-full rounded-[3px] border border-[#ccc] bg-white px-3">
                                {variants.map((product) => <option key={product.id} value={product.id}>{product.item_code}</option>)}
                              </select>
                            ) : (toProduct?.item_code || row.item_code)}
                          </td>
                          <td className="px-2 py-[9px]">
                            {editable ? (
                              <select value={toWarehouse} onChange={(event) => chooseWarehouse(row, 'to', event.target.value)} className="h-[35px] w-full rounded-[3px] border border-[#ccc] bg-white px-3">
                                {WAREHOUSES.map((warehouse) => <option key={warehouse} value={warehouse}>{warehouse} ({warehouseStock(toProduct, warehouse)})</option>)}
                              </select>
                            ) : `${toWarehouse} (${Number(row.to_original_qty || 0)})`}
                          </td>
                          <td className="px-2 py-[9px]">
                            {editable ? (
                              <input
                                type="number"
                                min="0"
                                value={Number(row.transfer_qty || 0)}
                                onChange={(event) => updateDraftItem(row.id, { transfer_qty: Number(event.target.value || 0) })}
                                placeholder="Input Qty"
                                className="h-[35px] w-full rounded-[3px] border border-[#ccc] px-3"
                              />
                            ) : Number(row.transfer_qty || 0)}
                          </td>
                        </tr>
                      );
                    })}
                    {selectedTransfer.status === 'pending' && (
                      <tr>
                        <td colSpan={6}></td>
                        <td className="px-2 py-[9px] text-right">
                          <button type="button" onClick={() => void saveItems()} disabled={busy} className="rounded-[3px] bg-[#5d82a2] px-[14px] py-[9px] text-[12px] text-white disabled:opacity-50">Save</button>
                        </td>
                      </tr>
                    )}
                    {selectedTransfer.status === 'pending' && (
                      <tr className="bg-[#fafafa]">
                        <td colSpan={3} className="px-2 py-[9px]">
                          <div className="relative">
                            <div className="flex min-h-[35px] flex-wrap items-center gap-1 rounded-[3px] border border-[#ccc] bg-white px-2">
                              {selectedParts.map((partNo) => (
                                <span key={partNo} className="flex items-center gap-1 rounded bg-[#e8eef3] px-2 py-1 text-[11px]">
                                  {partNo}
                                  <button type="button" onClick={() => setSelectedParts((parts) => parts.filter((part) => part !== partNo))}><X className="h-3 w-3" /></button>
                                </span>
                              ))}
                              <input
                                value={partSearch}
                                onChange={(event) => { setPartSearch(event.target.value); setPartPickerOpen(true); }}
                                onFocus={() => setPartPickerOpen(true)}
                                placeholder="Select Part No."
                                className="min-w-[120px] flex-1 border-0 py-2 outline-none"
                              />
                            </div>
                            {partPickerOpen && partSearch && (
                              <div className="absolute bottom-full z-30 mb-1 max-h-[190px] w-full overflow-y-auto rounded border border-[#ccc] bg-white shadow-lg">
                                {matchingParts.map((partNo) => (
                                  <button key={partNo} type="button" onClick={() => addSelectedPart(partNo)} className="block w-full border-b border-[#eee] px-3 py-2 text-left hover:bg-[#eee]">{partNo}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-[9px]">
                          <button type="button" onClick={() => void addPartsToRecord()} disabled={busy || !selectedParts.length} className="rounded-[3px] bg-[#5d82a2] px-[14px] py-[9px] text-[12px] text-white disabled:opacity-50">Add Part No</button>
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="flex min-h-[76px] items-center gap-1 rounded-t-[5px] border border-[#d7d7d7] bg-white px-5">
          <button
            type="button"
            onClick={() => selectedTransfer ? setDialog('delete-transfer') : addToast({ type: 'info', title: 'Select Item', description: 'Select a transfer first before proceeding.', durationMs: 3500 })}
            className="rounded-[4px] bg-[#d64b47] px-[25px] py-[9px] text-[14px] text-white"
          >
            Delete
          </button>
          <button type="button" onClick={printTransfer} className="rounded-[4px] bg-[#55b457] px-[29px] py-[9px] text-[14px] text-white">Print</button>
        </section>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:hidden">
          <div className="w-full max-w-[600px] rounded-[4px] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#ddd] px-6 py-4">
              <h3 className="text-[22px] font-medium">
                {dialog === 'submit' ? 'Submit Record'
                  : dialog === 'approve' ? 'Approve Record'
                  : dialog === 'delete-transfer' ? 'Delete Record'
                  : dialog === 'delete-item' ? 'Delete Item'
                  : 'Edit Date'}
              </h3>
              <button type="button" onClick={() => setDialog(null)} className="text-[24px] text-[#777]">×</button>
            </div>
            <div className="min-h-[95px] px-6 py-6 text-[14px]">
              {dialog === 'submit' && <p>Are you sure you want to submit this transaction?</p>}
              {dialog === 'approve' && <p>Are you sure you want to approve this transaction?</p>}
              {dialog === 'delete-transfer' && <p>Are you sure you want to delete this transaction?</p>}
              {dialog === 'delete-item' && <p>Are you sure you want to delete this item?</p>}
              {dialog === 'edit-date' && (
                <div className="flex items-center gap-4">
                  <label className="w-[100px] text-right">Date:</label>
                  <input type="date" value={editedDate} onChange={(event) => setEditedDate(event.target.value)} className="h-[35px] w-[250px] rounded border border-[#ccc] px-3" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#ddd] px-6 py-4">
              <button type="button" onClick={() => setDialog(null)} className="rounded border border-[#ccc] bg-white px-4 py-2 text-[13px]">{dialog === 'edit-date' ? 'Cancel' : 'Close'}</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (dialog === 'submit') void performSubmit();
                  if (dialog === 'approve') void performApprove();
                  if (dialog === 'delete-transfer') void performDeleteTransfer();
                  if (dialog === 'delete-item') void performDeleteItem();
                  if (dialog === 'edit-date') void saveTransferDate();
                }}
                className={`rounded px-4 py-2 text-[13px] text-white disabled:opacity-50 ${dialog === 'delete-transfer' || dialog === 'delete-item' ? 'bg-[#d9534f]' : dialog === 'edit-date' ? 'bg-[#5d82a2]' : 'bg-[#4caf50]'}`}
              >
                {dialog === 'delete-transfer' || dialog === 'delete-item' ? 'Delete' : dialog === 'edit-date' ? 'Save' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTransfer && (
        <div className="transfer-print-document hidden">
          <div className="mb-8 border-b pb-4">
            <div className="text-lg font-semibold">PRINT TRANSFER PRODUCT</div>
          </div>
          <div className="mb-9 text-center text-[22px] font-bold underline">TRANSFER STOCK</div>
          <div className="mb-10 flex justify-between text-[14px]">
            <div><strong>Transfer Number:</strong> <span className="ml-2 font-normal">{selectedTransfer.transfer_no}</span></div>
            <div><strong>Transfer Date:</strong> <span className="ml-2 font-normal">{formatLegacyDate(selectedTransfer.transfer_date)}</span></div>
          </div>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {['Part No.', 'Item Code From', 'Warehouse From', 'Item Code To', 'Warehouse To', 'Quantity'].map((heading) => (
                  <th key={heading} className="border border-black px-2 py-3 text-left">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recordItems.filter((item) => Number(item.transfer_qty) > 0).map((item) => {
                const fromProduct = productForSession(item.from_item_session, item.part_no, item.item_code);
                const toProduct = productForSession(item.to_item_session, item.part_no, item.item_code);
                return (
                  <tr key={item.id}>
                    <td className="border border-black px-2 py-3">{item.part_no}</td>
                    <td className="border border-black px-2 py-3">{fromProduct?.item_code || item.item_code}</td>
                    <td className="border border-black px-2 py-3">{item.from_warehouse_id}</td>
                    <td className="border border-black px-2 py-3">{toProduct?.item_code || item.item_code}</td>
                    <td className="border border-black px-2 py-3">{item.to_warehouse_id}</td>
                    <td className="border border-black px-2 py-3">{Number(item.transfer_qty)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TransferStockView;
