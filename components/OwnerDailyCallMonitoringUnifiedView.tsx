import React, { Component, ReactNode, useState } from 'react';
import { Table2 } from 'lucide-react';
import OwnerLiveCallMonitoringView from './OwnerLiveCallMonitoringView';
import DailyCallMonitoringMiniSidebar, { DailyCallOwnerViewMode } from './DailyCallMonitoringMiniSidebar';
import DailyCallMasterListView from './DailyCallMasterListView';
import { UserProfile } from '../types';

interface OwnerDailyCallMonitoringUnifiedViewProps {
  currentUser: UserProfile | null;
}

interface LocalErrorBoundaryProps {
  children: ReactNode;
}

interface LocalErrorBoundaryState {
  hasError: boolean;
}

class LocalErrorBoundary extends Component<LocalErrorBoundaryProps, LocalErrorBoundaryState> {
  state: LocalErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Owner daily call unified view failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          <p className="font-semibold">Something went wrong while rendering this page.</p>
          <p className="mt-1 text-sm">Please refresh and try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const OwnerDailyCallMonitoringUnifiedView: React.FC<OwnerDailyCallMonitoringUnifiedViewProps> = ({ currentUser }) => {
  const [activeView, setActiveView] = useState<DailyCallOwnerViewMode>('chart');

  return (
    <div className="h-full min-h-0 overflow-hidden bg-slate-50 p-3 md:p-4 dark:bg-slate-950">
      <div className="mx-auto flex h-full min-h-0 max-w-[1800px] flex-col gap-4 lg:flex-row">
        <DailyCallMonitoringMiniSidebar activeView={activeView} onChangeView={setActiveView} />

        <section className={`min-h-0 min-w-0 flex-1 space-y-4 ${activeView === 'master-list' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {activeView === 'master-list' && (
            <header className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Daily Call Monitoring</p>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <Table2 className="h-5 w-5 text-blue-600" />
                Master List
              </h2>
            </header>
          )}

          <LocalErrorBoundary>
            {activeView === 'master-list' ? (
              <DailyCallMasterListView />
            ) : (
              <OwnerLiveCallMonitoringView currentUser={currentUser} />
            )}
          </LocalErrorBoundary>
        </section>
      </div>
    </div>
  );
};

export default OwnerDailyCallMonitoringUnifiedView;
