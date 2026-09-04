import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Crown,
  FileText,
  ShieldCheck,
  Tag,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import {
  customerLedgerService,
  CustomerLedgerResponse,
  LedgerCustomer,
  LedgerDateType,
  LedgerReportType,
} from '../services/customerLedgerService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${Number(dateOnly[2])}/${Number(dateOnly[3])}/${dateOnly[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

const vipLabel = (status: string | null | undefined): string => {
  if (!status) return '-';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const dateTypeOptions: Array<{ value: LedgerDateType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Date' },
];

/* -------------------------------------------------------------------------- */
/*  Left Panel — Permanent Customer Search                                     */
/* -------------------------------------------------------------------------- */

const CustomerSearchPanel: React.FC<{
  customers: LedgerCustomer[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selectedCustomerId: string;
  onCustomerSelect: (sessionId: string) => void;
}> = ({ customers, loading, search, onSearchChange, selectedCustomerId, onCustomerSelect }) => (
  <div className="flex h-full flex-col border-r border-[#ddd] bg-white">
    <div className="border-b border-[#ddd] px-4 py-3">
      <h3 className="text-sm font-semibold uppercase text-[#555]">Customer Search</h3>
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search customer..."
        className="mt-2 w-full rounded border border-[#ccc] px-3 py-2 text-sm"
        aria-label="Search customers"
      />
    </div>
    <div className="flex-1 overflow-y-auto" data-testid="customer-list-scroll">
      {loading ? (
        <div className="px-4 py-6 text-center text-sm text-[#999]">Loading customers...</div>
      ) : customers.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-[#999]">
          {search.trim() ? 'No customers found' : 'No customers available'}
        </div>
      ) : (
        <ul role="listbox" aria-label="Customer list">
          {customers.map((customer) => {
            const isSelected = customer.sessionId === selectedCustomerId;
            return (
              <li key={customer.sessionId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onCustomerSelect(customer.sessionId)}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[#337ab7] text-white'
                      : 'text-[#333] hover:bg-[#e8f0fe]'
                  }`}
                >
                  <div className="font-medium truncate">
                    {customer.company || customer.customerCode || customer.sessionId}
                  </div>
                  {customer.oldName && (
                    <div className={`truncate text-xs ${isSelected ? 'text-[#dbeafe]' : 'text-[#666]'}`}>
                      Old Name: {customer.oldName}
                    </div>
                  )}
                  {customer.customerCode && (
                    <div
                      className={`text-xs truncate ${
                        isSelected ? 'text-[#cce5ff]' : 'text-[#999]'
                      }`}
                    >
                      {customer.customerCode}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Report Controls (date, type toggle)                                       */
/* -------------------------------------------------------------------------- */

const ReportControls: React.FC<{
  reportType: LedgerReportType;
  onReportTypeChange: (type: LedgerReportType) => void;
  dateType: LedgerDateType;
  onDateTypeChange: (type: LedgerDateType) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  loading: boolean;
}> = ({
  reportType,
  onReportTypeChange,
  dateType,
  onDateTypeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  loading,
}) => (
  <div className="flex flex-wrap items-center gap-3 text-sm">
    <label className="flex items-center gap-1.5">
      <input
        type="radio"
        checked={reportType === 'detailed'}
        onChange={() => onReportTypeChange('detailed')}
        disabled={loading}
      />
      Detailed
    </label>
    <label className="flex items-center gap-1.5">
      <input
        type="radio"
        checked={reportType === 'summary'}
        onChange={() => onReportTypeChange('summary')}
        disabled={loading}
      />
      Summary
    </label>
    <span className="ml-2 text-xs text-[#999]">|</span>
    <select
      value={dateType}
      onChange={(e) => onDateTypeChange(e.target.value as LedgerDateType)}
      className="rounded border border-[#ccc] bg-white px-2 py-1.5 text-sm"
      disabled={loading}
    >
      {dateTypeOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {dateType === 'custom' && (
      <>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded border border-[#ccc] px-2 py-1.5 text-sm"
          disabled={loading}
          aria-label="Date from"
        />
        <span className="text-xs text-[#999]">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded border border-[#ccc] px-2 py-1.5 text-sm"
          disabled={loading}
          aria-label="Date to"
        />
      </>
    )}
    {loading && <span className="ml-1 animate-pulse text-xs text-[#999]">Loading...</span>}
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Detailed Table (old-system format)                                        */
/* -------------------------------------------------------------------------- */

const DetailedTable: React.FC<{ data: CustomerLedgerResponse }> = ({ data }) => (
  <table className="min-w-full text-xs">
    <thead className="bg-[#f5f5f5] text-[#555]">
      <tr>
        <th className="whitespace-nowrap px-2 py-2 text-left">Date</th>
        <th className="whitespace-nowrap px-2 py-2 text-left">Ref</th>
        <th className="whitespace-nowrap px-2 py-2 text-left">Chk No.</th>
        <th className="whitespace-nowrap px-2 py-2 text-left">Chk Date</th>
        <th className="whitespace-nowrap px-2 py-2 text-left">DCR</th>
        <th className="whitespace-nowrap px-2 py-2 text-right">Debit</th>
        <th className="whitespace-nowrap px-2 py-2 text-right">Credit</th>
        <th className="whitespace-nowrap px-2 py-2 text-right">PDC</th>
        <th className="whitespace-nowrap px-2 py-2 text-right">Balance</th>
        <th className="whitespace-nowrap px-2 py-2 text-left">Remarks</th>
        <th className="whitespace-nowrap px-2 py-2 text-left">Promise to Pay</th>
      </tr>
    </thead>
    <tbody>
      {data.rows.map((row, index) => (
        <tr
          key={`${row.id}-${index}`}
          className={`border-b border-[#eee] ${
            row.reference === 'OPENING BALANCE'
              ? 'bg-[#fffde7] font-semibold italic text-[#555]'
              : 'hover:bg-[#fafafa]'
          }`}
        >
          <td className="whitespace-nowrap px-2 py-1.5">
            {row.reference === 'OPENING BALANCE' ? '' : formatDate(row.date)}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5">{row.reference || '-'}</td>
          <td className="whitespace-nowrap px-2 py-1.5">{row.check_no || '-'}</td>
          <td className="whitespace-nowrap px-2 py-1.5">{formatDate(row.check_date)}</td>
          <td className="whitespace-nowrap px-2 py-1.5">{row.dcr || '-'}</td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">
            {peso.format(row.debit || 0)}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">
            {peso.format(row.credit || 0)}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">
            {peso.format(row.pdc || 0)}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
            {peso.format(row.balance || 0)}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5">{row.remarks || '-'}</td>
          <td className="whitespace-nowrap px-2 py-1.5">{row.promise_to_pay || '-'}</td>
        </tr>
      ))}
      <tr className="border-t-2 border-[#aaa] bg-[#f5f5f5] font-bold text-rose-600">
        <td className="px-2 py-2" colSpan={5}>
          TOTAL
        </td>
        <td className="px-2 py-2 text-right">{peso.format(data.totals.debit || 0)}</td>
        <td className="px-2 py-2 text-right">{peso.format(data.totals.credit || 0)}</td>
        <td className="px-2 py-2 text-right">{peso.format(data.totals.pdc || 0)}</td>
        <td className="px-2 py-2 text-right">{peso.format(data.totals.balance || 0)}</td>
        <td className="px-2 py-2" colSpan={2} />
      </tr>
    </tbody>
  </table>
);

/* -------------------------------------------------------------------------- */
/*  Summary Table                                                             */
/* -------------------------------------------------------------------------- */

const SummaryTable: React.FC<{ data: CustomerLedgerResponse }> = ({ data }) => (
  <table className="min-w-full text-xs">
    <thead className="bg-[#f5f5f5] text-[#555]">
      <tr>
        <th className="whitespace-nowrap px-2 py-2 text-left">Year</th>
        <th className="whitespace-nowrap px-2 py-2 text-left">Month</th>
        <th className="whitespace-nowrap px-2 py-2 text-right">Debit</th>
        <th className="whitespace-nowrap px-2 py-2 text-right">Credit</th>
        <th className="whitespace-nowrap px-2 py-2 text-right">Balance</th>
      </tr>
    </thead>
    <tbody>
      {data.summary_rows.map((row, index) => (
        <tr
          key={`${row.year}-${row.month}-${index}`}
          className={`border-b border-[#eee] ${
            row.month_name === 'Opening'
              ? 'bg-[#fffde7] font-semibold italic text-[#555]'
              : 'hover:bg-[#fafafa]'
          }`}
        >
          <td className="whitespace-nowrap px-2 py-1.5">
            {row.month_name === 'Opening' ? '' : row.year}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5">{row.month_name || row.month}</td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">
            {peso.format(row.debit || 0)}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">
            {peso.format(row.credit || 0)}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
            {peso.format(row.balance || 0)}
          </td>
        </tr>
      ))}
      <tr className="border-t-2 border-[#aaa] bg-[#f5f5f5] font-bold text-rose-600">
        <td className="px-2 py-2" colSpan={2}>
          TOTAL
        </td>
        <td className="px-2 py-2 text-right">{peso.format(data.totals.debit || 0)}</td>
        <td className="px-2 py-2 text-right">{peso.format(data.totals.credit || 0)}</td>
        <td className="px-2 py-2 text-right">{peso.format(data.totals.balance || 0)}</td>
      </tr>
    </tbody>
  </table>
);

/* -------------------------------------------------------------------------- */
/*  Aging Buckets                                                             */
/* -------------------------------------------------------------------------- */

const AgingBuckets: React.FC<{ aging: CustomerLedgerResponse['metrics']['aging'] }> = ({ aging }) => {
  const buckets = [
    { label: 'Current', value: aging.current },
    { label: '31–60 Days', value: aging.days_31_60 },
    { label: '61–90 Days', value: aging.days_61_90 },
    { label: '91–120 Days', value: aging.days_91_120 },
    { label: '121–150 Days', value: aging.days_121_150 },
    { label: 'Over 150 Days', value: aging.over_150 },
  ];
  const total = buckets.reduce((s, b) => s + b.value, 0);

  return (
    <div className="rounded border border-[#ddd] bg-white">
      <table className="min-w-full text-xs">
        <thead className="bg-[#f5f5f5] text-[#555]">
          <tr>
            {buckets.map((b) => (
              <th key={b.label} className="whitespace-nowrap px-2 py-1.5 text-center">
                {b.label}
              </th>
            ))}
            <th className="whitespace-nowrap px-2 py-1.5 text-center font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-center">
            {buckets.map((b) => (
              <td key={b.label} className="px-2 py-1.5">
                {peso.format(b.value)}
              </td>
            ))}
            <td className="px-2 py-1.5 font-bold">{peso.format(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const LedgerMetricCard: React.FC<{
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}> = ({ label, value, color, icon }) => (
  <div className="flex min-h-28 min-w-36 flex-col items-center justify-center border-r border-[#ddd] px-3 py-4 text-center last:border-r-0">
    <div className={color}>{icon}</div>
    <div className="mt-2 text-xs font-medium text-[#333]">{label}</div>
    <div className={`mt-1 text-base font-bold ${color}`}>{value}</div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Report section (right side)                                               */
/* -------------------------------------------------------------------------- */

const LedgerReport: React.FC<{
  ledgerData: CustomerLedgerResponse | null;
  selectedCustomer: LedgerCustomer | null;
  reportType: LedgerReportType;
  onReportTypeChange: (type: LedgerReportType) => void;
  dateType: LedgerDateType;
  onDateTypeChange: (type: LedgerDateType) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  loading: boolean;
  error: string;
  onBack: () => void;
}> = ({
  ledgerData,
  selectedCustomer,
  reportType,
  onReportTypeChange,
  dateType,
  onDateTypeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  loading,
  error,
  onBack,
}) => {
  if (!selectedCustomer) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-[#999]">
        <p>Select a customer from the left to view their ledger.</p>
      </div>
    );
  }

  const handleExportExcel = () => {
    if (!ledgerData) return;
    customerLedgerService.exportLedgerCsv(ledgerData);
  };

  return (
    <div className="h-full overflow-y-auto" data-testid="ledger-report-scroll">
      {error && (
        <div className="mb-4 rounded border border-[#ebccd1] bg-[#f2dede] px-4 py-3 text-sm text-[#a94442]">
          <b>Oops!</b> {error}
        </div>
      )}

      {/* Old-system report title and actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#ddd] pb-3">
        <h2 className="font-serif text-lg font-bold uppercase">Customer Ledger (Accounting Copy)</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={!ledgerData}
            className="rounded border border-[#4a9] bg-white px-3 py-1.5 text-sm text-[#4a9] hover:bg-[#f0fff0] disabled:opacity-40"
          >
            Export Excel
          </button>
          <button
            onClick={() => window.print()}
            className="rounded border border-[#ccc] bg-white px-3 py-1.5 text-sm hover:bg-[#f5f5f5]"
          >
            Print
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded border border-[#c9302c] bg-[#d9534f] px-3 py-1.5 text-sm text-white hover:bg-[#c9302c]"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Report header */}
      <div className="border-b border-[#ddd] pb-4">
        <div className="text-center">
          <h3 className="font-serif text-xl font-bold">
            Customer Ledger: {selectedCustomer.company}
            {ledgerData?.metrics.old_name && (
              <span className="ml-2 text-sm font-normal text-[#555]">
                ( Old Name: <span>{ledgerData.metrics.old_name}</span> )
              </span>
            )}
          </h3>
          <p className="text-xs text-[#555]">System generated: {new Date().toLocaleString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-3">
          <ReportControls
            reportType={reportType}
            onReportTypeChange={onReportTypeChange}
            dateType={dateType}
            onDateTypeChange={onDateTypeChange}
            dateFrom={dateFrom}
            onDateFromChange={onDateFromChange}
            dateTo={dateTo}
            onDateToChange={onDateToChange}
            loading={loading}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[#999]">Loading ledger...</div>
      ) : ledgerData ? (
        <>
          {/* Old-system seven-card customer summary */}
          <div className="my-4 overflow-x-auto rounded border border-[#ddd] bg-white">
            <div className="grid min-w-[980px] grid-cols-7">
              <LedgerMetricCard
                label="Customer Since:"
                value={formatDate(ledgerData.metrics.customer_since)}
                color="text-[#1261b5]"
                icon={<CalendarDays size={28} />}
              />
              <LedgerMetricCard
                label="VIP Status:"
                value={vipLabel(ledgerData.metrics.vip_status)}
                color="text-[#c58a00]"
                icon={<Crown size={28} />}
              />
              <LedgerMetricCard
                label="Price Code:"
                value={ledgerData.metrics.price_code || '-'}
                color="text-[#7a1fa2]"
                icon={<Tag size={28} />}
              />
              <LedgerMetricCard
                label="Total Sales (This Month):"
                value={peso.format(ledgerData.metrics.monthly_sales || 0)}
                color="text-[#138a4b]"
                icon={<TrendingUp size={28} />}
              />
              <LedgerMetricCard
                label="Outstanding Balance:"
                value={peso.format(ledgerData.metrics.balance || 0)}
                color="text-[#c62828]"
                icon={<WalletCards size={28} />}
              />
              <LedgerMetricCard
                label="Terms:"
                value={ledgerData.metrics.terms || '-'}
                color="text-[#1261b5]"
                icon={<FileText size={28} />}
              />
              <LedgerMetricCard
                label="Credit Limit:"
                value={peso.format(ledgerData.metrics.credit_limit || 0)}
                color="text-[#142c52]"
                icon={<ShieldCheck size={28} />}
              />
            </div>
          </div>

          {/* Table */}
          <div className="mb-4 overflow-auto border border-[#ddd]">
            {reportType === 'summary' ? (
              <SummaryTable data={ledgerData} />
            ) : (
              <DetailedTable data={ledgerData} />
            )}
          </div>

          {/* Aging buckets appear below the ledger, as in James's reference. */}
          <div className="mb-4 overflow-x-auto">
            <h4 className="mb-2 text-xs font-bold uppercase text-[#555]">Aging Balances</h4>
            <AgingBuckets aging={ledgerData.metrics.aging} />
          </div>
        </>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Main View                                                                 */
/* -------------------------------------------------------------------------- */

const CustomerLedgerView: React.FC = () => {
  const [customers, setCustomers] = useState<LedgerCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [reportType, setReportType] = useState<LedgerReportType>('detailed');
  const [dateType, setDateType] = useState<LedgerDateType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ledgerData, setLedgerData] = useState<CustomerLedgerResponse | null>(null);

  // Persist selected customer data across searches
  const selectedCustomerRef = useRef<LedgerCustomer | null>(null);

  // Debounce customer search
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Load customer list (always includes the selected customer)
  useEffect(() => {
    let active = true;
    setLoadingCustomers(true);
    customerLedgerService
      .getCustomers(debouncedSearch)
      .then((rows) => {
        if (!active) return;
        // Ensure the selected customer is always in the list
        if (
          selectedCustomerRef.current &&
          !rows.find((r) => r.sessionId === selectedCustomerRef.current!.sessionId)
        ) {
          rows = [selectedCustomerRef.current, ...rows];
        }
        setCustomers(rows);
      })
      .catch(() => {
        if (!active) return;
        setCustomers(selectedCustomerRef.current ? [selectedCustomerRef.current] : []);
      })
      .finally(() => {
        if (active) setLoadingCustomers(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.sessionId === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  // Auto-load ledger when customer or filters change
  useEffect(() => {
    if (!selectedCustomerId) {
      setLedgerData(null);
      setError('');
      return;
    }

    if (dateType === 'custom' && (!dateFrom || !dateTo)) {
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    customerLedgerService
      .getLedger(selectedCustomerId, {
        reportType,
        dateType,
        dateFrom: dateType === 'custom' ? dateFrom : undefined,
        dateTo: dateType === 'custom' ? dateTo : undefined,
      })
      .then((payload) => {
        if (!active) return;
        setLedgerData(payload);
      })
      .catch((err: any) => {
        if (!active) return;
        setLedgerData(null);
        setError(err?.message || 'Failed to load customer ledger');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCustomerId, reportType, dateType, dateFrom, dateTo]);

  const handleCustomerSelect = (sessionId: string) => {
    setSelectedCustomerId(sessionId);
    setError('');
    // Persist selected customer for re-injection on search
    const found = customers.find((r) => r.sessionId === sessionId);
    if (found) {
      selectedCustomerRef.current = found;
    }
  };

  const handleBack = () => {
    setSelectedCustomerId('');
    selectedCustomerRef.current = null;
    setLedgerData(null);
    setError('');
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f4f4f4] text-[#333]">
      {/* Left panel: permanent customer search */}
      <div className="w-[300px] flex-shrink-0">
        <CustomerSearchPanel
          customers={customers}
          loading={loadingCustomers}
          search={search}
          onSearchChange={setSearch}
          selectedCustomerId={selectedCustomerId}
          onCustomerSelect={handleCustomerSelect}
        />
      </div>

      {/* Right panel: ledger report */}
      <div className="flex flex-1 flex-col min-w-0 p-5">
        <div className="flex-1 rounded border border-[#d5d5d5] bg-white p-5 shadow-sm">
          <LedgerReport
            ledgerData={ledgerData}
            selectedCustomer={selectedCustomer}
            reportType={reportType}
            onReportTypeChange={setReportType}
            dateType={dateType}
            onDateTypeChange={setDateType}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            loading={loading}
            error={error}
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerLedgerView;
