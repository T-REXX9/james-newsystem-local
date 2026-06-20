import React from 'react';
import {
  Calendar,
  ChevronRight,
  Filter,
  Package,
  Phone,
  MessageSquare,
  Bot,
  CheckCircle2,
  Percent,
  Users,
  AlertTriangle,
  Truck,
  ShieldAlert,
  RotateCcw,
  ClipboardList,
  Bell,
  Target,
  TrendingUp,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { LineChartPro as MuiLineChartPro } from '@mui/x-charts-pro/LineChartPro';

export type CustomerCategoryId = 'priority' | 'recovery' | 'verified' | 'unverified';

export interface CustomerCategorySummary {
  id: CustomerCategoryId;
  label: string;
  customers: number;
  currentSales: number;
  averageSales: number;
  potentialSales: number;
  note: string;
  tone: 'green' | 'red' | 'blue' | 'orange';
}

export interface RevenueSeries {
  id: string;
  label: string;
  data: number[];
  color: string;
}

export interface OwnerDashboardTemplateProps {
  dateLabel: string;
  monthLabel: string;
  currentSales: number;
  monthlyTarget: number;
  remainingTarget: number;
  totalPotential: number;
  targetAchieved: number;
  pipelineVsTarget: number;
  customerCategories: CustomerCategorySummary[];
  revenueSeries: RevenueSeries[];
  revenueDays: string[];
  monthlyTargetLine: number;
  cases: Array<{ label: string; open: number; pending: number; tone: string }>;
  notifications: Array<{ label: string; count: number }>;
  actions: Array<{ label: string; count: number }>;
  attendance: { present: number; absent: number };
  agents: Array<{ name: string; calls: number; actualSales: number; target: number; achievement: number }>;
  activity: { calls: number; texts: number; aiSms: number; successfulOutcomes: number; conversionRate: number };
  search: string;
  selectedAgentId: string | null;
  agentOptions: Array<{ id: string; name: string }>;
  onSearchChange: (value: string) => void;
  onAgentChange: (id: string | null) => void;
  onResetFilters: () => void;
  onOpenCategory: (id: CustomerCategoryId) => void;
  onOpenNotifications: () => void;
  onOpenAttendance: () => void;
  onOpenActionList: () => void;
}

const toCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);

const toCompactCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);

const TONE_STYLES: Record<
  CustomerCategorySummary['tone'],
  { border: string; bg: string; text: string; dot: string; funnel: string }
> = {
  green: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    funnel: '#078b3e',
  },
  red: {
    border: 'border-rose-200',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    funnel: '#e31219',
  },
  blue: {
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-600',
    funnel: '#1262d6',
  },
  orange: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    funnel: '#f58a0a',
  },
};

const CASE_ICONS: Record<string, React.ReactNode> = {
  blue: <ClipboardList className="h-4 w-4" />,
  green: <Truck className="h-4 w-4" />,
  orange: <ShieldAlert className="h-4 w-4" />,
  violet: <AlertTriangle className="h-4 w-4" />,
  red: <RotateCcw className="h-4 w-4" />,
};

interface KpiCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  subtext: string;
  valueClass?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, iconBg, label, value, subtext, valueClass }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-start gap-2.5">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${iconBg}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] font-medium text-slate-500">{label}</p>
        <p className={`mt-0.5 text-lg font-bold leading-tight text-slate-900 ${valueClass || ''}`}>{value}</p>
        <p className="mt-0.5 text-[0.65rem] text-slate-500">{subtext}</p>
      </div>
    </div>
  </div>
);

interface FunnelSegmentProps {
  label: string;
  value: number;
  color: string;
  widthPercent: number;
  isFirst?: boolean;
  isLast?: boolean;
}

const FunnelSegment: React.FC<FunnelSegmentProps> = ({ label, value, color, widthPercent, isFirst, isLast }) => {
  const topInset = isFirst ? 0 : 8;
  const bottomInset = isLast ? 0 : 8;
  const clipPath = `polygon(${topInset}% 0%, ${100 - topInset}% 0%, ${100 - bottomInset}% 100%, ${bottomInset}% 100%)`;

  return (
    <div className="relative w-full" style={{ width: `${widthPercent}%`, marginInline: 'auto' }}>
      <div
        className="relative flex h-14 items-center justify-center"
        style={{ backgroundColor: color, clipPath }}
      >
        <span className="sr-only">
          {label}: {toCompactCurrency(value)}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <p className="text-[0.65rem] font-semibold text-white drop-shadow-sm">{label}</p>
        <p className="text-xs font-bold text-white drop-shadow-sm">{toCompactCurrency(value)}</p>
      </div>
    </div>
  );
};

const OwnerDashboardTemplate: React.FC<OwnerDashboardTemplateProps> = ({
  dateLabel,
  monthLabel,
  currentSales,
  monthlyTarget,
  remainingTarget,
  totalPotential,
  targetAchieved,
  pipelineVsTarget,
  customerCategories,
  revenueSeries,
  revenueDays,
  monthlyTargetLine,
  cases,
  notifications,
  actions,
  attendance,
  agents,
  activity,
  search,
  selectedAgentId,
  agentOptions,
  onSearchChange,
  onAgentChange,
  onResetFilters,
  onOpenCategory,
  onOpenNotifications,
  onOpenAttendance,
  onOpenActionList,
}) => {
  const attendanceTotal = attendance.present + attendance.absent;
  const leftPercent = monthlyTarget > 0 ? Number((100 - targetAchieved).toFixed(2)) : 0;

  const funnelWidths = [100, 82, 64, 46];

  const chartSeries = [
    ...revenueSeries.map((item) => ({
      ...item,
      curve: 'monotoneX' as const,
      valueFormatter: (value: number | null) => toCurrency(Number(value || 0)),
    })),
    {
      id: 'monthly-target',
      label: 'Monthly Target',
      data: revenueDays.map(() => monthlyTargetLine),
      color: '#1e293b',
      curve: 'linear' as const,
      showMark: false,
      valueFormatter: (value: number | null) => toCurrency(Number(value || 0)),
    },
  ];

  return (
    <section className="min-w-0 rounded-xl bg-[#f7f9fc] p-3 text-[#0f1f46]">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[#0f1f46]">Daily Call Monitoring — Owner Dashboard</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            {dateLabel}
          </div>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 marker:content-none hover:bg-slate-50">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search customer / area"
                className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
              <select
                value={selectedAgentId || 'all'}
                onChange={(event) => onAgentChange(event.target.value === 'all' ? null : event.target.value)}
                className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              >
                <option value="all">All agents</option>
                {agentOptions.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onResetFilters}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Reset filters
              </button>
            </div>
          </details>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={<Wallet className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-100"
          label="Current Month Sales (MTD)"
          value={toCurrency(currentSales)}
          subtext={`${targetAchieved}% of ${toCurrency(monthlyTarget)}`}
        />
        <KpiCard
          icon={<Target className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-100"
          label="Monthly Target"
          value={toCurrency(monthlyTarget)}
          subtext={monthLabel}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Remaining to Target"
          value={toCurrency(remainingTarget)}
          subtext={`${leftPercent}% Left`}
        />
        <KpiCard
          icon={<BarChart3 className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-100"
          label="Total Potential Sales"
          value={toCurrency(totalPotential)}
          subtext="Pipeline Potential"
        />
        <KpiCard
          icon={<Percent className="h-4 w-4 text-teal-600" />}
          iconBg="bg-teal-100"
          label="Pipeline vs Target"
          value={`${pipelineVsTarget}%`}
          subtext="of Monthly Target"
          valueClass="text-teal-600"
        />
      </div>

      <div className="mt-3 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,20rem)] 2xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)_minmax(0,20rem)]">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer Lists</p>
          <div data-testid="customer-category-grid" className="grid gap-2 2xl:grid-cols-2">
          {customerCategories.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
              No customer data available
            </div>
          ) : (
            customerCategories.map((category) => {
              const tone = TONE_STYLES[category.tone];
              const isProspect = category.id === 'verified' || category.id === 'unverified';
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onOpenCategory(category.id)}
                  className={`w-full rounded-xl border ${tone.border} ${tone.bg} p-2.5 text-left transition hover:shadow-sm`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                    <p className={`text-xs font-bold ${tone.text}`}>{category.label}</p>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-800">{category.customers} Customers</p>
                  {isProspect ? (
                    <div className="mt-1.5 space-y-0.5 text-[0.65rem] text-slate-600">
                      <p>Average Monthly Purchase: {toCurrency(category.averageSales)}</p>
                      <p>Potential Sales: {toCurrency(category.potentialSales)}</p>
                      <p className="text-slate-400">{category.note}</p>
                    </div>
                  ) : (
                    <div className="mt-1.5 space-y-0.5 text-[0.65rem] text-slate-600">
                      <p>Current Month Sales: {toCompactCurrency(category.currentSales)}</p>
                      <p>Avg Monthly Sales: {toCompactCurrency(category.averageSales)}</p>
                      <p>Potential Sales: {toCompactCurrency(category.potentialSales)}</p>
                    </div>
                  )}
                </button>
              );
            })
          )}
          </div>
          <button
            type="button"
            onClick={() => onOpenCategory('priority')}
            className="flex w-full items-center justify-center gap-1 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            View All Customers
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold text-slate-700">Revenue Trend (Last 30 Days)</h3>
          <div className="relative min-h-[18rem]">
            <div className="h-[18rem] w-full">
              <MuiLineChartPro
                height={288}
                xAxis={[
                  {
                    scaleType: 'point',
                    data: revenueDays.map((_, index) => index),
                    tickLabelStyle: { fontSize: 10 },
                    valueFormatter: (value) => revenueDays[Number(value)] || '',
                  },
                ]}
                yAxis={[
                  {
                    valueFormatter: (value) => {
                      const num = Number(value);
                      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
                      if (num >= 1_000) return `${Math.round(num / 1_000)}k`;
                      return String(num);
                    },
                    tickLabelStyle: { fontSize: 10 },
                  },
                ]}
                series={chartSeries}
                grid={{ horizontal: true }}
              />
            </div>
            <div className="absolute right-2 top-2 w-[9rem] rounded-lg border border-slate-200 bg-white/95 p-2 text-[0.6rem] shadow-sm backdrop-blur-sm">
              <p className="mb-1 font-semibold text-slate-700">MTD Summary</p>
              <div className="space-y-0.5 text-slate-600">
                <p>Actual: {toCompactCurrency(currentSales)}</p>
                <p>Target: {toCompactCurrency(monthlyTarget)}</p>
                <p>Remaining: {toCompactCurrency(remainingTarget)}</p>
                <p>Pipeline: {toCompactCurrency(totalPotential)}</p>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.6rem] text-slate-600">
            {revenueSeries.map((item) => (
              <span key={item.id} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-3 border-t-2 border-dashed border-slate-800" />
              Monthly Target
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold text-slate-700">Sales Funnel (Potential)</h3>
          <div className="flex flex-col items-center gap-0.5 py-2">
            {customerCategories.length === 0 ? (
              <p className="text-xs text-slate-500">No pipeline data available</p>
            ) : (
              customerCategories.map((category, index) => (
                <FunnelSegment
                  key={category.id}
                  label={category.label}
                  value={category.potentialSales}
                  color={TONE_STYLES[category.tone].funnel}
                  widthPercent={funnelWidths[index] || 50}
                  isFirst={index === 0}
                  isLast={index === customerCategories.length - 1}
                />
              ))
            )}
          </div>
          <div className="mt-4 text-center">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Total Pipeline Potential
            </p>
            <p className="text-xl font-bold text-blue-700">{toCurrency(totalPotential)}</p>
          </div>
        </div>
      </div>

      <div data-testid="dashboard-detail-grid" className="mt-3 grid break-words gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7 [&>*]:min-w-0">
        <button
          type="button"
          onClick={onOpenAttendance}
          className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300"
        >
          <h3 className="mb-2 text-xs font-semibold text-slate-700">Attendance (Today)</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-center">
              <p className="text-[0.65rem] font-semibold text-emerald-700">Present</p>
              <p className="text-lg font-bold text-emerald-700">{attendance.present}</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-center">
              <p className="text-[0.65rem] font-semibold text-rose-700">Absent</p>
              <p className="text-lg font-bold text-rose-700">{attendance.absent}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-center">
              <p className="text-[0.65rem] font-semibold text-blue-700">Total</p>
              <p className="text-lg font-bold text-blue-700">{attendanceTotal}</p>
            </div>
          </div>
          <p className="mt-2 text-[0.65rem] font-medium text-blue-600">View full attendance details</p>
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold text-slate-700">Customer Case Overview (This Month)</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cases.map((caseItem) => (
              <div key={caseItem.label} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                <div className="flex items-center gap-1.5 text-slate-600">
                  {CASE_ICONS[caseItem.tone] || <Package className="h-4 w-4" />}
                  <p className="text-[0.65rem] font-semibold leading-tight">{caseItem.label}</p>
                </div>
                <p className="mt-1 text-[0.6rem] text-slate-500">
                  Open: <span className="font-bold text-slate-800">{caseItem.open}</span>
                </p>
                <p className="text-[0.6rem] text-slate-500">
                  Pending: <span className="font-bold text-slate-800">{caseItem.pending}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold text-slate-700">Top Agent Performance (MTD)</h3>
          {agents.length === 0 ? (
            <p className="text-xs text-slate-500">No agent performance available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[0.65rem]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="pb-1.5 pr-2 font-semibold">Agent</th>
                    <th className="pb-1.5 pr-2 font-semibold">Calls</th>
                    <th className="pb-1.5 pr-2 font-semibold">Actual Sales</th>
                    <th className="pb-1.5 pr-2 font-semibold">Target</th>
                    <th className="pb-1.5 font-semibold">Achievement</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.name} className="border-b border-slate-50">
                      <td className="py-1.5 pr-2 font-medium text-slate-800">{agent.name}</td>
                      <td className="py-1.5 pr-2 text-slate-600">{agent.calls}</td>
                      <td className="py-1.5 pr-2 text-slate-600">{toCompactCurrency(agent.actualSales)}</td>
                      <td className="py-1.5 pr-2 text-slate-600">{toCompactCurrency(agent.target)}</td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{ width: `${Math.min(100, agent.achievement)}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-700">{agent.achievement}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700">Notifications & Approvals</h3>
            <button
              type="button"
              onClick={onOpenNotifications}
              className="text-[0.65rem] font-semibold text-blue-600 hover:text-blue-700"
            >
              View all notifications
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500">No pending items</p>
          ) : (
            <ul className="space-y-1.5">
              {notifications.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-2 text-[0.7rem]">
                  <span className="text-slate-700">{item.label}</span>
                  {item.count > 0 && (
                    <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                      {item.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700">Owner Daily Action List</h3>
            <button
              type="button"
              onClick={onOpenActionList}
              className="text-[0.65rem] font-semibold text-blue-600 hover:text-blue-700"
            >
              View details
            </button>
          </div>
          {actions.length === 0 ? (
            <p className="text-xs text-slate-500">No pending items</p>
          ) : (
            <ol className="space-y-1.5">
              {actions.map((item, index) => (
                <li key={item.label} className="flex items-center justify-between gap-2 text-[0.7rem]">
                  <span className="text-slate-700">
                    {index + 1}. {item.label}
                  </span>
                  {item.count > 0 && (
                    <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                      {item.count}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div data-testid="sales-activity-panel" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm 2xl:col-span-2">
          <h3 className="mb-2 text-xs font-semibold text-slate-700">Sales Activity Summary (MTD)</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <Phone className="mx-auto h-4 w-4 text-blue-600" />
              <p className="mt-1 text-[0.6rem] text-slate-500">Calls Made</p>
              <p className="text-sm font-bold text-slate-800">{activity.calls}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <MessageSquare className="mx-auto h-4 w-4 text-emerald-600" />
              <p className="mt-1 text-[0.6rem] text-slate-500">SMS Sent</p>
              <p className="text-sm font-bold text-slate-800">{activity.texts}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <Bot className="mx-auto h-4 w-4 text-violet-600" />
              <p className="mt-1 text-[0.6rem] text-slate-500">AI SMS Sent</p>
              <p className="text-sm font-bold text-slate-800">{activity.aiSms}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <CheckCircle2 className="mx-auto h-4 w-4 text-teal-600" />
              <p className="mt-1 text-[0.6rem] text-slate-500">Successful Outcomes</p>
              <p className="text-sm font-bold text-slate-800">{activity.successfulOutcomes}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <Percent className="mx-auto h-4 w-4 text-amber-600" />
              <p className="mt-1 text-[0.6rem] text-slate-500">Conversion Rate</p>
              <p className="text-sm font-bold text-slate-800">{activity.conversionRate}%</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OwnerDashboardTemplate;
