import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Filter, Plus, MessageSquare, Edit, ChevronLeft, Search, FileText, BarChart2, Layout, MoreHorizontal, Sparkles } from 'lucide-react';
import { REPORT_PIE_DATA, REPORT_BAR_DATA } from '../constants';

const DASHBOARDS = [
  'datafiles', 'Test Dashboard', 'Sales Activities', 'MB Franchise Reports', 
  'Franchise Reports', 'Terence Dashboard', 'Sales Performance', 
  'Sales Dashboard', 'Client Contacts Reports', 'Sales Pipeline Account...', 
  'B2B Sales Pipeline Rep...'
];

const ReportsView: React.FC = () => {
  const [activeDashboard, setActiveDashboard] = useState('Sales Performance');

  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
      const RADIAN = Math.PI / 180;
      const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
      if (percent < 0.05) return null; // Hide small labels

      return (
        <text x={x} y={y} fill="#94a3b8" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
          {`${(percent * 100).toFixed(1)}%`}
        </text>
      );
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950 animate-fadeIn">
      
      {/* Inner Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col hidden lg:flex h-[calc(100vh-3rem)] overflow-y-auto">
        <div className="p-6">
            <div className="flex items-center gap-3 text-brand-blue font-bold text-xl mb-6">
                <div className="w-8 h-8 rounded bg-brand-blue/10 dark:bg-brand-blue/20 flex items-center justify-center">
                    <BarChart2 className="w-5 h-5" />
                </div>
                Reports
            </div>
            
            <div className="mb-6">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-3">ACME Corporation</p>
                <button className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                    <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4" /> New Dashboard
                    </div>
                    <ChevronLeft className="w-4 h-4 -rotate-90" />
                </button>
            </div>

            <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-medium">
                    <Layout className="w-4 h-4" /> Home
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-medium">
                    <MoreHorizontal className="w-4 h-4" /> Shared with me
                </button>
            </div>

            <div className="mt-8">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-200 mb-3 px-3">Dashboards</p>
                <div className="space-y-1">
                    {DASHBOARDS.map(dash => (
                        <button 
                            key={dash}
                            onClick={() => setActiveDashboard(dash)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeDashboard === dash 
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <FileText className="w-4 h-4 opacity-70" />
                            <span className="truncate text-left">{dash}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
          {/* Toolbar */}
          <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0">
              <div className="flex items-center gap-3">
                  <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">{activeDashboard}</h1>
              </div>
              <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Filter className="w-4 h-4" /> Filter
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-brand-blue text-white rounded-md text-sm font-medium hover:bg-blue-700">
                      <Plus className="w-4 h-4" /> Add report
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Sparkles className="w-4 h-4 text-purple-500" /> Ask AI
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Edit <ChevronLeft className="w-3 h-3 -rotate-90" />
                  </button>
              </div>
          </div>

          {/* Dashboard Scroll Area */}
          <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-4 gap-6 max-w-[1600px] mx-auto">
                  
                  {/* KPI: Total Revenue */}
                  <div className="col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white">
                              <BarChart2 className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Sales Won Revenue</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                          <span className="text-6xl font-bold text-slate-900 dark:text-white tracking-tight">₱79,366,217</span>
                      </div>
                  </div>

                  {/* KPI: Closed Lost */}
                  <div className="col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                       <div className="flex items-center gap-2 mb-8">
                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white">
                              <BarChart2 className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Closed-lost deals</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                          <span className="text-6xl font-bold text-slate-900 dark:text-white">15</span>
                      </div>
                  </div>

                  {/* KPI: Closed Won */}
                  <div className="col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                       <div className="flex items-center gap-2 mb-8">
                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white">
                              <BarChart2 className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Closed-won deals</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                          <span className="text-6xl font-bold text-slate-900 dark:text-white">64</span>
                      </div>
                  </div>

                  {/* KPI: Total Deals */}
                  <div className="col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-64">
                      <div className="flex items-center gap-2 mb-8">
                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white">
                              <BarChart2 className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total deals</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                          <span className="text-6xl font-bold text-slate-900 dark:text-white">311</span>
                      </div>
                  </div>

                   {/* KPI: Opening Deals */}
                   <div className="col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-64">
                      <div className="flex items-center gap-2 mb-8">
                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white">
                              <BarChart2 className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Opening deals</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                          <span className="text-6xl font-bold text-slate-900 dark:text-white">232</span>
                      </div>
                  </div>

                  {/* Pie Chart: Deals Size Distribution */}
                  <div className="col-span-2 row-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                      <div className="flex items-center gap-2 mb-6">
                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white">
                              <BarChart2 className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Deals Size Distribution</span>
                      </div>
                      
                      <div className="text-center mb-4">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">Percentage of Deal value (sum)</span>
                      </div>

                      <div className="flex-1 min-h-[300px] relative">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={REPORT_PIE_DATA}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={100}
                                      paddingAngle={1}
                                      dataKey="value"
                                      label={CustomPieLabel}
                                  >
                                      {REPORT_PIE_DATA.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                                      ))}
                                  </Pie>
                                  <Tooltip 
                                      contentStyle={{ backgroundColor: '#121212', borderRadius: '8px', border: 'none', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)' }}
                                      formatter={(value: number) => `${value}%`}
                                  />
                              </PieChart>
                          </ResponsiveContainer>
                      </div>

                      <div className="grid grid-cols-4 gap-y-2 gap-x-4 mt-6">
                          {REPORT_PIE_DATA.map((entry) => (
                              <div key={entry.name} className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{entry.name}</span>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Bar Chart: Revenue Per Pipeline */}
                  <div className="col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col min-h-[300px]">
                      <div className="flex items-center gap-2 mb-6">
                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white">
                              <BarChart2 className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Revenue Per Pipeline</span>
                      </div>
                      <div className="flex-1">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={REPORT_BAR_DATA}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" opacity={0.2} />
                                  <XAxis dataKey="name" hide />
                                  <YAxis 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={{fontSize: 10, fill: '#94a3b8'}} 
                                      tickFormatter={(val) => `${val / 1000000}M`}
                                  />
                                  <Tooltip 
                                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                      contentStyle={{ backgroundColor: '#121212', borderRadius: '8px', border: 'none', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)' }}
                                      formatter={(value: any) => `₱${value.toLocaleString()}`}
                                  />
                                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* Forecast (Placeholder for bottom row) */}
                  <div className="col-span-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white">
                              <BarChart2 className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Sales Forecast Per Pipeline</span>
                      </div>
                      <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse w-full"></div>
                  </div>

              </div>
          </div>
      </div>
    </div>
  );
};

export default ReportsView;