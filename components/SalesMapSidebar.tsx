import React from 'react';
import { X, ShoppingBag, Calendar, User, Building2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Customer {
    id: string;
    name: string;
    company: string;
    totalSpend: number;
    lastOrderDate: string;
    status: 'Active' | 'Inactive';
}

interface SalesMapSidebarProps {
    provinceName: string | null;
    onClose: () => void;
}

// Mock Data Generator
const mockCustomers = (province: string): Customer[] => {
    if (!province) return [];
    const count = Math.floor(Math.random() * 8) + 2; // 2-10 customers
    return Array.from({ length: count }).map((_, i) => ({
        id: `cust-${i}`,
        name: ['Alice Santos', 'Miguel Tan', 'Robert Lim', 'Maria Cruz', 'Juan Dela Cruz'][Math.floor(Math.random() * 5)],
        company: `${province} ${['Trading', 'Enterprises', 'Hardware', 'Supplies', 'Logistics'][Math.floor(Math.random() * 5)]}`,
        totalSpend: Math.floor(Math.random() * 500000) + 10000,
        lastOrderDate: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toLocaleDateString(),
        status: Math.random() > 0.3 ? 'Active' : 'Inactive'
    })).sort((a, b) => b.totalSpend - a.totalSpend);
};

const SalesMapSidebar: React.FC<SalesMapSidebarProps> = ({ provinceName, onClose }) => {
    if (!provinceName) return null;

    const customers = mockCustomers(provinceName);
    const totalRegionRevenue = customers.reduce((acc, curr) => acc + curr.totalSpend, 0);

    return (
        <div className="w-[400px] h-full bg-white/95 backdrop-blur-sm border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-300 relative z-[1000]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-white">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{provinceName}</h2>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 mt-2">
                            <ShoppingBag className="w-3 h-3 mr-1" />
                            {customers.length} Active Accounts
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Total Region Revenue</p>
                    <p className="text-3xl font-light text-slate-900">₱{totalRegionRevenue.toLocaleString()}</p>
                </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Top Customers</h3>
                <div className="space-y-4">
                    {customers.map((customer) => (
                        <div
                            key={customer.id}
                            className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                        {customer.company.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{customer.company}</h4>
                                        <div className="flex items-center text-xs text-slate-500">
                                            <User className="w-3 h-3 mr-1" />
                                            {customer.name}
                                        </div>
                                    </div>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${customer.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {customer.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase">Lifetime Spend</p>
                                    <p className="font-medium text-slate-700">₱{customer.totalSpend.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase">Last Order</p>
                                    <div className="flex items-center justify-end text-slate-600 text-sm">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {customer.lastOrderDate}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-xs text-slate-400">
                Showing data for {provinceName} Region
            </div>
        </div>
    );
};

export default SalesMapSidebar;
