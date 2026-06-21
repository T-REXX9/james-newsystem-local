import React from 'react';
import { BarChart3, Table2 } from 'lucide-react';

export type DailyCallOwnerViewMode = 'master-list' | 'chart';

interface DailyCallMonitoringMiniSidebarProps {
  activeView: DailyCallOwnerViewMode;
  onChangeView: (view: DailyCallOwnerViewMode) => void;
}

const navItems: Array<{
  id: DailyCallOwnerViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'master-list', label: 'Master List', icon: Table2 },
  { id: 'chart', label: 'Chart', icon: BarChart3 },
];

const DailyCallMonitoringMiniSidebar: React.FC<DailyCallMonitoringMiniSidebarProps> = ({
  activeView,
  onChangeView,
}) => {
  return (
    <nav
      aria-label="Owner dashboard views"
      className="w-full rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-4 lg:w-40 lg:shrink-0 lg:self-start"
    >
      <div className="flex gap-2 overflow-x-auto lg:flex-col">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={`flex min-w-[130px] items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition lg:min-w-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              aria-pressed={isActive}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default DailyCallMonitoringMiniSidebar;
