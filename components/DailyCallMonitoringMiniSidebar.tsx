import React from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import type { UserProfile } from '../types';

export type DailyCallOwnerViewMode = 'master-list' | 'chart';

interface DailyCallMonitoringMiniSidebarProps {
  activeView: DailyCallOwnerViewMode;
  onChangeView: (view: DailyCallOwnerViewMode) => void;
  currentUser?: UserProfile | null;
}

const navItems: Array<{
  id: DailyCallOwnerViewMode;
  label: (isMainUser: boolean) => string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'master-list',
    label: (isMainUser) => (isMainUser ? 'Management/Staff Dashboard' : 'Staff Dashboard'),
    icon: Table2,
  },
  { id: 'chart', label: () => 'Chart', icon: BarChart3 },
];

const DailyCallMonitoringMiniSidebar: React.FC<DailyCallMonitoringMiniSidebarProps> = ({
  activeView,
  onChangeView,
  currentUser,
}) => {
  const normalizedRole = String(currentUser?.role || '').trim().toLowerCase();
  const isMainUser = ['main', 'owner', 'developer'].includes(normalizedRole);

  return (
    <nav
      aria-label="Owner dashboard views"
      className="w-full shrink-0 border-b border-blue-900/40 bg-gradient-to-b from-brand-blue to-[#0a3d74] p-3 text-white shadow-sm lg:h-full lg:w-56 lg:border-b-0 lg:border-r lg:p-4 lg:shadow-none 2xl:w-64 2xl:p-5"
    >
      <div className="flex h-full gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeView;
          const label = item.label(isMainUser);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={`flex min-w-[136px] items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition lg:min-w-0 lg:justify-start 2xl:min-h-12 2xl:px-4 2xl:text-base ${
                isActive
                  ? 'bg-white/20 text-white shadow-sm ring-1 ring-white/25'
                  : 'text-blue-50/85 hover:bg-white/10 hover:text-white'
              }`}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4 shrink-0 2xl:h-5 2xl:w-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default DailyCallMonitoringMiniSidebar;
