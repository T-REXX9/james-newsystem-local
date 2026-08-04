import React, { useState, useEffect } from 'react';
import ReturnToSupplierList from './ReturnToSupplierList';
import ReturnToSupplierView from './ReturnToSupplierView';
import ReturnToSupplierNew from './ReturnToSupplierNew';
import { returnToSupplierService } from '../../services/returnToSupplierService';
import { SupplierReturn } from '../../returnToSupplier.types';
import { Plus } from 'lucide-react';

const ReturnToSupplier: React.FC = () => {
    const [returns, setReturns] = useState<SupplierReturn[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    const fetchReturns = async () => {
        setLoading(true);
        try {
            const data = await returnToSupplierService.getAllReturns();
            setReturns(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReturns();
    }, []);

    const handleSelect = (r: SupplierReturn) => {
        setSelectedId(r.id);
    };

    const handleSuccessNew = (newReturn: SupplierReturn) => {
        setShowNewModal(false);
        fetchReturns(); // Refresh list
        setSelectedId(newReturn.id); // Select new
    };

    const selectedReturn = returns.find(r => r.id === selectedId);

    const periodReturns = returns.filter(r => {
        const date = new Date(r.return_date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
    });

    return (
        <div className="min-h-full overflow-y-auto bg-[#f4f4f4] p-5 text-[#333]">
            <div className="mx-auto max-w-[1380px] space-y-5">
                <section className="rounded border border-[#d5d5d5] bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ddd] px-5 py-4">
                        <button onClick={() => { setShowNewModal(true); setSelectedId(null); }} className="flex items-center gap-1 rounded border border-[#4f9e43] bg-[#70b865] px-4 py-2 text-sm font-semibold text-white">
                            <Plus className="h-4 w-4" /> Create New
                        </button>
                        <div className="flex items-center gap-3 text-sm">
                            <label htmlFor="rts-month" className="font-semibold">Filter by Month:</label>
                            <select id="rts-month" value={month} onChange={e => setMonth(Number(e.target.value))} className="w-48 rounded border border-[#ccc] px-3 py-2">
                                {Array.from({length: 12}, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}
                            </select>
                            <input aria-label="Filter year" type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24 rounded border border-[#ccc] px-3 py-2" />
                        </div>
                    </div>
                    <div className="max-h-[280px] overflow-auto px-5 py-4">
                        <ReturnToSupplierList returns={periodReturns} selectedId={selectedId} onSelect={r => { handleSelect(r); setShowNewModal(false); }} searchTerm={searchTerm} onSearchChange={setSearchTerm} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} loading={loading} />
                    </div>
                </section>
                {showNewModal && <ReturnToSupplierNew onClose={() => setShowNewModal(false)} onSuccess={handleSuccessNew} />}
                {selectedReturn && !showNewModal && <ReturnToSupplierView returnRecord={selectedReturn} onUpdate={fetchReturns} />}
            </div>
        </div>
    );
};

export default ReturnToSupplier;
