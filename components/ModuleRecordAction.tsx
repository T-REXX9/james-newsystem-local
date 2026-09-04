import React from 'react';
import { ExternalLink } from 'lucide-react';
import ModuleRecordLink from './ModuleRecordLink';
import { openModuleInNewWindow, type WorkflowNavigateMode } from '../utils/workflowNavigate';

interface ModuleRecordActionProps {
  tab: string;
  payload?: Record<string, string | undefined>;
  mode?: WorkflowNavigateMode;
  onOpen?: () => void;
  openInNewTab?: boolean;
  children: React.ReactNode;
  className?: string;
  wrapperClassName?: string;
  newWindowClassName?: string;
  newWindowLabel?: string;
  'aria-label'?: string;
}

const ModuleRecordAction: React.FC<ModuleRecordActionProps> = ({
  tab,
  payload,
  mode,
  onOpen,
  openInNewTab,
  children,
  className,
  wrapperClassName = 'inline-flex items-center gap-1',
  newWindowClassName = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-brand-blue',
  newWindowLabel,
  'aria-label': ariaLabel,
}) => (
  <span className={wrapperClassName}>
    <ModuleRecordLink
      tab={tab}
      payload={payload}
      mode={mode}
      onOpen={onOpen}
      openInNewTab={openInNewTab}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </ModuleRecordLink>
    <button
      type="button"
      title={newWindowLabel || 'Open in new window'}
      aria-label={newWindowLabel || 'Open in new window'}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openModuleInNewWindow(tab, payload);
      }}
      className={newWindowClassName}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </span>
);

export default ModuleRecordAction;
