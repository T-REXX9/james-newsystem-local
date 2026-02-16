import React from 'react';
import { X, Edit2, Trash2, Clock3, User, Building2, DollarSign, Target, ArrowRight, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PipelineDeal, UserProfile, PipelineColumn } from '../types';
import { PIPELINE_COLUMNS } from '../constants';
import CompanyName from './CompanyName';

interface DealDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: PipelineDeal;
  onEdit: (deal: PipelineDeal) => void;
  onDelete: (id: string) => void;
  onStageChange: (id: string, stageId: string) => void;
  currentUser?: UserProfile;
}

const DealDetailsModal: React.FC<DealDetailsModalProps> = ({
  isOpen,
  onClose,
  deal,
  onEdit,
  onDelete,
  onStageChange,
  currentUser,
}) => {
  if (!isOpen || !deal) return null;

  const normalizedRole = (currentUser?.role || '').trim().toLowerCase();
  const isOwner = normalizedRole === 'owner' || normalizedRole === 'developer';
  const isManager = normalizedRole === 'manager';
  const canEdit = isOwner || isManager || deal.ownerId === currentUser?.id;
  const canDelete = isOwner || isManager;

  const currentStage = PIPELINE_COLUMNS.find(col => col.id === deal.stageId);
  const probability = currentStage?.probability ?? 0.2;
  const rootingDays = currentStage?.rootingDays ?? 7;
  const isStalled = (deal.daysInStage || 0) > rootingDays;

  const getStageColor = (stage: PipelineColumn) => {
    const color = stage.color || '';
    if (color.includes('amber')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    if (color.includes('emerald')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (color.includes('slate')) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    if (color.includes('rose')) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    if (color.includes('blue')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    if (color.includes('indigo')) return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
    if (color.includes('purple')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Deal Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <img
                src={deal.avatar}
                alt=""
                className="w-14 h-14 rounded-full border-2 border-white dark:border-slate-700 shadow-md"
              />
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">{deal.title}</h3>
                <CompanyName
                  name={deal.company}
                  pastName={deal.pastName}
                  className="text-sm text-gray-500 dark:text-slate-400"
                  formerNameClassName="text-xs text-gray-400 dark:text-slate-500"
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {deal.currency}{deal.value.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Weighted: {deal.currency}{Math.round(deal.value * probability).toLocaleString()}
              </p>
            </div>
          </div>

          {isStalled && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-300 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>This deal has been in the current stage for {deal.daysInStage} days (threshold: {rootingDays} days)</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <Target className="w-5 h-5 text-brand-blue" />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Stage</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{currentStage?.title || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <User className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Owner</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{deal.ownerName || 'Unassigned'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <Building2 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Contact</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{deal.contactName || 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <Clock3 className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Days in Stage</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{deal.daysInStage ?? 0} days</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <DollarSign className="w-5 h-5 text-teal-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Customer Type</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{deal.customerType || 'Regular'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <Target className="w-5 h-5 text-rose-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Win Probability</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{Math.round(probability * 100)}%</p>
              </div>
            </div>
          </div>

          {(deal.nextStep || deal.entryEvidence || deal.exitEvidence) && (
            <div className="space-y-3">
              {deal.nextStep && (
                <div className="flex items-start gap-2 text-sm">
                  <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700 dark:text-slate-300">Next Step: </span>
                    <span className="text-gray-600 dark:text-slate-400">{deal.nextStep}</span>
                  </div>
                </div>
              )}
              {deal.entryEvidence && (
                <div className="flex items-start gap-2 text-sm">
                  <ArrowRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700 dark:text-slate-300">Entry Evidence: </span>
                    <span className="text-gray-600 dark:text-slate-400">{deal.entryEvidence}</span>
                  </div>
                </div>
              )}
              {deal.exitEvidence && (
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-brand-blue mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700 dark:text-slate-300">Exit Evidence: </span>
                    <span className="text-gray-600 dark:text-slate-400">{deal.exitEvidence}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {deal.riskFlag && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Risk: </span>
                {deal.riskFlag}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Quick Stage Change</p>
            <div className="flex flex-wrap gap-2">
              {PIPELINE_COLUMNS.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => {
                    if (stage.id !== deal.stageId) {
                      onStageChange(deal.id, stage.id);
                    }
                  }}
                  disabled={stage.id === deal.stageId}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    stage.id === deal.stageId
                      ? `${getStageColor(stage)} ring-2 ring-offset-1 ring-gray-300 dark:ring-slate-600`
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {stage.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
          <div>
            {canDelete && (
              <button
                onClick={() => onDelete(deal.id)}
                className="flex items-center gap-2 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              Close
            </button>
            {canEdit && (
              <button
                onClick={() => onEdit(deal)}
                className="px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Deal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealDetailsModal;
