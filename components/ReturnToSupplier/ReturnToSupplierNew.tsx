import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2 } from 'lucide-react';
import { CreateReturnDTO, CreateReturnItemDTO, RRItemForReturn } from '../../returnToSupplier.types';
import { returnToSupplierService } from '../../services/returnToSupplierService';
import { supabase } from '../../lib/supabaseClient'; // For direct queries if needed or user info
import { parseSupabaseError } from '../../utils/errorHandler';
import { useToast } from '../ToastProvider';

interface ReturnToSupplierNewProps {
    onClose: () => void;
    onSuccess: (newReturn: any) => void;
}

const ReturnToSupplierNew: React.FC<ReturnToSupplierNewProps> = ({ onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [step, setStep] = useState<1 | 2>(1); // 1: Select RR, 2: Add Items
    const [loading, setLoading] = useState(false);
    const [rrSearch, setRrSearch] = useState('');
    const [rrResults, setRrResults] = useState<any[]>([]); // Receiving Reports
    const [selectedRR, setSelectedRR] = useState<any | null>(null);

    const [formData, setFormData] = useState<{
        return_date: string;
        remarks: string;
        items: CreateReturnItemDTO[];
    }>({
        return_date: new Date().toISOString().split('T')[0],
        remarks: '',
        items: []
    });

    const [availableItems, setAvailableItems] = useState<RRItemForReturn[]>([]);
    const [itemSearchTerm, setItemSearchTerm] = useState('');
    const [showItemDropdown, setShowItemDropdown] = useState(false);

    // Search RRs
    useEffect(() => {
        const search = async () => {
            if (!rrSearch) {
                setRrResults([]);
                return;
            }
            try {
                const results = await returnToSupplierService.searchRRs(rrSearch);
                setRrResults(results);
            } catch (err) {
                console.error(err);
            }
        };
        const debounce = setTimeout(search, 300);
        return () => clearTimeout(debounce);
    }, [rrSearch]);

    const handleSelectRR = async (rr: any) => {
        setSelectedRR(rr);
        setLoading(true);
        try {
            const items = await returnToSupplierService.getRRItemsForReturn(rr.id);
            setAvailableItems(items);
            setStep(2);
        } catch (err) {
            console.error(err);
            // Handle error
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = (item: RRItemForReturn) => {
        const existing = formData.items.find(i => i.rr_item_id === item.id);
        if (existing) return; // Already added

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, {
                rr_item_id: item.id,
                item_id: item.item_id,
                item_code: item.item_code,
                part_no: item.part_number, // Mapping part_number to part_no
                description: item.description || '',
                qty_returned: 1, // Default 1
                unit_cost: item.unit_cost,
                total_amount: item.unit_cost * 1,
                return_reason: 'Defective',
                remarks: ''
            }]
        }));
        setItemSearchTerm('');
        setShowItemDropdown(false);
    };

    const updateItem = (index: number, field: keyof CreateReturnItemDTO, value: any) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };

            // Recalculate total if qty changed
            if (field === 'qty_returned') {
                const rrItemId = newItems[index].rr_item_id || '';
                const maxQty = availableMaxQty(rrItemId);
                const parsedQty = Number(value);
                const safeQty = Number.isFinite(parsedQty) ? parsedQty : 1;
                const qty = Math.max(1, Math.min(safeQty, maxQty > 0 ? maxQty : 1));
                newItems[index].qty_returned = qty;
                newItems[index].total_amount = qty * newItems[index].unit_cost;
            }

            return { ...prev, items: newItems };
        });
    };

    const removeItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async () => {
        if (!selectedRR) return;

        if (formData.items.length === 0) {
            addToast({
                type: 'error',
                title: 'No items selected',
                description: 'Please add at least one item to return.',
                durationMs: 5000,
            });
            return;
        }

        const normalizedItems = formData.items.map((item) => {
            const maxQty = availableMaxQty(item.rr_item_id || '');
            const qty = Math.max(1, Math.min(Number(item.qty_returned) || 1, maxQty > 0 ? maxQty : 1));
            return {
                ...item,
                qty_returned: qty,
                total_amount: qty * item.unit_cost,
            };
        });

        const invalidItem = normalizedItems.find((item) => {
            const maxQty = availableMaxQty(item.rr_item_id || '');
            return item.qty_returned < 1 || item.qty_returned > maxQty;
        });

        if (invalidItem) {
            addToast({
                type: 'error',
                title: 'Invalid return quantity',
                description: `Quantity for ${invalidItem.part_no || invalidItem.item_code} exceeds available returnable stock.`,
                durationMs: 6000,
            });
            return;
        }

        setLoading(true);

        try {
            const dto: CreateReturnDTO = {
                return_date: formData.return_date,
                return_type: 'purchase',
                rr_id: selectedRR.id,
                rr_no: selectedRR.rr_no || selectedRR.rr_number || '',
                supplier_id: selectedRR.supplier_id,
                supplier_name: selectedRR.supplier_name,
                po_no: selectedRR.po_no || selectedRR.po_number,
                remarks: formData.remarks,
                items: normalizedItems
            };

            const newReturn = await returnToSupplierService.createReturn(dto);
            onSuccess(newReturn);
            addToast({ 
                type: 'success', 
                title: 'Return created',
                description: 'Return to supplier has been created successfully.',
                durationMs: 4000,
            });
        } catch (err) {
            console.error(err);
            addToast({ 
                type: 'error', 
                title: 'Unable to create return',
                description: parseSupabaseError(err, 'return'),
                durationMs: 6000,
            });
        } finally {
            setLoading(false);
        }
    };

    // Filter available items for dropdown
    const filteredAvailableItems = availableItems.filter(item => {
        const search = itemSearchTerm.toLowerCase();
        const alreadyAdded = formData.items.some(i => i.rr_item_id === item.id);
        if (alreadyAdded) return false;

        return item.part_number.toLowerCase().includes(search) ||
            (item.item_code || '').toLowerCase().includes(search) ||
            (item.description && item.description.toLowerCase().includes(search));
    });

    const availableMaxQty = (rrItemId: string) => {
        const item = availableItems.find(i => i.id === rrItemId);
        if (!item) return 0;
        return item.quantity_received - item.qty_returned_already;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">New Return to Supplier</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium dark:text-white">Select Receiving Report</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by RR Number..."
                                    value={rrSearch}
                                    onChange={(e) => setRrSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>

                            <div className="mt-4 space-y-2">
                                {rrResults.map(rr => (
                                    <div
                                        key={rr.id}
                                        onClick={() => handleSelectRR(rr)}
                                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                                    >
                                        <div className="flex justify-between">
                                            <span className="font-bold text-gray-900 dark:text-white">{rr.rr_no || rr.rr_number}</span>
                                            <span className="text-sm text-gray-500">{new Date(rr.received_date || rr.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            Supplier: {rr.supplier_name} | PO: {rr.po_no || rr.po_number || 'N/A'}
                                        </div>
                                    </div>
                                ))}
                                {rrSearch && rrResults.length === 0 && (
                                    <div className="text-center text-gray-500 py-4">No RRs found (must be Posted)</div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && selectedRR && (
                        <div className="space-y-6">
                            {/* Header Info */}
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Supplier</label>
                                    <div className="font-medium dark:text-white">{selectedRR.supplier_name}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">RR Number</label>
                                    <div className="font-medium dark:text-white">{selectedRR.rr_no || selectedRR.rr_number}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">PO Number</label>
                                    <div className="font-medium dark:text-white">{selectedRR.po_no || selectedRR.po_number || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Return Date</label>
                                    <input
                                        type="date"
                                        value={formData.return_date}
                                        onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                                        className="block w-full bg-white dark:bg-gray-800 border-none rounded px-2 py-1 mt-1 text-sm focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Remarks</label>
                                <textarea
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter reason for return..."
                                    rows={2}
                                />
                            </div>

                            {/* Items Section */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Return Items</label>

                                {/* Item Search Add */}
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search items from this RR to add..."
                                        value={itemSearchTerm}
                                        onChange={(e) => {
                                            setItemSearchTerm(e.target.value);
                                            setShowItemDropdown(true);
                                        }}
                                        onFocus={() => setShowItemDropdown(true)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />

                                    {showItemDropdown && itemSearchTerm && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {filteredAvailableItems.map(item => {
                                                const max = availableMaxQty(item.id);
                                                if (max <= 0) return null; // Don't show fully returned items
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleAddItem(item)}
                                                        className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700"
                                                    >
                                                        <div className="font-medium text-sm text-gray-900 dark:text-white">{item.part_number}</div>
                                                        <div className="text-xs text-gray-500">{item.description}</div>
                                                        <div className="text-xs text-green-600">Available to Return: {max}</div>
                                                    </div>
                                                );
                                            })}
                                            {filteredAvailableItems.length === 0 && (
                                                <div className="p-3 text-sm text-gray-500">No matching items found</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Table */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Item</th>
                                                <th className="px-3 py-2 text-left">Reason</th>
                                                <th className="px-3 py-2 text-right">Qty</th>
                                                <th className="px-3 py-2 text-right">Cost</th>
                                                <th className="px-3 py-2 text-right">Total</th>
                                                <th className="px-3 py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {formData.items.map((item, idx) => {
                                                const max = availableMaxQty(item.rr_item_id || '');
                                                return (
                                                    <tr key={idx}>
                                                        <td className="px-3 py-2">
                                                            <div className="font-medium dark:text-white">{item.part_no}</div>
                                                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{item.description}</div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <select
                                                                value={item.return_reason}
                                                                onChange={(e) => updateItem(idx, 'return_reason', e.target.value)}
                                                                className="w-full bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 text-sm py-1"
                                                            >
                                                                <option value="Defective">Defective</option>
                                                                <option value="Wrong Item">Wrong Item</option>
                                                                <option value="Damaged">Damaged</option>
                                                                <option value="Overstock">Overstock</option>
                                                                <option value="Other">Other</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max={max}
                                                                value={item.qty_returned}
                                                                onChange={(e) => updateItem(idx, 'qty_returned', Number(e.target.value))}
                                                                className="w-16 text-right bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 py-1"
                                                            />
                                                            <div className="text-[10px] text-gray-400">Max: {max}</div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                                            {item.unit_cost.toLocaleString()}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium dark:text-white">
                                                            {item.total_amount.toLocaleString()}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {formData.items.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                                                        No items added yet. Search above to add items.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {formData.items.length > 0 && (
                                            <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold dark:text-white">
                                                <tr>
                                                    <td colSpan={4} className="px-3 py-2 text-right">Grand Total:</td>
                                                    <td className="px-3 py-2 text-right">
                                                        {formData.items.reduce((sum, i) => sum + i.total_amount, 0).toLocaleString()}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    {step === 2 && (
                        <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg">
                            Back
                        </button>
                    )}
                    <div className="flex gap-2 ml-auto">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-900">
                            Cancel
                        </button>
                        {step === 2 && (
                            <button
                                onClick={handleSubmit}
                                disabled={loading || formData.items.length === 0}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Creating...' : 'Create Return'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReturnToSupplierNew;
