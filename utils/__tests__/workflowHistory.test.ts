import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canRetraceWorkflowHistory,
  createWorkflowHistoryState,
  ensureWorkflowHistoryState,
  getWorkflowHistoryIndex,
  retraceWorkflowHistory,
} from '../workflowHistory';

describe('workflow history', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/#/home');
  });

  it('initializes the current page as the protected app history root', () => {
    ensureWorkflowHistoryState();
    expect(getWorkflowHistoryIndex()).toBe(0);
    expect(canRetraceWorkflowHistory()).toBe(false);
  });

  it('numbers each pushed page so Back cannot leave the application root', () => {
    ensureWorkflowHistoryState();
    window.history.pushState(createWorkflowHistoryState('#/home'), '', '/#/warehouse');
    expect(getWorkflowHistoryIndex()).toBe(1);
    expect(canRetraceWorkflowHistory()).toBe(true);
  });

  it('uses browser history for app pages and the local fallback at the root', () => {
    const fallback = vi.fn();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    ensureWorkflowHistoryState();

    expect(retraceWorkflowHistory(fallback)).toBe(false);
    expect(fallback).toHaveBeenCalledOnce();
    window.history.pushState(createWorkflowHistoryState('#/home'), '', '/#/warehouse');
    expect(retraceWorkflowHistory(fallback)).toBe(true);
    expect(backSpy).toHaveBeenCalledOnce();
  });
});
