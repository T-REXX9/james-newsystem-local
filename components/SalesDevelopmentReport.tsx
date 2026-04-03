import React from 'react';
import { BarChart3 } from 'lucide-react';
import { UserProfile } from '../types';
import SalesDevelopmentReportFilterView from './SalesDevelopmentReportFilter';

interface SalesDevelopmentReportProps {
  currentUser?: UserProfile;
}

const SalesDevelopmentReport: React.FC<SalesDevelopmentReportProps> = ({ currentUser }) => {
  void currentUser;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="px-6 md:px-8">
          <div className="flex items-center gap-8">
            <button
              className={`py-4 px-4 font-semibold text-sm transition-all duration-300 border-b-2 flex items-center gap-2 ${
                'border-brand-blue text-brand-blue'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Sales Development Report
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <SalesDevelopmentReportFilterView />
      </div>
    </div>
  );
};

export default SalesDevelopmentReport;
