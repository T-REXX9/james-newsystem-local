import React, { useState, useEffect } from 'react';
import ReturnToSupplierList from './ReturnToSupplierList';
import ReturnToSupplierView from './ReturnToSupplierView';
import ReturnToSupplierNew from './ReturnToSupplierNew';
import { returnToSupplierService } from '../../services/returnToSupplierService';
import { SupplierReturn } from '../../returnToSupplier.types';
import { CalendarDays, Plus } from 'lucide-react';

interface ReturnToSupplierProps {
    initialSearch?: string;
    initialDateFrom?: string;
    initialDateTo?: string;
    initialItemRefno?: string;
    initialItemCode?: string;
    initialStatus?: string;
}

const ReturnToSupplier: React.FC<ReturnToSupplierProps> = ({
    initialSearch = '',
    initialDateFrom = '',
    initialDateTo = '',
    initialItemRefno = '',
    initialItemCode = '',
    initialStatus = 'all',
}) => {
    const [returns, setReturns] = useState<SupplierReturn[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [statusFilter, setStatusFilter] = useState(initialStatus || 'all');
    const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [year, setYear] = useState<string>(String(new Date().getFullYear()));
    const yearOptions = Array.from({ length: 16 }, (_, index) => String(new Date().getFullYear() - 10 + index)).reverse();

    const fetchReturns = async () => {
        setLoading(true);
        try {
            const data = await returnToSupplierService.getAllReturns({
                search: initialSearch,
                itemRefno: initialItemRefno,
                itemCode: initialItemCode,
                status: initialStatus,
            });
            setReturns(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setSearchTerm(initialSearch);
        fetchReturns();
    }, [initialItemCode, initialItemRefno, initialSearch, initialStatus]);

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
        if (initialDateFrom && initialDateTo) {
            const recordDate = r.return_date.slice(0, 10);
            return recordDate >= initialDateFrom && recordDate <= initialDateTo;
        }
        const matchesMonth = month === 'all' || date.getMonth() + 1 === Number(month);
        const matchesYear = year === 'all' || date.getFullYear() === Number(year);
        return matchesMonth && matchesYear;
    });

    const filteredReturns = periodReturns.filter(r => {
        if (statusFilter !== 'all' && r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
        if (searchTerm && !initialItemRefno && !initialItemCode) {
            const lowerSearch = searchTerm.toLowerCase();
            return r.return_no.toLowerCase().includes(lowerSearch) ||
                   (r.supplier_name && r.supplier_name.toLowerCase().includes(lowerSearch));
        }
        return true;
    });

    return (
        <div className="flex h-full flex-col bg-[#f7f9fc] text-slate-900 xl:flex-row">
            <aside className="w-full shrink-0 border-b border-slate-200 bg-[#f8fafb] xl:w-[320px] xl:border-b-0 xl:border-r">
                <div className="flex flex-col gap-4 p-5">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Return to Supplier</h2>
                        <p className="text-xs text-slate-500">Manage vendor returns and stock adjustments</p>
                    </div>

                    <button onClick={() => { setShowNewModal(true); setSelectedId(null); }} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#175fd3] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0e4fb7]">
                        <Plus className="h-4 w-4" /> Create Return
                    </button>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search RS No., Supplier..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                        />
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                            <CalendarDays className="h-4 w-4 text-[#175fd3]" />
                            <span>Filter by Date</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="sr-only" htmlFor="return-to-supplier-month">Return month</label>
                            <select
                                id="return-to-supplier-month"
                                value={month}
                                onChange={e => setMonth(e.target.value)}
                                className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="all">All Months</option>
                                {Array.from({ length: 12 }, (_, index) => {
                                    const monthValue = index + 1;
                                    return (
                                        <option key={monthValue} value={monthValue}>
                                            {new Date(2000, index, 1).toLocaleString('en-US', { month: 'long' })}
                                        </option>
                                    );
                                })}
                            </select>
                            <label className="sr-only" htmlFor="return-to-supplier-year">Return year</label>
                            <select
                                id="return-to-supplier-year"
                                value={year}
                                onChange={e => setYear(e.target.value)}
                                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                                aria-label="Return year"
                            >
                                <option value="all">All Years</option>
                                {yearOptions.map(yearOption => (
                                    <option key={yearOption} value={yearOption}>{yearOption}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="sr-only" htmlFor="return-to-supplier-status">Return status</label>
                        <select id="return-to-supplier-status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100">
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="posted">Posted</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>

                <div className="max-h-[calc(100vh-320px)] overflow-y-auto px-5 pb-5">
                    {loading ? (
                        <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
                    ) : filteredReturns.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">No records found.</div>
                    ) : (
                        <div className="space-y-2">
                            {filteredReturns.map(r => {
                                const isSelected = selectedId === r.id;
                                const statusColor = r.status === 'Pending' ? 'bg-orange-100 text-orange-700'
                                    : r.status === 'Posted' ? 'bg-emerald-100 text-emerald-700'
                                    : r.status === 'Cancelled' ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-700';

                                return (
                                    <button
                                        key={r.id}
                                        onClick={() => { handleSelect(r); setShowNewModal(false); }}
                                        className={`w-full rounded-lg border p-3 text-left transition ${
                                            isSelected ? 'border-[#175fd3] bg-[#eef5ff]' : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-6 w-6 items-center justify-center rounded bg-[#175fd3] text-[10px] font-bold text-white">RS</span>
                                                <span className="font-bold text-[#175fd3]">{r.return_no}</span>
                                            </div>
                                            <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>{r.status}</span>
                                        </div>
                                        <div className="mt-2 text-xs font-semibold text-slate-600">{r.supplier_name || '-'}</div>
                                        <div className="mt-2 flex items-center justify-between text-xs">
                                            <span className="text-slate-500">📅 {new Date(r.return_date).toLocaleDateString('en-GB')}</span>
                                            <span className="font-bold text-slate-800">₱{r.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-4 text-xs text-slate-500">
                        Showing 1 to {filteredReturns.length} of {returns.length}
                    </div>
                </div>
            </aside>

            <main className="min-w-0 flex-1 p-4 lg:p-6">
                {showNewModal ? (
                    <ReturnToSupplierNew onClose={() => setShowNewModal(false)} onSuccess={handleSuccessNew} />
                ) : selectedReturn ? (
                    <ReturnToSupplierView returnRecord={selectedReturn} onUpdate={fetchReturns} />
                ) : (
                    <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                <span className="text-3xl">📦</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Select a Return Record</h3>
                            <p className="mt-1 text-sm text-slate-500">Choose a record from the list or create a new return.</p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ReturnToSupplier;
