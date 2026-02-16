import React from 'react';
import { TrendingUp } from 'lucide-react';
import { AgentSalesData } from '../types';

interface SalesPerformanceCardProps {
  agents: AgentSalesData[];
  onAgentClick: (agentId: string) => void;
  loading?: boolean;
}

const SalesPerformanceCard: React.FC<SalesPerformanceCardProps> = ({ agents, onAgentClick, loading = false }) => {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `₱${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `₱${(value / 1000).toFixed(0)}k`;
    }
    return `₱${value.toFixed(0)}`;
  };

  return (
    <div className="col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-bold text-xs text-slate-800 dark:text-white">Sales Performance Leaderboard</h3>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          Loading leaderboard...
        </div>
      ) : agents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          No sales data available
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {agents.map((agent) => (
            <button
              key={agent.agent_id}
              onClick={() => onAgentClick(agent.agent_id)}
              className="w-full text-left px-2.5 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Rank Badge */}
                <div className="flex-shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                    agent.rank === 1 ? 'bg-yellow-500' :
                    agent.rank === 2 ? 'bg-slate-400' :
                    agent.rank === 3 ? 'bg-orange-600' :
                    'bg-slate-500'
                  }`}>
                    {agent.rank}
                  </div>
                </div>

                {/* Agent Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {agent.avatar_url && (
                      <img
                        src={agent.avatar_url}
                        alt={agent.agent_name}
                        className="w-5 h-5 rounded-full flex-shrink-0 object-cover"
                      />
                    )}
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                      {agent.agent_name}
                    </span>
                  </div>
                </div>

                {/* Sales Amount */}
                <div className="flex-shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  {formatCurrency(agent.total_sales)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesPerformanceCard;
