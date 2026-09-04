import React, { useState, useEffect, useRef } from 'react';
import { ReceivingReport, ReceivingReportWithDetails } from '../../receiving.types';
import { receivingService } from '../../services/receivingService';
import { Plus } from 'lucide-react';
import CustomLoadingSpinner from '../CustomLoadingSpinner';
import ReceivingList from './ReceivingList';
import ReceivingForm from './ReceivingForm';
import ReceivingView from './ReceivingView';
import { retraceWorkflowHistory } from '../../utils/workflowHistory';

interface ReceivingStockProps {
    initialRRId?: string;
    initialRRRefNo?: string;
}

const ReceivingStock: React.FC<ReceivingStockProps> = ({ initialRRId, initialRRRefNo }) => {
    const [loading, setLoading] = useState(true);
    const [rrs, setRrs] = useState<ReceivingReportWithDetails[]>([]);

    // Filters
    const [month, setMonth] = useState<string>('all');
    const [year, setYear] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Views
    const [viewMode, setViewMode] = useState<'list' | 'create' | 'view'>('list');
    const [selectedRrId, setSelectedRrId] = useState<string | null>(null);
    const consumedDeepLinkRef = useRef<string>('');

    const fetchRRs = async () => {
        setLoading(true);
        try {
            const data = await receivingService.getReceivingReports({
                month,
                year,
                status: statusFilter || undefined,
                search: search || undefined
            });
            setRrs(data);
        } catch (error) {
            console.error("Error fetching receiving reports:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRRs();
    }, [month, year, statusFilter]); // Search usually triggers on button or debounce, but here on enter or effect if debounced? I'll leave search for manual trigger or effect if simple.
    // For simplicity, I'll trigger search on Enter or blur in the input, or just add a button.
    // Or adds search to dependency array with debounce. I'll add a search button logic in UI.

    useEffect(() => {
        const deepLinkTarget = String(initialRRId || initialRRRefNo || '').trim();
        if (!deepLinkTarget) return;

        // Prevent repeated reopen on the same deep-link while component remains mounted.
        if (consumedDeepLinkRef.current === deepLinkTarget) return;
        consumedDeepLinkRef.current = deepLinkTarget;

        // The local API uses receiving refno as the primary route key.
        setSelectedRrId(deepLinkTarget);
        setViewMode('view');
    }, [initialRRId, initialRRRefNo]);

    const handleCreateSuccess = (report: ReceivingReport) => {
        setSelectedRrId(report.id);
        setViewMode('view');
        void fetchRRs();
    };

    const handleViewRR = (id: string) => {
        setSelectedRrId(id);
        setViewMode('view');
    };

    const handleCreateNew = () => {
        setSelectedRrId(null);
        setViewMode('create');
    };

    const handleSearch = () => {
        fetchRRs();
    };

    const handleBackToList = () => {
        const returnToList = () => {
            setViewMode('list');
            setSelectedRrId(null);
            void fetchRRs(); // Refresh list to reflect changes
        };
        if (String(initialRRId || initialRRRefNo || '').trim()) {
            retraceWorkflowHistory(returnToList);
            return;
        }
        returnToList();
    };

    if (viewMode === 'create') {
        return <ReceivingForm onClose={() => setViewMode('list')} onSuccess={handleCreateSuccess} />;
    }

    return (
        <div className="flex h-full flex-col bg-[#f7f9fc] text-slate-900 xl:flex-row">
            <aside className="w-full shrink-0 border-b border-slate-200 bg-[#f8fafb] xl:w-[320px] xl:border-b-0 xl:border-r">
                <div className="flex flex-col gap-4 p-5">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Receiving Reports</h2>
                    <p className="text-xs text-slate-500">List of all Receiving Reports</p>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search RR No..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onBlur={handleSearch}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                        />
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label htmlFor="receiving-filter-month" className="mb-1 block text-xs font-semibold text-slate-500">Month</label>
                            <select id="receiving-filter-month" value={month} onChange={e => setMonth(e.target.value)} className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm">
                                <option value="all">All Months</option>
                                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="receiving-filter-year" className="mb-1 block text-xs font-semibold text-slate-500">Year</label>
                            <select id="receiving-filter-year" value={year} onChange={e => setYear(e.target.value)} className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm">
                                <option value="all">All Years</option>
                                {Array.from({ length: 11 }, (_, i) => <option key={new Date().getFullYear() - 5 + i} value={String(new Date().getFullYear() - 5 + i)}>{new Date().getFullYear() - 5 + i}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm">
                            <option value="">All Statuses</option>
                            <option value="Draft">Draft</option>
                            <option value="Pending">Pending</option>
                            <option value="Posted">Posted</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>

                <div className="max-h-[calc(100vh-360px)] overflow-y-auto px-5 pb-5">
                    {loading ? (
                        <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
                    ) : rrs.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">No records found.</div>
                    ) : (
                        <div className="space-y-2">
                            {rrs.map(rr => {
                                const isSelected = selectedRrId === rr.id;
                                const statusColor = rr.status === 'Draft' || rr.status === 'Pending' ? 'bg-orange-100 text-orange-700'
                                    : rr.status === 'Posted' ? 'bg-emerald-100 text-emerald-700'
                                    : rr.status === 'Cancelled' ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-700';

                                return (
                                    <button
                                        key={rr.id}
                                        onClick={() => handleViewRR(rr.id)}
                                        className={`w-full rounded-lg border p-3 text-left transition ${
                                            isSelected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100 text-[10px] font-bold text-emerald-700">RR</span>
                                                <span className="font-bold text-emerald-700">{rr.rr_no}</span>
                                            </div>
                                            <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>{rr.status || 'Draft'}</span>
                                        </div>
                                        <div className="mt-2 text-xs text-slate-600">PO No.: {rr.po_no || '-'}</div>
                                        <div className="mt-1 text-xs text-slate-600">Supplier: {rr.supplier_name || '-'}</div>
                                        <div className="mt-2 flex items-center justify-between text-xs">
                                            <span className="text-slate-500">{rr.status === 'Posted' ? 'Received' : rr.status === 'Cancelled' ? 'Cancelled' : 'Expected'}: {new Date(rr.receive_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                            <span className="font-semibold text-slate-700">{rr.item_count ?? rr.items?.length ?? 0} Items ❯</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </aside>

            <main className="min-w-0 flex-1 p-4 lg:p-6">
                {viewMode === 'view' && selectedRrId ? (
                    <ReceivingView rrId={selectedRrId} onBack={handleBackToList} onCreateNew={handleCreateNew} />
                ) : (
                    <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                <span className="text-3xl">📦</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Select a Receiving Report</h3>
                            <p className="mt-1 text-sm text-slate-500">Choose a report from the list or generate a new one from a Purchase Order.</p>
                            <button onClick={() => setViewMode('create')} className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#175fd3] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#0e4fb7]">
                                <Plus className="h-4 w-4" /> Generate Receiving Report
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ReceivingStock;
