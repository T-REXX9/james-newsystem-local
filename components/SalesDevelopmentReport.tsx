import React, { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { UserProfile } from '../types';
import SalesDevelopmentReportFilterView from './SalesDevelopmentReportFilter';
import PipelineView from './PipelineView';

interface SalesDevelopmentReportProps {
  currentUser?: UserProfile;
}

const SalesDevelopmentReport: React.FC<SalesDevelopmentReportProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'development-report' | 'pipeline'>('development-report');

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="px-6 md:px-8">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab('development-report')}
              className={`py-4 px-4 font-semibold text-sm transition-all duration-300 border-b-2 flex items-center gap-2 ${
                activeTab === 'development-report'
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Sales Development Report
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`py-4 px-4 font-semibold text-sm transition-all duration-300 border-b-2 flex items-center gap-2 ${
                activeTab === 'pipeline'
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Pipeline
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'development-report' ? (
          <SalesDevelopmentReportFilterView />
        ) : (
          <PipelineView currentUser={currentUser} />
        )}
      </div>
    </div>
  );
};

export default SalesDevelopmentReport;
