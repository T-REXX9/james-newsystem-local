import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PipelineDeal, PipelineColumn } from '../../types';
import DraggableDealCard from './DraggableDealCard';

interface DroppableColumnProps {
  column: PipelineColumn;
  deals: PipelineDeal[];
  columnIndex: number;
  stats: { count: number; value: number; avgAge: number };
  onDealClick: (deal: PipelineDeal) => void;
  stageMap: Map<string, PipelineColumn>;
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({
  column,
  deals,
  columnIndex,
  stats,
  onDealClick,
  stageMap,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full mr-4 last:mr-0">
      <div className="relative h-14 mb-4 filter drop-shadow-sm group flex-shrink-0">
        <div
          className="absolute inset-0 bg-white dark:bg-slate-900 flex items-center px-4 transition-transform hover:scale-[1.02]"
          style={{
            clipPath:
              columnIndex === 0
                ? 'polygon(0% 0%, 92% 0%, 100% 50%, 92% 100%, 0% 100%)'
                : 'polygon(0% 0%, 92% 0%, 100% 50%, 92% 100%, 0% 100%, 8% 50%)',
            marginLeft: columnIndex === 0 ? '0' : '-22px',
            paddingLeft: columnIndex === 0 ? '16px' : '38px',
            zIndex: 10 - columnIndex,
          }}
        >
          <div className="flex flex-col w-full truncate">
            <div className="flex items-center gap-2 mb-0.5">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${column.color.replace('text-', 'bg-')}`}></div>
              <span className={`font-bold text-sm truncate ${column.color}`}>{column.title}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 font-medium">
              <span className="truncate">{column.id === 'blacklisted' ? '' : `₱${stats.value.toLocaleString()}`}</span>
              <span className="flex-shrink-0 ml-1">{stats.count} deals</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 font-semibold">
              <span>{Math.round((column.probability ?? 0) * 100)}% win prob</span>
              <span>Avg {stats.avgAge || 0}d</span>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto pr-2 pb-4 space-y-3 custom-scrollbar rounded-lg transition-colors ${
          isOver ? 'bg-brand-blue/5 ring-2 ring-brand-blue/30' : ''
        }`}
      >
        <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DraggableDealCard
              key={deal.id}
              deal={deal}
              stageInfo={stageMap.get(deal.stageId)}
              onClick={() => onDealClick(deal)}
            />
          ))}
        </SortableContext>
        <div className="h-12"></div>
      </div>
    </div>
  );
};

export default DroppableColumn;
