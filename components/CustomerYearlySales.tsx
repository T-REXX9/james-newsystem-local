import React, { useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildYearlySales } from '../services/customerLedgerService';
import type { CustomerLedgerDetailedRow, CustomerYearlySales as CustomerYearlySalesEntry } from '../services/customerLedgerService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const chartPeso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});
const axisPeso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
});

type ChartYear = { year: number; total: number; isCurrentYear: boolean };
type SalesTrendTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: ChartYear }>;
};

const SalesTrendTooltip: React.FC<SalesTrendTooltipProps> = ({ active, payload }) => {
  const year = payload?.[0]?.payload;
  if (!active || !year) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{year.year} {year.isCurrentYear ? 'year to date' : 'full year'}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-brand-blue dark:text-blue-300">
        {chartPeso.format(year.total)}
      </p>
    </div>
  );
};

interface CustomerYearlySalesProps {
  rows?: CustomerLedgerDetailedRow[];
  /** Pre-aggregated qualifying sales grouped by year and month. */
  entries?: CustomerYearlySalesEntry[];
  error?: string;
  today?: Date;
  /** Yearly trend chart for at-a-glance panels. */
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
  const chartGradientId = `customer-sales-trend-${useId().replace(/:/g, '')}`;
  const years = useMemo(() => {
    if (entries) {
      return [...entries].sort((left, right) =>
        compact ? left.year - right.year : right.year - left.year
      );
    }
    const built = buildYearlySales(rows, currentDate);
    return compact ? [...built].sort((left, right) => left.year - right.year) : built;
  }, [compact, currentDate, entries, rows]);
  const currentYear = currentDate.getFullYear();
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const chartYears: ChartYear[] = years.length === 0 ? [] : Array.from(
    { length: Math.max(years[years.length - 1].year, currentYear) - years[0].year + 1 },
    (_, index) => {
      const year = years[0].year + index;
      return {
        year,
        total: years.find((entry) => entry.year === year)?.total ?? 0,
        isCurrentYear: year === currentYear,
      };
    },
  );
  const headlineYear = chartYears.find((entry) => entry.isCurrentYear) ?? chartYears[chartYears.length - 1];
  const yearTicks = chartYears.map((entry) => entry.year);
  const chartAccessibleSummary = chartYears
    .map(({ year, total, isCurrentYear }) => `${year}${isCurrentYear ? ' year to date' : ' full year'}: ${chartPeso.format(total)}`)
    .join('; ');

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
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        data-testid="customer-yearly-sales"
        data-compact="true"
        data-year-count={years.length}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3.5 py-3 dark:border-slate-800 dark:from-slate-900 dark:to-slate-800/70">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="rounded-lg bg-blue-50 p-1.5 text-brand-blue dark:bg-blue-950/70 dark:text-blue-300"><TrendingUp className="h-4 w-4" /></span>
            <div className="min-w-0">
              <h3 id="customer-yearly-sales-heading" className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">Yearly Sales Trend</h3>
              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Posted invoice and order slip sales</p>
            </div>
          </div>
          {headlineYear ? <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{headlineYear.year}</span> : null}
        </div>

        {error ? (
          <p role="alert" className="m-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>
        ) : years.length === 0 ? (
          <p className="m-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">No posted sales found in the customer ledger.</p>
        ) : (
          <div className="px-3.5 pb-2.5 pt-3">
            <div className="mb-1 flex items-end justify-between gap-3" aria-live="polite">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{headlineYear?.isCurrentYear ? 'Year to date' : 'Latest full year'}</p>
                <p className="mt-0.5 text-lg font-bold leading-tight tabular-nums text-slate-900 dark:text-white">{chartPeso.format(headlineYear?.total ?? 0)}</p>
              </div>
              {headlineYear?.isCurrentYear ? <span className="mb-0.5 rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-brand-blue dark:bg-blue-950/70 dark:text-blue-300">YTD</span> : null}
            </div>
            {chartYears.length > 0 ? (
              <div
                className="h-40 w-full overflow-x-auto text-brand-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue dark:text-blue-400 sm:h-44"
                role="group"
                aria-label={`Annual sales trend from ${chartYears[0].year} to ${chartYears[chartYears.length - 1].year}`}
                aria-describedby={`${chartGradientId}-scroll-hint`}
                tabIndex={0}
                data-testid="customer-yearly-sales-chart"
                data-year-count={chartYears.length}
              >
                <span className="sr-only">{chartAccessibleSummary}</span>
                <div className="h-full" style={{ minWidth: `${Math.max(240, chartYears.length * 64)}px` }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart data={chartYears} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0F5298" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#0F5298" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#94a3b8" strokeDasharray="3 4" opacity={0.22} />
                    <XAxis dataKey="year" type="category" ticks={yearTicks} tick={{ fill: 'currentColor', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} tickMargin={8} />
                    <YAxis width={52} tick={{ fill: 'currentColor', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => axisPeso.format(value)} domain={[0, (dataMax: number) => Math.max(dataMax, 1)]} />
                    <Tooltip
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.year ?? ''}
                      content={(props) => <SalesTrendTooltip active={props.active} payload={props.payload} />}
                    />
                    <Area type="monotone" dataKey="total" stroke="none" fill={`url(#${chartGradientId})`} isAnimationActive={false} />
                    <Line type="monotone" dataKey="total" name="Sales" stroke="currentColor" strokeWidth={2.5} dot={{ r: 3, fill: '#ffffff', stroke: 'currentColor', strokeWidth: 2 }} activeDot={{ r: 5, fill: 'currentColor', stroke: '#ffffff', strokeWidth: 2 }} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
            <p id={`${chartGradientId}-scroll-hint`} className="sr-only">Use the horizontal scroll area to view every year.</p>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Current year is shown year to date.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="customer-yearly-sales-heading"
      className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
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
