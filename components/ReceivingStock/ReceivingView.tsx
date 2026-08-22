import React, { useState, useEffect } from 'react';
import { ReceivingReportWithDetails, RR_STATUS_COLORS } from '../../receiving.types';
import { receivingService } from '../../services/receivingService';
import { useToast } from '../ToastProvider';
import { ArrowLeft, Printer, CheckCircle, Trash2, Calendar, User, FileText, Loader2, AlertCircle } from 'lucide-react';
import CustomLoadingSpinner from '../CustomLoadingSpinner';

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
        setFinalizing(true);
        try {
            await receivingService.finalizeReceivingReport(rr.id);
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

    return (
        <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#173c83]">Receiving Report: {rr.rr_no}</h2>
                    <span className={`rounded-md px-3 py-1 text-sm font-bold ${statusColor}`}>{rr.status || 'Draft'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => addToast({ type: 'info', message: 'Print functionality coming soon' })} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        <Printer className="h-4 w-4" /> Print RR
                    </button>
                    <button onClick={() => addToast({ type: 'info', message: 'History view coming soon' })} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        <FileText className="h-4 w-4" /> View History
                    </button>
                    {rr.status === 'Draft' ? (
                        <button onClick={() => setShowFinalizeConfirm(true)} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                            <CheckCircle className="h-4 w-4" /> Post Receiving
                        </button>
                    ) : rr.status === 'Posted' ? (
                        <button onClick={() => addToast({ type: 'error', message: 'Unpost is not currently supported by the backend.' })} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">
                            Unpost Receiving
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
                        <span className="mt-1 text-lg font-bold text-slate-800">{rr.po?.items?.[0]?.eta_date ? new Date(rr.po.items[0].eta_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-'}</span>
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
                                    <td className="px-4 py-3 font-semibold text-slate-600">-</td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">{item.part_no || '-'}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-600">{item.product?.brand || '-'}</td>
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
        </div>
    );
};

export default ReceivingView;
