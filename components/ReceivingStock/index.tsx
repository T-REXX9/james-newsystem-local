import React, { useState, useEffect, useRef } from 'react';
import { ReceivingReportWithDetails } from '../../receiving.types';
import { receivingService } from '../../services/receivingService';
import { Plus } from 'lucide-react';
import CustomLoadingSpinner from '../CustomLoadingSpinner';
import ReceivingList from './ReceivingList';
import ReceivingForm from './ReceivingForm';
import ReceivingView from './ReceivingView';

interface ReceivingStockProps {
    initialRRId?: string;
    initialRRRefNo?: string;
}

const ReceivingStock: React.FC<ReceivingStockProps> = ({ initialRRId, initialRRRefNo }) => {
    const [loading, setLoading] = useState(true);
    const [rrs, setRrs] = useState<ReceivingReportWithDetails[]>([]);

    // Filters
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [year, setYear] = useState<number>(new Date().getFullYear());
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

    const handleCreateSuccess = () => {
        setViewMode('list');
        fetchRRs();
    };

    const handleViewRR = (id: string) => {
        setSelectedRrId(id);
        setViewMode('view');
    };

    const handleSearch = () => {
        fetchRRs();
    };

    const handleBackToList = () => {
        setViewMode('list');
        setSelectedRrId(null);
        fetchRRs(); // Refresh list to reflect changes
    };

    if (viewMode === 'create') {
        return <ReceivingForm onClose={() => setViewMode('list')} onSuccess={handleCreateSuccess} />;
    }

    if (viewMode === 'view' && selectedRrId) {
        return <ReceivingView rrId={selectedRrId} onBack={handleBackToList} />;
    }

    return (
        <div className="min-h-full overflow-y-auto bg-[#f4f4f4] p-5 text-[#333]">
            <section className="mx-auto max-w-[1380px] rounded border border-[#d5d5d5] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ddd] px-5 py-4">
                    <button onClick={() => setViewMode('create')} className="flex items-center gap-1 rounded border border-[#4f9e43] bg-[#70b865] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5daa52]">
                        <Plus className="h-4 w-4" /> Create New
                    </button>
                    <div className="flex items-center gap-3 text-sm">
                        <label htmlFor="rr-month" className="font-semibold">Filter by Month:</label>
                        <select id="rr-month" value={month} onChange={e => setMonth(Number(e.target.value))} className="w-48 rounded border border-[#ccc] bg-white px-3 py-2">
                            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                        </select>
                        <input aria-label="Filter year" type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24 rounded border border-[#ccc] px-3 py-2" />
                    </div>
                </div>
                <div className="max-h-[300px] overflow-auto px-5 py-4">
                    {loading ? <div className="flex h-32 items-center justify-center"><CustomLoadingSpinner label="Loading" /></div> : <ReceivingList rrs={rrs} onView={handleViewRR} />}
                </div>
            </section>
        </div>
    );
};

export default ReceivingStock;
