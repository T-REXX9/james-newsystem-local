import React, { useEffect, useMemo, useState } from 'react';
import {
  SoaCustomer,
  SoaDateType,
  SoaReportType,
  SoaResponse,
  statementOfAccountService,
} from '../services/statementOfAccountService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTypeOptions: Array<{ value: SoaDateType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${Number(dateOnly[2])}/${Number(dateOnly[3])}/${dateOnly[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

const StatementOfAccountView: React.FC = () => {
  const [customers, setCustomers] = useState<SoaCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [reportType, setReportType] = useState<SoaReportType>('detailed');
  const [dateType, setDateType] = useState<SoaDateType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.sessionId === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const generate = async () => {
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
      const payload = await statementOfAccountService.getStatement({
        customerId: selectedCustomerId,
        reportType,
        dateType,
        dateFrom: dateType === 'custom' ? dateFrom : undefined,
        dateTo: dateType === 'custom' ? dateTo : undefined,
      });
      setReport(payload);
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Failed to load statement of account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[#f4f4f4] p-5 text-[#333]">
      <div className="mx-auto max-w-[1140px] space-y-5">
        <section className="rounded border border-[#d5d5d5] bg-white shadow-sm">
          <header className="border-b border-[#ddd] px-5 py-4"><h2 className="font-serif text-lg font-bold uppercase">Statement of Account</h2></header>
          <div className="p-8">
            {error && <div className="mb-5 rounded border border-[#ebccd1] bg-[#f2dede] px-4 py-3 text-sm text-[#a94442]"><b>Oops!</b> {error}</div>}
            <div className="mx-auto max-w-[760px] space-y-5">
              <div className="grid grid-cols-[210px_1fr] items-start gap-4">
                <label className="pt-2 text-right text-sm font-semibold">Select Customer <span className="text-red-600">*</span></label>
                <div className="space-y-2">
                  <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="*Leave it blank to show all customers*" className="w-full rounded border border-[#ccc] px-3 py-2 text-sm" />
                  <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full rounded border border-[#ccc] bg-white px-3 py-2 text-sm">
                    <option value="">{loadingCustomers ? 'Loading customers...' : 'Select Customer'}</option>
                    {customers.map(customer => <option key={customer.sessionId} value={customer.sessionId}>{customer.company || customer.customerCode || customer.sessionId}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-[210px_1fr] items-center gap-4">
                <label className="text-right text-sm font-semibold">Type <span className="text-red-600">*</span></label>
                <div className="flex gap-5 text-sm"><label><input type="radio" checked={reportType === 'detailed'} onChange={() => setReportType('detailed')} /> Detailed</label><label><input type="radio" checked={reportType === 'summary'} onChange={() => setReportType('summary')} /> Monthly</label></div>
              </div>
              <div className="grid grid-cols-[210px_1fr] gap-4"><span/><div className="flex gap-2">
                <button type="button" onClick={generate} disabled={loading} className="rounded border border-[#2e6da4] bg-[#337ab7] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Generating...' : 'Generate Report'}</button>
                <button type="button" onClick={() => { setReport(null); setError(''); }} className="rounded border border-[#ccc] bg-white px-4 py-2 text-sm">Cancel</button>
              </div></div>
            </div>
          </div>
        </section>
        {report && <section className="rounded border border-[#d5d5d5] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between border-b border-[#ddd] pb-4"><div><h3 className="font-serif text-lg font-bold uppercase">Statement of Account</h3><p className="text-sm">{selectedCustomer?.company || '-'}</p></div><button onClick={() => window.print()} className="rounded border border-[#ccc] px-3 py-2 text-sm">Print</button></div>
          <div className="overflow-auto">{reportType === 'summary' ? <SummaryTable report={report} /> : <DetailedTable report={report} />}</div>
        </section>}
      </div>
    </div>
  );
};

const DetailedTable: React.FC<{ report: SoaResponse }> = ({ report }) => (
  <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
        <tr>
          <th className="px-3 py-2 text-left">Terms</th>
          <th className="px-3 py-2 text-left">Date</th>
          <th className="px-3 py-2 text-left">DR/INV</th>
          <th className="px-3 py-2 text-right">Amount</th>
          <th className="px-3 py-2 text-right">Amount Paid</th>
          <th className="px-3 py-2 text-right">Balance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {report.rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No statement rows found.</td>
          </tr>
        ) : (
          report.rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2">{row.terms || '-'}</td>
              <td className="px-3 py-2">{formatDate(row.date)}</td>
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
          <td className="px-3 py-2" colSpan={3}>TOTAL BALANCE</td>
          <td className="px-3 py-2 text-right">{peso.format(report.totals.amount || 0)}</td>
          <td className="px-3 py-2 text-right">{peso.format(report.totals.amount_paid || 0)}</td>
          <td className="px-3 py-2 text-right text-rose-600">{peso.format(report.totals.balance || 0)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

const SummaryTable: React.FC<{ report: SoaResponse }> = ({ report }) => (
  <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
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
