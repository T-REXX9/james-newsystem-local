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

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                            {rr.rr_no}
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${RR_STATUS_COLORS[rr.status || 'Draft'] || 'bg-gray-100 text-gray-800 border-gray-200'
                                }`}>
                                {rr.status || 'Draft'}
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500">
                            created on {new Date(rr.created_at || '').toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Only show Finalize if Draft */}
                    {rr.status === 'Draft' && (
                        <button
                            onClick={() => setShowFinalizeConfirm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow font-medium"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Finalize & Post
                        </button>
                    )}

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    <button
                        // onClick={handlePrint} 
                        // Implement print logic later or map to ReceivingPrint if separate view is needed
                        onClick={() => addToast({ type: 'info', message: 'Print functionality coming soon' })}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium text-sm"
                    >
                        <Printer className="w-4 h-4" />
                        Print
                    </button>

                    {/* Only show Cancel/Delete if Draft */}
                    {rr.status === 'Draft' && (
                        <button
                            onClick={() => addToast({ type: 'info', message: 'Delete functionality coming soon' })}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete Draft"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wide">
                                <User className="w-4 h-4" /> Supplier
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                                {rr.supplier_name}
                            </div>
                            <div className="text-sm text-slate-500">
                                {rr.supplier_id ? 'Registered Supplier' : 'Manual Entry'}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wide">
                                <Calendar className="w-4 h-4" /> Details
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Date Received:</span>
                                    <span className="font-medium dark:text-slate-200">{new Date(rr.receive_date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">PO Reference:</span>
                                    <span className="font-medium dark:text-slate-200">{rr.po_no || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Warehouse:</span>
                                    <span className="font-medium dark:text-slate-200">{rr.warehouse_id}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wide">
                                <FileText className="w-4 h-4" /> Remarks
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 italic">
                                "{rr.remarks || 'No remarks provided'}"
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
                            <h3 className="font-bold text-slate-800 dark:text-white">Line Items</h3>
                            <span className="text-sm text-slate-500">{rr.items?.length || 0} items</span>
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="pl-6 py-3">Item</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-right">Qty</th>
                                    <th className="px-4 py-3 text-right">Unit Cost</th>
                                    <th className="pr-6 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {rr.items && rr.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="pl-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-white">{item.part_no}</div>
                                            <div className="text-xs text-slate-500">{item.item_code}</div>
                                        </td>
                                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                                            {item.description}
                                        </td>
                                        <td className="px-4 py-4 text-right font-medium">
                                            {item.qty_received}
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                                            ₱{(item.unit_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="pr-6 py-4 text-right font-bold text-slate-800 dark:text-white">
                                            ₱{(item.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700">
                                <tr>
                                    <td colSpan={4} className="text-right py-4 px-4 font-bold text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider">
                                        Grand Total
                                    </td>
                                    <td className="text-right py-4 pr-6 font-bold text-xl text-blue-600 dark:text-blue-400">
                                        ₱{(rr.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
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
                            Finalize Receiving Report?
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
