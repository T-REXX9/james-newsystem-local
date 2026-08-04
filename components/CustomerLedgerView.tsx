import React, { useEffect, useMemo, useState } from 'react';
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
  return d.toLocaleDateString('en-US');
};

const dateTypeOptions: Array<{ value: LedgerDateType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Date' },
];

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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoadingCustomers(true);
    customerLedgerService
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

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.sessionId === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const loadLedger = async () => {
    if (!selectedCustomerId) {
      setError('Select a customer first');
      return;
    }
    if (dateType === 'custom' && (!dateFrom || !dateTo)) {
      setError('Custom date range requires Date From and Date To');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await customerLedgerService.getLedger(selectedCustomerId, {
        reportType,
        dateType,
        dateFrom: dateType === 'custom' ? dateFrom : undefined,
        dateTo: dateType === 'custom' ? dateTo : undefined,
      });
      setLedgerData(payload);
    } catch (err: any) {
      setLedgerData(null);
      setError(err?.message || 'Failed to load customer ledger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[#f4f4f4] p-5 text-[#333]">
      <div className="mx-auto max-w-[1140px] space-y-5">
        <section className="rounded border border-[#d5d5d5] bg-white shadow-sm">
          <header className="border-b border-[#ddd] px-5 py-4">
            <h2 className="font-serif text-lg font-bold uppercase">Customer Ledger Report</h2>
          </header>
          <div className="p-6">
            <p className="mb-8 text-sm">Field mark with (<span className="text-red-600">*</span>) is required. Press generate after you select the sorting options</p>
            {error && <div className="mb-5 rounded border border-[#ebccd1] bg-[#f2dede] px-4 py-3 text-sm text-[#a94442]"><b>Oops!</b> {error}</div>}
            <div className="mx-auto max-w-[760px] space-y-5">
              <div className="grid grid-cols-[210px_1fr] items-center gap-4">
                <label className="text-right text-sm font-semibold">Select Customer <span className="text-red-600">*</span></label>
                <div className="space-y-2">
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer" className="w-full rounded border border-[#ccc] px-3 py-2 text-sm" />
                  <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full rounded border border-[#ccc] bg-white px-3 py-2 text-sm">
                    <option value="">{loadingCustomers ? 'Loading customers...' : 'Select Customer'}</option>
                    {customers.map(customer => <option key={customer.sessionId} value={customer.sessionId}>{customer.company || customer.customerCode || customer.sessionId}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-[210px_1fr] items-center gap-4">
                <label className="text-right text-sm font-semibold">Date Covered <span className="text-red-600">*</span></label>
                <select value={dateType} onChange={e => setDateType(e.target.value as LedgerDateType)} className="rounded border border-[#ccc] bg-white px-3 py-2 text-sm">
                  {dateTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              {dateType === 'custom' && <>
                <div className="grid grid-cols-[210px_1fr] items-center gap-4"><label className="text-right text-sm font-semibold">Date From <span className="text-red-600">*</span></label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded border border-[#ccc] px-3 py-2 text-sm" /></div>
                <div className="grid grid-cols-[210px_1fr] items-center gap-4"><label className="text-right text-sm font-semibold">Date To <span className="text-red-600">*</span></label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded border border-[#ccc] px-3 py-2 text-sm" /></div>
              </>}
              <div className="grid grid-cols-[210px_1fr] items-center gap-4">
                <label className="text-right text-sm font-semibold">Type <span className="text-red-600">*</span></label>
                <div className="flex gap-5 text-sm"><label><input type="radio" checked={reportType === 'detailed'} onChange={() => setReportType('detailed')} /> Detailed</label><label><input type="radio" checked={reportType === 'summary'} onChange={() => setReportType('summary')} /> Summary</label></div>
              </div>
              <div className="grid grid-cols-[210px_1fr] gap-4">
                <span />
                <div className="flex gap-2">
                  <button type="button" onClick={loadLedger} disabled={loading} className="rounded border border-[#2e6da4] bg-[#337ab7] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Generating...' : 'Generate Report'}</button>
                  <button type="button" onClick={() => { setLedgerData(null); setError(''); }} className="rounded border border-[#ccc] bg-white px-4 py-2 text-sm">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {ledgerData && (
          <section className="rounded border border-[#d5d5d5] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between border-b border-[#ddd] pb-4">
              <div><h3 className="text-center font-serif text-lg font-bold uppercase">Customer Ledger: {selectedCustomer?.company}</h3><p className="text-center text-xs">System generated: {new Date().toLocaleString()}</p></div>
              <button onClick={() => window.print()} className="rounded border border-[#ccc] px-3 py-2 text-sm">Print</button>
            </div>
            <div className="mb-5 grid grid-cols-2 gap-6 text-sm">
              <div><p><b>Credit Limit:</b> <u>{peso.format(ledgerData.metrics.credit_limit || 0)}</u></p><p className="mt-3"><b>Balance:</b> <u>{peso.format(ledgerData.metrics.balance || 0)}</u></p></div>
              <table className="w-full border-collapse border border-[#ddd]"><tbody><tr><th className="border border-[#ddd] p-2">Since</th><th className="border border-[#ddd] p-2">Quota</th><th className="border border-[#ddd] p-2">Terms</th></tr><tr><td className="border border-[#ddd] p-2">{formatDate(ledgerData.metrics.customer_since)}</td><td className="border border-[#ddd] p-2">{peso.format(ledgerData.metrics.dealership_quota || 0)}</td><td className="border border-[#ddd] p-2">{ledgerData.metrics.terms || '-'}</td></tr></tbody></table>
            </div>
            <div className="overflow-auto">{reportType === 'summary' ? <SummaryTable data={ledgerData} /> : <DetailedTable data={ledgerData} />}</div>
          </section>
        )}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{value}</p>
  </div>
);

const DetailedTable: React.FC<{ data: CustomerLedgerResponse }> = ({ data }) => (
  <table className="min-w-full text-sm">
    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
      <tr>
        <th className="text-left px-2 py-2">Date</th>
        <th className="text-left px-2 py-2">Ref</th>
        <th className="text-left px-2 py-2">Chk No.</th>
        <th className="text-left px-2 py-2">Chk Date</th>
        <th className="text-left px-2 py-2">DCR</th>
        <th className="text-right px-2 py-2">Debit</th>
        <th className="text-right px-2 py-2">Credit</th>
        <th className="text-right px-2 py-2">PDC</th>
        <th className="text-right px-2 py-2">Balance</th>
        <th className="text-left px-2 py-2">Remarks</th>
        <th className="text-left px-2 py-2">Promise to Pay</th>
      </tr>
    </thead>
    <tbody>
      {data.rows.map((row, index) => (
        <tr key={`${row.id}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
          <td className="px-2 py-1.5">{formatDate(row.date)}</td>
          <td className="px-2 py-1.5">{row.reference || '-'}</td>
          <td className="px-2 py-1.5">{row.check_no || '-'}</td>
          <td className="px-2 py-1.5">{formatDate(row.check_date)}</td>
          <td className="px-2 py-1.5">{row.dcr || '-'}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.debit || 0)}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.credit || 0)}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.pdc || 0)}</td>
          <td className="px-2 py-1.5 text-right font-semibold">{peso.format(row.balance || 0)}</td>
          <td className="px-2 py-1.5">{row.remarks || '-'}</td>
          <td className="px-2 py-1.5">{row.promise_to_pay || '-'}</td>
        </tr>
      ))}
      <tr className="font-semibold bg-slate-50 dark:bg-slate-900/50">
        <td className="px-2 py-2" colSpan={5}>TOTAL</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.debit || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.credit || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.pdc || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.balance || 0)}</td>
        <td className="px-2 py-2" colSpan={2}></td>
      </tr>
    </tbody>
  </table>
);

const SummaryTable: React.FC<{ data: CustomerLedgerResponse }> = ({ data }) => (
  <table className="min-w-full text-sm">
    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
      <tr>
        <th className="text-left px-2 py-2">Year</th>
        <th className="text-left px-2 py-2">Month</th>
        <th className="text-right px-2 py-2">Debit</th>
        <th className="text-right px-2 py-2">Credit</th>
        <th className="text-right px-2 py-2">Balance</th>
      </tr>
    </thead>
    <tbody>
      {data.summary_rows.map((row, index) => (
        <tr key={`${row.year}-${row.month}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
          <td className="px-2 py-1.5">{row.year}</td>
          <td className="px-2 py-1.5">{row.month_name || row.month}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.debit || 0)}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.credit || 0)}</td>
          <td className="px-2 py-1.5 text-right font-semibold">{peso.format(row.balance || 0)}</td>
        </tr>
      ))}
      <tr className="font-semibold bg-slate-50 dark:bg-slate-900/50">
        <td className="px-2 py-2" colSpan={2}>TOTAL</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.debit || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.credit || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.balance || 0)}</td>
      </tr>
    </tbody>
  </table>
);

export default CustomerLedgerView;
