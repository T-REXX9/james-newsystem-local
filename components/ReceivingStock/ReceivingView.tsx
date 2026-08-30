import React, { useState, useEffect } from 'react';
import { ReceivingReportWithDetails, RR_STATUS_COLORS } from '../../receiving.types';
import { receivingService } from '../../services/receivingService';
import { useToast } from '../ToastProvider';
import { ArrowLeft, Printer, CheckCircle, Trash2, Calendar, User, FileText, Loader2, AlertCircle } from 'lucide-react';
import CustomLoadingSpinner from '../CustomLoadingSpinner';
import RecoveryReasonModal from '../RecoveryReasonModal';

interface ReceivingViewProps {
    rrId: string;
    onBack: () => void;
}

const ReceivingView: React.FC<ReceivingViewProps> = ({ rrId, onBack }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [rr, setRr] = useState<ReceivingReportWithDetails | null>(null);
    const [finalizing, setFinalizing] = useState(false);
    const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
    const [closeShortReceipt, setCloseShortReceipt] = useState(false);
    const [shortReceiptReason, setShortReceiptReason] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [recoveryAction, setRecoveryAction] = useState<'unpost' | 'delete' | null>(null);

    const fetchRR = async () => {
        setLoading(true);
        try {
            const data = await receivingService.getReceivingReportById(rrId);
            setRr(data);
        } catch (error) {
            console.error("Error fetching RR:", error);
            addToast({ type: 'error', message: "Failed to load Receiving Report" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (rrId) {
            fetchRR();
        }
    }, [rrId]);

    const handleFinalize = async () => {
        if (!rr) return;
        if (closeShortReceipt && !shortReceiptReason.trim()) {
            addToast({ type: 'error', message: 'Enter the reason the supplier cannot deliver the remaining quantity.' });
            return;
        }
        setFinalizing(true);
        try {
            if (closeShortReceipt) {
                await receivingService.finalizeReceivingReport(rr.id, {
                    closeRemainingPoQty: true,
                    shortReceiptReason: shortReceiptReason.trim(),
                });
            } else {
                await receivingService.finalizeReceivingReport(rr.id);
            }
            addToast({ type: 'success', message: "Receiving Report finalized and inventory updated!" });
            await fetchRR(); // Refresh to see updated status
            setShowFinalizeConfirm(false);
        } catch (error: any) {
            console.error("Error finalizing RR:", error);
            addToast({ type: 'error', message: error.message || "Failed to finalize Receiving Report" });
        } finally {
            setFinalizing(false);
        }
    };

    const handleRecovery = async (kind: 'unpost' | 'delete', reason: string) => {
        if (!rr) return;
            try {
                if (kind === 'unpost') await receivingService.unpostReceivingReport(rr.id, reason);
                else await receivingService.deleteReceivingReport(rr.id, reason);
                addToast({ type: 'success', message: `${kind === 'unpost' ? 'Receiving Report unposted' : 'Receiving Report deleted'}.` });
                if (kind === 'delete') onBack(); else await fetchRR();
            } catch (error: any) {
                addToast({ type: 'error', message: error.message || `Failed to ${kind} Receiving Report` });
                throw error;
            }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-20">
                <div className="mb-4">
                    <CustomLoadingSpinner label="Loading" />
                </div>
                <p className="text-slate-500">Loading details...</p>
            </div>
        );
    }

    if (!rr) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Receiving Report not found</p>
                <button onClick={onBack} className="mt-4 text-blue-500 hover:underline">Go Back</button>
            </div>
        );
    }

    const statusColor = rr.status === 'Draft' || rr.status === 'Pending' ? 'bg-orange-100 text-orange-700'
        : rr.status === 'Posted' ? 'bg-emerald-100 text-emerald-700'
        : rr.status === 'Cancelled' ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-700';

    const totalOrdered = rr.items?.reduce((sum, item) => sum + (item.qty_ordered || item.qty_received || 0), 0) || 0;
    const totalReceived = rr.items?.reduce((sum, item) => sum + (item.qty_received || 0), 0) || 0;
    const hasShortReceipt = totalReceived < totalOrdered;
    const etaDate = rr.eta_date || rr.po?.items?.find(item => item.eta_date)?.eta_date || null;

    return (
        <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#173c83]">Receiving Report: {rr.rr_no}</h2>
                    <span className={`rounded-md px-3 py-1 text-sm font-bold ${statusColor}`}>{rr.status || 'Draft'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 print:hidden">
                        <Printer className="h-4 w-4" /> Print RR
                    </button>
                    <button onClick={() => setShowHistory(true)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 print:hidden">
                        <FileText className="h-4 w-4" /> View History
                    </button>
                    {['Posted', 'Delivered'].includes(rr.status) && <button onClick={() => setRecoveryAction('unpost')} className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 print:hidden"><AlertCircle className="h-4 w-4" /> Unpost</button>}
                    {['Draft', 'Unposted'].includes(rr.status) && <button onClick={() => setRecoveryAction('delete')} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 print:hidden"><Trash2 className="h-4 w-4" /> Delete</button>}
                    {rr.status === 'Draft' ? (
                        <button onClick={() => { setCloseShortReceipt(false); setShortReceiptReason(''); setShowFinalizeConfirm(true); }} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 print:hidden">
                            <CheckCircle className="h-4 w-4" /> Post Receiving
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="p-6">
                <div className="mb-8 flex items-center justify-between rounded-xl border border-slate-200 p-6">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-orange-500">PR No.</span>
                        <span className="text-2xl font-bold text-orange-500">{rr.po?.pr_reference || 'PR-UNKNOWN'}</span>
                        <span className="mt-2 text-xs font-semibold text-slate-500">PR Date</span>
                        <span className="text-sm font-semibold text-slate-700">{rr.po?.order_date ? new Date(rr.po.order_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-'}</span>
                    </div>

                    <ArrowLeft className="h-6 w-6 rotate-180 text-slate-300" />

                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#175fd3]">PO No.</span>
                        <span className="text-2xl font-bold text-[#175fd3]">{rr.po_no || '-'}</span>
                        <span className="mt-2 text-xs font-semibold text-slate-500">PO Date</span>
                        <span className="text-sm font-semibold text-slate-700">{rr.po?.order_date ? new Date(rr.po.order_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-'}</span>
                    </div>

                    <ArrowLeft className="h-6 w-6 rotate-180 text-slate-300" />

                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-emerald-600">RR No.</span>
                        <span className="text-2xl font-bold text-emerald-600">{rr.rr_no}</span>
                        <span className="mt-2 text-xs font-semibold text-slate-500">RR Date</span>
                        <span className="text-sm font-semibold text-slate-700">{new Date(rr.receive_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                    </div>

                    <div className="h-24 w-px bg-slate-200"></div>

                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-slate-400" />
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">ETA Date</span>
                        </div>
                        <span className="mt-1 text-lg font-bold text-slate-800">{etaDate ? new Date(etaDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-'}</span>
                        <span className="text-xs font-semibold text-slate-500">(Estimated Arrival)</span>
                    </div>
                </div>

                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-800">Items Received</h3>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[1000px] border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-3 text-center">#</th>
                                <th className="px-4 py-3">Item Code</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3">Original P/N</th>
                                <th className="px-4 py-3">Part No.</th>
                                <th className="px-4 py-3">Brand</th>
                                <th className="px-4 py-3 text-center">Qty Ordered</th>
                                <th className="px-4 py-3 text-center">Qty Received</th>
                                <th className="px-4 py-3 text-right">Unit Cost</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!rr.items?.length ? (
                                <tr><td colSpan={10} className="py-12 text-center text-sm text-slate-500">No items received.</td></tr>
                            ) : rr.items.map((item, index) => (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-3 text-center font-semibold text-slate-500">{index + 1}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">{item.item_code || '-'}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-700">{item.description || '-'}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">{item.original_part_no || '-'}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">{item.part_no || '-'}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">{item.brand || item.product?.brand || '-'}</td>
                                    <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.qty_ordered || item.qty_received || 0}</td>
                                    <td className="px-4 py-3 text-center font-bold text-slate-700">{item.qty_received || 0}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-600">{item.unit_cost ? item.unit_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-700">{item.total_amount ? item.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-6">
                    <div className="flex flex-col gap-3 text-sm font-bold text-slate-700">
                        <div>Total Items: <span className="ml-2">{rr.items?.length || 0}</span></div>
                        <div>Total Quantity Received: <span className="ml-2 text-[#175fd3]">{totalReceived}</span></div>
                    </div>
                    <div className="flex w-64 flex-col gap-3 text-sm">
                        <div className="flex justify-between font-semibold text-slate-600">
                            <span>Total Qty Ordered:</span>
                            <span>{totalOrdered}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-slate-600">
                            <span>Total Amount:</span>
                            <span>{rr.grand_total ? rr.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-slate-600">
                            <span>Total COGS:</span>
                            <span>-</span>
                        </div>
                        <div className="mt-2 flex justify-between border-t border-slate-300 pt-3 text-base font-extrabold text-slate-800">
                            <span>Grand Total:</span>
                            <span className="text-[#175fd3]">{rr.grand_total ? rr.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirm Finalize Modal */}
            {showFinalizeConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-center w-12 h-12 bg-green-100 text-green-600 rounded-full mx-auto mb-4">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-center text-slate-800 dark:text-white mb-2">
                            Post Receiving Report?
                        </h3>
                        <p className="text-center text-slate-500 dark:text-slate-400 mb-6">
                            This will post the report, update inventory stock quantities, and create inventory logs. This action cannot be undone.
                        </p>
                        {hasShortReceipt ? (
                            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                <label className="flex cursor-pointer items-start gap-2 font-semibold">
                                    <input type="checkbox" checked={closeShortReceipt} onChange={(event) => setCloseShortReceipt(event.target.checked)} className="mt-1" />
                                    <span>Supplier cannot deliver the remaining {totalOrdered - totalReceived} unit(s). Close the remaining PO quantity as a short receipt.</span>
                                </label>
                                {closeShortReceipt ? (
                                    <textarea value={shortReceiptReason} onChange={(event) => setShortReceiptReason(event.target.value)} placeholder="Reason (e.g. factory shortage, lost/damaged in transit)" className="mt-3 w-full rounded-md border border-amber-300 bg-white p-2 text-sm text-slate-800" rows={3} />
                                ) : null}
                            </div>
                        ) : null}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowFinalizeConfirm(false)}
                                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFinalize}
                                disabled={finalizing}
                                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex justify-center items-center gap-2"
                            >
                                {finalizing && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirm & Post
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="receiving-history-title">
                    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 id="receiving-history-title" className="text-lg font-bold text-slate-800">Receiving Report History</h3>
                                <p className="mt-1 text-sm text-slate-500">Current audit information recorded for {rr.rr_no}.</p>
                            </div>
                            <button type="button" onClick={() => setShowHistory(false)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close history">×</button>
                        </div>
                        <dl className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                            <div className="flex justify-between gap-4 px-4 py-3"><dt className="font-semibold text-slate-500">Created / received by</dt><dd className="text-right text-slate-800">{rr.received_by || '—'}</dd></div>
                            <div className="flex justify-between gap-4 px-4 py-3"><dt className="font-semibold text-slate-500">Report date</dt><dd className="text-right text-slate-800">{rr.receive_date || '—'}</dd></div>
                            <div className="flex justify-between gap-4 px-4 py-3"><dt className="font-semibold text-slate-500">Current status</dt><dd className="text-right font-semibold text-slate-800">{rr.status || 'Draft'}</dd></div>
                            <div className="flex justify-between gap-4 px-4 py-3"><dt className="font-semibold text-slate-500">Items received</dt><dd className="text-right text-slate-800">{rr.item_count ?? rr.items?.length ?? 0}</dd></div>
                            {rr.remarks ? <div className="flex justify-between gap-4 px-4 py-3"><dt className="font-semibold text-slate-500">Receiving / short-receipt note</dt><dd className="max-w-xs text-right text-slate-800">{rr.remarks}</dd></div> : null}
                            <div className="flex justify-between gap-4 px-4 py-3"><dt className="font-semibold text-slate-500">Last recorded timestamp</dt><dd className="text-right text-slate-800">{rr.created_at ? new Date(rr.created_at).toLocaleString('en-PH') : '—'}</dd></div>
                        </dl>
                        <div className="mt-5 flex justify-end"><button type="button" onClick={() => setShowHistory(false)} className="rounded-md bg-[#175fd3] px-4 py-2 text-sm font-bold text-white hover:bg-[#0e4fb7]">Close</button></div>
                    </div>
                </div>
            )}
            <RecoveryReasonModal
                isOpen={recoveryAction !== null}
                action={recoveryAction || 'unpost'}
                recordLabel={rr.rr_no}
                description={recoveryAction === 'unpost' ? 'This reverses the receiving report and reopens the related purchase order when allowed. Returns linked to this report prevent unposting.' : 'This retains an audit record and removes the draft/unposted receiving report from active work.'}
                onClose={() => setRecoveryAction(null)}
                onConfirm={(reason) => handleRecovery(recoveryAction || 'unpost', reason)}
            />
        </div>
    );
};

export default ReceivingView;
