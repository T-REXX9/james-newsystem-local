import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PipelineDeal, PipelineColumn } from '../../types';
import CompanyName from '../CompanyName';

interface DraggableDealCardProps {
  deal: PipelineDeal;
  stageInfo: PipelineColumn | undefined;
  onClick: () => void;
  isDraggingEnabled?: boolean;
}

const DraggableDealCard: React.FC<DraggableDealCardProps> = ({
  deal,
  stageInfo,
  onClick,
  isDraggingEnabled = true,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    disabled: !isDraggingEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const probability = stageInfo?.probability ?? 0.2;
  const rootingDays = stageInfo?.rootingDays ?? 7;
  const isStalled = (deal.daysInStage || 0) > rootingDays;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-100 dark:border-slate-700 shadow-card group hover:shadow-card-hover transition-all duration-200 cursor-pointer relative ${
        isDragging ? 'opacity-50 shadow-2xl scale-105 z-50' : ''
      } ${(deal.isWarning || isStalled) ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''}`}
    >
      {(deal.isWarning || isStalled) && (
        <div className="absolute inset-0 bg-rose-50 dark:bg-rose-900 opacity-20 dark:opacity-10 pointer-events-none rounded-lg"></div>
      )}
      <div className="relative z-10 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-bold text-sm text-gray-800 dark:text-white leading-snug mb-1 group-hover:text-brand-blue dark:group-hover:text-blue-400 transition-colors">
              {deal.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              <CompanyName
                name={deal.company}
                pastName={deal.pastName}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-slate-400"
                formerNameClassName="text-[10px] text-slate-400 dark:text-slate-500 font-medium"
              />
            </p>
          </div>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
            {(probability * 100).toFixed(0)}% win
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={deal.avatar}
              alt=""
              className="w-6 h-6 rounded-full border border-white dark:border-slate-600 shadow-sm"
            />
            <span className="text-xs font-medium text-gray-600 dark:text-slate-300">
              {deal.ownerName}
            </span>
          </div>
          {isStalled && (
            <span className="flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> {deal.daysInStage}d in stage
            </span>
          )}
        </div>

        <div className="text-[11px] text-gray-500 dark:text-slate-400 space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Exit: {deal.exitEvidence || stageInfo?.exitCriteria || 'Buyer-reviewed proposal'}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3 h-3 text-amber-500" />
            <span>Next: {deal.nextStep || stageInfo?.keyActivities?.[0] || 'Secure next meeting'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-slate-700">
          <div className="flex flex-col">
            <span className="font-bold text-sm text-gray-700 dark:text-slate-200">
              {deal.currency}{deal.value.toLocaleString()}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-slate-400">
              Weighted: {deal.currency}{Math.round(deal.value * probability).toLocaleString()}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="text-gray-300 hover:text-gray-500 dark:hover:text-slate-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraggableDealCard;
