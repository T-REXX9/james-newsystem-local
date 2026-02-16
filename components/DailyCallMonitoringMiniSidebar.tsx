import React from 'react';
import { BarChart3, Table2 } from 'lucide-react';

export type DailyCallOwnerViewMode = 'daily-call' | 'chart';

interface DailyCallMonitoringMiniSidebarProps {
  activeView: DailyCallOwnerViewMode;
  onChangeView: (view: DailyCallOwnerViewMode) => void;
}

const navItems: Array<{
  id: DailyCallOwnerViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'daily-call', label: 'Daily Call', icon: Table2 },
  { id: 'chart', label: 'Chart', icon: BarChart3 },
];

const DailyCallMonitoringMiniSidebar: React.FC<DailyCallMonitoringMiniSidebarProps> = ({
  activeView,
  onChangeView,
}) => {
  return (
    <aside className="w-full rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:w-52 lg:p-3">
      <div className="flex gap-2 overflow-x-auto lg:flex-col">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={`flex min-w-[130px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition lg:min-w-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default DailyCallMonitoringMiniSidebar;
