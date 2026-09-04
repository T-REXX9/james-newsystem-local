import React, { useEffect, useState } from 'react';
import type { InquiryReportFilters } from '../types';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import InquiryReportView from './InquiryReportView';
import {
  type InquiryReportCustomer,
  inquiryReportLocalApiService,
} from '../services/inquiryReportLocalApiService';
import { closeSalesReportResults, isSalesReportResultsView, openSalesReportResults, type SalesReportRouteView } from '../utils/workflowNavigate';

const todayInput = () => new Date().toISOString().slice(0, 10);

const startForPeriod = (type: InquiryReportFilters['reportType']): string => {
  const today = new Date();
  const start = new Date(today);
  if (type === 'week') start.setDate(today.getDate() - 7);
  if (type === 'month') start.setMonth(today.getMonth() - 1);
  if (type === 'year') start.setFullYear(today.getFullYear() - 1);
  return start.toISOString().slice(0, 10);
};

const INQUIRY_REPORT_TAB = 'sales-reports-inquiry-report';

const InquiryReportFilter: React.FC<{ initialView?: SalesReportRouteView }> = ({ initialView }) => {
  const [reportType, setReportType] = useState<InquiryReportFilters['reportType']>('today');
  const [dateFrom, setDateFrom] = useState(todayInput);
  const [dateTo, setDateTo] = useState(todayInput);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customers, setCustomers] = useState<InquiryReportCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showView, setShowView] = useState(isSalesReportResultsView(initialView));

  useEffect(() => {
    setShowView(isSalesReportResultsView(initialView));
  }, [initialView]);

  useEffect(() => {
    const loadCustomers = async () => {
      setIsLoading(true);
      try {
        setCustomers(await inquiryReportLocalApiService.getCustomers());
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load customer filters');
      } finally {
        setIsLoading(false);
      }
    };
    void loadCustomers();
  }, []);

  const updateReportType = (type: InquiryReportFilters['reportType']) => {
    setReportType(type);
    if (type !== 'custom') {
      setDateFrom(startForPeriod(type));
      setDateTo(todayInput());
    }
  };

  const resetForm = () => {
    setReportType('today');
    setDateFrom(todayInput());
    setDateTo(todayInput());
    setSelectedCustomerId('');
  };

  const handleGenerate = () => {
    setShowView(true);
    openSalesReportResults(INQUIRY_REPORT_TAB);
  };

  const handleBack = () => {
    closeSalesReportResults(INQUIRY_REPORT_TAB, () => setShowView(false));
  };

  if (loadError) {
    return <div role="alert" className="p-6 text-red-700">Unable to load inquiry report filters: {loadError}</div>;
  }

  if (showView) {
    return (
      <InquiryReportView
        filters={{
          dateFrom,
          dateTo,
          customerId: selectedCustomerId || undefined,
          reportType,
        }}
        onBack={handleBack}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f4f4f4]">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-auto bg-[#f4f4f4] px-4 py-10 text-[#333]">
      <div className="mx-auto max-w-[1140px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
        <header className="min-h-[64px] border-b border-[#e5e5e5] px-5">
          <h1 className="inline-block border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase leading-none text-[#315574]">
            Inquiry Report
          </h1>
        </header>

        <main className="p-5">
          <p className="mb-10 text-[13px]">
            Field mark with (<span className="text-[#d9534f]">*</span>) is required. Press generate after you select the sorting options
          </p>

          <form
            className="mx-auto max-w-[900px] space-y-[15px] text-[13px]"
            onSubmit={(event) => {
              event.preventDefault();
              handleGenerate();
            }}
          >
            <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
              <label htmlFor="inquiry-report-type" className="text-right font-semibold">
                Report Type <span className="text-[#d9534f]">*</span>
              </label>
              <select
                id="inquiry-report-type"
                value={reportType}
                onChange={(event) => updateReportType(event.target.value as InquiryReportFilters['reportType'])}
                className="h-[34px] w-full max-w-[590px] rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Date</option>
              </select>
            </div>

            {reportType === 'custom' && (
              <>
                <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
                  <label htmlFor="inquiry-date-from" className="text-right font-semibold">
                    Date From <span className="text-[#d9534f]">*</span>
                  </label>
                  <input
                    id="inquiry-date-from"
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    required
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="h-[34px] w-full max-w-[590px] rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]"
                  />
                </div>
                <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
                  <label htmlFor="inquiry-date-to" className="text-right font-semibold">
                    Date To<span className="text-[#d9534f]">*</span>
                  </label>
                  <input
                    id="inquiry-date-to"
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    required
                    onChange={(event) => setDateTo(event.target.value)}
                    className="h-[34px] w-full max-w-[590px] rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]"
                  />
                </div>
              </>
            )}

            <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
              <label htmlFor="inquiry-customer" className="text-right font-semibold">Customer</label>
              <select
                id="inquiry-customer"
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
                className="h-[34px] w-full max-w-[590px] rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]"
              >
                <option value="">All</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.company}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 pt-1 md:grid-cols-[220px_1fr]">
              <span />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-[3px] border border-[#285e8e] bg-[#428bca] px-3 py-[7px] font-semibold text-white hover:bg-[#3276b1]"
                >
                  Generate Report
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-[3px] border border-[#ccc] bg-white px-3 py-[7px] font-semibold text-[#333] hover:bg-[#ebebeb]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
};

export default InquiryReportFilter;
