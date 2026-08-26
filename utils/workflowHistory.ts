const WORKFLOW_NAVIGATION_KEY = '__jamesWorkflowNavigation';

type WorkflowNavigationState = {
  fromHash: string;
  index: number;
};

const asHistoryRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

const readWorkflowNavigation = (): WorkflowNavigationState | null => {
  const state = asHistoryRecord(window.history.state);
  const navigation = state[WORKFLOW_NAVIGATION_KEY];
  if (!navigation || typeof navigation !== 'object') return null;

  const candidate = navigation as Partial<WorkflowNavigationState>;
  if (typeof candidate.fromHash !== 'string' || !Number.isInteger(candidate.index)) return null;
  return candidate as WorkflowNavigationState;
};

export const createWorkflowHistoryState = (fromHash: string): Record<string, unknown> => ({
  [WORKFLOW_NAVIGATION_KEY]: {
    fromHash,
    index: (readWorkflowNavigation()?.index ?? 0) + 1,
  } satisfies WorkflowNavigationState,
});

export const preserveCurrentHistoryState = (): Record<string, unknown> =>
  ensureWorkflowHistoryState();

export const ensureWorkflowHistoryState = (): Record<string, unknown> => {
  const currentState = asHistoryRecord(window.history.state);
  if (readWorkflowNavigation()) return currentState;

  const initializedState = {
    ...currentState,
    [WORKFLOW_NAVIGATION_KEY]: { fromHash: '', index: 0 } satisfies WorkflowNavigationState,
  };
  window.history.replaceState(initializedState, '', window.location.href);
  return initializedState;
};

export const getWorkflowHistoryIndex = (): number => readWorkflowNavigation()?.index ?? 0;

export const canRetraceWorkflowHistory = (): boolean => getWorkflowHistoryIndex() > 0;

/**
 * Retrace an in-app navigation when this entry was pushed by the workflow
 * router. Direct links have no predecessor marker and use their local fallback.
 */
export const retraceWorkflowHistory = (fallback: () => void): boolean => {
  if (!canRetraceWorkflowHistory()) {
    fallback();
    return false;
  }

  window.history.back();
  return true;
};
