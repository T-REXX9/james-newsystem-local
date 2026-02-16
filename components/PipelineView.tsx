import React, { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  Settings,
  ChevronDown,
  Plus,
  Search,
  ChevronRight,
  Clock3,
  Activity,
  BarChart3,
  Target,
  LayoutGrid,
  List,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { fetchDeals, moveDealToStage, deleteDeal } from '../services/supabaseService';
import { PIPELINE_COLUMNS } from '../constants';
import { PipelineDeal, UserProfile } from '../types';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { useToast } from './ToastProvider';
import DealFormModal from './DealFormModal';
import DealDetailsModal from './DealDetailsModal';
import DeleteDealConfirmModal from './DeleteDealConfirmModal';
import DroppableColumn from './pipeline/DroppableColumn';
import DraggableDealCard from './pipeline/DraggableDealCard';

interface PipelineViewProps {
  currentUser?: UserProfile;
}

type DealScope = 'all' | 'team' | 'mine';
type SortColumn = 'title' | 'ownerName' | 'stageId' | 'value' | 'daysInStage' | 'nextStep';
type SortDirection = 'asc' | 'desc';

const normalizeRole = (role?: string) => (role || '').trim().toLowerCase();

const PipelineView: React.FC<PipelineViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const normalizedRole = normalizeRole(currentUser?.role);
  const isOwner = normalizedRole === 'owner' || normalizedRole === 'developer';
  const isManager = normalizedRole === 'manager';
  const isSupport = normalizedRole === 'support' || normalizedRole === 'support staff';
  const isAgent = normalizedRole.includes('agent');
  const isJunior = normalizedRole.includes('junior');
  const canCreateDeal = isOwner || isManager || isAgent || isJunior;
  const canExport = isOwner || isManager;

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showScopeMenu, setShowScopeMenu] = useState(false);
  const [dealScope, setDealScope] = useState<DealScope>(
    isAgent || isJunior ? 'mine' : 'all'
  );
  const [filters, setFilters] = useState({
    ownerName: 'all',
    stageId: 'all',
    valueRange: 'all',
    daysInStage: 'all',
    probability: 'all',
    customerType: 'all',
  });

  const [showDealForm, setShowDealForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<PipelineDeal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null);
  const [dealToDelete, setDealToDelete] = useState<PipelineDeal | null>(null);
  const [activeDragDeal, setActiveDragDeal] = useState<PipelineDeal | null>(null);

  const [sortConfig, setSortConfig] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'value',
    direction: 'desc',
  });

  const stageMap = useMemo(() => {
    const map = new Map<string, typeof PIPELINE_COLUMNS[number]>();
    PIPELINE_COLUMNS.forEach(col => map.set(col.id, col));
    return map;
  }, []);

  const sortByStage = (a: PipelineDeal, b: PipelineDeal) => {
    const stageOrder = PIPELINE_COLUMNS.map(col => col.id);
    const aIndex = stageOrder.indexOf(a.stageId);
    const bIndex = stageOrder.indexOf(b.stageId);
    if (aIndex !== bIndex) return aIndex - bIndex;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  };

  const { data: deals, isLoading, refetch } = useRealtimeList<PipelineDeal>({
    tableName: 'deals',
    initialFetchFn: fetchDeals,
    sortFn: sortByStage,
  });

  const filteredDeals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const ownerName = currentUser?.full_name || currentUser?.email || '';
    const stageProbability = (stageId: string) => stageMap.get(stageId)?.probability ?? 0;
    return deals.filter((deal) => {
      if (dealScope === 'mine' && ownerName && deal.ownerName !== ownerName) return false;
      if (dealScope === 'team') {
        if (!currentUser?.team) return false;
        if (!deal.team || deal.team !== currentUser.team) return false;
      }
      if (!isOwner && !isManager && !isSupport && (isAgent || isJunior) && ownerName && deal.ownerName !== ownerName) return false;

      if (query) {
        const haystack = `${deal.title} ${deal.company} ${deal.ownerName || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (filters.ownerName !== 'all' && deal.ownerName !== filters.ownerName) return false;
      if (filters.stageId !== 'all' && deal.stageId !== filters.stageId) return false;
      if (filters.customerType !== 'all' && deal.customerType !== filters.customerType) return false;

      if (filters.valueRange !== 'all') {
        const value = deal.value || 0;
        const ranges: Record<string, [number, number | null]> = {
          '0-100k': [0, 100000],
          '100k-500k': [100000, 500000],
          '500k-1m': [500000, 1000000],
          '1m+': [1000000, null],
        };
        const [min, max] = ranges[filters.valueRange] || [0, null];
        if (value < min || (max !== null && value > max)) return false;
      }

      if (filters.daysInStage !== 'all') {
        const days = deal.daysInStage || 0;
        const ranges: Record<string, [number, number | null]> = {
          '0-7': [0, 7],
          '8-14': [8, 14],
          '15-30': [15, 30],
          '30+': [30, null],
        };
        const [min, max] = ranges[filters.daysInStage] || [0, null];
        if (days < min || (max !== null && days > max)) return false;
      }

      if (filters.probability !== 'all') {
        const prob = stageProbability(deal.stageId);
        const ranges: Record<string, [number, number]> = {
          '0-20': [0, 0.2],
          '21-40': [0.21, 0.4],
          '41-60': [0.41, 0.6],
          '61-80': [0.61, 0.8],
          '81-100': [0.81, 1],
        };
        const [min, max] = ranges[filters.probability] || [0, 1];
        if (prob < min || prob > max) return false;
      }

      return true;
    });
  }, [currentUser?.email, currentUser?.full_name, currentUser?.team, dealScope, deals, filters, isAgent, isJunior, isManager, isOwner, isSupport, searchQuery, stageMap]);

  const stageOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    PIPELINE_COLUMNS.forEach((col, idx) => map.set(col.id, idx));
    return map;
  }, []);

  const sortedDeals = useMemo(() => {
    if (viewMode !== 'list') return filteredDeals;
    const sorted = [...filteredDeals];
    sorted.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortConfig.column) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'ownerName':
          aVal = (a.ownerName || '').toLowerCase();
          bVal = (b.ownerName || '').toLowerCase();
          break;
        case 'stageId':
          aVal = stageOrderMap.get(a.stageId) ?? 999;
          bVal = stageOrderMap.get(b.stageId) ?? 999;
          break;
        case 'value':
          aVal = a.value;
          bVal = b.value;
          break;
        case 'daysInStage':
          aVal = a.daysInStage || 0;
          bVal = b.daysInStage || 0;
          break;
        case 'nextStep':
          aVal = (a.nextStep || '').toLowerCase();
          bVal = (b.nextStep || '').toLowerCase();
          break;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredDeals, sortConfig, stageOrderMap, viewMode]);

  const getDealsForStage = (stageId: string) => filteredDeals.filter(d => d.stageId === stageId);

  const getColumnStats = useMemo(() => {
    const statsMap = new Map<string, { count: number; value: number; avgAge: number }>();
    PIPELINE_COLUMNS.forEach(col => {
      const stageDeals = filteredDeals.filter(d => d.stageId === col.id);
      const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
      const avgAge = stageDeals.length
        ? Math.round(stageDeals.reduce((sum, d) => sum + (d.daysInStage || 0), 0) / stageDeals.length)
        : 0;
      statsMap.set(col.id, { count: stageDeals.length, value: totalValue, avgAge });
    });
    return (stageId: string) => statsMap.get(stageId) || { count: 0, value: 0, avgAge: 0 };
  }, [filteredDeals]);

  const pipelineStats = useMemo(() => {
    const totalDeals = filteredDeals.length;
    const totalValue = filteredDeals.reduce((sum, d) => sum + d.value, 0);
    const weightedValue = filteredDeals.reduce((sum, d) => {
      const prob = stageMap.get(d.stageId)?.probability ?? 0.2;
      return sum + d.value * prob;
    }, 0);
    const avgDays = filteredDeals.length
      ? Math.round(filteredDeals.reduce((sum, d) => sum + (d.daysInStage || 0), 0) / filteredDeals.length)
      : 0;
    const stageDistribution = PIPELINE_COLUMNS.map(col => {
      const items = filteredDeals.filter(d => d.stageId === col.id);
      const value = items.reduce((sum, d) => sum + d.value, 0);
      return { id: col.id, title: col.title, count: items.length, value, probability: col.probability ?? 0 };
    });
    return { totalDeals, totalValue, weightedValue, avgDays, stageDistribution };
  }, [filteredDeals, stageMap]);

  const { totalDeals, totalValue, weightedValue, avgDays, stageDistribution } = pipelineStats;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const deal = deals.find(d => d.id === event.active.id);
    setActiveDragDeal(deal || null);
  }, [deals]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragDeal(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const overId = over.id as string;
    const isColumn = PIPELINE_COLUMNS.some(col => col.id === overId);
    const newStageId = isColumn ? overId : deals.find(d => d.id === overId)?.stageId;

    if (!newStageId || newStageId === deal.stageId) return;

    try {
      await moveDealToStage(dealId, newStageId);
      addToast({ type: 'success', message: `Moved "${deal.title}" to ${stageMap.get(newStageId)?.title}` });
      refetch();
    } catch (err) {
      console.error('Error moving deal:', err);
      addToast({ type: 'error', message: 'Failed to move deal' });
    }
  }, [deals, stageMap, addToast, refetch]);

  const handleDealClick = useCallback((deal: PipelineDeal) => {
    setSelectedDeal(deal);
  }, []);

  const handleEditDeal = useCallback((deal: PipelineDeal) => {
    setSelectedDeal(null);
    setEditingDeal(deal);
    setShowDealForm(true);
  }, []);

  const handleDeleteRequest = useCallback((id: string) => {
    const deal = deals.find(d => d.id === id);
    if (deal) {
      setSelectedDeal(null);
      setDealToDelete(deal);
    }
  }, [deals]);

  const handleConfirmDelete = useCallback(async () => {
    if (!dealToDelete) return;
    try {
      const success = await deleteDeal(dealToDelete.id);
      if (success) {
        addToast({ type: 'success', message: 'Deal deleted successfully' });
        refetch();
      } else {
        addToast({ type: 'error', message: 'Failed to delete deal' });
      }
    } catch (err) {
      console.error('Error deleting deal:', err);
      addToast({ type: 'error', message: 'Failed to delete deal' });
    } finally {
      setDealToDelete(null);
    }
  }, [dealToDelete, addToast, refetch]);

  const handleStageChange = useCallback(async (id: string, stageId: string) => {
    try {
      await moveDealToStage(id, stageId);
      addToast({ type: 'success', message: `Deal moved to ${stageMap.get(stageId)?.title}` });
      setSelectedDeal(null);
      refetch();
    } catch (err) {
      console.error('Error changing stage:', err);
      addToast({ type: 'error', message: 'Failed to change stage' });
    }
  }, [stageMap, addToast, refetch]);

  const handleFormSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleExport = useCallback(() => {
    const headers = ['Title', 'Company', 'Contact', 'Owner', 'Stage', 'Value', 'Weighted', 'Days in Stage', 'Customer Type', 'Next Step'];
    const rows = filteredDeals.map(deal => {
      const stage = stageMap.get(deal.stageId);
      const prob = stage?.probability ?? 0.2;
      return [
        `"${deal.title.replace(/"/g, '""')}"`,
        `"${deal.company.replace(/"/g, '""')}"`,
        `"${(deal.contactName || '').replace(/"/g, '""')}"`,
        `"${(deal.ownerName || '').replace(/"/g, '""')}"`,
        `"${stage?.title || ''}"`,
        deal.value,
        Math.round(deal.value * prob),
        deal.daysInStage || 0,
        `"${deal.customerType || 'Regular'}"`,
        `"${(deal.nextStep || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipeline-deals-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: `Exported ${filteredDeals.length} deals` });
  }, [filteredDeals, stageMap, addToast]);

  const handleSort = useCallback((column: SortColumn) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortConfig.column !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" /> 
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-slate-950 w-full">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 dark:bg-slate-950 overflow-hidden font-sans w-full animate-fadeIn">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-5 flex flex-col gap-4 shadow-sm z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="bg-brand-blue hover:bg-blue-800 text-white px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center shadow-sm transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canCreateDeal}
                onClick={() => {
                  setEditingDeal(null);
                  setShowDealForm(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add deal
              </button>
              <div className="flex items-center border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 shadow-sm cursor-pointer hover:border-gray-300 dark:hover:border-slate-600 transition-colors group">
                <div className="w-1 h-5 bg-gray-300 dark:bg-slate-600 mr-3 rounded-full group-hover:bg-gray-400 transition-colors"></div>
                <span className="text-sm font-bold text-gray-700 dark:text-slate-200 mr-2">B2B PH Sales Pipeline</span>
                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-3"></div>
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors">
                  <Settings className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                </button>
              </div>
              <div className="flex items-center text-sm text-gray-500 dark:text-slate-400 gap-3 ml-2 bg-gray-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-gray-100 dark:border-slate-700">
                <span className="font-semibold text-gray-700 dark:text-slate-300">{totalDeals} deals</span>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <span>Total: <span className="font-semibold text-gray-700 dark:text-slate-300">₱{totalValue.toLocaleString()}</span></span>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <span>Projected: <span className="font-semibold text-gray-700 dark:text-slate-300">₱{Math.round(weightedValue).toLocaleString()}</span></span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-white transition-colors"
                  onClick={() => setShowScopeMenu(prev => !prev)}
                >
                  {dealScope === 'all' ? 'All deals' : dealScope === 'team' ? 'Team deals' : 'My deals'}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showScopeMenu && (
                  <div className="absolute right-0 mt-2 w-40 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-20">
                    {(['all', 'team', 'mine'] as DealScope[]).map(scope => (
                      <button
                        key={scope}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 ${dealScope === scope ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-600 dark:text-slate-300'}`}
                        onClick={() => {
                          setDealScope(scope);
                          setShowScopeMenu(false);
                        }}
                        disabled={scope === 'team' && !(isOwner || isManager)}
                      >
                        {scope === 'all' ? 'All deals' : scope === 'team' ? 'Team deals' : 'My deals'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Quick filter deals"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-3 pr-9 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none w-56 transition-all shadow-sm"
                />
                <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <button
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-white transition-colors"
                onClick={() => setShowAdvancedFilters(prev => !prev)}
              >
                Advanced filters <ChevronRight className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-1 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                <button
                  className={`px-2.5 py-2 text-sm ${viewMode === 'kanban' ? 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}
                  onClick={() => setViewMode('kanban')}
                  aria-label="Kanban view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  className={`px-2.5 py-2 text-sm ${viewMode === 'list' ? 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canExport}
                onClick={handleExport}
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-3 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 shadow-sm">
              <Target className="w-5 h-5 text-brand-blue" />
              <div>
                <p className="text-[11px] uppercase font-bold text-gray-400">Pipeline Value</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">₱{totalValue.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 shadow-sm">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-[11px] uppercase font-bold text-gray-400">Weighted Forecast</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">₱{Math.round(weightedValue).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 shadow-sm">
              <Clock3 className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[11px] uppercase font-bold text-gray-400">Avg Days in Stage</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{avgDays || '—'} days</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 shadow-sm">
              <Activity className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-[11px] uppercase font-bold text-gray-400">Stage Distribution</p>
                <div className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-slate-300">
                  {stageDistribution.map(s => (
                    <span key={s.id} className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 font-semibold">
                      {s.title}: {s.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <select
                className="border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-white"
                value={filters.ownerName}
                onChange={e => setFilters(prev => ({ ...prev, ownerName: e.target.value }))}
              >
                <option value="all">All owners</option>
                {Array.from(new Set(deals.map(deal => deal.ownerName).filter(Boolean))).map(owner => (
                  <option key={owner} value={owner as string}>{owner}</option>
                ))}
              </select>
              <select
                className="border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-white"
                value={filters.valueRange}
                onChange={e => setFilters(prev => ({ ...prev, valueRange: e.target.value }))}
              >
                <option value="all">All values</option>
                <option value="0-100k">₱0-100K</option>
                <option value="100k-500k">₱100K-500K</option>
                <option value="500k-1m">₱500K-1M</option>
                <option value="1m+">₱1M+</option>
              </select>
              <select
                className="border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-white"
                value={filters.stageId}
                onChange={e => setFilters(prev => ({ ...prev, stageId: e.target.value }))}
              >
                <option value="all">All stages</option>
                {PIPELINE_COLUMNS.map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.title}</option>
                ))}
              </select>
              <select
                className="border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-white"
                value={filters.daysInStage}
                onChange={e => setFilters(prev => ({ ...prev, daysInStage: e.target.value }))}
              >
                <option value="all">All ages</option>
                <option value="0-7">0-7 days</option>
                <option value="8-14">8-14 days</option>
                <option value="15-30">15-30 days</option>
                <option value="30+">30+ days</option>
              </select>
              <select
                className="border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-white"
                value={filters.probability}
                onChange={e => setFilters(prev => ({ ...prev, probability: e.target.value }))}
              >
                <option value="all">All probabilities</option>
                <option value="0-20">0-20%</option>
                <option value="21-40">21-40%</option>
                <option value="41-60">41-60%</option>
                <option value="61-80">61-80%</option>
                <option value="81-100">81-100%</option>
              </select>
              <select
                className="border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-white"
                value={filters.customerType}
                onChange={e => setFilters(prev => ({ ...prev, customerType: e.target.value }))}
              >
                <option value="all">All customer types</option>
                <option value="VIP1">VIP1</option>
                <option value="VIP2">VIP2</option>
                <option value="Regular">Regular</option>
              </select>
            </div>
            <div className="flex items-center justify-between mt-4 text-xs text-gray-500 dark:text-slate-400">
              <span>{filteredDeals.length} deals matched</span>
              <button
                className="text-brand-blue hover:text-blue-700 font-semibold"
                onClick={() => setFilters({
                  ownerName: 'all',
                  stageId: 'all',
                  valueRange: 'all',
                  daysInStage: 'all',
                  probability: 'all',
                  customerType: 'all',
                })}
              >
                Reset filters
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {PIPELINE_COLUMNS.map(stage => (
              <div key={stage.id} className="border border-gray-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-3 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.color.replace('text-', 'bg-')}`}></div>
                    <p className="text-sm font-bold text-gray-800 dark:text-white">{stage.title}</p>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">{Math.round((stage.probability ?? 0) * 100)}% prob.</span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400">
                  <strong>Entry:</strong> {stage.entryCriteria || 'Buyer intent captured'}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400">
                  <strong>Exit:</strong> {stage.exitCriteria || 'Buyer-verified outcome'}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400">
                  <Clock3 className="w-3 h-3" /> Rooting: {stage.rootingDays ?? 7}d
                </div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400">
                  <strong>Activities:</strong> {(stage.keyActivities || []).slice(0, 2).join(' | ') || 'Advance buyer proof'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {viewMode === 'kanban' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex-1 overflow-hidden p-6 bg-gray-50 dark:bg-slate-950">
              <div className="flex h-full w-full">
                {PIPELINE_COLUMNS.map((column, index) => (
                  <DroppableColumn
                    key={column.id}
                    column={column}
                    deals={getDealsForStage(column.id)}
                    columnIndex={index}
                    stats={getColumnStats(column.id)}
                    onDealClick={handleDealClick}
                    stageMap={stageMap}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>
              {activeDragDeal && (
                <div className="w-64 opacity-90">
                  <DraggableDealCard
                    deal={activeDragDeal}
                    stageInfo={stageMap.get(activeDragDeal.stageId)}
                    onClick={() => {}}
                    isDraggingEnabled={false}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-slate-950">
            <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                  <tr>
                    <th
                      className="text-left font-semibold px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 select-none"
                      onClick={() => handleSort('title')}
                    >
                      <span className="flex items-center">Deal <SortIcon column="title" /></span>
                    </th>
                    <th
                      className="text-left font-semibold px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 select-none"
                      onClick={() => handleSort('ownerName')}
                    >
                      <span className="flex items-center">Owner <SortIcon column="ownerName" /></span>
                    </th>
                    <th
                      className="text-left font-semibold px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 select-none"
                      onClick={() => handleSort('stageId')}
                    >
                      <span className="flex items-center">Stage <SortIcon column="stageId" /></span>
                    </th>
                    <th
                      className="text-right font-semibold px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 select-none"
                      onClick={() => handleSort('value')}
                    >
                      <span className="flex items-center justify-end">Value <SortIcon column="value" /></span>
                    </th>
                    <th className="text-right font-semibold px-4 py-3">Weighted</th>
                    <th
                      className="text-right font-semibold px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 select-none"
                      onClick={() => handleSort('daysInStage')}
                    >
                      <span className="flex items-center justify-end">Days <SortIcon column="daysInStage" /></span>
                    </th>
                    <th
                      className="text-left font-semibold px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 select-none"
                      onClick={() => handleSort('nextStep')}
                    >
                      <span className="flex items-center">Next Step <SortIcon column="nextStep" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDeals.map(deal => {
                    const meta = stageMap.get(deal.stageId);
                    const probability = meta?.probability ?? 0.2;
                    return (
                      <tr
                        key={deal.id}
                        className="border-t border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer"
                        onClick={() => handleDealClick(deal)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800 dark:text-white">{deal.title}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">{deal.company}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{deal.ownerName || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{meta?.title || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-slate-200">₱{deal.value.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">₱{Math.round(deal.value * probability).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">{deal.daysInStage ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{deal.nextStep || meta?.keyActivities?.[0] || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredDeals.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-500 dark:text-slate-400">
                  No deals match the current filters.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DealFormModal
        isOpen={showDealForm}
        onClose={() => {
          setShowDealForm(false);
          setEditingDeal(null);
        }}
        onSuccess={handleFormSuccess}
        deal={editingDeal}
        currentUser={currentUser}
      />

      {selectedDeal && (
        <DealDetailsModal
          isOpen={!!selectedDeal}
          onClose={() => setSelectedDeal(null)}
          deal={selectedDeal}
          onEdit={handleEditDeal}
          onDelete={handleDeleteRequest}
          onStageChange={handleStageChange}
          currentUser={currentUser}
        />
      )}

      <DeleteDealConfirmModal
        isOpen={!!dealToDelete}
        onClose={() => setDealToDelete(null)}
        onConfirm={handleConfirmDelete}
        dealTitle={dealToDelete?.title || ''}
      />
    </div>
  );
};

export default PipelineView;
