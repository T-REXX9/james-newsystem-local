import React from 'react';
import { X, ShoppingBag, User, MapPin, Loader2 } from 'lucide-react';
import { Contact, CustomerStatus } from '../types';

interface SalesMapSidebarProps {
    provinceName: string | null;
    contacts: Contact[];
    loading?: boolean;
    onClose: () => void;
}

const SalesMapSidebar: React.FC<SalesMapSidebarProps> = ({ provinceName, contacts, loading = false, onClose }) => {
    if (!provinceName) return null;

    const activeContacts = contacts.filter((c) => c.status === CustomerStatus.ACTIVE);
    const inactiveContacts = contacts.filter((c) => c.status !== CustomerStatus.ACTIVE);

    return (
        <div className="w-[400px] h-full bg-white/95 backdrop-blur-sm border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-300 relative z-30">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-white">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{provinceName}</h2>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 mt-2">
                            <ShoppingBag className="w-3 h-3 mr-1" />
                            {contacts.length} {contacts.length === 1 ? 'Customer' : 'Customers'}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                        <p className="text-[10px] text-green-600 uppercase font-medium">Active</p>
                        <p className="text-2xl font-light text-green-800">{activeContacts.length}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] text-slate-500 uppercase font-medium">Inactive</p>
                        <p className="text-2xl font-light text-slate-600">{inactiveContacts.length}</p>
                    </div>
                </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Customers</h3>
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mb-2" />
                        <p className="text-sm">Loading customers...</p>
                    </div>
                ) : contacts.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No customers in this province</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {contacts.map((contact) => (
                            <div
                                key={contact.id}
                                className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                            {(contact.company || '??').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{contact.company}</h4>
                                            {contact.salesman && (
                                                <div className="flex items-center text-xs text-slate-500">
                                                    <User className="w-3 h-3 mr-1" />
                                                    {contact.salesman}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${contact.status === CustomerStatus.ACTIVE ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {contact.status === CustomerStatus.ACTIVE ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase">City</p>
                                        <p className="font-medium text-slate-700 text-sm">{contact.city || '—'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 uppercase">Since</p>
                                        <p className="font-medium text-slate-700 text-sm">{contact.customerSince || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-xs text-slate-400">
                Showing data for {provinceName} Region
            </div>
        </div>
    );
};

export default SalesMapSidebar;
