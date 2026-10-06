import React, { useEffect, useMemo, useState } from 'react';
import {
  SoaCustomer,
  SoaDateType,
  SoaReportType,
  SoaResponse,
  statementOfAccountService,
} from '../services/statementOfAccountService';
import { formatAccountingTimestamp, formatDate as formatPhilippineDate } from '../utils/formatUtils';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';

import { shouldSuppressAuthError } from '../services/localApiAuth';
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  return formatPhilippineDate(value);
};

const StatementOfAccountView: React.FC = () => {
  const [customers, setCustomers] = useState<SoaCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [reportType, setReportType] = useState<SoaReportType>('detailed');
  const dateType: SoaDateType = 'all';

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<SoaResponse | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(customerSearch.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    let active = true;
    setLoadingCustomers(true);
    statementOfAccountService
      .getCustomers(debouncedSearch)
      .then((rows) => {
        if (!active) return;
        setCustomers(rows);
      })
      .catch(() => {
        if (!active) return;
        setCustomers([]);
      })
      .finally(() => {
        if (active) setLoadingCustomers(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  const [selectedCustomerSnapshot, setSelectedCustomerSnapshot] = useState<SoaCustomer | null>(null);
  const customerOptions = useMemo<SearchableSelectOption[]>(() => {
    const options = new Map<string, SearchableSelectOption>();
    for (const customer of customers) {
      options.set(customer.sessionId, {
        value: customer.sessionId,
        label: customer.company || customer.customerCode || customer.sessionId,
        keywords: [customer.customerCode],
      });
    }
    if (selectedCustomerSnapshot && !options.has(selectedCustomerSnapshot.sessionId)) {
      options.set(selectedCustomerSnapshot.sessionId, {
        value: selectedCustomerSnapshot.sessionId,
        label: selectedCustomerSnapshot.company || selectedCustomerSnapshot.customerCode || selectedCustomerSnapshot.sessionId,
        keywords: [selectedCustomerSnapshot.customerCode],
      });
    }
    return Array.from(options.values());
  }, [customers, selectedCustomerSnapshot]);

  const generate = async () => {
    if (!selectedCustomerId) {
      setError('Select a customer first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await statementOfAccountService.getStatement({
        customerId: selectedCustomerId,
        reportType,
        dateType,
      });
      setReport(payload);
    } catch (err: any) {
      if (shouldSuppressAuthError(err)) return;
      setReport(null);
      setError(err?.message || 'Failed to load statement of account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full overflow-y-auto bg-slate-100 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {!report && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-base font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">Statement of Account</h2></header>
          <div className="p-5 sm:p-8">
            {error && <div role="alert" className="mb-5 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><b>Oops!</b> {error}</div>}
            <div className="mx-auto max-w-4xl space-y-5">
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(160px,25%)_minmax(0,1fr)] sm:gap-4">
                <label className="pt-2 text-sm font-semibold sm:text-right">Select Customer <span className="text-rose-600">*</span></label>
                <SearchableSelect
                  value={selectedCustomerId}
                  options={customerOptions}
                  onChange={(customerId) => {
                    setSelectedCustomerId(customerId);
                    const customer = customers.find((row) => row.sessionId === customerId);
                    if (customer) setSelectedCustomerSnapshot(customer);
                    setError('');
                  }}
                  onSearch={setCustomerSearch}
                  loading={loadingCustomers}
                  placeholder="Search customer..."
                  searchPlaceholder="Search customer..."
                  buttonClassName="min-h-10 rounded border-slate-300 py-2 text-sm dark:border-slate-700"
                  searchInputClassName="focus:border-brand-blue focus:ring-brand-blue"
                  dropdownClassName="dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(160px,25%)_minmax(0,1fr)] sm:gap-4">
                <label className="pt-1 text-sm font-semibold sm:text-right">Type <span className="text-rose-600">*</span></label>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <label className="inline-flex items-center gap-2"><input className="h-4 w-4 accent-brand-blue" type="radio" name="soa-report-type" checked={reportType === 'detailed'} onChange={() => setReportType('detailed')} /> Detailed</label>
                  <label className="inline-flex items-center gap-2"><input className="h-4 w-4 accent-brand-blue" type="radio" name="soa-report-type" checked={reportType === 'summary'} onChange={() => setReportType('summary')} /> Monthly</label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(160px,25%)_minmax(0,1fr)] sm:gap-4"><span className="hidden sm:block"/><div className="flex flex-wrap gap-2">
                <button type="button" onClick={generate} disabled={loading || !selectedCustomerId} className="rounded border border-brand-blue bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Generating...' : 'Generate Report'}</button>
                <button type="button" onClick={() => { setReport(null); setError(''); }} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
              </div></div>
            </div>
          </div>
        </section>}
        {report && <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800"><div><h3 className="text-base font-bold uppercase tracking-wide">Statement of Account</h3><p className="text-sm">{selectedCustomerSnapshot?.company || report.customer.company || '-'}</p></div><div className="flex gap-2"><button onClick={() => window.print()} className="rounded border border-brand-blue px-3 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-blue hover:text-white">Print</button><button onClick={() => setReport(null)} className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Back</button></div></div>
          <div className="mb-5 text-center"><h4 className="text-base font-bold">STATEMENT OF ACCOUNT</h4><p className="font-semibold">{selectedCustomerSnapshot?.company || report.customer.company || '-'}</p><p className="text-sm text-slate-600 dark:text-slate-400">As of: {formatDate(new Date().toISOString())}</p></div>
          <div className="overflow-auto">{reportType === 'summary' ? <SummaryTable report={report} /> : <DetailedTable report={report} />}</div>
        </section>}
      </div>
    </div>
  );
};

const DetailedTable: React.FC<{ report: SoaResponse }> = ({ report }) => (
  <div className="overflow-auto rounded border border-slate-200 dark:border-slate-800">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
        <tr>
          <th className="px-3 py-2 text-left">Terms</th>
          <th className="px-3 py-2 text-left">Date</th>
          <th className="px-3 py-2 text-left">Timestamp</th>
          <th className="px-3 py-2 text-left">DR/INV</th>
          <th className="px-3 py-2 text-right">Amount</th>
          <th className="px-3 py-2 text-right">Amount Paid</th>
          <th className="px-3 py-2 text-right">Balance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {report.rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-3 py-6 text-center text-slate-500">No statement rows found.</td>
          </tr>
        ) : (
          report.rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2">{row.terms || '-'}</td>
              <td className="px-3 py-2">{formatDate(row.date)}</td>
              <td className="whitespace-nowrap px-3 py-2">{formatAccountingTimestamp(row.created_at)}</td>
              <td className="px-3 py-2">{row.reference || '-'}</td>
              <td className="px-3 py-2 text-right">{peso.format(row.amount || 0)}</td>
              <td className="px-3 py-2 text-right">{peso.format(row.amount_paid || 0)}</td>
              <td className="px-3 py-2 text-right font-semibold">{peso.format(row.balance || 0)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-semibold">
        <tr>
          <td className="px-3 py-2 text-right" colSpan={6}>BALANCE =&gt;</td>
          <td className="border-y-2 border-slate-700 px-3 py-2 text-right text-rose-600 dark:border-slate-300">{peso.format(report.totals.balance || 0)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

const SummaryTable: React.FC<{ report: SoaResponse }> = ({ report }) => (
  <div className="overflow-auto rounded border border-slate-200 dark:border-slate-800">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
        <tr>
          <th className="px-3 py-2 text-left">Year</th>
          <th className="px-3 py-2 text-left">Month</th>
          <th className="px-3 py-2 text-right">Debit</th>
          <th className="px-3 py-2 text-right">Credit</th>
          <th className="px-3 py-2 text-right">Running Balance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {report.summary_rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No monthly rows found.</td>
          </tr>
        ) : (
          report.summary_rows.map((row, index) => (
            <tr key={`${row.year}-${row.month}-${index}`}>
              <td className="px-3 py-2">{row.year || '-'}</td>
              <td className="px-3 py-2">{row.month_name || row.month || '-'}</td>
              <td className="px-3 py-2 text-right">{peso.format(row.total_debit || 0)}</td>
              <td className="px-3 py-2 text-right">{peso.format(row.total_credit || 0)}</td>
              <td className="px-3 py-2 text-right font-semibold">{peso.format(row.balance || 0)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-semibold">
        <tr>
          <td className="px-3 py-2" colSpan={2}>TOTAL</td>
          <td className="px-3 py-2 text-right">{peso.format(report.totals.amount || 0)}</td>
          <td className="px-3 py-2 text-right">{peso.format(report.totals.amount_paid || 0)}</td>
          <td className="px-3 py-2 text-right text-rose-600">{peso.format(report.totals.balance || 0)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

export default StatementOfAccountView;
