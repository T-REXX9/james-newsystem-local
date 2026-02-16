
import React, { useState, useEffect } from 'react';
import { getInquiryReportData, getInquiryReportSummary } from '../services/salesInquiryService';
import { SalesInquiry, InquiryReportFilters } from '../types';
import {
    Printer,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    FileText,
    LayoutList,
    List,
    Calendar,
    User,
    TrendingUp,
    DollarSign,
    Hash,
    Clock,
    Sparkles
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';

interface InquiryReportViewProps {
    filters: InquiryReportFilters;
    onBack: () => void;
}

const InquiryReportView: React.FC<InquiryReportViewProps> = ({ filters, onBack }) => {
    const [inquiries, setInquiries] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
    const [expandedInquiryIds, setExpandedInquiryIds] = useState<Set<string>>(new Set());

    // Computed Stats
    const totalInquiries = inquiries.length;
    const totalAmount = inquiries.reduce((sum, item) => sum + (item.grand_total || 0), 0);
    const averageamount = totalInquiries > 0 ? totalAmount / totalInquiries : 0;
    const dateRangeDays = Math.ceil((new Date(filters.dateTo).getTime() - new Date(filters.dateFrom).getTime()) / (1000 * 3600 * 24)) + 1;

    useEffect(() => {
        loadReportData();
    }, [filters, viewMode]);

    const loadReportData = async () => {
        setIsLoading(true);
        try {
            let data;
            if (viewMode === 'detailed') {
                data = await getInquiryReportData(filters.dateFrom, filters.dateTo, filters.customerId);
            } else {
                data = await getInquiryReportSummary(filters.dateFrom, filters.dateTo, filters.customerId);
            }
            setInquiries(data);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedInquiryIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedInquiryIds(newExpanded);
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
        }).format(amount);
    };

    const formatCompactCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            notation: "compact",
            maximumFractionDigits: 1
        }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-brand-blue blur-2xl opacity-15 animate-pulse rounded-full"></div>
                        <div className="relative">
                            <CustomLoadingSpinner label="Loading" />
                            <div className="absolute inset-0 bg-brand-blue/20 blur-xl rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-slate-700 dark:text-slate-200 font-semibold text-lg tracking-tight">Generating Report</p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Please wait while we compile your data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 p-6 md:p-8 lg:p-10 animate-fadeIn print:p-0 print:bg-white overflow-y-auto">

            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6 print:mb-6 animate-slideInUp">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="group relative p-2.5 bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-brand-blue transition-all duration-300 shadow-sm hover:shadow-md print:hidden"
                    >
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-blue/0 via-brand-blue/5 to-brand-blue/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </button>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-brand-blue/10 blur-xl rounded-lg"></div>
                                <span className="relative p-2 bg-gradient-to-br from-brand-blue/10 to-brand-blue/5 rounded-lg print:hidden">
                                    <FileText className="w-6 h-6 text-brand-blue" />
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white print:text-black tracking-tight">
                                Inquiry Report
                            </h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                            <span className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 px-3.5 py-1.5 rounded-full text-slate-600 dark:text-slate-300 print:text-gray-600 print:bg-transparent print:border-none">
                                <Calendar className="w-4 h-4 text-brand-blue" />
                                <span className="font-medium">{filters.dateFrom}</span>
                                <span className="text-slate-300 mx-1">→</span>
                                <span className="font-medium">{filters.dateTo}</span>
                            </span>
                            <span className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 px-3.5 py-1.5 rounded-full text-slate-600 dark:text-slate-300 print:text-gray-600 print:bg-transparent print:border-none">
                                <User className="w-4 h-4 text-brand-blue" />
                                <span className="font-medium">{!filters.customerId ? 'All Customers' : (inquiries[0]?.customer_company || 'Selected Customer')}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 print:hidden">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-1 rounded-xl flex items-center border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                        <button
                            onClick={() => setViewMode('summary')}
                            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${viewMode === 'summary'
                                ? 'bg-gradient-to-r from-brand-blue to-blue-600 text-white shadow-md'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <List className="w-4 h-4" />
                            <span>Summary</span>
                        </button>
                        <button
                            onClick={() => setViewMode('detailed')}
                            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${viewMode === 'detailed'
                                ? 'bg-gradient-to-r from-brand-blue to-blue-600 text-white shadow-md'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <LayoutList className="w-4 h-4" />
                            <span>Detailed</span>
                        </button>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="group relative flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-700 hover:from-slate-700 hover:to-slate-800 dark:hover:from-slate-700 dark:hover:to-slate-600 text-white rounded-xl shadow-lg hover:shadow-xl font-medium transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>Print</span>
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-100%] group-hover:translate-x-[100%] duration-700"></div>
                    </button>
                </div>
            </div>

            {/* Summary Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10 print:hidden animate-slideInUp" style={{ animationDelay: '0.1s' }}>
                <div className="group relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 p-6 rounded-2xl overflow-hidden hover:border-brand-blue/40 hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                        <Hash className="w-20 h-20 text-brand-blue" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-brand-blue/10 rounded-lg">
                                <Hash className="w-4 h-4 text-brand-blue" />
                            </div>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Inquiries</p>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight animate-countUp">
                            {totalInquiries}
                        </h3>
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Recorded in period</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-blue/20 to-transparent group-hover:via-brand-blue/40 transition-all duration-300"></div>
                </div>

                <div className="group relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 p-6 rounded-2xl overflow-hidden hover:border-brand-blue/40 hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                        <DollarSign className="w-20 h-20 text-brand-blue" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-brand-blue/10 rounded-lg">
                                <DollarSign className="w-4 h-4 text-brand-blue" />
                            </div>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Amount</p>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight animate-countUp" style={{ animationDelay: '0.1s' }}>
                            {formatCompactCurrency(totalAmount)}
                        </h3>
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand-blue">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Gross revenue</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-blue/20 to-transparent group-hover:via-brand-blue/40 transition-all duration-300"></div>
                </div>

                <div className="group relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 p-6 rounded-2xl overflow-hidden hover:border-brand-blue/40 hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                        <TrendingUp className="w-20 h-20 text-brand-blue" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-brand-blue/10 rounded-lg">
                                <TrendingUp className="w-4 h-4 text-brand-blue" />
                            </div>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Average Value</p>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight animate-countUp" style={{ animationDelay: '0.2s' }}>
                            {formatCompactCurrency(averageamount)}
                        </h3>
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span>Per inquiry</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-blue/20 to-transparent group-hover:via-brand-blue/40 transition-all duration-300"></div>
                </div>

                <div className="group relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 p-6 rounded-2xl overflow-hidden hover:border-brand-blue/40 hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                        <Clock className="w-20 h-20 text-brand-blue" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-brand-blue/10 rounded-lg">
                                <Clock className="w-4 h-4 text-brand-blue" />
                            </div>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Period Length</p>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight animate-countUp" style={{ animationDelay: '0.3s' }}>
                            {dateRangeDays}
                            <span className="text-base font-normal text-slate-500 dark:text-slate-400 ml-1">days</span>
                        </h3>
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span>Selected range</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-blue/20 to-transparent group-hover:via-brand-blue/40 transition-all duration-300"></div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20 print:shadow-none print:border-none print:overflow-visible flex flex-col animate-slideInUp" style={{ animationDelay: '0.2s' }}>
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar print:overflow-visible print:h-auto">
                    {inquiries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-24 text-center">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 rounded-full blur-2xl opacity-50"></div>
                                <div className="relative w-28 h-28 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                    <FileText className="w-14 h-14 text-slate-300 dark:text-slate-600" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-3">No data available</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
                                We couldn't find any inquiries for this period. Try adjusting your date range or filter criteria.
                            </p>
                            <button
                                onClick={onBack}
                                className="group relative px-8 py-3.5 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 hover:from-slate-200 hover:to-slate-300 dark:hover:from-slate-700 dark:hover:to-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 print:hidden"
                            >
                                Adjust Filters
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse print:text-sm">
                            <thead className="bg-gradient-to-r from-slate-50/90 to-slate-100/90 dark:from-slate-800/90 dark:to-slate-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm print:shadow-none print:bg-gray-100 print:static">
                                <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/60 dark:border-slate-700/60 print:text-black print:border-gray-300">
                                    {viewMode === 'detailed' && <th className="p-5 w-12 print:hidden text-center"></th>}
                                    <th className="p-5 print:p-3 font-semibold">Inquiry Details</th>
                                    <th className="p-5 print:p-3 font-semibold">Customer</th>
                                    <th className="p-5 print:p-3 font-semibold">Date & Time</th>
                                    <th className="p-5 text-right print:p-3 font-semibold">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/60 print:divide-gray-200">
                                {inquiries.map((inquiry, index) => (
                                    <React.Fragment key={inquiry.id}>
                                        <tr
                                            onClick={() => viewMode === 'detailed' && toggleExpand(inquiry.id)}
                                            className={`group transition-all duration-300 print:hover:bg-transparent border-l-2 ${viewMode === 'detailed'
                                                ? 'cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent dark:hover:from-blue-900/10 dark:hover:to-transparent hover:border-brand-blue hover:shadow-sm'
                                                : 'hover:bg-gradient-to-r hover:from-slate-50/50 hover:to-transparent dark:hover:from-slate-800/30 dark:hover:to-transparent hover:border-slate-300 dark:hover:border-slate-600'
                                                }`}
                                            style={{ animationDelay: `${index * 0.03}s` }}
                                        >
                                            {viewMode === 'detailed' && (
                                                <td className="p-5 print:hidden text-center">
                                                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 ${expandedInquiryIds.has(inquiry.id)
                                                        ? 'bg-brand-blue/10 text-brand-blue rotate-180'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-brand-blue/10 group-hover:text-brand-blue'
                                                        }`}>
                                                        <ChevronDown className="w-4 h-4" />
                                                    </div>
                                                </td>
                                            )}
                                            <td className="p-5 print:p-3">
                                                <div className="font-bold text-slate-800 dark:text-white print:text-black group-hover:text-brand-blue transition-colors duration-200">
                                                    {inquiry.inquiry_no}
                                                </div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono tracking-wide">
                                                    ID: {inquiry.id.slice(0, 8)}
                                                </div>
                                            </td>
                                            <td className="p-5 print:p-3">
                                                <div className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                                                    {inquiry.customer_company}
                                                </div>
                                            </td>
                                            <td className="p-5 print:p-3">
                                                <div className="text-sm text-slate-600 dark:text-slate-400 print:text-black font-medium">
                                                    {new Date(inquiry.sales_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                    {new Date(inquiry.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="p-5 text-right print:p-3">
                                                <span className="inline-flex items-center px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10 text-brand-blue font-bold text-sm shadow-sm border border-blue-100 dark:border-blue-900/30">
                                                    {formatCurrency(inquiry.grand_total || 0)}
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Expanded Detail View */}
                                        {viewMode === 'detailed' && inquiry.items && (
                                            <tr className={`transition-all duration-300 overflow-hidden ${expandedInquiryIds.has(inquiry.id) ? 'opacity-100' : 'opacity-0 h-0 hidden'}`}>
                                                <td colSpan={5} className="p-0 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-800/30 dark:to-transparent print:bg-transparent">
                                                    <div className="p-5 md:p-6 print:p-0">
                                                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg overflow-hidden animate-slideInUp">
                                                            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/80 dark:to-slate-800/60 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                    <List className="w-3.5 h-3.5" />
                                                                    Line Items
                                                                </h4>
                                                                <span className="text-xs bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 px-3 py-1 rounded-full text-slate-700 dark:text-slate-300 font-semibold">
                                                                    {inquiry.items.length} items
                                                                </span>
                                                            </div>
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-left text-xs">
                                                                    <thead className="bg-gradient-to-r from-slate-50/80 to-slate-100/60 dark:from-slate-800/60 dark:to-slate-800/40 text-slate-400 dark:text-slate-500 font-semibold border-b border-slate-200/60 dark:border-slate-700/60">
                                                                        <tr>
                                                                            <th className="py-3.5 px-4 w-16 font-semibold">Qty</th>
                                                                            <th className="py-3.5 px-4 font-semibold">Item Code</th>
                                                                            <th className="py-3.5 px-4 font-semibold">Part No</th>
                                                                            <th className="py-3.5 px-4 font-semibold">Brand</th>
                                                                            <th className="py-3.5 px-4 font-semibold">Description</th>
                                                                            <th className="py-3.5 px-4 text-right font-semibold">Unit Price</th>
                                                                            <th className="py-3.5 px-4 text-right font-semibold">Total</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/60">
                                                                        {inquiry.items.map((item: any, idx: number) => (
                                                                            <tr key={idx} className="hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-transparent dark:hover:from-slate-800/40 dark:hover:to-transparent transition-colors duration-200">
                                                                                <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">{item.qty}</td>
                                                                                <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400 tracking-wide">{item.item_code}</td>
                                                                                <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{item.part_no}</td>
                                                                                <td className="py-3.5 px-4">
                                                                                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-400 font-medium text-xs">
                                                                                        {item.brand || '---'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={item.description}>
                                                                                    {item.description}
                                                                                </td>
                                                                                <td className="py-3.5 px-4 text-right font-medium text-slate-600 dark:text-slate-400">{formatCurrency(item.unit_price)}</td>
                                                                                <td className="py-3.5 px-4 text-right font-bold text-slate-800 dark:text-slate-200">{formatCurrency(item.qty * item.unit_price)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                    <tfoot className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/40 dark:to-slate-800/30">
                                                                        <tr>
                                                                            <td colSpan={6} className="py-4 px-4 text-right font-bold text-slate-500 uppercase text-[10px] tracking-widest">Grand Total</td>
                                                                            <td className="py-4 px-4 text-right font-black text-brand-blue text-base">
                                                                                {formatCurrency(inquiry.grand_total)}
                                                                            </td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Print Footer */}
            <div className="hidden print:flex flex-col items-center mt-auto pt-8 text-[10px] text-gray-400 italic">
                <div className="w-full border-t border-gray-100 mb-2"></div>
                <p>Generated by TND-OPC System on {new Date().toLocaleString()}</p>
            </div>
        </div>
    );
};

export default InquiryReportView;
