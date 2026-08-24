import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, Printer, RefreshCcw } from 'lucide-react';
import {
  accountsReceivableService,
  ArDateType,
  ArDebtType,
  ArResponse,
  ArRow,
} from '../services/accountsReceivableService';
import { LedgerCustomer, customerLedgerService } from '../services/customerLedgerService';
import { BUTTON_BASE, BUTTON_PRIMARY } from '../utils/uiConstants';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTypeOptions: Array<{ value: ArDateType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

const debtTypeOptions: Array<{ value: ArDebtType; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Good', label: 'Good Only' },
  { value: 'Bad', label: 'Bad Only' },
];

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200';

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${Number(dateOnly[2])}/${Number(dateOnly[3])}/${dateOnly[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US');
};

const buildDateRangeLabel = (report: ArResponse | null): string => {
  if (!report) return 'ALL DATES';
  if (report.date_from && report.date_to) {
    return `FROM ${formatDate(report.date_from)} TO ${formatDate(report.date_to)}`;
  }
  return 'ALL DATES';
};

const flattenRows = (report: ArResponse | null): Array<ArRow & { customer: string; sessionId: string }> => {
  if (!report) return [];
  return report.customers.flatMap((customer) =>
    customer.rows.map((row) => ({
      ...row,
      customer: customer.company || customer.customer_code || customer.session_id,
      sessionId: customer.session_id,
    }))
  );
};

interface AccountsReceivableViewProps {
  initialDateType?: ArDateType;
  initialDateFrom?: string;
  initialDateTo?: string;
}

const AccountsReceivableView: React.FC<AccountsReceivableViewProps> = ({ initialDateType, initialDateFrom, initialDateTo }) => {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customers, setCustomers] = useState<LedgerCustomer[]>([]);
  const [selectedCustomerOption, setSelectedCustomerOption] = useState<LedgerCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [customersLoading, setCustomersLoading] = useState(true);
  const [debtType, setDebtType] = useState<ArDebtType>('All');
  const [dateType, setDateType] = useState<ArDateType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ArResponse | null>(null);

  useEffect(() => {
    if (!initialDateType && !initialDateFrom && !initialDateTo) return;
    setDateType(initialDateType || 'all');
    setDateFrom(initialDateFrom || '');
    setDateTo(initialDateTo || '');
    setReport(null);
  }, [initialDateFrom, initialDateTo, initialDateType]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    let active = true;

    const loadCustomers = async () => {
      setCustomersLoading(true);
      try {
        const rows = await customerLedgerService.getCustomers(debouncedCustomerSearch);
        if (!active) return;

        setCustomers(rows);
        if (selectedCustomer) {
          const matchedCustomer = rows.find((customer) => customer.sessionId === selectedCustomer) || null;
          if (matchedCustomer) {
            setSelectedCustomerOption(matchedCustomer);
          }
        }
      } catch {
        if (!active) return;
        setCustomers([]);
      } finally {
        if (active) {
          setCustomersLoading(false);
        }
      }
    };

    loadCustomers();

    return () => {
      active = false;
    };
  }, [debouncedCustomerSearch, selectedCustomer]);

  const generate = async () => {
    if (dateType === 'custom' && (!dateFrom || !dateTo)) {
      setError('Custom date range requires Date From and Date To');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await accountsReceivableService.getReport({
        customerId: selectedCustomer || undefined,
        debtType,
        dateType,
        dateFrom: dateType === 'custom' ? dateFrom : undefined,
        dateTo: dateType === 'custom' ? dateTo : undefined,
      });
      setReport(payload);
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Failed to load accounts receivable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialDateType || !initialDateFrom || !initialDateTo) return;
    void generate();
  }, [initialDateFrom, initialDateTo, initialDateType]);

  const customerOptions = useMemo(() => {
    if (!selectedCustomerOption || customers.some((customer) => customer.sessionId === selectedCustomerOption.sessionId)) {
      return customers;
    }

    return [selectedCustomerOption, ...customers].sort((a, b) => a.company.localeCompare(b.company));
  }, [customers, selectedCustomerOption]);
  const flattenedRows = useMemo(() => flattenRows(report), [report]);
  const isSingleCustomer = !!selectedCustomer;
  const selectedCustomerName = useMemo(() => {
    if (!selectedCustomer) return '';
    return customerOptions.find((customer) => customer.sessionId === selectedCustomer)?.company || selectedCustomerOption?.company || '';
  }, [customerOptions, selectedCustomer, selectedCustomerOption]);

  return (
    <div className="min-h-full overflow-y-auto bg-[#f4f4f4] p-5 text-[#333]">
      <div className="mx-auto max-w-[1140px] space-y-5">
        <section className="rounded border border-[#d5d5d5] bg-white shadow-sm">
          <header className="border-b border-[#ddd] px-5 py-4"><h2 className="font-serif text-lg font-bold uppercase">Accounts Receivable</h2></header>
          <div className="p-8">
            {error && <div className="mb-5 rounded border border-[#ebccd1] bg-[#f2dede] px-4 py-3 text-sm text-[#a94442]"><b>Oops!</b> {error}</div>}
            <div className="mx-auto max-w-[760px] space-y-5">
              <div className="grid grid-cols-[210px_1fr] items-start gap-4">
                <label className="contents">
                <span className="pt-2 text-right text-sm font-semibold"><span className="sr-only">Customer</span><span aria-hidden="true">Select Customer <span className="text-red-600">*</span></span></span>
                <div className="space-y-2">
                  <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search customer — leave it blank to show all customers" className="w-full rounded border border-[#ccc] px-3 py-2 text-sm" />
                  <select value={selectedCustomer} onChange={e => { const id = e.target.value; setSelectedCustomer(id); setSelectedCustomerOption(customerOptions.find(c => c.sessionId === id) || null); }} className="w-full rounded border border-[#ccc] bg-white px-3 py-2 text-sm">
                    <option value="">{customersLoading ? 'Loading customers...' : 'All Customers'}</option>
                    {customerOptions.map(customer => <option key={customer.sessionId} value={customer.sessionId}>{customer.company || customer.customerCode || customer.sessionId}</option>)}
                  </select>
                </div>
                </label>
              </div>
              <div className="grid grid-cols-[210px_1fr] items-start gap-4">
                <label className="pt-1 text-right text-sm font-semibold">Options</label>
                <div className="space-y-2 text-sm">
                  {debtTypeOptions.map(option => <label key={option.value} className="block"><input type="radio" checked={debtType === option.value} onChange={() => setDebtType(option.value)} /> {option.value === 'Good' ? 'Good Debt Only' : option.value === 'Bad' ? 'Bad Debt Only' : 'All'}</label>)}
                </div>
              </div>
              <div className="grid grid-cols-[210px_1fr] gap-4"><span/><div className="flex gap-2">
                <button type="button" onClick={generate} disabled={loading} className="rounded border border-[#2e6da4] bg-[#337ab7] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Generating...' : 'Generate Report'}</button>
                <button type="button" onClick={() => { setReport(null); setError(''); }} className="rounded border border-[#ccc] bg-white px-4 py-2 text-sm">Cancel</button>
              </div></div>
            </div>
          </div>
        </section>

        {report && <section className="rounded border border-[#d5d5d5] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between border-b border-[#ddd] pb-4"><div><h3 className="font-serif text-lg font-bold uppercase">Accounts Receivable</h3><p className="text-sm font-semibold">{buildDateRangeLabel(report)}</p><p className="text-xs">As of: {new Date().toLocaleDateString('en-US')}</p>{isSingleCustomer && selectedCustomerName && <p className="mt-1 text-sm">{selectedCustomerName}</p>}</div><button onClick={() => window.print()} className="rounded border border-[#ccc] px-3 py-2 text-sm">Print</button></div>
          {flattenedRows.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No outstanding balances found.</p> :
          <div className="overflow-auto border border-[#ddd]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f5f5f5]"><tr>{!isSingleCustomer && <th className="px-3 py-2 text-left">Customer</th>}<th className="px-3 py-2 text-left">Terms</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">DR/INV</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Amount Paid</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
              <tbody>{flattenedRows.map((row,index) => <tr key={`${row.sessionId}-${row.reference}-${index}`} className="border-t border-[#eee]">{!isSingleCustomer && <td className="px-3 py-2">{row.customer || '-'}</td>}<td className="px-3 py-2">{row.terms || '-'}</td><td className="px-3 py-2">{formatDate(row.date)}</td><td className="px-3 py-2">{row.reference || '-'}</td><td className="px-3 py-2 text-right">{peso.format(row.amount || 0)}</td><td className="px-3 py-2 text-right">{peso.format(row.amount_paid || 0)}</td><td className="px-3 py-2 text-right font-semibold">{peso.format(row.balance || 0)}</td></tr>)}</tbody>
              <tfoot className="border-t-2 border-[#aaa] font-bold text-red-600"><tr><td colSpan={isSingleCustomer ? 6 : 7} className="px-3 py-3">GRAND TOTAL BALANCE: {peso.format(report.grand_total_balance || 0)}</td></tr></tfoot>
            </table>
          </div>}
        </section>}
      </div>
    </div>
  );
};

export default AccountsReceivableView;
