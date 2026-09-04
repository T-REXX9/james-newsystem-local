export const WORKFLOW_NAVIGATE_EVENT = 'workflow:navigate';

export type WorkflowNavigateMode = 'push' | 'replace';

export type WorkflowNavigateDetail = {
  tab: string;
  payload?: Record<string, string | undefined>;
  mode?: WorkflowNavigateMode;
};

export const compactWorkflowPayload = (
  payload?: Record<string, string | undefined>
): Record<string, string> | undefined => {
  if (!payload) return undefined;
  const next = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => Boolean(value))
  ) as Record<string, string>;
  return Object.keys(next).length > 0 ? next : undefined;
};

export const buildModuleRecordHref = (
  tab: string,
  payload: Record<string, string | undefined> = {}
) => {
  const params = new URLSearchParams(compactWorkflowPayload(payload) || {});
  const query = params.toString();
  return `#/${tab}${query ? `?${query}` : ''}`;
};

export const buildModuleRecordUrl = (
  tab: string,
  payload: Record<string, string | undefined> = {}
) => {
  const href = buildModuleRecordHref(tab, payload);
  if (typeof window === 'undefined') return href;
  return `${window.location.pathname}${window.location.search}${href}`;
};

export const navigateWorkflow = (
  tab: string,
  payload?: Record<string, string | undefined>,
  mode: WorkflowNavigateMode = 'push'
) => {
  window.dispatchEvent(new CustomEvent<WorkflowNavigateDetail>(WORKFLOW_NAVIGATE_EVENT, {
    detail: { tab, payload: compactWorkflowPayload(payload), mode },
  }));
};

export const openModuleInNewWindow = (
  tab: string,
  payload?: Record<string, string | undefined>
) => {
  window.open(buildModuleRecordUrl(tab, payload), '_blank', 'noopener,noreferrer');
};
