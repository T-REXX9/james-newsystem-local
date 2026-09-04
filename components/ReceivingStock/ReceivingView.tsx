import React, { useState, useEffect } from 'react';
import {
    ReceivingReportWithDetails,
    INCOMPLETE_DELIVERY_REASONS,
    PARTIAL_DELIVERY_REASON,
    remainingQuantityAfterReceipt,
    shouldCloseRemainingPoQty,
} from '../../receiving.types';
import { receivingService } from '../../services/receivingService';
import { parseOptionalNumberInput } from '../../utils/formValidation';
import { useToast } from '../ToastProvider';
import { ArrowLeft, Printer, CheckCircle, Trash2, Calendar, FileText, Loader2, AlertCircle, Plus } from 'lucide-react';
import CustomLoadingSpinner from '../CustomLoadingSpinner';
import RecoveryReasonModal from '../RecoveryReasonModal';
import ModuleRecordLink from '../ModuleRecordLink';

interface ReceivingViewProps {
    rrId: string;
    onBack: () => void;
    onCreateNew: () => void;
}

type LineDraft = { qty: number | ''; unitCost: number | '' };

const seedLineDrafts = (items: ReceivingReportWithDetails['items'] | undefined): Record<string, LineDraft> => {
    const drafts: Record<string, LineDraft> = {};
    for (const item of items || []) {
        const qty = Number(item.qty_received);
        const unitCost = Number(item.unit_cost);
        drafts[item.id] = {
            qty: Number.isFinite(qty) && qty > 0 ? qty : '',
            unitCost: Number.isFinite(unitCost) ? unitCost : '',
        };
    }
    return drafts;
};

const applyLineDrafts = (
    report: ReceivingReportWithDetails,
    drafts: Record<string, LineDraft>
): ReceivingReportWithDetails => ({
    ...report,
    items: (report.items || []).map((item) => {
        const draft = drafts[item.id];
        const qty = draft?.qty === '' || draft?.qty == null ? 0 : Number(draft.qty);
        const unitCost = draft?.unitCost === '' || draft?.unitCost == null
            ? Number(item.unit_cost || 0)
            : Number(draft.unitCost);
        return {
            ...item,
            qty_received: qty,
            unit_cost: unitCost,
            total_amount: qty * unitCost,
        };
    }),
});

const validateLineDrafts = (
    report: ReceivingReportWithDetails,
    drafts: Record<string, LineDraft>
): string | null => {
    for (const item of report.items || []) {
        const draft = drafts[item.id];
        const qty = Number(draft?.qty);
        const ordered = Number(item.qty_ordered || 0);
        if (draft?.qty === '' || !Number.isFinite(qty) || qty <= 0) {
            return 'Quantity received must be greater than zero';
        }
        if (ordered > 0 && qty > ordered) {
            return `Quantity cannot exceed the ordered quantity (${ordered}).`;
        }
        const unitCost = draft?.unitCost === '' ? 0 : Number(draft?.unitCost);
        if (!Number.isFinite(unitCost) || unitCost < 0) {
            return 'Unit cost cannot be negative';
        }
    }
    return null;
};

const ReceivingView: React.FC<ReceivingViewProps> = ({ rrId, onBack, onCreateNew }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [rr, setRr] = useState<ReceivingReportWithDetails | null>(null);
    const [finalizing, setFinalizing] = useState(false);
    const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
    const [incompleteDeliveryReason, setIncompleteDeliveryReason] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [recoveryAction, setRecoveryAction] = useState<'unpost' | 'delete' | null>(null);
    const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});

    const fetchRR = async () => {
        setLoading(true);
        try {
            const data = await receivingService.getReceivingReportById(rrId);
            setRr(data);
            setLineDrafts(seedLineDrafts(data.items));
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
        const lineError = validateLineDrafts(rr, lineDrafts);
        if (lineError) {
            addToast({ type: 'error', message: lineError });
            return;
        }
        const drafted = applyLineDrafts(rr, lineDrafts);
        const remainingQty = remainingQuantityAfterReceipt(drafted);
        const isIncompleteDelivery = remainingQty > 0;
        if (isIncompleteDelivery && !incompleteDeliveryReason) {
            addToast({ type: 'error', message: 'Select a reason for the incomplete delivery.' });
            return;
        }
        setFinalizing(true);
        try {
            for (const item of drafted.items || []) {
                const original = rr.items?.find((candidate) => candidate.id === item.id);
                if (
                    Number(original?.qty_received || 0) !== Number(item.qty_received || 0)
                    || Number(original?.unit_cost || 0) !== Number(item.unit_cost || 0)
                ) {
                    await receivingService.updateReceivingReportItem(item.id, {
                        rr_id: rr.id,
                        qty_received: Number(item.qty_received),
                        unit_cost: Number(item.unit_cost),
                    });
                }
            }
            if (isIncompleteDelivery) {
                await receivingService.finalizeReceivingReport(rr.id, {
                    // Partial delivery keeps the remaining PO quantity open; other reasons close it.
                    closeRemainingPoQty: shouldCloseRemainingPoQty(incompleteDeliveryReason),
                    incompleteDeliveryReason,
                });
            } else {
                await receivingService.finalizeReceivingReport(rr.id);
            }
            addToast({ type: 'success', message: "Receiving Report finalized and inventory updated!" });
            await fetchRR(); // Refresh to see updated status
            setShowFinalizeConfirm(false);
            setIncompleteDeliveryReason('');
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

    const canEditItems = ['Draft', 'Pending', 'Unposted'].includes(rr?.status || '');

    const updateLineDraft = (itemId: string, field: keyof LineDraft, value: number | '') => {
        setLineDrafts((current) => ({
            ...current,
            [itemId]: {
                qty: current[itemId]?.qty ?? '',
                unitCost: current[itemId]?.unitCost ?? '',
                [field]: value,
            },
        }));
    };

    const openPostModal = () => {
        if (!rr) return;
        const lineError = validateLineDrafts(rr, lineDrafts);
        if (lineError) {
            addToast({ type: 'error', message: lineError });
            return;
        }
        setIncompleteDeliveryReason('');
        setShowFinalizeConfirm(true);
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
        : rr.status === 'Unposted' ? 'bg-amber-100 text-amber-800'
        : rr.status === 'Posted' ? 'bg-emerald-100 text-emerald-700'
        : rr.status === 'Cancelled' ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-700';

    const drafted = applyLineDrafts(rr, lineDrafts);
    const totalOrdered = drafted.items?.reduce((sum, item) => sum + (item.qty_ordered || item.qty_received || 0), 0) || 0;
    const totalReceived = drafted.items?.reduce((sum, item) => sum + (item.qty_received || 0), 0) || 0;
    const remainingQty = remainingQuantityAfterReceipt(drafted);
    const hasIncompleteDelivery = remainingQty > 0;
    const etaDate = rr.eta_date || rr.po?.items?.find(item => item.eta_date)?.eta_date || null;
    const liveGrandTotal = drafted.items?.reduce((sum, item) => sum + Number(item.total_amount || 0), 0) || 0;

    return (
        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#173c83]">Receiving Report: {rr.rr_no}</h2>
                    <span className={`rounded-md px-3 py-1 text-sm font-bold ${statusColor}`}>{rr.status || 'Draft'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onCreateNew} className="inline-flex items-center gap-2 rounded-md bg-[#175fd3] px-4 py-2 text-sm font-bold text-white hover:bg-[#0e4fb7] print:hidden">
                        <Plus className="h-4 w-4" /> New RR
                    </button>
                    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 print:hidden">
                        <Printer className="h-4 w-4" /> Print RR
                    </button>
                    <button onClick={() => setShowHistory(true)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 print:hidden">
                        <FileText className="h-4 w-4" /> View History
                    </button>
                    {['Posted', 'Delivered'].includes(rr.status) && <button onClick={() => setRecoveryAction('unpost')} className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 print:hidden"><AlertCircle className="h-4 w-4" /> Unpost</button>}
                    {['Draft', 'Unposted'].includes(rr.status) && <button onClick={() => setRecoveryAction('delete')} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 print:hidden"><Trash2 className="h-4 w-4" /> Delete</button>}
                    {['Draft', 'Unposted'].includes(rr.status) ? (
                        <button onClick={openPostModal} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 print:hidden">
                            <CheckCircle className="h-4 w-4" /> Post Receiving
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="p-6">
                <div className="mb-5 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="font-bold text-indigo-800">Delivery status: {rr.cycle_status || (hasIncompleteDelivery ? 'Incomplete Delivery' : 'Complete Delivery')}</span>
                        <span>Ordered <b>{Number(rr.ordered_qty ?? totalOrdered)}</b> · Received <b>{Number(rr.received_qty ?? totalReceived)}</b> · Remaining <b>{Number(rr.remaining_qty ?? Math.max(0, totalOrdered - totalReceived))}</b></span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <span className="font-bold text-slate-500">Related documents:</span>
                        {rr.po?.pr_reference ? (rr.po.pr_refno ? <ModuleRecordLink tab="warehouse-purchasing-purchase-request" payload={{ prId: rr.po.pr_refno }} className="font-bold text-[#175fd3] hover:underline">PR {rr.po.pr_reference}</ModuleRecordLink> : <span>PR <b className="text-[#175fd3]">{rr.po.pr_reference}</b></span>) : null}
                        {rr.po_refno ? <ModuleRecordLink tab="purchases-transaction-purchase-order" payload={{ poId: rr.po_refno }} className="font-bold text-[#175fd3] hover:underline">PO {rr.po_no}</ModuleRecordLink> : <span>PO {rr.po_no || '—'}</span>}
                        {(rr.return_records || []).map((returnRecord) => <ModuleRecordLink key={returnRecord.id} tab="warehouse-purchasing-return-to-supplier" payload={{ returnId: returnRecord.id }} className="font-bold text-[#175fd3] hover:underline">Return {returnRecord.return_no}</ModuleRecordLink>)}
                    </div>
                    {rr.incomplete_delivery_reason ? <p className="mt-2 text-xs text-amber-800"><b>Reason for incomplete delivery:</b> {rr.incomplete_delivery_reason}</p> : null}
                </div>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-slate-200 p-5">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-orange-500">PR No.</span>
                        <span className="text-2xl font-bold text-orange-500">{rr.po?.pr_reference || 'PR-UNKNOWN'}</span>
                        <span className="mt-2 text-xs font-semibold text-slate-500">PR Date</span>
                        <span className="text-sm font-semibold text-slate-700">{rr.po?.order_date ? new Date(rr.po.order_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}</span>
                    </div>

                    <ArrowLeft className="hidden h-6 w-6 rotate-180 text-slate-300 xl:block" />

                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#175fd3]">PO No.</span>
                        <span className="text-2xl font-bold text-[#175fd3]">{rr.po_no || '-'}</span>
                        <span className="mt-2 text-xs font-semibold text-slate-500">PO Date</span>
                        <span className="text-sm font-semibold text-slate-700">{rr.po?.order_date ? new Date(rr.po.order_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}</span>
                    </div>

                    <ArrowLeft className="hidden h-6 w-6 rotate-180 text-slate-300 xl:block" />

                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-emerald-600">RR No.</span>
                        <span className="text-2xl font-bold text-emerald-600">{rr.rr_no}</span>
                        <span className="mt-2 text-xs font-semibold text-slate-500">RR Date</span>
                        <span className="text-sm font-semibold text-slate-700">{new Date(rr.receive_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>

                    <div className="hidden h-24 w-px bg-slate-200 xl:block"></div>

                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-slate-400" />
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">ETA Date</span>
                        </div>
                        <span className="mt-1 text-lg font-bold text-slate-800">{etaDate ? new Date(etaDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}</span>
                        <span className="text-xs font-semibold text-slate-500">(Estimated Arrival)</span>
                    </div>
                </div>

                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-800">Items Received</h3>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full table-fixed border-collapse text-xs">
                        <colgroup>
                            <col className="w-[4%]" />
                            <col className="w-[11%]" />
                            <col className="w-[18%]" />
                            <col className="w-[11%]" />
                            <col className="w-[11%]" />
                            <col className="w-[10%]" />
                            <col className="w-[9%]" />
                            <col className="w-[10%]" />
                            <col className="w-[8%]" />
                            <col className="w-[8%]" />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[9px] font-bold uppercase leading-tight tracking-wide text-slate-500">
                                <th className="break-words px-2 py-3 text-center">#</th>
                                <th className="break-words px-2 py-3">Item Code</th>
                                <th className="break-words px-2 py-3">Description</th>
                                <th className="break-words px-2 py-3">Original P/N</th>
                                <th className="break-words px-2 py-3">Part No.</th>
                                <th className="break-words px-2 py-3">Brand</th>
                                <th className="break-words px-2 py-3 text-center">Qty Ordered</th>
                                <th className="break-words px-2 py-3 text-center">Qty Received</th>
                                <th className="break-words px-2 py-3 text-right">Unit Cost</th>
                                <th className="break-words px-2 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!rr.items?.length ? (
                                <tr><td colSpan={10} className="py-12 text-center text-sm text-slate-500">No items received.</td></tr>
                            ) : drafted.items.map((item, index) => {
                                const draft = lineDrafts[item.id] || { qty: item.qty_received || '', unitCost: item.unit_cost || '' };
                                return (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="break-words px-2 py-3 text-center font-semibold text-slate-500">{index + 1}</td>
                                    <td className="break-words px-2 py-3 text-[13px] font-bold text-slate-700">{item.item_code || '-'}</td>
                                    <td className="break-words px-2 py-3 font-semibold text-slate-700">{item.description || '-'}</td>
                                    <td className="break-words px-2 py-3 font-semibold text-slate-600">{item.original_part_no || '-'}</td>
                                    <td className="break-words px-2 py-3 text-[13px] font-bold text-[#173c83]">{item.part_no || '-'}</td>
                                    <td className="break-words px-2 py-3 font-semibold text-slate-600">{item.brand || item.product?.brand || '-'}</td>
                                    <td className="break-words px-2 py-3 text-center font-semibold text-slate-600">{item.qty_ordered || item.qty_received || 0}</td>
                                    <td className="break-words px-2 py-3 text-center font-bold text-slate-700">{canEditItems ? <input aria-label={`Edit quantity received ${index + 1}`} type="number" min="1" value={draft.qty} onChange={(event) => updateLineDraft(item.id, 'qty', parseOptionalNumberInput(event.target.value))} className="h-8 w-full min-w-0 rounded border border-slate-300 px-1 text-center" /> : (item.qty_received || 0)}</td>
                                    <td className="break-words px-2 py-3 text-right font-semibold text-slate-600">{canEditItems ? <input aria-label={`Edit unit cost ${index + 1}`} type="number" min="0" step="0.01" value={draft.unitCost} onChange={(event) => updateLineDraft(item.id, 'unitCost', parseOptionalNumberInput(event.target.value))} className="h-8 w-full min-w-0 rounded border border-slate-300 px-1 text-right" /> : (item.unit_cost ? item.unit_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')}</td>
                                    <td className="break-words px-2 py-3 text-right font-bold text-slate-700">{item.total_amount ? item.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                </tr>
                                );
                            })}
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
                            <span>{liveGrandTotal ? liveGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-slate-600">
                            <span>Total COGS:</span>
                            <span>-</span>
                        </div>
                        <div className="mt-2 flex justify-between border-t border-slate-300 pt-3 text-base font-extrabold text-slate-800">
                            <span>Grand Total:</span>
                            <span className="text-[#175fd3]">{liveGrandTotal ? liveGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
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
                            This will post the report, update inventory stock quantities, and create inventory logs. It can be reversed later by unposting with a reason.
                        </p>
                        {hasIncompleteDelivery ? (
                            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                <p className="font-semibold">Incomplete Delivery</p>
                                <p className="mt-1 text-amber-800">
                                    Received quantity is less than the PO quantity. Select a reason for the remaining {remainingQty} unit(s) before posting.
                                </p>
                                <fieldset className="mt-3">
                                    <legend className="font-semibold">Reason</legend>
                                    <div className="mt-2 flex flex-col gap-2">
                                        {INCOMPLETE_DELIVERY_REASONS.map((reason) => (
                                            <label key={reason} className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-200 bg-white p-2 text-slate-800">
                                                <input
                                                    type="radio"
                                                    name="incomplete-delivery-reason"
                                                    value={reason}
                                                    checked={incompleteDeliveryReason === reason}
                                                    onChange={() => setIncompleteDeliveryReason(reason)}
                                                    className="mt-1"
                                                />
                                                <span>{reason}</span>
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                                {incompleteDeliveryReason === PARTIAL_DELIVERY_REASON ? (
                                    <p className="mt-2 text-xs text-amber-800">The remaining PO quantity will stay open for a follow-up delivery.</p>
                                ) : incompleteDeliveryReason ? (
                                    <p className="mt-2 text-xs text-amber-800">The remaining PO quantity will be closed.</p>
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
                                disabled={finalizing || (hasIncompleteDelivery && !incompleteDeliveryReason)}
                                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex justify-center items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
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
                            {rr.remarks ? <div className="flex justify-between gap-4 px-4 py-3"><dt className="font-semibold text-slate-500">Receiving / incomplete delivery note</dt><dd className="max-w-xs text-right text-slate-800">{rr.remarks}</dd></div> : null}
                            <div className="flex justify-between gap-4 px-4 py-3"><dt className="font-semibold text-slate-500">Last recorded timestamp</dt><dd className="text-right text-slate-800">{rr.created_at ? new Date(rr.created_at).toLocaleString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</dd></div>
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
