import React, { useState, useEffect } from 'react';
import { ReceivingReportWithDetails } from '../../receiving.types';
import { receivingService } from '../../services/receivingService';
import { Plus, Search, Filter } from 'lucide-react';
import CustomLoadingSpinner from '../CustomLoadingSpinner';
import ReceivingList from './ReceivingList';
import ReceivingForm from './ReceivingForm';
import ReceivingView from './ReceivingView';

const ReceivingStock: React.FC = () => {
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
        <div className="h-full flex flex-col space-y-4 p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Receiving Stock</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage incoming inventory and receiving reports</p>
                </div>
                <button
                    onClick={() => setViewMode('create')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg shadow-blue-500/30 transition-all font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Create New RR
                </button>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="sm:col-span-4 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search RR # or Supplier..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="pl-10 w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                    />
                </div>

                <div className="sm:col-span-2">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {new Date(0, i).toLocaleString('default', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="sm:col-span-2">
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <div className="sm:col-span-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    >
                        <option value="">All Status</option>
                        <option value="Draft">Draft</option>
                        <option value="Posted">Posted</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <button
                        onClick={handleSearch}
                        className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                    >
                        <Filter className="w-4 h-4" />
                        Filter
                    </button>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <CustomLoadingSpinner label="Loading" />
                    </div>
                ) : (
                    <ReceivingList rrs={rrs} onView={handleViewRR} />
                )}
            </div>
        </div>
    );
};

export default ReceivingStock;
