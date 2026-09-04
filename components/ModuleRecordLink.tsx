import React from 'react';
import {
  buildModuleRecordHref,
  navigateWorkflow,
  type WorkflowNavigateMode,
} from '../utils/workflowNavigate';

export { buildModuleRecordHref, openModuleInNewWindow } from '../utils/workflowNavigate';

interface ModuleRecordLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
  tab: string;
  payload?: Record<string, string | undefined>;
  onOpen?: () => void;
  openInNewTab?: boolean;
  mode?: WorkflowNavigateMode;
}

const ModuleRecordLink: React.FC<ModuleRecordLinkProps> = ({
  tab,
  payload,
  onOpen,
  openInNewTab = false,
  mode,
  children,
  target = '_blank',
  rel = 'noopener noreferrer',
  ...props
}) => (
  <a
    {...props}
    href={buildModuleRecordHref(tab, payload)}
    target={target}
    rel={rel}
    onClick={(event) => {
      event.stopPropagation();
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (openInNewTab) return;
      event.preventDefault();
      if (onOpen) {
        onOpen();
        if (mode) {
          navigateWorkflow(tab, payload, mode);
        }
        return;
      }
      navigateWorkflow(tab, payload, mode ?? 'push');
    }}
  >
    {children}
  </a>
);

export default ModuleRecordLink;
