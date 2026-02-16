import React, { useState, useEffect } from 'react';
import ReturnToSupplierList from './ReturnToSupplierList';
import ReturnToSupplierView from './ReturnToSupplierView';
import ReturnToSupplierNew from './ReturnToSupplierNew';
import { returnToSupplierService } from '../../services/returnToSupplierService';
import { SupplierReturn } from '../../returnToSupplier.types';
import { Plus, ArrowRightLeft, ListFilter, Search } from 'lucide-react';

const ReturnToSupplier: React.FC = () => {
    const [returns, setReturns] = useState<SupplierReturn[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

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

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500 rounded-lg">
                        <ArrowRightLeft className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Return to Supplier</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage vendor returns and stock adjustments</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowNewModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus className="w-4 h-4" />
                    Create Return
                </button>
            </div>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: List */}
                <div className="w-96 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
                    {/* Filters */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search returns..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Status</option>
                                <option value="Pending">Pending</option>
                                <option value="Posted">Posted</option>
                            </select>
                        </div>
                    </div>

                    <ReturnToSupplierList
                        returns={returns}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        statusFilter={statusFilter}
                        onStatusFilterChange={setStatusFilter}
                        loading={loading}
                    />
                </div>

                {/* Right Panel: View */}
                <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900">
                    {selectedReturn ? (
                        <ReturnToSupplierView
                            returnRecord={selectedReturn}
                            onUpdate={fetchReturns}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <ArrowRightLeft className="w-16 h-16 mb-4 opacity-10" />
                            <p className="text-lg font-medium">Select a return to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* New Modal */}
            {showNewModal && (
                <ReturnToSupplierNew
                    onClose={() => setShowNewModal(false)}
                    onSuccess={handleSuccessNew}
                />
            )}
        </div>
    );
};

export default ReturnToSupplier;
