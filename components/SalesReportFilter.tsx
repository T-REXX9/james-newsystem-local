import React, { useState, useEffect } from 'react';
import { FileText, Calendar, ArrowRight, Users, Loader2 } from 'lucide-react';
import { UserProfile, CustomerOption } from '../types';
import { getCustomerList } from '../services/salesReportService';
import SalesReportDataView from './SalesReportDataView';

interface SalesReportFilterProps {
  currentUser?: UserProfile;
}

type ReportType = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

const SalesReportFilter: React.FC<SalesReportFilterProps> = ({ currentUser }) => {
  const [reportType, setReportType] = useState<ReportType>('month');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });

  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showView, setShowView] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const data = await getCustomerList();
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
      case 'all':
        from = new Date('2013-06-01');
        break;
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
    setShowView(true);
  };

  if (showView) {
    return (
      <SalesReportDataView
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
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
              Sales Report
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Comprehensive sales transaction report by customer and date range
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
              <div className="relative">
                {isLoadingCustomers ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading customers...
                  </div>
                ) : (
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">All Customers</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company}
                      </option>
                    ))}
                  </select>
                )}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-brand-blue" />
                Select Period
              </label>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { id: 'all', label: 'All' },
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
                  onChange={(e) => setDateFrom(e.target.value)}
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
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 pb-2 pt-1 bg-transparent text-slate-800 dark:text-slate-100 font-medium outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
            <button
              onClick={handleGenerateReport}
              className="group relative flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-blue to-blue-700 text-white rounded-xl shadow-xl shadow-brand-blue/20 font-bold transition-all duration-300 hover:shadow-brand-blue/40 hover:-translate-y-1 active:translate-y-0 overflow-hidden"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
              <span>Generate Report</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReportFilter;
