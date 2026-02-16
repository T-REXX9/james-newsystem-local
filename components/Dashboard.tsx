
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragEndEvent, DragMoveEvent, DragStartEvent, PointerSensor, useDraggable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, Briefcase, Trophy, Activity, Filter, CheckCircle, XCircle, BarChart2, ArrowUpRight, ArrowDownRight, ClipboardList, Clock, GripVertical, LayoutTemplate } from 'lucide-react';
import { REPORT_PIE_DATA, TOP_PRODUCTS_DATA } from '../constants';
import { UserProfile, Task } from '../types';
import { fetchTasks } from '../services/supabaseService';

const data = [
  { name: 'Jan', revenue: 640258.00, revenueLastYear: 580000.00 },
  { name: 'Feb', revenue: 899332.20, revenueLastYear: 720000.00 },
  { name: 'Mar', revenue: 1223654.00, revenueLastYear: 950000.00 },
  { name: 'Apr', revenue: 1194761.80, revenueLastYear: 1050000.00 },
  { name: 'May', revenue: 1051973.20, revenueLastYear: 980000.00 },
  { name: 'Jun', revenue: 2361373.60, revenueLastYear: 1800000.00 },
  { name: 'Jul', revenue: 2140157.00, revenueLastYear: 1650000.00 },
  { name: 'Aug', revenue: 1676042.40, revenueLastYear: 1400000.00 },
  { name: 'Sep', revenue: 1968572.60, revenueLastYear: 1550000.00 },
  { name: 'Oct', revenue: 2265326.60, revenueLastYear: 1900000.00 },
  { name: 'Nov', revenue: 1622740.00, revenueLastYear: 1450000.00 },
  { name: 'Dec', revenue: 0.00, revenueLastYear: 1600000.00 },
];

const topCustomersData = [
  { name: 'JRLT CALIB.', value: 100445.00 },
  { name: 'R AND M', value: 89510.00 },
  { name: 'VENDIESEL', value: 52350.00 },
  { name: 'CORPUZ ENG.', value: 38810.00 },
  { name: 'SULTAN KUD.', value: 38000.00 },
  { name: 'ESTANCIA', value: 33120.00 },
  { name: 'CUIZON', value: 31620.00 },
  { name: 'JRM DIESEL', value: 29320.00 },
  { name: 'CM CALIB.', value: 26100.00 },
  { name: 'RENA DIESEL', value: 25440.00 },
];

const CompactMetricCard = ({ title, value, trend, icon: Icon, colorClass, bgClass, subtext }: any) => (
  <div className={`relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm flex flex-col justify-between h-full`}>
    <div className="flex justify-between items-start mb-1">
      <div className={`p-1.5 rounded-lg ${bgClass} ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      {trend && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${trend > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30'}`}>
          {trend > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div>
      <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate">{title}</h3>
      <div className="flex items-baseline gap-1">
        <p className="text-lg font-bold text-slate-800 dark:text-white truncate">{value}</p>
        {subtext && <span className="text-[10px] text-slate-400 font-medium">{subtext}</span>}
      </div>
    </div>
  </div>
);

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

interface DashboardProps {
  user?: UserProfile | null;
}

type WidgetId = 'revenue' | 'dealDistribution' | 'topProducts' | 'tasks' | 'topCustomers';

interface WidgetDefinition {
  id: WidgetId;
  title: string;
  description: string;
  defaultSpan: number;
  render: () => React.ReactNode;
}

type WidgetLayout = Record<WidgetId, { row: number; col: number; width: number }>;

const GRID_COLUMNS = 12;
const GRID_ROW_HEIGHT = 260;

const allWidgetIds: WidgetId[] = ['revenue', 'dealDistribution', 'topProducts', 'tasks', 'topCustomers'];
const defaultWidgetOrder: WidgetId[] = ['revenue', 'dealDistribution', 'topProducts', 'tasks'];

const defaultWidgetSpans: Record<WidgetId, number> = {
  revenue: 8,
  dealDistribution: 4,
  topProducts: 6,
  tasks: 6,
  topCustomers: 4,
};

const defaultWidgetLayout: WidgetLayout = {
  revenue: { row: 1, col: 1, width: defaultWidgetSpans.revenue },
  dealDistribution: { row: 1, col: 9, width: defaultWidgetSpans.dealDistribution },
  topProducts: { row: 2, col: 1, width: defaultWidgetSpans.topProducts },
  tasks: { row: 2, col: 7, width: defaultWidgetSpans.tasks },
  topCustomers: { row: 3, col: 1, width: defaultWidgetSpans.topCustomers },
};

const WIDGET_ORDER_STORAGE_KEY = 'dashboard.widgets.v1';
const WIDGET_LAYOUT_STORAGE_KEY = 'dashboard.layout.v1';
const WIDGET_SPAN_STORAGE_KEY = 'dashboard.spans.v1';

const clampColumn = (col: number, width: number) => Math.max(1, Math.min(col, GRID_COLUMNS - width + 1));
const parsePx = (value: string) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

interface WidgetCardProps {
  widget: WidgetDefinition;
  layout: { row: number; col: number };
  span: number;
  isArranging: boolean;
  isActiveDrag: boolean;
}

const WidgetCard: React.FC<WidgetCardProps> = ({ widget, layout, span, isArranging, isActiveDrag }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: widget.id,
    disabled: !isArranging,
  });

  const transformStyle = transform ? CSS.Translate.toString(transform) : undefined;

  const style = {
    gridColumn: `${layout.col} / span ${span}`,
    gridRow: `${layout.row} / span 1`,
    transform: transformStyle,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col ${isActiveDrag && isArranging ? 'opacity-70' : ''
        }`}
    >
      <div className="flex items-center justify-between mb-2 text-[11px] text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-2">
          <GripVertical className={`w-3 h-3 ${isArranging ? 'text-brand-blue' : ''}`} />
          <span className="font-bold text-slate-600 dark:text-slate-200">{widget.title}</span>
        </div>
        <span>{widget.description}</span>
      </div>
      <div className="flex-1 min-h-0 w-full relative">
        {widget.render()}
      </div>
    </div>
  );
};

const packWidgets = (
  activeIds: WidgetId[],
  spans: Record<WidgetId, number>,
  currentLayout: WidgetLayout,
  forced?: { id: WidgetId; row: number; col: number },
) => {
  const layout: WidgetLayout = {} as WidgetLayout;
  const occupied = new Set<string>();
  const placed = new Set<WidgetId>();

  const fits = (row: number, col: number, width: number) => {
    for (let c = col; c < col + width; c += 1) {
      if (occupied.has(`${row}-${c}`)) return false;
    }
    return true;
  };

  const place = (id: WidgetId, row: number, col: number, width: number) => {
    layout[id] = { row, col, width };
    placed.add(id);
    for (let c = col; c < col + width; c += 1) {
      occupied.add(`${row}-${c}`);
    }
  };

  const findBestFit = (id: WidgetId, preferredRow: number, preferredCol: number, width: number) => {
    const clampedCol = clampColumn(preferredCol, width);

    // Try exact position first
    if (fits(preferredRow, clampedCol, width)) {
      place(id, preferredRow, clampedCol, width);
      return true;
    }

    // Search in expanding spiral from preferred position
    const maxRadius = 10;
    for (let radius = 1; radius <= maxRadius; radius++) {
      // Check same row, nearby columns
      for (let colOffset = -radius; colOffset <= radius; colOffset++) {
        const testCol = clampColumn(clampedCol + colOffset, width);
        if (fits(preferredRow, testCol, width)) {
          place(id, preferredRow, testCol, width);
          return true;
        }
      }

      // Check nearby rows
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
        const testRow = Math.max(1, preferredRow + rowOffset);
        if (testRow === preferredRow) continue; // Already checked this row

        for (let colOffset = -radius; colOffset <= radius; colOffset++) {
          const testCol = clampColumn(clampedCol + colOffset, width);
          if (fits(testRow, testCol, width)) {
            place(id, testRow, testCol, width);
            return true;
          }
        }
      }
    }

    // Fallback: scan from top-left
    for (let row = 1; row < 50; row++) {
      for (let col = 1; col <= GRID_COLUMNS - width + 1; col++) {
        if (fits(row, col, width)) {
          place(id, row, col, width);
          return true;
        }
      }
    }
    return false;
  };

  const tryPlaceAtOrBelow = (id: WidgetId, desiredRow: number, desiredCol: number, width: number) => {
    const clampedCol = clampColumn(desiredCol, width);
    let row = Math.max(1, desiredRow);
    while (row < desiredRow + 50) {
      if (fits(row, clampedCol, width)) {
        place(id, row, clampedCol, width);
        return true;
      }
      row += 1;
    }
    return false;
  };

  // Handle forced placement (dragged widget)
  if (forced && activeIds.includes(forced.id)) {
    const forcedWidth = spans[forced.id] ?? defaultWidgetSpans[forced.id] ?? 4;
    findBestFit(forced.id, forced.row, forced.col, forcedWidth);
  }

  // Place other widgets, prioritizing their previous positions
  const sortedIds = activeIds
    .filter(id => !placed.has(id))
    .sort((a, b) => {
      const layoutA = currentLayout[a] ?? defaultWidgetLayout[a];
      const layoutB = currentLayout[b] ?? defaultWidgetLayout[b];
      if (!layoutA) return 1;
      if (!layoutB) return -1;
      return (layoutA.row * GRID_COLUMNS + layoutA.col) - (layoutB.row * GRID_COLUMNS + layoutB.col);
    });

  sortedIds.forEach((id) => {
    if (placed.has(id)) return;
    const width = spans[id] ?? defaultWidgetSpans[id] ?? 4;
    const previous = currentLayout[id] ?? defaultWidgetLayout[id];

    if (previous) {
      const placedExisting = findBestFit(id, previous.row, previous.col, width);
      if (placedExisting) return;
    }

    // Find any available spot
    findBestFit(id, 1, 1, width);
  });

  return layout;
};

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [widgetSpans, setWidgetSpans] = useState<Record<WidgetId, number>>(defaultWidgetSpans);
  const [widgetLayout, setWidgetLayout] = useState<WidgetLayout>(() => packWidgets(defaultWidgetOrder, defaultWidgetSpans, defaultWidgetLayout));
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(defaultWidgetOrder);
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [isArranging, setIsArranging] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    const loadTasks = async () => {
      const allTasks = await fetchTasks();
      // Filter for tasks assigned to current user and NOT done
      if (user) {
        setMyTasks(allTasks.filter(t => t.assignedTo === user.full_name && t.status !== 'Done'));
      }
    };
    loadTasks();
  }, [user]);

  useEffect(() => {
    const storedOrder = localStorage.getItem(WIDGET_ORDER_STORAGE_KEY);
    const storedLayout = localStorage.getItem(WIDGET_LAYOUT_STORAGE_KEY);
    const storedSpans = localStorage.getItem(WIDGET_SPAN_STORAGE_KEY);

    let nextOrder = defaultWidgetOrder;
    let nextSpans = { ...defaultWidgetSpans };
    let nextLayout = defaultWidgetLayout;

    if (storedOrder) {
      try {
        nextOrder = (JSON.parse(storedOrder) as WidgetId[]).filter((id) => allWidgetIds.includes(id));
      } catch (error) {
        console.error('Failed to parse widget order', error);
      }
    }

    if (storedSpans) {
      try {
        const parsed = JSON.parse(storedSpans) as Record<WidgetId, number>;
        nextSpans = { ...nextSpans, ...parsed };
      } catch (error) {
        console.error('Failed to parse widget sizing', error);
      }
    }

    if (storedLayout) {
      try {
        nextLayout = JSON.parse(storedLayout) as WidgetLayout;
      } catch (error) {
        console.error('Failed to parse widget layout', error);
      }
    }

    setWidgetOrder(nextOrder);
    setWidgetSpans(nextSpans);
    setWidgetLayout(packWidgets(nextOrder, nextSpans, nextLayout));
  }, []);

  useEffect(() => {
    localStorage.setItem(WIDGET_ORDER_STORAGE_KEY, JSON.stringify(widgetOrder));
  }, [widgetOrder]);

  useEffect(() => {
    localStorage.setItem(WIDGET_LAYOUT_STORAGE_KEY, JSON.stringify(widgetLayout));
  }, [widgetLayout]);

  useEffect(() => {
    localStorage.setItem(WIDGET_SPAN_STORAGE_KEY, JSON.stringify(widgetSpans));
  }, [widgetSpans]);

  useEffect(() => {
    const active = widgetOrder.filter((id) => allWidgetIds.includes(id));
    setWidgetLayout((prev) => packWidgets(active, widgetSpans, prev));
  }, [widgetOrder, widgetSpans]);

  const totalRevenue2025 = data.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalTopRevenue = topCustomersData.reduce((acc, curr) => acc + curr.value, 0);

  const widgets: WidgetDefinition[] = useMemo(() => ([
    {
      id: 'revenue',
      title: 'Monthly Revenue',
      description: '2025 Performance vs Targets',
      defaultSpan: 8,
      render: () => (
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Monthly Revenue</h3>
              <p className="text-[10px] text-slate-400">2025 Performance vs Targets</p>
            </div>
            <Filter className="w-4 h-4 text-slate-400 cursor-pointer hover:text-brand-blue transition-colors" />
          </div>
	        <div className="flex-1 min-h-0 w-full">
	          <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={200}>
              <AreaChart data={data} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F5298" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0F5298" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRevenueLastYear" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={5} />
                <YAxis stroke="#64748b" axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#f8fafc', borderRadius: '4px', fontSize: '12px', padding: '8px' }}
                  formatter={(value: number) => [`₱${value.toLocaleString()}`, '']}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '-10px' }} />
                <Area type="monotone" dataKey="revenue" name="2025 Revenue" stroke="#0F5298" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="revenueLastYear" name="2024 Revenue" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorRevenueLastYear)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
    {
      id: 'dealDistribution',
      title: 'Deal Distribution',
      description: 'Win / loss breakdown',
      defaultSpan: 4,
      render: () => (
        <div className="flex flex-col h-full">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2 shrink-0">Deal Distribution</h3>
          <div className="flex-1 min-h-0 relative">
	            <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={200}>
              <PieChart>
                <Pie
                  data={REPORT_PIE_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                  label={CustomPieLabel}
                  labelLine={false}
                >
                  {REPORT_PIE_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '4px', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-0 w-full flex flex-wrap justify-center gap-2">
              {REPORT_PIE_DATA.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'topProducts',
      title: 'Top 10 Products',
      description: 'Sorted by revenue',
      defaultSpan: 6,
      render: () => (
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Top 10 Products</h3>
            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">By Revenue</span>
          </div>
          <div className="flex-1 min-h-0">
	            <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={200}>
              <BarChart data={TOP_PRODUCTS_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" opacity={0.1} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 8, fill: '#94a3b8' }}
                  dy={5}
                  interval={0}
                  tickFormatter={(value) => (value.length > 8 ? `${value.substring(0, 8)}...` : value)}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(val) => `${val / 1000000}M`} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '4px', fontSize: '11px' }} formatter={(val: number) => `₱${val.toLocaleString()}`} />
                <Bar dataKey="value" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
    {
      id: 'tasks',
      title: 'My Pending Tasks',
      description: 'Actionable follow-ups',
      defaultSpan: 6,
      render: () => (
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-blue" />
              My Pending Tasks
            </h3>
            <div className="flex items-center gap-1 text-xs font-bold text-brand-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
              <span>{myTasks.length} Due</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {myTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">No pending tasks. Great job!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{task.title}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{task.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${task.priority === 'High'
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30'
                            : task.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30'
                          }`}
                      >
                        {task.priority}
                      </span>
                      <div className="flex items-center gap-1 text-[9px] text-slate-400">
                        <Clock className="w-3 h-3" /> {task.dueDate}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'topCustomers',
      title: 'Top Customers',
      description: 'High-value accounts',
      defaultSpan: 4,
      render: () => (
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Top Customers</h3>
            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">₱{(totalTopRevenue / 1000000).toFixed(1)}M</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
            {topCustomersData.map((customer) => (
              <div
                key={customer.name}
                className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-brand-blue">
                    {customer.name.substring(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{customer.name}</p>
                    <p className="text-[10px] text-slate-400">Key account</p>
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-white">₱{customer.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ]), [myTasks, totalTopRevenue]);

  const widgetMap = useMemo(() => widgets.reduce((acc, widget) => {
    acc[widget.id] = widget;
    return acc;
  }, {} as Record<WidgetId, WidgetDefinition>), [widgets]);

  const availableWidgets = widgets.map((widget) => widget.id);

  const toggleWidget = (id: WidgetId) => {
    setWidgetOrder((prev) => {
      if (prev.includes(id)) {
        return prev.filter((widgetId) => widgetId !== id);
      }
      return [...prev, id];
    });
  };

  const handleResetLayout = () => {
    setWidgetOrder(defaultWidgetOrder);
    setWidgetSpans(defaultWidgetSpans);
    setWidgetLayout(packWidgets(defaultWidgetOrder, defaultWidgetSpans, defaultWidgetLayout));
  };

  const getSnapFromRect = (rect: DOMRect | ClientRect | null | undefined) => {
    if (!rect || !gridRef.current) return null;
    const gridRect = gridRef.current.getBoundingClientRect();
    const style = window.getComputedStyle(gridRef.current);
    const colGap = parsePx(style.columnGap) || 16;
    const rowGap = parsePx(style.rowGap) || 16;
    const availableWidth = gridRect.width - colGap * (GRID_COLUMNS - 1);
    const colWidth = availableWidth / GRID_COLUMNS;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const relativeX = centerX - gridRect.left + gridRef.current.scrollLeft;
    const relativeY = centerY - gridRect.top + gridRef.current.scrollTop;

    const col = clampColumn(Math.floor((relativeX + colGap / 2) / (colWidth + colGap)) + 1, GRID_COLUMNS);
    const row = Math.max(1, Math.floor((relativeY + rowGap / 2) / (GRID_ROW_HEIGHT + rowGap)) + 1);

    return { colWidth, colGap, rowGap, col, row };
  };

  const showPreview = (snap: { colWidth: number; colGap: number; rowGap: number; col: number; row: number }, width: number) => {
    const col = clampColumn(snap.col, width);
    setHoverPreview({
      left: (col - 1) * (snap.colWidth + snap.colGap),
      top: (snap.row - 1) * (GRID_ROW_HEIGHT + snap.rowGap),
      width: width * snap.colWidth + (width - 1) * snap.colGap,
      height: GRID_ROW_HEIGHT,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!isArranging) return;
    const id = event.active.id as WidgetId;
    setDraggingId(id);
    const rect = event.active.rect.current.translated ?? event.active.rect.current.initial ?? event.active.rect.current;
    const snap = getSnapFromRect(rect);
    if (snap) {
      const width = widgetSpans[id] ?? defaultWidgetSpans[id] ?? 4;
      showPreview(snap, width);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!isArranging) return;
    const id = event.active.id as WidgetId;
    const rect = event.active.rect.current.translated ?? event.active.rect.current;
    const snap = getSnapFromRect(rect);
    if (snap) {
      const width = widgetSpans[id] ?? defaultWidgetSpans[id] ?? 4;
      showPreview(snap, width);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isArranging) {
      setDraggingId(null);
      setHoverPreview(null);
      return;
    }
    const id = event.active.id as WidgetId;
    const rect = event.active.rect.current.translated ?? event.active.rect.current;
    const snap = getSnapFromRect(rect);
    if (snap) {
      const width = widgetSpans[id] ?? defaultWidgetSpans[id] ?? 4;
      const col = clampColumn(snap.col, width);
      const active = widgetOrder.filter((widgetId) => availableWidgets.includes(widgetId));

      // Create temporary layout without the dragged widget to find best placement
      const tempLayout = { ...widgetLayout };
      delete tempLayout[id];

      // Smart placement: try to place at desired position, move others if needed
      setWidgetLayout((prev) => {
        const newLayout = { ...prev };
        const draggedWidth = widgetSpans[id] ?? defaultWidgetSpans[id] ?? 4;

        // Check if desired position is available
        const isPositionAvailable = (row: number, col: number, width: number, layout: WidgetLayout) => {
          for (let c = col; c < col + width; c++) {
            for (const [widgetId, widgetLayout] of Object.entries(layout)) {
              if (widgetId === id) continue;
              const widgetPos = widgetLayout;
              if (widgetPos.row === row && c >= widgetPos.col && c < widgetPos.col + widgetPos.width) {
                return false;
              }
            }
          }
          return true;
        };

        // Find widgets that need to be moved
        const widgetsToMove: WidgetId[] = [];
        for (let c = col; c < col + draggedWidth; c++) {
          for (const [widgetId, widgetLayout] of Object.entries(newLayout)) {
            if (widgetId === id) continue;
            const widgetPos = widgetLayout as { row: number; col: number; width: number };
            if (widgetPos.row === snap.row && c >= widgetPos.col && c < widgetPos.col + widgetPos.width) {
              if (!widgetsToMove.includes(widgetId as WidgetId)) {
                widgetsToMove.push(widgetId as WidgetId);
              }
            }
          }
        }

        // Remove conflicting widgets temporarily
        widgetsToMove.forEach(widgetId => delete newLayout[widgetId]);

        // Place the dragged widget
        newLayout[id] = { row: snap.row, col, width: draggedWidth };

        // Reposition displaced widgets
        widgetsToMove.forEach(widgetId => {
          const widgetWidth = widgetSpans[widgetId] ?? defaultWidgetSpans[widgetId] ?? 4;
          const originalPos = widgetLayout[widgetId];

          // Try to place near original position first
          let placed = false;
          for (let rowOffset = 0; rowOffset <= 3; rowOffset++) {
            for (let colOffset = 0; colOffset <= GRID_COLUMNS - widgetWidth + 1; colOffset++) {
              const testRow = originalPos.row + rowOffset;
              const testCol = Math.max(1, Math.min(colOffset, GRID_COLUMNS - widgetWidth + 1));

              if (isPositionAvailable(testRow, testCol, widgetWidth, newLayout)) {
                newLayout[widgetId] = { row: testRow, col: testCol, width: widgetWidth };
                placed = true;
                break;
              }
            }
            if (placed) break;
          }

          // If still not placed, use packWidgets to find a spot
          if (!placed) {
            const remainingWidgets = active.filter(wId => wId !== id && !widgetsToMove.includes(wId));
            const packedLayout = packWidgets([...remainingWidgets, widgetId], widgetSpans, newLayout);
            if (packedLayout[widgetId]) {
              newLayout[widgetId] = packedLayout[widgetId];
            }
          }
        });

        return newLayout;
      });
    }
    setDraggingId(null);
    setHoverPreview(null);
  };

  const handleDragCancel = () => {
    setDraggingId(null);
    setHoverPreview(null);
  };

  const activeWidgets = widgetOrder.filter((id) => availableWidgets.includes(id));

  return (
    <div className="flex flex-col h-full gap-4 animate-fadeIn">
      {/* 1. Header (Compact) */}
      <div className="flex justify-between items-center shrink-0 h-10">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            Dashboard
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">Overview</span>
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          <button className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">Last 7 Days</button>
          <button className="px-3 py-1 text-xs font-medium text-brand-blue dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-100 dark:border-blue-800">Last 30 Days</button>
          <button className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">Quarter</button>
        </div>
      </div>

      {/* Customization rail */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-brand-blue">
              <LayoutTemplate className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">Customize this dashboard</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Toggle widgets on/off. Enable Arrange Mode to drag and snap them anywhere on the grid.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {widgets.map((widget) => {
              const isActive = activeWidgets.includes(widget.id);
              return (
                <button
                  key={widget.id}
                  type="button"
                  onClick={() => toggleWidget(widget.id)}
                  className={`text-[11px] px-3 py-1 rounded-lg border transition-colors flex items-center gap-1 ${isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-brand-blue'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  aria-pressed={isActive}
                >
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? '#0F5298' : '#cbd5e1' }}></span>
                  {widget.title}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsArranging((prev) => !prev)}
              className={`text-[11px] px-3 py-1 rounded-lg border flex items-center gap-1 transition-colors ${isArranging
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
            >
              {isArranging ? 'Exit Arrange Mode' : 'Arrange Mode'}
            </button>
            <button
              type="button"
              onClick={handleResetLayout}
              className="text-[11px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Reset Layout
            </button>
          </div>
        </div>
      </div>

      {/* 2. Metrics Rail (Consolidated 7 Columns) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0 h-24">
        <CompactMetricCard
          title="Revenue (2025)"
          value={`₱${(totalRevenue2025 / 1000000).toFixed(1)}M`}
          trend={12.5}
          icon={DollarSign}
          bgClass="bg-blue-50 dark:bg-blue-900/20"
          colorClass="text-brand-blue dark:text-blue-400"
        />
        <CompactMetricCard
          title="Active Deals"
          value="45"
          trend={-2.4}
          icon={Briefcase}
          bgClass="bg-indigo-50 dark:bg-indigo-900/20"
          colorClass="text-indigo-600 dark:text-indigo-400"
        />
        <CompactMetricCard
          title="Win Rate"
          value="68%"
          trend={5.1}
          icon={Trophy}
          bgClass="bg-amber-50 dark:bg-amber-900/20"
          colorClass="text-amber-600 dark:text-amber-400"
        />
        <CompactMetricCard
          title="Pipeline Val"
          value="₱120M"
          trend={8.2}
          icon={Activity}
          bgClass="bg-purple-50 dark:bg-purple-900/20"
          colorClass="text-purple-600 dark:text-purple-400"
        />
        <CompactMetricCard
          title="Total Deals"
          value="311"
          subtext="in pipeline"
          icon={BarChart2}
          bgClass="bg-slate-50 dark:bg-slate-800"
          colorClass="text-slate-600 dark:text-slate-400"
        />
        <CompactMetricCard
          title="Won Deals"
          value="64"
          subtext="this year"
          icon={CheckCircle}
          bgClass="bg-emerald-50 dark:bg-emerald-900/20"
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <CompactMetricCard
          title="Lost Deals"
          value="15"
          subtext="this year"
          icon={XCircle}
          bgClass="bg-rose-50 dark:bg-rose-900/20"
          colorClass="text-rose-600 dark:text-rose-400"
        />
      </div>

      {/* 3. High Density Chart Grid (Fills remaining space) */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={gridRef}
          className={`flex-1 min-h-0 relative grid grid-cols-12 auto-rows-[minmax(260px,_1fr)] gap-4 ${isArranging ? 'cursor-grab' : ''}`}
        >
          {hoverPreview && draggingId && isArranging && (
            <div
              className="pointer-events-none absolute z-10 rounded-xl border-2 border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/30 transition-all"
              style={{
                left: hoverPreview.left,
                top: hoverPreview.top,
                width: hoverPreview.width,
                height: hoverPreview.height,
              }}
            />
          )}
          {activeWidgets.length === 0 ? (
            <div className="col-span-12 h-full flex items-center justify-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
              Select widgets above to build your view.
            </div>
          ) : (
            activeWidgets.map((id) => {
              const widget = widgetMap[id];
              if (!widget) return null;
              const isDragging = draggingId === id;
              const layoutConfig = widgetLayout[id] ?? defaultWidgetLayout[id];
              const width = widgetSpans[id] ?? defaultWidgetSpans[id] ?? widget.defaultSpan;
              const colStart = clampColumn(layoutConfig?.col ?? 1, width);
              const rowStart = layoutConfig?.row ?? 1;
              return (
                <WidgetCard
                  key={id}
                  widget={widget}
                  layout={{ row: rowStart, col: colStart }}
                  span={width}
                  isArranging={isArranging}
                  isActiveDrag={isDragging}
                />
              );
            })
          )}
        </div>
      </DndContext>
    </div>
  );
};

export default Dashboard;
