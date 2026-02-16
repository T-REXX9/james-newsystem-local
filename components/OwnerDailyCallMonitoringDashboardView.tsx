import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  ClipboardList,
  FileText,
  Home,
  LayoutGrid,
  Settings,
  TrendingUp,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { UserProfile } from '../types';

interface OwnerDailyCallMonitoringDashboardViewProps {
  currentUser: UserProfile | null;
}

type TrendMode = 'monthly' | 'weekly';
type CrmTab = 'active' | 'pending' | 'archive';

interface AgentContributionDetail {
  id: string;
  name: string;
  revenueLabel: string;
  callsToday: number;
  deals: number;
  percent: number;
}

interface CommissionItem {
  name: string;
  role: string;
  amountLabel: string;
  accent: 'emerald' | 'blue' | 'slate';
}

interface CrmRow {
  clientName: string;
  region: string;
  statusLabel: string;
  statusTone: 'active' | 'new' | 'followup';
  agent: string;
  rtoScore: number;
}

const numberBadgeTone: Record<CrmRow['statusTone'], string> = {
  active: 'bg-emerald-50 text-emerald-700',
  new: 'bg-blue-50 text-blue-700',
  followup: 'bg-slate-100 text-slate-600',
};

const dispatchNavigate = (tab: string) => {
  window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab } }));
};

const OwnerDailyCallMonitoringDashboardView: React.FC<OwnerDailyCallMonitoringDashboardViewProps> = ({ currentUser }) => {
  const [trendMode, setTrendMode] = useState<TrendMode>('monthly');
  const [crmTab, setCrmTab] = useState<CrmTab>('active');
  const [search, setSearch] = useState('');
  const [showAgentContributionModal, setShowAgentContributionModal] = useState(false);
  const [selectedAgentContributionId, setSelectedAgentContributionId] = useState<string | null>(null);

  const sidebarItems = useMemo(
    () =>
      [
        { tab: 'dashboard', label: 'Dashboard', icon: Home },
        { tab: 'pipelines', label: 'Pipelines', icon: TrendingUp },
        { tab: 'customers', label: 'Customers', icon: Users },
        { tab: 'tasks', label: 'Tasks', icon: ClipboardList },
        { tab: 'settings', label: 'Settings', icon: Settings },
      ] as const,
    []
  );

  const kpis = useMemo(
    () => ({
      quotaPercent: 92,
      quotaDelta: 4.5,
      revenueLabel: '₱124.5k',
      revenueGoalLabel: 'Goal: ₱150k',
      successRate: 68.4,
      performance: 555,
      activeDeals: 48,
      dealsNote: '12 closing soon',
      dailyCalls: 142,
      callsStatus: 'On Track',
    }),
    []
  );

  const trendData = useMemo(() => {
    if (trendMode === 'weekly') {
      return [
        { label: 'Mon', value: 25 },
        { label: 'Tue', value: 40 },
        { label: 'Wed', value: 52 },
        { label: 'Thu', value: 45 },
        { label: 'Fri', value: 60 },
        { label: 'Sat', value: 74 },
        { label: 'Sun', value: 95 },
      ];
    }

    return [
      { label: 'Jan', value: 20 },
      { label: 'Feb', value: 38 },
      { label: 'Mar', value: 55 },
      { label: 'Apr', value: 62 },
      { label: 'May', value: 48 },
      { label: 'Jun', value: 44 },
      { label: 'Jul', value: 52 },
      { label: 'Aug', value: 79 },
    ];
  }, [trendMode]);

  const agentContribution = useMemo(() => {
    return [
      { id: 'SC', height: 100 },
      { id: 'JB', height: 55 },
      { id: 'JW', height: 88 },
      { id: 'OTH', height: 35 },
    ];
  }, []);

  const agentContributionDetails = useMemo<AgentContributionDetail[]>(
    () => [
      { id: 'SC', name: 'Sarah Connor', revenueLabel: '₱52,400', callsToday: 38, deals: 12, percent: 34 },
      { id: 'JB', name: 'James Bond', revenueLabel: '₱31,800', callsToday: 29, deals: 9, percent: 21 },
      { id: 'JW', name: 'John Wick', revenueLabel: '₱41,100', callsToday: 33, deals: 11, percent: 27 },
      { id: 'OTH', name: 'Other Agents', revenueLabel: '₱27,900', callsToday: 42, deals: 16, percent: 18 },
    ],
    []
  );

  const totalAgentContribution = useMemo(() => {
    const totalCalls = agentContributionDetails.reduce((sum, row) => sum + row.callsToday, 0);
    const totalDeals = agentContributionDetails.reduce((sum, row) => sum + row.deals, 0);
    return { totalCalls, totalDeals };
  }, [agentContributionDetails]);

  const goalProgress = useMemo(() => {
    const percent = 54;
    return {
      percent,
      chart: [
        { name: 'progress', value: percent, color: '#2563eb' },
        { name: 'rest', value: 100 - percent, color: '#e2e8f0' },
      ],
      actual: '₱124,500',
      target: '₱230,000',
    };
  }, []);

  const commissions = useMemo<CommissionItem[]>(
    () => [
      { name: 'Sarah Connor', role: 'Team Leader', amountLabel: '+₱2,202', accent: 'emerald' },
      { name: 'James Bond', role: 'Senior Agent', amountLabel: '+₱1,540', accent: 'blue' },
      { name: 'John Wick', role: 'Agent', amountLabel: '+₱880', accent: 'slate' },
    ],
    []
  );

  const crmRows = useMemo<CrmRow[]>(() => {
    const base: CrmRow[] = [
      { clientName: 'John Doe Enterprises', region: 'North America', statusLabel: 'Active', statusTone: 'active', agent: 'Sarah C.', rtoScore: 98 },
      { clientName: 'SkyNet Systems', region: 'Global HQ', statusLabel: 'New Lead', statusTone: 'new', agent: 'Kyle R.', rtoScore: 74 },
      { clientName: 'Cyberdyne Inc.', region: 'West Coast', statusLabel: 'Follow-up', statusTone: 'followup', agent: 'Miles D.', rtoScore: 42 },
    ];

    if (crmTab === 'active') return base;
    if (crmTab === 'pending') return base.map((row) => ({ ...row, statusLabel: 'Pending', statusTone: 'new' }));
    return base.map((row) => ({ ...row, statusLabel: 'Archived', statusTone: 'followup' }));
  }, [crmTab]);

  const filteredCrmRows = useMemo(() => {
    if (!search.trim()) return crmRows;
    const q = search.trim().toLowerCase();
    return crmRows.filter((row) => `${row.clientName} ${row.region} ${row.agent}`.toLowerCase().includes(q));
  }, [crmRows, search]);

  useEffect(() => {
    if (!showAgentContributionModal) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowAgentContributionModal(false);
      setSelectedAgentContributionId(null);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showAgentContributionModal]);

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="mx-auto flex max-w-[1700px] gap-6 p-4 lg:p-6">
        <nav className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[74px] flex-col items-center rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 lg:flex">
          <button
            type="button"
            onClick={() => dispatchNavigate('dashboard')}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-sm"
            aria-label="Owner Dashboard"
            title="Owner Dashboard"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>

          <div className="my-2 h-px w-full bg-slate-100" />

          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.tab === 'dashboard';
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => dispatchNavigate(item.tab)}
                className={`grid h-11 w-11 place-items-center rounded-2xl transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}

          <div className="mt-auto w-full space-y-3">
            <button
              type="button"
              className="relative grid h-11 w-11 place-items-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-blue-600" />
            </button>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-xs font-bold text-slate-600">
              {(currentUser?.full_name || currentUser?.email || 'O').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </nav>

        <main className="min-w-0 flex-1 space-y-[1.43rem]">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold text-slate-900">Owner Dashboard</h1>
              <span className="text-sm font-semibold text-slate-300">|</span>
              <span className="text-sm font-medium text-slate-400">Overview</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search analytics..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <UserPlus className="h-4 w-4" />
                Invite Reports
              </button>

              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Open notifications"
                title="Open notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </header>

          <section className="grid gap-[0.95rem] md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-[0.95rem] shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-slate-400">QUOTA VS ACTUAL</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{kpis.quotaPercent}%</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">+{kpis.quotaDelta}%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${kpis.quotaPercent}%` }} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-[0.95rem] shadow-sm">
              <p className="text-[11px] font-semibold tracking-wide text-slate-400">REVENUE</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{kpis.revenueLabel}</p>
              <p className="mt-2 text-xs text-slate-400">{kpis.revenueGoalLabel}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-[0.95rem] shadow-sm">
              <p className="text-[11px] font-semibold tracking-wide text-slate-400">SUCCESS RATE</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{kpis.successRate}%</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${kpis.successRate}%` }} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-[0.95rem] shadow-sm">
              <p className="text-[11px] font-semibold tracking-wide text-slate-400">PERFORMANCE</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{kpis.performance}%</p>
              <div className="mt-3 flex items-end gap-1.5">
                {[22, 44, 28, 52, 36].map((v, idx) => (
                  <div key={idx} className="w-2 rounded-md bg-blue-500/30" style={{ height: `${12 + v / 2}px` }} />
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-[0.95rem] shadow-sm">
              <p className="text-[11px] font-semibold tracking-wide text-slate-400">ACTIVE DEALS</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{kpis.activeDeals}</p>
              <p className="mt-2 text-xs text-slate-400">{kpis.dealsNote}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-[0.95rem] shadow-sm">
              <p className="text-[11px] font-semibold tracking-wide text-slate-400">DAILY CALLS</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{kpis.dailyCalls}</p>
              <p className="mt-2 text-xs font-semibold text-emerald-600">{kpis.callsStatus}</p>
            </div>
          </section>

          <section className="grid gap-[1.43rem] xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-[1.19rem] shadow-sm xl:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Sales Chart</h2>
                  <p className="mt-1 text-sm text-slate-400">Monthly revenue projection</p>
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-1 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setTrendMode('monthly')}
                    className={`rounded-xl px-3 py-1.5 ${trendMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMode('weekly')}
                    className={`rounded-xl px-3 py-1.5 ${trendMode === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Weekly
                  </button>
                </div>
              </div>

              <div className="mt-4 h-[320px] overflow-hidden rounded-3xl bg-gradient-to-b from-blue-50/70 to-white">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 30, right: 20, left: 0, bottom: 10 }}>
                    <defs>
                      <linearGradient id="ownerTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#2563eb"
                      strokeWidth={5}
                      fill="url(#ownerTrendFill)"
                      dot={{ r: 5, strokeWidth: 3, stroke: '#2563eb', fill: '#fff' }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-[1.43rem]">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowAgentContributionModal(true)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  setShowAgentContributionModal(true);
                }}
                className="rounded-3xl border border-slate-200 bg-white p-[1.19rem] shadow-sm transition hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                aria-label="Open agent contribution details"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-base font-semibold text-slate-900">Agent Contribution</h2>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedAgentContributionId(null);
                      setShowAgentContributionModal(true);
                    }}
                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    aria-label="Open agent contribution details"
                    title="Open details"
                  >
                    <span className="text-xl leading-none">…</span>
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-4 gap-4">
                  {agentContribution.map((bar) => (
                    <button
                      key={bar.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedAgentContributionId(bar.id);
                        setShowAgentContributionModal(true);
                      }}
                      className="flex flex-col items-center gap-2 rounded-2xl p-1 transition hover:bg-slate-50"
                      aria-label={`Open ${bar.id} contribution details`}
                      title={`Open ${bar.id} details`}
                    >
                      <div className="flex h-[160px] w-full items-end justify-center">
                        <div className="w-full max-w-[70px] rounded-[28px] bg-slate-50 p-2">
                          <div
                            className="w-full rounded-[22px] bg-gradient-to-b from-blue-400 to-blue-700"
                            style={{ height: `${bar.height}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{bar.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-[1.19rem] shadow-sm">
                <div className="flex items-start justify-between">
                  <h2 className="text-base font-semibold text-slate-900">Goal Progress</h2>
                  <button type="button" className="rounded-xl p-2 text-blue-600 hover:bg-blue-50" aria-label="Add">
                    <span className="text-xl leading-none">+</span>
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-center">
                  <div className="relative h-[180px] w-[180px]">
                    <PieChart width={180} height={180}>
                      <Pie
                        data={goalProgress.chart}
                        dataKey="value"
                        innerRadius={60}
                        outerRadius={78}
                        startAngle={90}
                        endAngle={-270}
                        cornerRadius={12}
                        paddingAngle={0}
                      >
                        {goalProgress.chart.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <span className="text-xl font-semibold text-slate-900">{goalProgress.percent}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wide">Actual Revenue</span>
                    <span className="font-semibold text-slate-900">{goalProgress.actual}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wide">Target</span>
                    <span className="font-semibold text-slate-900">{goalProgress.target}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-[1.43rem] xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-[1.19rem] shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wide text-slate-900">COMMISSIONS EARNED</h2>
                <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  View All
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {commissions.map((leader) => (
                  <div key={leader.name} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200/70">
                        {leader.name
                          .split(' ')
                          .slice(0, 2)
                          .map((p) => p.slice(0, 1))
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{leader.name}</p>
                        <p className="text-xs text-slate-400">{leader.role}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{leader.amountLabel}</p>
                      <div
                        className={`mt-1 h-1.5 w-16 overflow-hidden rounded-full ${
                          leader.accent === 'emerald' ? 'bg-emerald-200' : leader.accent === 'blue' ? 'bg-blue-200' : 'bg-slate-200'
                        }`}
                      >
                        <div
                          className={`h-full w-full rounded-full ${
                            leader.accent === 'emerald' ? 'bg-emerald-600' : leader.accent === 'blue' ? 'bg-blue-600' : 'bg-slate-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-[1.19rem] shadow-sm xl:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-slate-900">CRM DATABASE OVERVIEW</h2>
                </div>

                <div className="flex items-center gap-6 text-xs font-semibold">
                  {(['active', 'pending', 'archive'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCrmTab(tab)}
                      className={`pb-2 transition ${
                        crmTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {tab[0].toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-3xl border border-slate-100">
                <div className="grid grid-cols-[2fr_1.2fr_1fr_1.2fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Client Name</span>
                  <span>Region</span>
                  <span>Status</span>
                  <span>Assigned Agent</span>
                  <span className="text-right">RTO Score</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredCrmRows.map((row) => (
                    <div
                      key={row.clientName}
                      className="grid grid-cols-[2fr_1.2fr_1fr_1.2fr_0.8fr] items-center gap-3 px-4 py-3 text-sm"
                    >
                      <span className="font-semibold text-slate-900">{row.clientName}</span>
                      <span className="text-slate-500">{row.region}</span>
                      <span className="text-slate-500">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${numberBadgeTone[row.statusTone]}`}>
                          {row.statusLabel}
                        </span>
                      </span>
                      <span className="text-slate-500">{row.agent}</span>
                      <span className="text-right font-semibold text-slate-900">{row.rtoScore}</span>
                    </div>
                  ))}
                  {filteredCrmRows.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">No customers in this view.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {showAgentContributionModal && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => {
              setShowAgentContributionModal(false);
              setSelectedAgentContributionId(null);
            }}
            aria-label="Close agent contribution details"
          />

          <div className="absolute left-1/2 top-1/2 w-[min(980px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Agent Contribution</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Full distribution breakdown for today. Totals: {totalAgentContribution.totalCalls} calls · {totalAgentContribution.totalDeals} deals
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAgentContributionModal(false);
                    setSelectedAgentContributionId(null);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Distribution</p>
                  <div className="mt-3 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agentContributionDetails} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="id" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="percent" radius={[12, 12, 12, 12]} fill="#2563eb" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">Tap an agent row for details and quick context.</p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white">
                  <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.7fr] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <span>Agent</span>
                    <span className="text-right">% Share</span>
                    <span className="text-right">Calls</span>
                    <span className="text-right">Deals</span>
                  </div>
                  <div className="max-h-[320px] divide-y divide-slate-100 overflow-auto">
                    {agentContributionDetails.map((row) => {
                      const isSelected = selectedAgentContributionId === row.id;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => setSelectedAgentContributionId((prev) => (prev === row.id ? null : row.id))}
                          className={`grid w-full grid-cols-[1.4fr_0.6fr_0.6fr_0.7fr] items-center gap-2 px-4 py-3 text-left transition ${
                            isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200/70">
                              {row.id}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                              <p className="text-xs text-slate-400">{row.revenueLabel} revenue</p>
                            </div>
                          </div>
                          <span className="text-right text-sm font-semibold text-slate-900">{row.percent}%</span>
                          <span className="text-right text-sm font-semibold text-slate-900">{row.callsToday}</span>
                          <span className="text-right text-sm font-semibold text-slate-900">{row.deals}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {selectedAgentContributionId && (
                <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{selectedAgentContributionId}</span> selected — use this space later for the full drill-down (calls, texts, outcomes, revenue, and customer list).
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerDailyCallMonitoringDashboardView;
