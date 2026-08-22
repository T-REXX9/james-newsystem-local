import React, { useState, useEffect } from 'react';
import { SupplierReturn, SupplierReturnItem } from '../../returnToSupplier.types';
import { returnToSupplierService } from '../../services/returnToSupplierService';
import StatusBadge from '../StatusBadge';
import { Send, Printer } from 'lucide-react';
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

    const handleFinalize = async () => {
        setProcessing(true);
        try {
            await returnToSupplierService.finalizeReturn(returnRecord.id);
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

    const handlePrint = () => {
        // Implement print logic here or open new window
        window.print();
    };

    const statusColor = returnRecord.status === 'Draft' || returnRecord.status === 'Pending' ? 'bg-orange-100 text-orange-700'
        : returnRecord.status === 'Posted' ? 'bg-emerald-100 text-emerald-700'
        : returnRecord.status === 'Cancelled' ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-700';

    return (
        <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#173c83]">Return to Supplier: {returnRecord.return_no}</h2>
                    <span className={`rounded-md px-3 py-1 text-sm font-bold ${statusColor}`}>{returnRecord.status || 'Draft'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        <Printer className="h-4 w-4" /> Print Return
                    </button>
                    {returnRecord.status === 'Pending' && (
                        <button
                            onClick={() => setFinalizeModalOpen(true)}
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                            <Send className="h-4 w-4" />
                            {processing ? 'Posting...' : 'Post Return to Supplier'}
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6">
                <div className="mb-8 grid grid-cols-2 gap-x-12 gap-y-6">
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-sm font-bold text-slate-500">Supplier <span className="text-rose-500">*</span></span>
                        <input value={returnRecord.supplier_name || ''} disabled className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700" />
                    </div>
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-sm font-bold text-slate-500">Date <span className="text-rose-500">*</span></span>
                        <input value={new Date(returnRecord.return_date).toLocaleDateString('en-GB')} disabled className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700" />
                    </div>
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-sm font-bold text-slate-500">Ship VIA</span>
                        <input value="-" disabled className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700" />
                    </div>
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-sm font-bold text-slate-500">Tracking No.</span>
                        <input value="-" disabled className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700" />
                    </div>
                    <div className="grid grid-cols-[100px_1fr] items-start gap-4">
                        <span className="pt-2 text-sm font-bold text-slate-500">Remarks</span>
                        <textarea value={returnRecord.remarks || ''} disabled rows={3} className="w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700" />
                    </div>
                </div>

                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-800">Items Returned</h3>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[900px] border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-3 text-center">#</th>
                                <th className="px-4 py-3 text-center">Qty</th>
                                <th className="px-4 py-3">Item Code</th>
                                <th className="px-4 py-3">Part No.</th>
                                <th className="px-4 py-3">Brand</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 text-right">Cost</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="py-12 text-center text-sm text-slate-500">Loading items...</td></tr>
                            ) : !items.length ? (
                                <tr><td colSpan={9} className="py-12 text-center text-sm text-slate-500">No items returned.</td></tr>
                            ) : items.map((item, index) => (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-3 text-center font-semibold text-slate-500">{index + 1}</td>
                                    <td className="px-4 py-3 text-center font-bold text-slate-700">
                                        <div className="mx-auto flex h-8 w-16 items-center justify-center rounded border border-slate-200 bg-white">{item.qty_returned}</div>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">{item.item_code || '-'}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">{item.part_no || '-'}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">-</td>
                                    <td className="px-4 py-3 font-semibold text-slate-700">{item.description || '-'}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-600">{item.unit_cost ? item.unit_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-700">{item.total_amount ? item.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">{item.return_reason || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-6">
                    <div className="flex flex-col gap-3 text-sm font-bold text-slate-700">
                        <div>Total Items: <span className="ml-2 text-[#175fd3]">{items.length}</span></div>
                        <div>Total Quantity: <span className="ml-2 text-[#175fd3]">{items.reduce((sum, item) => sum + (item.qty_returned || 0), 0)}</span></div>
                    </div>
                    <div className="flex w-64 flex-col gap-3 text-sm">
                        <div className="flex justify-between font-semibold text-slate-600">
                            <span>Total Cost:</span>
                            <span>₱{returnRecord.grand_total ? returnRecord.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
                        </div>
                        <div className="mt-2 flex justify-between border-t border-slate-300 pt-3 text-base font-extrabold text-slate-800">
                            <span>Grand Total:</span>
                            <span className="text-[#175fd3]">₱{returnRecord.grand_total ? returnRecord.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-[100px_1fr] items-center gap-4 text-sm">
                    <span className="font-semibold text-slate-500">Prepared By:</span>
                    <span className="font-bold text-slate-700">Master</span>
                    <span className="font-semibold text-slate-500">Prepared Date:</span>
                    <span className="font-bold text-slate-700">{new Date(returnRecord.return_date).toLocaleDateString('en-GB')}</span>
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
                message={`Post ${returnRecord.return_no}? This will deduct inventory for the returned items and cannot be undone.`}
                confirmLabel={processing ? 'Posting...' : 'Post Return to Supplier'}
                cancelLabel="Cancel"
                variant="warning"
            />
        </section>
    );
};

export default ReturnToSupplierView;
