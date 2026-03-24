import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Package, Calendar, ArrowRight, Users, Loader2, Search, ChevronDown, Check } from 'lucide-react';
import { UserProfile } from '../types';
import {
  fetchCustomersWithNotListedInquiries,
  CustomerWithInquiries,
} from '../services/suggestedStockService';
import SuggestedStockDataView from './SuggestedStockDataView';

interface SuggestedStockReportProps {
  currentUser?: UserProfile | null;
}

type ReportType = 'today' | 'week' | 'month' | 'year' | 'custom';

const SuggestedStockReport: React.FC<SuggestedStockReportProps> = ({ currentUser }) => {
  const [reportType, setReportType] = useState<ReportType>('month');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [customers, setCustomers] = useState<CustomerWithInquiries[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });

  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showView, setShowView] = useState(false);
  const customerPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadCustomers();
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!isCustomerOpen) {
      setCustomerQuery('');
    }
  }, [isCustomerOpen]);

  useEffect(() => {
    if (!isCustomerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!customerPickerRef.current?.contains(event.target as Node)) {
        setIsCustomerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isCustomerOpen]);

  useEffect(() => {
    if (selectedCustomer !== 'all' && !customers.some((customer) => customer.id === selectedCustomer)) {
      setSelectedCustomer('all');
    }
  }, [customers, selectedCustomer]);

  const loadCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const data = await fetchCustomersWithNotListedInquiries(dateFrom, dateTo);
      setCustomers(data);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleReportTypeChange = (type: ReportType) => {
    setReportType(type);
    const today = new Date();
    let from = new Date();

    switch (type) {
      case 'today':
        from = today;
        break;
      case 'week':
        from.setDate(today.getDate() - 7);
        break;
      case 'month':
        from.setDate(today.getDate() - 30);
        break;
      case 'year':
        from.setDate(today.getDate() - 365);
        break;
      default:
        return;
    }

    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  };

  const handleGenerateReport = () => {
    if (reportType === 'custom' && dateFrom > dateTo) {
      return;
    }
    setShowView(true);
  };

  const totalInquiries = customers.reduce((sum, c) => sum + c.inquiryCount, 0);
  const customerOptions = useMemo(
    () => [
      {
        id: 'all',
        label: `All Customers (${totalInquiries} items)`,
      },
      ...customers.map((customer) => ({
        id: customer.id,
        label: `${customer.company} (${customer.inquiryCount} items)`,
      })),
    ],
    [customers, totalInquiries]
  );
  const filteredCustomerOptions = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase();
    if (!needle) return customerOptions;
    return customerOptions.filter((option) => option.label.toLowerCase().includes(needle));
  }, [customerOptions, customerQuery]);
  const selectedCustomerLabel =
    customerOptions.find((option) => option.id === selectedCustomer)?.label ||
    `All Customers (${totalInquiries} items)`;
  const customDateInvalid = reportType === 'custom' && Boolean(dateFrom && dateTo && dateFrom > dateTo);

  if (showView) {
    return (
      <SuggestedStockDataView
        dateFrom={dateFrom}
        dateTo={dateTo}
        customerId={selectedCustomer}
        onBack={() => setShowView(false)}
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 md:p-8 animate-fadeIn overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-8 animate-slideInUp">
          <div className="p-3 bg-gradient-to-br from-brand-blue to-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 text-white transform hover:scale-105 transition-transform duration-300">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
              Item Suggested for Stock Report
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Identify customer demand for products not currently in inventory
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-slideInUp" style={{ animationDelay: '0.05s' }}>
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Total Not Listed Items
            </p>
            <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{totalInquiries}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Customers with Requests
            </p>
            <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{customers.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Date Range
            </p>
            <p className="text-sm font-medium text-slate-800 dark:text-white mt-2">
              {new Date(dateFrom).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} -{' '}
              {new Date(dateTo).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="glass-card rounded-3xl overflow-hidden shadow-2xl animate-slideInUp" style={{ animationDelay: '0.1s' }}>
          <div className="p-8 space-y-10">
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Users className="w-4 h-4 text-brand-blue" />
                Select Customer
              </label>
              <div ref={customerPickerRef} className="relative">
                {isLoadingCustomers ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading customers...
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCustomerOpen((open) => !open)}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all appearance-none cursor-pointer"
                  >
                    <span className="block truncate text-left pr-8">{selectedCustomerLabel}</span>
                  </button>
                )}
                {!isLoadingCustomers && (
                  <>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isCustomerOpen ? 'rotate-180' : ''}`} />
                    </div>
                    {isCustomerOpen && (
                      <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={customerQuery}
                            onChange={(e) => setCustomerQuery(e.target.value)}
                            placeholder="Search customer..."
                            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-brand-blue dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            autoFocus
                          />
                        </div>
                        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
                          {filteredCustomerOptions.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No customers found.</p>
                          ) : (
                            filteredCustomerOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomer(option.id);
                                  setIsCustomerOpen(false);
                                }}
                                className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <span className="truncate">{option.label}</span>
                                {selectedCustomer === option.id && (
                                  <Check className="h-4 w-4 shrink-0 text-brand-blue" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-brand-blue" />
                Select Period
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'This Week' },
                  { id: 'month', label: 'This Month' },
                  { id: 'year', label: 'This Year' },
                  { id: 'custom', label: 'Custom' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleReportTypeChange(type.id as ReportType)}
                    className={`relative overflow-hidden px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 transform active:scale-95 ${
                      reportType === type.id
                        ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30 ring-2 ring-brand-blue ring-offset-2 dark:ring-offset-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {reportType === type.id && (
                      <span className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50"></span>
                    )}
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-500 ease-in-out ${
                reportType === 'custom'
                  ? 'opacity-100 translate-y-0 max-h-40'
                  : 'opacity-0 -translate-y-4 max-h-0 overflow-hidden pointer-events-none'
              }`}
            >
              <div className="bg-slate-50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-brand-blue focus-within:border-transparent transition-all">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 pt-2">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => {
                    const nextFrom = e.target.value;
                    setDateFrom(nextFrom);
                    if (dateTo && nextFrom && dateTo < nextFrom) {
                      setDateTo(nextFrom);
                    }
                  }}
                  className="w-full px-4 pb-2 pt-1 bg-transparent text-slate-800 dark:text-slate-100 font-medium outline-none"
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-brand-blue focus-within:border-transparent transition-all">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 pt-2">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => {
                    const nextTo = e.target.value;
                    setDateTo(nextTo);
                    if (dateFrom && nextTo && nextTo < dateFrom) {
                      setDateFrom(nextTo);
                    }
                  }}
                  className="w-full px-4 pb-2 pt-1 bg-transparent text-slate-800 dark:text-slate-100 font-medium outline-none"
                />
              </div>
            </div>
            {customDateInvalid && (
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                Date To must be the same as or later than Date From.
              </p>
            )}
          </div>

          <div className="p-8 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={customDateInvalid}
              className={`group relative flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 overflow-hidden ${
                customDateInvalid
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none dark:bg-slate-700 dark:text-slate-400'
                  : 'bg-gradient-to-r from-brand-blue to-blue-700 text-white shadow-xl shadow-brand-blue/20 hover:shadow-brand-blue/40 hover:-translate-y-1 active:translate-y-0'
              }`}
            >
              {!customDateInvalid && (
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
              )}
              <span>Generate Report</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuggestedStockReport;
