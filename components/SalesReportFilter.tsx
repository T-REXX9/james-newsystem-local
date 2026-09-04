import React, { useEffect, useState } from 'react';
import type { CustomerOption, UserProfile } from '../types';
import { getCustomerList } from '../services/salesReportService';
import SalesReportDataView from './SalesReportDataView';
import { closeSalesReportResults, isSalesReportResultsView, openSalesReportResults, type SalesReportRouteView } from '../utils/workflowNavigate';

interface SalesReportFilterProps {
  currentUser?: UserProfile;
  initialView?: SalesReportRouteView;
}

export type SalesReportPeriod = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

const todayInput = () => new Date().toISOString().slice(0, 10);

const startForPeriod = (type: SalesReportPeriod): string => {
  const today = new Date();
  const start = new Date(today);
  if (type === 'all') return '2013-06-01';
  if (type === 'week') start.setDate(today.getDate() - 7);
  if (type === 'month') start.setMonth(today.getMonth() - 1);
  if (type === 'year') start.setFullYear(today.getFullYear() - 1);
  return start.toISOString().slice(0, 10);
};

const SALES_REPORT_TAB = 'sales-reports-sales-report';

const SalesReportFilter: React.FC<SalesReportFilterProps> = ({ currentUser, initialView }) => {
  const [reportType, setReportType] = useState<SalesReportPeriod>('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [dateFrom, setDateFrom] = useState('2013-06-01');
  const [dateTo, setDateTo] = useState(todayInput);
  const [showView, setShowView] = useState(isSalesReportResultsView(initialView));

  useEffect(() => {
    setShowView(isSalesReportResultsView(initialView));
  }, [initialView]);

  useEffect(() => {
    const loadCustomers = async () => {
      setIsLoadingCustomers(true);
      try {
        setCustomers(await getCustomerList());
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    void loadCustomers();
  }, []);

  const updatePeriod = (type: SalesReportPeriod) => {
    setReportType(type);
    if (type !== 'custom') {
      setDateFrom(startForPeriod(type));
      setDateTo(todayInput());
    }
  };

  const resetForm = () => {
    setReportType('all');
    setSelectedCustomer('all');
    setDateFrom('2013-06-01');
    setDateTo(todayInput());
  };

  const handleGenerate = () => {
    setShowView(true);
    openSalesReportResults(SALES_REPORT_TAB);
  };

  const handleBack = () => {
    closeSalesReportResults(SALES_REPORT_TAB, () => setShowView(false));
  };

  if (showView) {
    return (
      <SalesReportDataView
        dateFrom={dateFrom}
        dateTo={dateTo}
        customerId={selectedCustomer}
        reportType={reportType}
        onBack={handleBack}
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className="min-h-full overflow-auto bg-[#f4f4f4] px-4 py-10 text-[#333]">
      <div className="mx-auto max-w-[1140px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
        <header className="min-h-[64px] border-b border-[#e5e5e5] px-5">
          <h1 className="inline-block border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase leading-none text-[#315574]">
            Sales Report
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
              <label htmlFor="sales-report-customer" className="text-right font-semibold">
                Select Customer <span className="text-[#d9534f]">*</span>
              </label>
              <select
                id="sales-report-customer"
                value={selectedCustomer}
                disabled={isLoadingCustomers}
                onChange={(event) => setSelectedCustomer(event.target.value)}
                className="h-[34px] w-full max-w-[590px] rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9] disabled:bg-[#eee]"
              >
                <option value="all">{isLoadingCustomers ? 'Loading customers...' : 'All'}</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.company}</option>
                ))}
              </select>
            </div>

            <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
              <label htmlFor="sales-report-period" className="text-right font-semibold">
                Date Covered <span className="text-[#d9534f]">*</span>
              </label>
              <select
                id="sales-report-period"
                value={reportType}
                onChange={(event) => updatePeriod(event.target.value as SalesReportPeriod)}
                className="h-[34px] w-full max-w-[590px] rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]"
              >
                <option value="all">All</option>
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
                  <label htmlFor="sales-date-from" className="text-right font-semibold">
                    Date From <span className="text-[#d9534f]">*</span>
                  </label>
                  <input
                    id="sales-date-from"
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    required
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="h-[34px] w-full max-w-[590px] rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner outline-none focus:border-[#66afe9] focus:ring-1 focus:ring-[#66afe9]"
                  />
                </div>
                <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
                  <label htmlFor="sales-date-to" className="text-right font-semibold">
                    Date To<span className="text-[#d9534f]">*</span>
                  </label>
                  <input
                    id="sales-date-to"
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

            <div className="grid gap-4 pt-1 md:grid-cols-[220px_1fr]">
              <span />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isLoadingCustomers}
                  className="rounded-[3px] border border-[#285e8e] bg-[#428bca] px-3 py-[7px] font-semibold text-white hover:bg-[#3276b1] disabled:bg-[#999]"
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

export default SalesReportFilter;
