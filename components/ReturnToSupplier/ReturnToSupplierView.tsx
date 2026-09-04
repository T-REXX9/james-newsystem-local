import React, { useState, useEffect } from 'react';
import { SupplierReturn, SupplierReturnItem } from '../../returnToSupplier.types';
import { returnToSupplierService } from '../../services/returnToSupplierService';
import { Send, Printer, RotateCcw, Save, Trash2 } from 'lucide-react';
import ConfirmModal from '../ConfirmModal';
import { useToast } from '../ToastProvider';

interface ReturnToSupplierViewProps {
    returnRecord: SupplierReturn;
    onUpdate: () => void; // Refresh list
}

const ReturnToSupplierView: React.FC<ReturnToSupplierViewProps> = ({ returnRecord, onUpdate }) => {
    const { addToast } = useToast();
    const [items, setItems] = useState<SupplierReturnItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
    const [unpostModalOpen, setUnpostModalOpen] = useState(false);
    const [draftHeader, setDraftHeader] = useState({
        return_date: returnRecord.return_date?.slice(0, 10) || '',
        remarks: returnRecord.remarks || '',
        po_no: returnRecord.po_no || '',
    });
    const [draftItems, setDraftItems] = useState<SupplierReturnItem[]>([]);

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            try {
                const data = await returnToSupplierService.getReturnItems(returnRecord.id);
                setItems(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        if (returnRecord.id) fetchItems();
    }, [returnRecord.id]);

    useEffect(() => {
        setDraftHeader({
            return_date: returnRecord.return_date?.slice(0, 10) || '',
            remarks: returnRecord.remarks || '',
            po_no: returnRecord.po_no || '',
        });
    }, [returnRecord]);

    useEffect(() => {
        setDraftItems(items.map((item) => ({ ...item })));
    }, [items]);

    const isPosted = returnRecord.status === 'Posted';
    const isEditable = returnRecord.status === 'Pending';

    const headerChanged =
        draftHeader.return_date !== (returnRecord.return_date?.slice(0, 10) || '') ||
        draftHeader.remarks !== (returnRecord.remarks || '') ||
        draftHeader.po_no !== (returnRecord.po_no || '');

    const itemChanged = (item: SupplierReturnItem, original?: SupplierReturnItem) => {
        if (!original) return true;
        return item.qty_returned !== original.qty_returned ||
            item.unit_cost !== original.unit_cost ||
            (item.remarks || '') !== (original.remarks || '') ||
            (item.description || '') !== (original.description || '');
    };

    const hasItemChanges = draftItems.some((item) => itemChanged(item, items.find((original) => original.id === item.id)));
    const hasChanges = headerChanged || hasItemChanges || draftItems.length !== items.length;

    const persistChanges = async () => {
        if (headerChanged) {
            await returnToSupplierService.updateReturn(returnRecord.id, draftHeader);
        }

        const deletedItems = items.filter((item) => !draftItems.some((draft) => draft.id === item.id));
        await Promise.all(deletedItems.map((item) => returnToSupplierService.deleteReturnItem(item.id)));

        const changedItems = draftItems.filter((item) => itemChanged(item, items.find((original) => original.id === item.id)));
        await Promise.all(changedItems.map((item) => returnToSupplierService.updateReturnItem(item.id, {
            qty_returned: Number(item.qty_returned) || 0,
            unit_cost: Number(item.unit_cost) || 0,
            remarks: item.remarks || item.return_reason || '',
            description: item.description || '',
        })));
    };

    const handleUnpost = async () => {
        setProcessing(true);
        try {
            await returnToSupplierService.unpostReturn(returnRecord.id);
            setUnpostModalOpen(false);
            addToast({
                type: 'success',
                title: 'Return unposted',
                description: `${returnRecord.return_no} is editable again.`,
                durationMs: 4000,
            });
            onUpdate();
        } catch (err: any) {
            console.error(err);
            addToast({
                type: 'error',
                title: 'Unable to unpost return',
                description: err?.message || 'Something went wrong while unposting the return.',
                durationMs: 6000,
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleSave = async () => {
        if (!isEditable) return;

        const invalidItem = draftItems.find((item) => Number(item.qty_returned) <= 0);
        if (invalidItem) {
            addToast({
                type: 'error',
                title: 'Invalid quantity',
                description: `Quantity for ${invalidItem.part_no || invalidItem.item_code} must be greater than zero.`,
                durationMs: 5000,
            });
            return;
        }

        setProcessing(true);
        try {
            await persistChanges();
            addToast({
                type: 'success',
                title: 'Return updated',
                description: `${returnRecord.return_no} has been saved.`,
                durationMs: 4000,
            });
            onUpdate();
            const refreshedItems = await returnToSupplierService.getReturnItems(returnRecord.id);
            setItems(refreshedItems);
        } catch (err: any) {
            console.error(err);
            addToast({
                type: 'error',
                title: 'Unable to save return',
                description: err?.message || 'Something went wrong while saving the return.',
                durationMs: 6000,
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleFinalize = async () => {
        setProcessing(true);
        try {
            if (hasChanges) {
                await persistChanges();
            }
            await returnToSupplierService.finalizeReturn(returnRecord.id);
            setFinalizeModalOpen(false);
            addToast({
                type: 'success',
                title: 'Return finalized',
                description: `${returnRecord.return_no} has been posted successfully.`,
                durationMs: 4000,
            });
            onUpdate();
        } catch (err: any) {
            console.error(err);
            addToast({
                type: 'error',
                title: 'Unable to finalize return',
                description: err?.message || 'Something went wrong while finalizing the return.',
                durationMs: 6000,
            });
        } finally {
            setProcessing(false);
        }
    };

    const updateDraftItem = (itemId: string, updates: Partial<SupplierReturnItem>) => {
        setDraftItems((current) => current.map((item) => {
            if (item.id !== itemId) return item;
            const next = { ...item, ...updates };
            next.total_amount = (Number(next.qty_returned) || 0) * (Number(next.unit_cost) || 0);
            return next;
        }));
    };

    const removeDraftItem = (itemId: string) => {
        setDraftItems((current) => current.filter((item) => item.id !== itemId));
    };

    const handlePrint = () => {
        // Implement print logic here or open new window
        window.print();
    };

    const statusColor = returnRecord.status === 'Pending' ? 'bg-orange-100 text-orange-700'
        : returnRecord.status === 'Posted' ? 'bg-emerald-100 text-emerald-700'
        : returnRecord.status === 'Cancelled' ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-700';

    return (
        <section className="w-full rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#173c83]">Return to Supplier: {returnRecord.return_no}</h2>
                    <span className={`rounded-md px-3 py-1 text-sm font-bold ${statusColor}`}>{returnRecord.status || 'Draft'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        <Printer className="h-4 w-4" /> Print Return
                    </button>
                    {isEditable && (
                        <button
                            onClick={handleSave}
                            disabled={processing || !hasChanges}
                            className="inline-flex items-center gap-2 rounded-md bg-[#175fd3] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0e4fb7] disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {processing ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                    {returnRecord.status === 'Pending' && (
                        <button
                            onClick={() => setFinalizeModalOpen(true)}
                            disabled={processing || draftItems.length === 0}
                            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                            <Send className="h-4 w-4" />
                            {processing ? 'Posting...' : 'Post Return to Supplier'}
                        </button>
                    )}
                    {isPosted && (
                        <button
                            onClick={() => setUnpostModalOpen(true)}
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
                        >
                            <RotateCcw className="h-4 w-4" />
                            {processing ? 'Unposting...' : 'Unpost'}
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6">
                <div className="mb-8 grid grid-cols-1 gap-x-8 gap-y-6 xl:grid-cols-2">
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-sm font-bold text-slate-500">Supplier <span className="text-rose-500">*</span></span>
                        <input value={returnRecord.supplier_name || ''} disabled className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700" />
                    </div>
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-sm font-bold text-slate-500">Date <span className="text-rose-500">*</span></span>
                        <input
                            type={isEditable ? 'date' : 'text'}
                            value={isEditable ? draftHeader.return_date : new Date(returnRecord.return_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                            disabled={!isEditable}
                            onChange={(event) => setDraftHeader((current) => ({ ...current, return_date: event.target.value }))}
                            className={`h-10 w-full rounded-md border px-3 text-sm font-semibold text-slate-700 ${isEditable ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'}`}
                        />
                    </div>
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-sm font-bold text-slate-500">PO No.</span>
                        <input
                            value={draftHeader.po_no}
                            disabled={!isEditable}
                            onChange={(event) => setDraftHeader((current) => ({ ...current, po_no: event.target.value }))}
                            className={`h-10 w-full rounded-md border px-3 text-sm font-semibold text-slate-700 ${isEditable ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'}`}
                        />
                    </div>
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-sm font-bold text-slate-500">Tracking No.</span>
                        <input value="-" disabled className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700" />
                    </div>
                    <div className="grid grid-cols-[100px_1fr] items-start gap-4">
                        <span className="pt-2 text-sm font-bold text-slate-500">Remarks</span>
                        <textarea
                            value={draftHeader.remarks}
                            disabled={!isEditable}
                            rows={3}
                            onChange={(event) => setDraftHeader((current) => ({ ...current, remarks: event.target.value }))}
                            className={`w-full resize-none rounded-md border p-3 text-sm font-semibold text-slate-700 ${isEditable ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'}`}
                        />
                    </div>
                </div>

                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-800">Items Returned</h3>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full table-fixed border-collapse text-xs leading-tight">
                        <colgroup>
                            <col className="w-[4%]" />
                            <col className="w-[7%]" />
                            <col className="w-[10%]" />
                            <col className="w-[10%]" />
                            <col className="w-[8%]" />
                            <col className="w-[24%]" />
                            <col className="w-[9%]" />
                            <col className="w-[10%]" />
                            <col className="w-[12%]" />
                            {isEditable && <col className="w-[6%]" />}
                        </colgroup>
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                <th className="break-words px-2 py-3 text-center">#</th>
                                <th className="break-words px-2 py-3 text-center">Qty</th>
                                <th className="break-words px-2 py-3">Item Code</th>
                                <th className="break-words px-2 py-3">Part No.</th>
                                <th className="break-words px-2 py-3">Brand</th>
                                <th className="break-words px-2 py-3">Description</th>
                                <th className="break-words px-2 py-3 text-right">Cost</th>
                                <th className="break-words px-2 py-3 text-right">Amount</th>
                                <th className="break-words px-2 py-3">Remarks</th>
                                {isEditable && <th className="break-words px-2 py-3 text-center">Action</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={isEditable ? 10 : 9} className="py-12 text-center text-sm text-slate-500">Loading items...</td></tr>
                            ) : !draftItems.length ? (
                                <tr><td colSpan={isEditable ? 10 : 9} className="py-12 text-center text-sm text-slate-500">No items returned.</td></tr>
                            ) : draftItems.map((item, index) => (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="break-words px-2 py-3 text-center font-semibold text-slate-500">{index + 1}</td>
                                    <td className="px-2 py-3 text-center font-bold text-slate-700">
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.qty_returned}
                                            disabled={!isEditable}
                                            onChange={(event) => updateDraftItem(item.id, { qty_returned: Number(event.target.value) })}
                                            className={`mx-auto h-8 w-full min-w-0 rounded border text-center ${isEditable ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'}`}
                                        />
                                    </td>
                                    <td className="break-words px-2 py-3 text-[13px] font-bold text-slate-700">{item.item_code || '-'}</td>
                                    <td className="break-words px-2 py-3 text-[13px] font-bold text-[#173c83]">{item.part_no || '-'}</td>
                                    <td className="break-words px-2 py-3 font-semibold text-slate-600">-</td>
                                    <td className="px-2 py-3 font-semibold text-slate-700">
                                        <input
                                            value={item.description || ''}
                                            disabled={!isEditable}
                                            onChange={(event) => updateDraftItem(item.id, { description: event.target.value })}
                                            className={`w-full min-w-0 rounded border px-2 py-1 ${isEditable ? 'border-slate-300 bg-white' : 'border-transparent bg-transparent'}`}
                                        />
                                    </td>
                                    <td className="px-2 py-3 text-right font-semibold text-slate-600">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.unit_cost}
                                            disabled={!isEditable}
                                            onChange={(event) => updateDraftItem(item.id, { unit_cost: Number(event.target.value) })}
                                            className={`w-full min-w-0 rounded border px-2 py-1 text-right ${isEditable ? 'border-slate-300 bg-white' : 'border-transparent bg-transparent'}`}
                                        />
                                    </td>
                                    <td className="break-words px-2 py-3 text-right font-bold text-slate-700">{item.total_amount ? item.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                                    <td className="px-2 py-3 font-semibold text-slate-600">
                                        <input
                                            value={item.remarks || item.return_reason || ''}
                                            disabled={!isEditable}
                                            onChange={(event) => updateDraftItem(item.id, { remarks: event.target.value, return_reason: event.target.value })}
                                            className={`w-full min-w-0 rounded border px-2 py-1 ${isEditable ? 'border-slate-300 bg-white' : 'border-transparent bg-transparent'}`}
                                        />
                                    </td>
                                    {isEditable && (
                                        <td className="px-2 py-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => removeDraftItem(item.id)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                                                aria-label={`Remove ${item.part_no || item.item_code}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-6">
                    <div className="flex flex-col gap-3 text-sm font-bold text-slate-700">
                        <div>Total Items: <span className="ml-2 text-[#175fd3]">{draftItems.length}</span></div>
                        <div>Total Quantity: <span className="ml-2 text-[#175fd3]">{draftItems.reduce((sum, item) => sum + (Number(item.qty_returned) || 0), 0)}</span></div>
                    </div>
                    <div className="flex w-64 flex-col gap-3 text-sm">
                        <div className="flex justify-between font-semibold text-slate-600">
                            <span>Total Cost:</span>
                            <span>₱{draftItems.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="mt-2 flex justify-between border-t border-slate-300 pt-3 text-base font-extrabold text-slate-800">
                            <span>Grand Total:</span>
                            <span className="text-[#175fd3]">₱{draftItems.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-[100px_1fr] items-center gap-4 text-sm">
                    <span className="font-semibold text-slate-500">Prepared By:</span>
                    <span className="font-bold text-slate-700">Master</span>
                    <span className="font-semibold text-slate-500">Prepared Date:</span>
                    <span className="font-bold text-slate-700">{new Date(returnRecord.return_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
            </div>

            <ConfirmModal
                isOpen={finalizeModalOpen}
                onClose={() => {
                    if (!processing) {
                        setFinalizeModalOpen(false);
                    }
                }}
                onConfirm={handleFinalize}
                title="Post Return to Supplier"
                message={`Post ${returnRecord.return_no}? This will deduct inventory for the returned items. You can unpost it later if the record needs correction.`}
                confirmLabel={processing ? 'Posting...' : 'Post Return to Supplier'}
                cancelLabel="Cancel"
                variant="warning"
            />
            <ConfirmModal
                isOpen={unpostModalOpen}
                onClose={() => {
                    if (!processing) {
                        setUnpostModalOpen(false);
                    }
                }}
                onConfirm={handleUnpost}
                title="Unpost Return to Supplier"
                message={`Unpost ${returnRecord.return_no}? This will remove the inventory movement and return the record to Pending so it can be edited and posted again.`}
                confirmLabel={processing ? 'Unposting...' : 'Unpost'}
                cancelLabel="Cancel"
                variant="warning"
            />
        </section>
    );
};

export default ReturnToSupplierView;
