import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface DocumentSubStatus {
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

interface WorkflowStepperProps {
  currentStage: 'inquiry' | 'order' | 'document';
  documentLabel?: string;
  documentSubStatus?: DocumentSubStatus;
}

const steps = [
  { id: 'inquiry', label: 'Sales Inquiry' },
  { id: 'order', label: 'Sales Order' },
  { id: 'document', label: 'Document' },
] as const;

const toneClasses: Record<NonNullable<DocumentSubStatus['tone']>, string> = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-200',
  info: 'bg-brand-blue/10 text-brand-blue dark:text-brand-blue/90',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ currentStage, documentLabel, documentSubStatus }) => {
  const getStatus = (stepId: 'inquiry' | 'order' | 'document') => {
    const order = steps.map(step => step.id).indexOf(stepId);
    const currentOrder = steps.map(step => step.id).indexOf(currentStage);
    if (order < currentOrder) return 'complete';
    if (order === currentOrder) return 'active';
    return 'pending';
  };

  return (
    <div className="flex items-center gap-3">
      {steps.map((step, index) => {
        const status = getStatus(step.id);
        const isDocumentStep = step.id === 'document' && documentLabel;
        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  status === 'complete'
                    ? 'bg-emerald-500 text-white'
                    : status === 'active'
                      ? 'bg-brand-blue text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {status === 'complete' ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
              </span>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                {isDocumentStep ? documentLabel : step.label}
                {isDocumentStep && documentSubStatus && (
                  <div
                    className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium normal-case ${
                      toneClasses[documentSubStatus.tone ?? 'neutral']
                    }`}
                  >
                    {documentSubStatus.label}
                  </div>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-800 rounded-full">
                <div
                  className={`h-full rounded-full ${
                    getStatus(steps[index + 1].id) !== 'pending' ? 'bg-brand-blue' : 'bg-slate-400/30'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default WorkflowStepper;
