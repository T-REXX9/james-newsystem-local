import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { buildYearlySales } from '../services/customerLedgerService';
import type { CustomerLedgerDetailedRow, CustomerYearlySales as CustomerYearlySalesEntry } from '../services/customerLedgerService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const compactPeso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const COMPACT_YEARS_PER_COLUMN = 10;

const chunkYears = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0 || items.length === 0) return items.length ? [items] : [];
  const columns: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    columns.push(items.slice(index, index + size));
  }
  return columns;
};

interface CustomerYearlySalesProps {
  rows?: CustomerLedgerDetailedRow[];
  /** Pre-aggregated year totals (e.g. ledger report_type=yearly). */
  entries?: CustomerYearlySalesEntry[];
  error?: string;
  today?: Date;
  /** Dense year/total chips for at-a-glance panels (no month accordion). */
  compact?: boolean;
}

const CustomerYearlySales: React.FC<CustomerYearlySalesProps> = ({
  rows = [],
  entries,
  error,
  today,
  compact = false,
}) => {
  const currentDate = useMemo(() => today || new Date(), [today]);
  const years = useMemo(() => {
    if (entries) {
      return [...entries].sort((left, right) =>
        compact ? left.year - right.year : right.year - left.year
      );
    }
    const built = buildYearlySales(rows, currentDate);
    return compact ? [...built].sort((left, right) => left.year - right.year) : built;
  }, [compact, currentDate, entries, rows]);
  const yearColumns = useMemo(
    () => (compact ? chunkYears(years, COMPACT_YEARS_PER_COLUMN) : []),
    [compact, years]
  );
  const currentYear = currentDate.getFullYear();
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  useEffect(() => {
    if (compact) {
      setExpandedYear(null);
      return;
    }
    setExpandedYear(years.find((entry) => entry.year === currentYear)?.year ?? years[0]?.year ?? null);
  }, [compact, currentYear, years]);

  if (compact) {
    return (
      <section
        aria-labelledby="customer-yearly-sales-heading"
        className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
        data-testid="customer-yearly-sales"
        data-compact="true"
        data-year-count={years.length}
        data-years-per-column={COMPACT_YEARS_PER_COLUMN}
      >
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <h3 id="customer-yearly-sales-heading" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-800">
            <TrendingUp className="h-3.5 w-3.5 text-brand-blue" /> Yearly Sales
          </h3>
          {years.length > 0 && (
            <span className="text-[10px] font-semibold text-slate-400">
              {years.length} year{years.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-2.5 py-2 text-xs text-rose-700">{error}</p>
        ) : years.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-500">No posted sales found in the customer ledger.</p>
        ) : (
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2" role="list">
            {yearColumns.map((column, columnIndex) => (
              <div
                key={`year-column-${column[0]?.year ?? columnIndex}`}
                role="group"
                aria-label={`Years column ${columnIndex + 1}`}
                data-testid="customer-yearly-sales-column"
                className="flex min-w-[7.5rem] flex-1 flex-col gap-1"
              >
                {column.map((entry) => (
                  <div
                    key={entry.year}
                    role="listitem"
                    className="flex items-baseline justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1"
                    aria-label={`${entry.year} sales ${compactPeso.format(entry.total)}`}
                  >
                    <span className="text-[11px] font-semibold text-slate-600">
                      {entry.year}
                      {entry.year === currentYear ? <span className="ml-1 text-[9px] font-bold uppercase text-blue-700">YTD</span> : null}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-800">{compactPeso.format(entry.total)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

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
  entry: CustomerYearlySalesEntry;
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
