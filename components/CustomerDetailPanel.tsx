import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2, User, Phone, Mail, MapPin, Calendar, CreditCard,
    TrendingUp, AlertCircle, ShoppingBag, MessageSquare, RotateCcw,
    FileText, DollarSign, Activity, Clock, UserCog, Save, X as XIcon, Pencil
} from 'lucide-react';
import { Contact, CustomerStatus, UserProfile } from '../types';
import { fetchContactTransactions, fetchCustomerMetrics, fetchSalesAgents, updateContact, fetchUpdatedContactDetails } from '../services/supabaseService';
import CompanyName from './CompanyName';
import { toast } from 'sonner';

interface CustomerDetailPanelProps {
    contactId: string;
    initialData?: Contact;
    onClose: () => void;
    onUpdate: (updated: Contact) => void;
    onEditContact?: (contact: Contact) => void;
}

// Transaction Icon Helper
const getTransactionIcon = (type: string) => {
    switch (type) {
        case 'invoice': return <FileText className="w-4 h-4 text-brand-blue" />;
        case 'order_slip': return <FileText className="w-4 h-4 text-purple-500" />;
        case 'sales_order': return <ShoppingBag className="w-4 h-4 text-emerald-500" />;
        case 'sales_inquiry': return <MessageSquare className="w-4 h-4 text-amber-500" />;
        case 'purchase_history': return <ShoppingBag className="w-4 h-4 text-slate-500" />;
        default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
};

const CustomerDetailPanel: React.FC<CustomerDetailPanelProps> = ({
    contactId,
    initialData,
    onClose,
    onUpdate,
    onEditContact
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'inquiries' | 'financials' | 'profile'>('overview');
    const [transactions, setTransactions] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [contact, setContact] = useState<Contact | undefined>(initialData);
    const [salesAgents, setSalesAgents] = useState<UserProfile[]>([]);
    const [isEditingSalesAgent, setIsEditingSalesAgent] = useState(false);
    const [selectedSalesAgent, setSelectedSalesAgent] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [pendingUpdates, setPendingUpdates] = useState<any[]>([]);

    // Sync prop data
    useEffect(() => {
        setContact(initialData);
        setSelectedSalesAgent(initialData?.salesman || '');
    }, [initialData]);

    // Fetch Deep Data
    useEffect(() => {
        if (!contactId) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const [txs, mets, agents, updates] = await Promise.all([
                    fetchContactTransactions(contactId),
                    fetchCustomerMetrics(contactId),
                    fetchSalesAgents(),
                    fetchUpdatedContactDetails(contactId)
                ]);
                setTransactions(txs);
                setMetrics(mets);
                setSalesAgents(agents);
                const pending = (updates || []).filter((u: any) => u.approval_status === 'pending');
                setPendingUpdates(pending);
            } catch (err) {
                console.error("Failed to load customer details", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [contactId]);

    // Handler for saving sales agent assignment
    const handleSaveSalesAgent = async () => {
        if (!contact || !contactId) return;

        setIsSaving(true);
        try {
            await updateContact(contactId, { salesman: selectedSalesAgent });
            const updatedContact = { ...contact, salesman: selectedSalesAgent };
            setContact(updatedContact);
            onUpdate(updatedContact);
            setIsEditingSalesAgent(false);
            toast.success('Sales agent updated successfully');
        } catch (err) {
            console.error('Failed to update sales agent:', err);
            toast.error('Failed to update sales agent');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelEditSalesAgent = () => {
        setSelectedSalesAgent(contact?.salesman || '');
        setIsEditingSalesAgent(false);
    };

    if (!contact) return <div className="p-8 text-center text-slate-400">Select a customer</div>;

    // Header Calculations
    const Initials = contact.company
        ? contact.company.substring(0, 2).toUpperCase()
        : contact.name ? contact.name.substring(0, 2).toUpperCase() : '??';

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden animate-fadeIn">

            {/* 1. Ultra Headers (Glass / Premium feel) */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 shadow-sm z-10">
                <div className="flex justify-between items-start">

                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-blue to-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-900/20">
                            {Initials}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <CompanyName name={contact.company} pastName={contact.pastName} entity={contact} />
                            </h1>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" />
                                    {contact.contactPersons?.[0]?.name || contact.name || 'No Contact Person'}
                                </span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {contact.city || contact.area || 'Unknown Location'}
                                </span>
                                {contact.salesman && (
                                    <>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                        <span className="flex items-center gap-1.5">
                                            <UserCog className="w-3.5 h-3.5" />
                                            {contact.salesman}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Outstanding Balance</div>
                        <div className={`text-2xl font-mono font-bold ${(contact.balance || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                            ₱{(contact.balance || 0).toLocaleString()}
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <span className={`px-2 py-0.5 rounded textxs font-bold uppercase border ${contact.status === CustomerStatus.ACTIVE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                {contact.status}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                {contact.priceGroup || 'No Group'}
                            </span>
                        </div>
                        {onEditContact && (
                            <button
                                onClick={() => onEditContact(contact)}
                                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-brand-blue hover:text-blue-700 border border-blue-100 hover:border-blue-200 rounded-lg bg-blue-50/60 dark:bg-blue-900/20 dark:border-blue-900/40 transition-colors"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit Details
                            </button>
                        )}
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-6 mt-8 border-b border-transparent">
                    {[
                        { id: 'overview', label: 'Overview', icon: Activity },
                        { id: 'history', label: 'Sales History', icon: ShoppingBag },
                        { id: 'inquiries', label: 'Inquiries', icon: MessageSquare },
                        { id: 'returns', label: 'Returns', icon: RotateCcw },
                        { id: 'financials', label: 'Financials', icon: DollarSign },
                        { id: 'profile', label: 'Profile', icon: User },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                 pb-3 px-1 text-sm font-bold flex items-center gap-2 transition-all relative
                 ${activeTab === tab.id
                                    ? 'text-brand-blue'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }
               `}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-blue rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Content Area */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                {loading && (
                    <div className="flex justify-center py-12">
                        <div className="animate-pulse flex flex-col items-center gap-4">
                            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
                            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        </div>
                    </div>
                )}

                {!loading && activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Key Metrics Card */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-1 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-brand-blue" /> Performance
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-sm text-slate-500">Total Sales (Lifetime)</span>
                                    <span className="font-mono font-bold">₱{(metrics?.total_purchases || contact.totalSales || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-sm text-slate-500">Average Order</span>
                                    <span className="font-mono font-bold">₱{(metrics?.average_order_value || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-sm text-slate-500">Last Purchase</span>
                                    <span className="font-medium text-sm">
                                        {metrics?.last_purchase_date || contact.lastContactDate || 'Never'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-slate-500">Credit utilization</span>
                                    <div className="text-right">
                                        <div className="text-xs font-bold mb-1">
                                            {Math.round(((contact.balance || 0) / (contact.creditLimit || 1)) * 100)}%
                                        </div>
                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-brand-blue rounded-full"
                                                style={{ width: `${Math.min(((contact.balance || 0) / (contact.creditLimit || 1)) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Stream */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-1 md:col-span-2">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-purple-500" /> Recent Activity
                            </h3>
                            <div className="space-y-0">
                                {transactions.slice(0, 5).map((tx, i) => (
                                    <div key={tx.id || i} className="flex items-center gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-5 px-5 transition-colors cursor-pointer">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                            {getTransactionIcon(tx.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between">
                                                <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{tx.label}</span>
                                                <span className="text-xs text-slate-400">{new Date(tx.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <div className="text-xs text-slate-500 capitalize">{tx.type.replace('_', ' ')} • <span className={
                                                    tx.status === 'paid' ? 'text-emerald-600 font-bold' :
                                                        tx.status === 'pending' ? 'text-amber-600 font-bold' : 'text-slate-500'
                                                }>{tx.status}</span></div>
                                                <div className={`font-bold font-mono text-sm ${tx.type === 'sales_return' ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'
                                                    }`}>
                                                    {tx.type === 'sales_return' ? '-' : ''}₱{(tx.amount || 0).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {transactions.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 italic">No recent transactions found.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!loading && activeTab === 'history' && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase font-bold text-slate-500">
                                <tr>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Transaction</th>
                                    <th className="p-4">Reference</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {transactions.filter(t => ['invoice', 'order_slip', 'sales_order'].includes(t.type)).map((tx) => (
                                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{new Date(tx.date).toLocaleDateString()}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {getTransactionIcon(tx.type)}
                                                <span className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm font-mono text-slate-600 dark:text-slate-400">{tx.number || '-'}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${tx.status === 'paid' || tx.status === 'finalized' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    tx.status === 'overdue' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                        'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                {tx.status || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                            ₱{(tx.amount || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Placeholder for other tabs (Inquiries, Financials, etc.) reuse same table style or specialized components */}
                {!loading && activeTab === 'inquiries' && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center">
                        <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-700">Inquiry History</h3>
                        <p className="text-slate-400 mb-6">Showing {transactions.filter(t => t.type === 'sales_inquiry').length} inquiries</p>
                        {/* Similar table for inquiries... */}
                        <div className="text-left space-y-2">
                            {transactions.filter(t => t.type === 'sales_inquiry').map(tx => (
                                <div key={tx.id} className="flex justify-between p-3 border rounded-lg">
                                    <div>
                                        <div className="font-bold text-sm">{tx.label}</div>
                                        <div className="text-xs text-slate-400">{new Date(tx.date).toLocaleDateString()}</div>
                                    </div>
                                    <div className="font-mono font-bold">₱{tx.amount.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && activeTab === 'profile' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {pendingUpdates.length > 0 && (
                            <div className="md:col-span-2 bg-amber-50/80 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                                        <AlertCircle className="w-4 h-4" />
                                        <h3 className="font-bold text-sm">Pending update requests</h3>
                                    </div>
                                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">
                                        {pendingUpdates.length} pending
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {pendingUpdates.slice(0, 3).map((update: any) => (
                                        <div key={update.id} className="flex items-center justify-between text-xs text-amber-900 dark:text-amber-100">
                                            <span className="font-semibold">Submitted by {update.submitted_by || 'Staff'}</span>
                                            <span>{update.submitted_date ? new Date(update.submitted_date).toLocaleDateString() : 'Unknown date'}</span>
                                        </div>
                                    ))}
                                    {pendingUpdates.length > 3 && (
                                        <div className="text-xs text-amber-700 dark:text-amber-200">
                                            +{pendingUpdates.length - 3} more pending updates
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-6 border-b pb-2">Contact Information</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Primary Contact</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium">{contact.name}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium">{contact.email || '-'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Phone</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium">{contact.phone || contact.mobile || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-6 border-b pb-2">Business Details</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">TIN</label>
                                    <div className="font-mono mt-1">{contact.tin || '-'}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Business Line</label>
                                    <div className="mt-1">{contact.businessLine || '-'}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Credit Limit</label>
                                    <div className="font-mono font-bold text-brand-blue mt-1">₱{(contact.creditLimit || 0).toLocaleString()}</div>
                                </div>
                            </div>
                        </div>

                        {/* Sales Agent Assignment Card */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm md:col-span-2">
                            <div className="flex items-center justify-between mb-6 border-b pb-2">
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <UserCog className="w-4 h-4 text-brand-blue" />
                                    Sales Agent Assignment
                                </h3>
                                {!isEditingSalesAgent && (
                                    <button
                                        onClick={() => setIsEditingSalesAgent(true)}
                                        className="text-xs font-bold text-brand-blue hover:text-blue-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    >
                                        Change Agent
                                    </button>
                                )}
                            </div>

                            {!isEditingSalesAgent ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Assigned Sales Agent</label>
                                        <div className="flex items-center gap-3 mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <UserCog className="w-5 h-5 text-brand-blue" />
                                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                                {contact.salesman || 'No agent assigned'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Select Sales Agent</label>
                                        <select
                                            value={selectedSalesAgent}
                                            onChange={(e) => setSelectedSalesAgent(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                                            disabled={isSaving}
                                        >
                                            <option value="">-- No Agent --</option>
                                            {salesAgents.map((agent) => (
                                                <option key={agent.id} value={agent.full_name}>
                                                    {agent.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleSaveSalesAgent}
                                            disabled={isSaving}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Save className="w-4 h-4" />
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            onClick={handleCancelEditSalesAgent}
                                            disabled={isSaving}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <XIcon className="w-4 h-4" />
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!loading && activeTab === 'financials' && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h3 className="font-bold text-lg mb-4">Financial Overview</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500 uppercase font-bold">Credit Limit</div>
                                <div className="text-xl font-mono font-bold text-slate-800">₱{(contact.creditLimit || 0).toLocaleString()}</div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500 uppercase font-bold">Total Debt</div>
                                <div className="text-xl font-mono font-bold text-rose-600">₱{(contact.balance || 0).toLocaleString()}</div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500 uppercase font-bold">Available Credit</div>
                                <div className="text-xl font-mono font-bold text-emerald-600">
                                    ₱{Math.max(0, (contact.creditLimit || 0) - (contact.balance || 0)).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        <h4 className="font-bold text-sm text-slate-600 mb-2 uppercase">Unpaid Invoices</h4>
                        <div className="space-y-2">
                            {transactions.filter(t => t.type === 'invoice' && (t.status === 'unpaid' || t.status === 'overdue' || (t.balance && t.balance > 0))).map(tx => (
                                <div key={tx.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-white">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle className="w-4 h-4 text-rose-500" />
                                        <div>
                                            <div className="font-bold text-sm">{tx.label}</div>
                                            <div className="text-xs text-slate-400">Due: {new Date(tx.date).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-rose-600">₱{(tx.balance || tx.amount).toLocaleString()}</div>
                                        <div className="text-xs text-slate-400">Original: ₱{tx.amount.toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                            {transactions.filter(t => t.type === 'invoice' && ((t.balance && t.balance > 0) || t.status === 'overdue')).length === 0 && (
                                <div className="text-sm text-slate-500 italic">No unpaid invoices. Good standing.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerDetailPanel;
