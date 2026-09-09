import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { buildYearlySales, CustomerLedgerDetailedRow, CustomerYearlySales } from '../services/customerLedgerService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

interface CustomerYearlySalesProps {
  rows: CustomerLedgerDetailedRow[];
  error?: string;
  today?: Date;
}

const CustomerYearlySales: React.FC<CustomerYearlySalesProps> = ({ rows, error, today }) => {
  const currentDate = useMemo(() => today || new Date(), [today]);
  const years = useMemo(() => buildYearlySales(rows, currentDate), [rows, currentDate]);
  const currentYear = currentDate.getFullYear();
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  useEffect(() => {
    setExpandedYear(years.find((entry) => entry.year === currentYear)?.year ?? years[0]?.year ?? null);
  }, [currentYear, years]);

  return (
    <section
      aria-labelledby="customer-yearly-sales-heading"
      className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-1 md:col-span-2 lg:col-span-3"
      data-testid="customer-yearly-sales"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 id="customer-yearly-sales-heading" className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-blue" /> Yearly Sales
          </h3>
          <p className="text-xs text-slate-500 mt-1">Posted customer-ledger sales from the first recorded year through today.</p>
        </div>
        {years.length > 0 && <span className="text-xs font-semibold text-slate-400">{years.length} year{years.length === 1 ? '' : 's'}</span>}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>
      ) : years.length === 0 ? (
        <p className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm text-slate-500">No posted sales found in the customer ledger.</p>
      ) : (
        <div className="space-y-2">
          {years.map((entry) => (
            <YearRow
              key={entry.year}
              entry={entry}
              isCurrentYear={entry.year === currentYear}
              expanded={expandedYear === entry.year}
              onToggle={() => setExpandedYear((value) => value === entry.year ? null : entry.year)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const YearRow: React.FC<{
  entry: CustomerYearlySales;
  isCurrentYear: boolean;
  expanded: boolean;
  onToggle: () => void;
}> = ({ entry, isCurrentYear, expanded, onToggle }) => {
  const panelId = `customer-year-${entry.year}-months`;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{entry.year}</span>
          {isCurrentYear && <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300">Year to date</span>}
        </span>
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{peso.format(entry.total)}</span>
      </button>
      {expanded && (
        <div id={panelId} className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-2" aria-label={`${entry.year} monthly sales`}>
          <div className="flex justify-between px-6 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <span>Monthly Sales</span><span>Total</span>
          </div>
          {entry.months.map((month) => (
            <div key={month.month} className="flex justify-between px-6 py-2 text-sm text-slate-600 dark:text-slate-300">
              <span>{month.label}</span><span className="font-mono font-semibold">{peso.format(month.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerYearlySales;
