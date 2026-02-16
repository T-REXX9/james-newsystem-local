import React, { useMemo } from 'react';
import { Search, Filter, Eye, EyeOff, CheckSquare, Square, ChevronRight } from 'lucide-react';
import { Contact, CustomerStatus } from '../types';
import CompanyName from './CompanyName';

interface CustomerListSidebarProps {
    customers: Contact[];
    selectedCustomerId: string | null;
    onSelectCustomer: (id: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    filterStatus: string;
    onFilterStatusChange: (status: string) => void;
    filterVisibility: string;
    onFilterVisibilityChange: (visibility: string) => void;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onToggleAll: () => void;
    onCreateNew: () => void;
}

const CustomerListSidebar: React.FC<CustomerListSidebarProps> = ({
    customers,
    selectedCustomerId,
    onSelectCustomer,
    searchQuery,
    onSearchChange,
    filterStatus,
    onFilterStatusChange,
    filterVisibility,
    onFilterVisibilityChange,
    selectedIds,
    onToggleSelection,
    onToggleAll,
    onCreateNew
}) => {

    const customerStatusOptions = Object.values(CustomerStatus);

    const filtered = useMemo(() => {
        return customers.filter(c => {
            const query = searchQuery.toLowerCase();
            const companyMatch = (c.company || '').toLowerCase().includes(query);
            const nameMatch = (c.name || '').toLowerCase().includes(query);
            const contactMatch = c.contactPersons?.some(p => p.name.toLowerCase().includes(query)) || false;

            const matchSearch = companyMatch || nameMatch || contactMatch;
            const matchStatus = filterStatus === 'All' || c.status === filterStatus;
            const matchVisibility = filterVisibility === 'All' ? true :
                filterVisibility === 'Hidden' ? !!c.isHidden : !c.isHidden;

            return matchSearch && matchStatus && matchVisibility;
        });
    }, [customers, searchQuery, filterStatus, filterVisibility]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-full md:w-80 lg:w-96 shadow-lg z-10 transition-all duration-300">

            {/* Header & Search */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-slate-800 dark:text-white">Customers ({filtered.length})</h2>
                    <button
                        onClick={onCreateNew}
                        className="text-xs font-bold bg-brand-blue text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        + New
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search customers..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                    />
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <select
                            value={filterStatus}
                            onChange={(e) => onFilterStatusChange(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-2 pr-6 py-1.5 text-xs focus:border-brand-blue outline-none appearance-none cursor-pointer"
                        >
                            <option value="All">All Status</option>
                            {customerStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="relative w-10">
                        <button
                            onClick={() => onFilterVisibilityChange(filterVisibility === 'All' ? 'Unhidden' : filterVisibility === 'Unhidden' ? 'Hidden' : 'All')}
                            className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title={`Visibility: ${filterVisibility}`}
                        >
                            {filterVisibility === 'All' && <Eye className="w-3.5 h-3.5 text-slate-500" />}
                            {filterVisibility === 'Unhidden' && <Eye className="w-3.5 h-3.5 text-brand-blue" />}
                            {filterVisibility === 'Hidden' && <EyeOff className="w-3.5 h-3.5 text-rose-500" />}
                        </button>
                    </div>

                    <button
                        onClick={onToggleAll}
                        className="w-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title="Select All"
                    >
                        {selectedIds.size > 0 && selectedIds.size === filtered.length ?
                            <CheckSquare className="w-3.5 h-3.5 text-brand-blue" /> :
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                        }
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {filtered.length === 0 ? (
                    <div className="text-center p-8 text-slate-400 text-sm italic">
                        No customers found matching your search.
                    </div>
                ) : (
                    filtered.map((customer) => {
                        const isSelected = selectedCustomerId === customer.id;
                        const isChecked = selectedIds.has(customer.id);

                        return (
                            <div
                                key={customer.id}
                                onClick={() => onSelectCustomer(customer.id)}
                                className={`
                            group relative p-3 rounded-lg cursor-pointer transition-all duration-200 border
                            ${isSelected
                                        ? 'bg-brand-blue/5 border-brand-blue/30 shadow-sm'
                                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'
                                    }
                        `}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-1" onClick={(e) => { e.stopPropagation(); onToggleSelection(customer.id); }}>
                                        {isChecked ?
                                            <CheckSquare className="w-4 h-4 text-brand-blue" /> :
                                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400" />
                                        }
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <CompanyName
                                                name={customer.company}
                                                pastName={customer.pastName}
                                                entity={customer}
                                                className={`font-semibold text-sm truncate pr-2 ${isSelected ? 'text-brand-blue' : 'text-slate-700 dark:text-slate-200'}`}
                                            />
                                            {customer.isHidden && <EyeOff className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />}
                                        </div>

                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                            {customer.name}
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex flex-wrap gap-1.5">
                                                <span className={`
                                            px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold uppercase border
                                            ${customer.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
                                                        customer.status === 'Blacklisted' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20' :
                                                            'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}
                                        `}>
                                                    {customer.status}
                                                </span>
                                                {customer.priceGroup && (
                                                    <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                        {customer.priceGroup}
                                                    </span>
                                                )}
                                            </div>

                                            <div className={`text-xs font-mono font-bold ${(customer.balance || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                                                }`}>
                                                {(customer.balance || 0) > 0 ? `₱${(customer.balance || 0).toLocaleString()}` : '—'}
                                            </div>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <ChevronRight className="w-4 h-4 text-brand-blue opacity-100 self-center" />
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CustomerListSidebar;
