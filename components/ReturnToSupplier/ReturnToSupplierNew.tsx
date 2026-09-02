import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2 } from 'lucide-react';
import { CreateReturnDTO, CreateReturnItemDTO, RRItemForReturn } from '../../returnToSupplier.types';
import { returnToSupplierService } from '../../services/returnToSupplierService';
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
    const [rrSearchLoading, setRrSearchLoading] = useState(false);
    const [showRrDropdown, setShowRrDropdown] = useState(false);
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

    const [itemLookup, setItemLookup] = useState<Record<string, RRItemForReturn>>({});
    const [itemSearchResults, setItemSearchResults] = useState<RRItemForReturn[]>([]);
    const [itemSearchLoading, setItemSearchLoading] = useState(false);
    const [itemSearchTerm, setItemSearchTerm] = useState('');
    const [showItemDropdown, setShowItemDropdown] = useState(false);

    // Load recent RRs on focus, then filter the suggestions as the user types.
    useEffect(() => {
        if (step !== 1 || !showRrDropdown) return;

        let cancelled = false;
        const search = async () => {
            setRrSearchLoading(true);
            try {
                const results = await returnToSupplierService.searchRRs(rrSearch);
                if (!cancelled) setRrResults(results);
            } catch (err) {
                if (!cancelled) {
                    console.error(err);
                    setRrResults([]);
                }
            } finally {
                if (!cancelled) setRrSearchLoading(false);
            }
        };
        const debounce = setTimeout(search, rrSearch.trim() === '' ? 0 : 250);
        return () => {
            cancelled = true;
            clearTimeout(debounce);
        };
    }, [rrSearch, showRrDropdown, step]);

    const handleSelectRR = async (rr: any) => {
        setSelectedRR(rr);
        setRrSearch(rr.rr_no || rr.rr_number || '');
        setShowRrDropdown(false);
        setItemLookup({});
        setItemSearchResults([]);
        setItemSearchTerm('');
        setShowItemDropdown(false);
        setStep(2);
    };

    useEffect(() => {
        if (!selectedRR || step !== 2 || !showItemDropdown) {
            return;
        }

        let cancelled = false;

        const searchItems = async () => {
            setItemSearchLoading(true);
            try {
                const results = await returnToSupplierService.getRRItemsForReturn(selectedRR.id, {
                    search: itemSearchTerm,
                    limit: 12,
                });
                if (cancelled) return;

                setItemSearchResults(results);
                setItemLookup((prev) => {
                    const next = { ...prev };
                    for (const item of results) {
                        next[item.id] = item;
                    }
                    return next;
                });
            } catch (err) {
                if (!cancelled) {
                    console.error(err);
                    addToast({
                        type: 'error',
                        title: 'Unable to load RR items',
                        description: parseSupabaseError(err, 'RR item search'),
                        durationMs: 5000,
                    });
                }
            } finally {
                if (!cancelled) {
                    setItemSearchLoading(false);
                }
            }
        };

        const debounce = setTimeout(searchItems, itemSearchTerm.trim() === '' ? 0 : 250);
        return () => {
            cancelled = true;
            clearTimeout(debounce);
        };
    }, [addToast, itemSearchTerm, selectedRR, showItemDropdown, step]);

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
        setItemSearchResults([]);
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

    const availableMaxQty = (rrItemId: string) => {
        const item = itemLookup[rrItemId];
        if (!item) return 0;
        return item.quantity_received - item.qty_returned_already;
    };

    // Filter available items for dropdown. The quantity helper must be initialized first
    // because this callback runs during render as soon as item results are loaded.
    const filteredAvailableItems = itemSearchResults.filter(item => {
        const alreadyAdded = formData.items.some(i => i.rr_item_id === item.id);
        if (alreadyAdded) return false;
        return availableMaxQty(item.id) > 0;
    });

    return (
        <section className="rounded border border-[#d5d5d5] bg-white shadow-sm">
            <div className="flex max-h-none w-full flex-col overflow-visible">
                <div className="flex items-center justify-between border-b border-[#ddd] px-5 py-4">
                    <h2 className="font-serif text-xl font-bold uppercase">Return to Supplier</h2>
                    <button onClick={onClose} className="rounded border border-[#ccc] bg-[#f5f5f5] px-3 py-2 text-sm">
                        ← Back
                    </button>
                </div>

                <div className={`relative flex-1 p-6 ${step === 1 ? 'overflow-visible' : 'overflow-y-auto'}`}>
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium dark:text-white">Select Receiving Report</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    role="combobox"
                                    aria-label="Receiving report smart search"
                                    aria-autocomplete="list"
                                    aria-expanded={showRrDropdown}
                                    aria-controls="receiving-report-options"
                                    placeholder="Search RR number, supplier, or PO..."
                                    value={rrSearch}
                                    onChange={(e) => {
                                        setRrSearch(e.target.value);
                                        setShowRrDropdown(true);
                                    }}
                                    onFocus={() => setShowRrDropdown(true)}
                                    onBlur={() => window.setTimeout(() => setShowRrDropdown(false), 150)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />

                                {showRrDropdown && (
                                    <div
                                        id="receiving-report-options"
                                        role="listbox"
                                        className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        {rrSearchLoading && (
                                            <div className="p-3 text-sm text-gray-500">Loading available receiving reports...</div>
                                        )}
                                        {!rrSearchLoading && rrResults.map((rr) => (
                                            <button
                                                key={rr.id}
                                                type="button"
                                                role="option"
                                                aria-selected="false"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => handleSelectRR(rr)}
                                                className="block w-full border-b border-gray-100 p-3 text-left transition-colors last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none dark:border-gray-700 dark:hover:bg-blue-900/20 dark:focus:bg-blue-900/20"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="font-semibold text-gray-900 dark:text-white">{rr.rr_no || rr.rr_number}</span>
                                                    <span className="whitespace-nowrap text-xs text-gray-500">
                                                        {new Date(rr.receive_date || rr.received_date || rr.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                                                    {rr.supplier_name || 'Unknown supplier'} · PO: {rr.po_no || rr.po_number || 'N/A'}
                                                </div>
                                            </button>
                                        ))}
                                        {!rrSearchLoading && rrResults.length === 0 && (
                                            <div className="p-3 text-sm text-gray-500">
                                                {rrSearch.trim() === ''
                                                    ? 'No posted receiving reports are available.'
                                                    : 'No matching receiving reports found.'}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && selectedRR && (
                        <div className="space-y-6">
                            {/* Header Info */}
                            <div className="grid grid-cols-1 gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg md:grid-cols-2">
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
                                        placeholder="Search part no, item code, or description from this RR..."
                                        value={itemSearchTerm}
                                        onChange={(e) => {
                                            setItemSearchTerm(e.target.value);
                                            setShowItemDropdown(true);
                                        }}
                                        onFocus={() => setShowItemDropdown(true)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />

                                    {showItemDropdown && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {itemSearchLoading && (
                                                <div className="p-3 text-sm text-gray-500">Loading matching RR items...</div>
                                            )}
                                            {filteredAvailableItems.map(item => {
                                                const max = availableMaxQty(item.id);
                                                if (max <= 0) return null; // Don't show fully returned items
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleAddItem(item)}
                                                        className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700"
                                                    >
                                                        <div className="font-medium text-sm text-gray-900 dark:text-white">
                                                            {item.part_number || item.item_code}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {item.description || 'No description'}
                                                        </div>
                                                        <div className="text-xs text-green-600">Available to Return: {max}</div>
                                                    </div>
                                                );
                                            })}
                                            {!itemSearchLoading && filteredAvailableItems.length === 0 && (
                                                <div className="p-3 text-sm text-gray-500">
                                                    {itemSearchTerm.trim() === ''
                                                        ? 'Start typing or pick from the first matching RR items.'
                                                        : 'No matching items found.'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Table */}
                                <div className="overflow-hidden border border-[#ddd]">
                                    <table className="w-full table-fixed text-xs leading-tight">
                                        <colgroup>
                                            <col className="w-[26%]" />
                                            <col className="w-[22%]" />
                                            <col className="w-[13%]" />
                                            <col className="w-[15%]" />
                                            <col className="w-[16%]" />
                                            <col className="w-[8%]" />
                                        </colgroup>
                                        <thead className="bg-white text-[#333]">
                                            <tr>
                                                <th className="break-words px-2 py-2 text-left">Item Code / Part No.</th>
                                                <th className="break-words px-2 py-2 text-left">Remark</th>
                                                <th className="break-words px-2 py-2 text-right">Quantity</th>
                                                <th className="break-words px-2 py-2 text-right">Unit Price</th>
                                                <th className="break-words px-2 py-2 text-right">Amount</th>
                                                <th className="px-2 py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {formData.items.map((item, idx) => {
                                                const max = availableMaxQty(item.rr_item_id || '');
                                                return (
                                                    <tr key={idx}>
                                                        <td className="break-words px-2 py-2">
                                                            <div className="text-[13px] font-bold dark:text-white">{item.part_no}</div>
                                                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">{item.description}</div>
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <select
                                                                value={item.return_reason}
                                                                onChange={(e) => updateItem(idx, 'return_reason', e.target.value)}
                                                                className="w-full min-w-0 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 text-[11px] py-1"
                                                            >
                                                                <option value="Defective">Defective</option>
                                                                <option value="Wrong Item">Wrong Item</option>
                                                                <option value="Damaged">Damaged</option>
                                                                <option value="Overstock">Overstock</option>
                                                                <option value="Other">Other</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-2 py-2 text-right">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max={max}
                                                                value={item.qty_returned}
                                                                onChange={(e) => updateItem(idx, 'qty_returned', Number(e.target.value))}
                                                                className="w-full min-w-0 text-right bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 py-1"
                                                            />
                                                            <div className="text-[10px] text-gray-400">Max: {max}</div>
                                                        </td>
                                                        <td className="break-words px-2 py-2 text-right text-gray-600 dark:text-gray-400">
                                                            {item.unit_cost.toLocaleString()}
                                                        </td>
                                                        <td className="break-words px-2 py-2 text-right font-medium dark:text-white">
                                                            {item.total_amount.toLocaleString()}
                                                        </td>
                                                        <td className="px-2 py-2">
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

                <div className="flex justify-between border-t border-[#ddd] px-6 py-4">
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
                                className="rounded border border-[#4f9e43] bg-[#70b865] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : 'Create Return'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ReturnToSupplierNew;
