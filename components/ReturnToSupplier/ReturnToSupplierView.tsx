import React, { useState, useEffect } from 'react';
import { SupplierReturn, SupplierReturnItem } from '../../returnToSupplier.types';
import { returnToSupplierService } from '../../services/returnToSupplierService';
import StatusBadge from '../StatusBadge';
import { Send, Printer } from 'lucide-react';
import { dispatchWorkflowNotification } from '../../services/supabaseService';

interface ReturnToSupplierViewProps {
    returnRecord: SupplierReturn;
    onUpdate: () => void; // Refresh list
}

const ReturnToSupplierView: React.FC<ReturnToSupplierViewProps> = ({ returnRecord, onUpdate }) => {
    const [items, setItems] = useState<SupplierReturnItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

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
        if (!confirm('Are you sure you want to finalize this return? This will deduct inventory and cannot be undone.')) return;

        setProcessing(true);
        try {
            await returnToSupplierService.finalizeReturn(returnRecord.id);
            await dispatchWorkflowNotification({
                title: 'Supplier Return Finalized',
                message: `Return ${returnRecord.return_no} has been posted.`,
                type: 'success',
                action: 'finalize',
                status: 'success',
                entityType: 'supplier_return',
                entityId: returnRecord.id,
                actionUrl: `/return-to-supplier?returnId=${returnRecord.id}`,
                targetRoles: ['Owner', 'Manager', 'Support'],
                includeActor: true,
            });
            onUpdate();
        } catch (err: any) {
            console.error(err);
            await dispatchWorkflowNotification({
                title: 'Supplier Return Finalization Failed',
                message: `Failed to finalize return ${returnRecord.return_no}.`,
                type: 'error',
                action: 'finalize',
                status: 'failed',
                entityType: 'supplier_return',
                entityId: returnRecord.id,
                actionUrl: `/return-to-supplier?returnId=${returnRecord.id}`,
                targetRoles: ['Owner', 'Manager', 'Support'],
                includeActor: true,
            });
            alert('Error finalizing: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handlePrint = () => {
        // Implement print logic here or open new window
        window.print();
    };

    return (
        <div className="p-6 space-y-6 flex-1 overflow-y-auto h-full">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{returnRecord.return_no}</h2>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span>{new Date(returnRecord.return_date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{returnRecord.supplier_name}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <StatusBadge
                        status={returnRecord.status.toLowerCase()}
                        label={returnRecord.status}
                        tone={returnRecord.status === 'Posted' ? 'success' : 'neutral'}
                    />
                </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 uppercase">From Receiving Report</div>
                    <div className="font-semibold dark:text-white">{returnRecord.rr_no}</div>
                    <div className="text-xs text-gray-400">PO: {returnRecord.po_no || 'N/A'}</div>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 uppercase">Total Amount</div>
                    <div className="font-semibold text-lg text-brand-blue">₱{returnRecord.grand_total.toLocaleString()}</div>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 uppercase">Remarks</div>
                    <div className="text-sm dark:text-gray-300">{returnRecord.remarks || '-'}</div>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Return Items</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Item</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Reason</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">Qty</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">Unit Cost</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={5} className="p-4 text-center">Loading items...</td></tr>
                            ) : items.map((item) => (
                                <tr key={item.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium dark:text-white">{item.part_no || item.item_code}</div>
                                        <div className="text-xs text-gray-500">{item.description}</div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                                            {item.return_reason}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right dark:text-white">{item.qty_returned}</td>
                                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">₱{item.unit_cost.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-medium dark:text-white">₱{item.total_amount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                    <Printer className="w-4 h-4" />
                    Print
                </button>

                {returnRecord.status === 'Pending' && (
                    <button
                        onClick={handleFinalize}
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                        <Send className="w-4 h-4" />
                        {processing ? 'Finalizing...' : 'Finalize Return'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default ReturnToSupplierView;
