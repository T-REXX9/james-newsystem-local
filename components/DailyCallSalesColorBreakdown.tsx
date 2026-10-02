import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { DailyCallSalesColor, DailyCallSalesColorAgent, DailyCallSalesColorBreakdown as Breakdown } from '../types';
import { fetchDailyCallSalesColorBreakdown } from '../services/dailyCallMonitoringService';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const colorColumns: Array<{ id: DailyCallSalesColor; label: string; detail: string; dot: string }> = [
  { id: 'green', label: 'Green', detail: 'Bought this month', dot: 'bg-emerald-600' },
  { id: 'yellow', label: 'Yellow', detail: 'No purchase for 1 month', dot: 'bg-amber-400' },
  { id: 'purple', label: 'Purple', detail: 'No purchase for 2 months', dot: 'bg-purple-600' },
  { id: 'white', label: 'White', detail: '3+ months / none', dot: 'border border-slate-300 bg-white' },
  { id: 'red', label: 'Red', detail: 'Blacklisted / rejected', dot: 'bg-rose-600' },
];

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
};

const DailyCallSalesColorBreakdown: React.FC = () => {
  const [data, setData] = useState<Breakdown | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchDailyCallSalesColorBreakdown({ signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [retry]);

  const rows = data ? [...data.agents, data.unassigned] : [];
  const sortedRows = [...rows].sort((a, b) => {
    if (a.id === '' || b.id === '') return a.id === '' ? 1 : -1;
    return b.sales - a.sales || a.name.localeCompare(b.name);
  });

  const renderAgentRow = (agent: DailyCallSalesColorAgent, rank?: number) => (
    <tr key={agent.id || 'unassigned'} className="border-t border-slate-100 dark:border-slate-800">
      <th scope="row" className="sticky left-0 z-[1] min-w-44 bg-white px-3 py-2.5 text-left dark:bg-slate-900">
        <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">{rank ? `${rank}. ` : ''}{agent.name}</span>
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{agent.customer_count.toLocaleString()} customers</span>
      </th>
      {colorColumns.map(({ id }) => (
        <td key={id} className="min-w-32 px-3 py-2.5 text-right">
          <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{money.format(agent.colors[id].sales)}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{agent.colors[id].customer_count.toLocaleString()} customers</span>
        </td>
      ))}
      <td className="min-w-36 px-3 py-2.5 text-right">
        <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{money.format(agent.unclassified_sales)}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">No customer ID</span>
      </td>
      <td className="min-w-36 px-3 py-2.5 text-right">
        <span className="block text-xs font-extrabold text-slate-900 dark:text-white">{money.format(agent.sales)}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">{data?.company_total ? `${((agent.sales / data.company_total) * 100).toFixed(1)}% of company` : '0.0% of company'}</span>
      </td>
    </tr>
  );

  return (
    <section aria-labelledby="daily-call-team-sales-title" className="shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div>
          <h2 id="daily-call-team-sales-title" className="text-sm font-extrabold text-slate-900 dark:text-white">Team sales by Daily Call status</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{data ? formatMonth(data.month) : 'Current month'} · posted sales by each customer’s assigned agent</p>
        </div>
        {data && <p className="text-sm font-extrabold text-blue-800 dark:text-blue-200">Company total {money.format(data.company_total)}</p>}
      </header>
      {error ? (
        <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm text-rose-700 dark:text-rose-200">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />Unable to load the company sales breakdown.</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-bold hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
        </div>
      ) : !data ? (
        <div className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400" role="status">Loading team sales breakdown…</div>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <caption className="sr-only">Monthly posted sales and customer counts by sales agent and Daily Call color status</caption>
            <thead className="sticky top-0 z-[2] bg-slate-50 text-[10px] text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th scope="col" className="sticky left-0 min-w-44 bg-slate-50 px-3 py-2 text-left dark:bg-slate-950">Sales agent</th>
                {colorColumns.map(({ id, label, detail, dot }) => (
                  <th key={id} scope="col" className="min-w-32 px-3 py-2 text-right font-bold">
                    <span className="flex items-center justify-end gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />{label}</span>
                    <span className="mt-0.5 block font-normal text-slate-500 dark:text-slate-400">{detail}</span>
                  </th>
                ))}
                <th scope="col" className="min-w-36 px-3 py-2 text-right font-bold">Unclassified</th>
                <th scope="col" className="min-w-36 px-3 py-2 text-right font-bold">Total sales</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((agent, index) => renderAgentRow(agent, agent.id ? index + 1 : undefined))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Each identified customer appears in one status bucket. Red includes blacklisted or rejected customers; unassigned agents and posted sales with no customer ID are shown separately.
      </p>
    </section>
  );
};

export default DailyCallSalesColorBreakdown;
