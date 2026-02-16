import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsCardProps {
  title: string;
  value: string;
  trend: number;
  icon: LucideIcon;
  trendLabel?: string;
}

const MetricsCard: React.FC<MetricsCardProps> = ({ title, value, trend, icon: Icon, trendLabel = "vs last month" }) => {
  const isPositive = trend >= 0;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-xl relative overflow-hidden shadow-sm">
      {/* Background Icon Decoration */}
      <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
        <Icon className="w-24 h-24 text-brand-blue" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800 text-brand-blue dark:text-blue-400">
            <Icon className="w-6 h-6" />
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center space-x-1 ${
            isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(trend)}%</span>
          </span>
        </div>
        
        <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{value}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{trendLabel}</p>
      </div>
    </div>
  );
};

export default MetricsCard;