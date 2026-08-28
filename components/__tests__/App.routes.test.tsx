import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import App from '../../App';

const session = vi.hoisted(() => ({
  token: 'route-test-token',
  context: { user: { id: 1, main_userid: 1 }, main_userid: 1 },
  userProfile: { id: '1', full_name: 'Test Owner', email: 'owner@example.test', role: 'Owner', access_rights: ['*'] },
}));
vi.mock('../../services/localAuthService', () => ({
  getLocalAuthSession: () => session,
  restoreLocalAuthSession: async () => session,
  logoutFromLocalApi: vi.fn(),
  localAuthChangedEventName: 'local-auth-changed',
}));
vi.mock('../TopNav', () => ({ default: () => <nav data-testid="route-navigation" /> }));
vi.mock('../NotificationProvider', () => ({ NotificationProvider: ({ children }: React.PropsWithChildren) => <>{children}</> }));

const appSource = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
const routes = [...new Set([...appSource.matchAll(/case '([^']+)':/g)].map(match => match[1]))];
class Boundary extends React.Component<React.PropsWithChildren, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <div data-testid="route-crash">{this.state.error}</div> : this.props.children; }
}
beforeEach(() => {
  localStorage.clear();
  // This suite checks actual page rendering and API-failure handling, not live database behavior.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'Test API unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Current App routes with local APIs', () => {
  it.each(['tasks', 'pipelines', 'maintenance-customer-pipeline', 'ai-service-dashboard', 'ai-service-standard-answers', 'ai-service-escalations'])('%s is retired instead of rendering a legacy page', async route => {
    window.history.replaceState(null, '', `/#/${route}`);
    render(<Boundary><App /></Boundary>);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.queryByTestId('route-crash')).not.toBeInTheDocument();
  });

  it.each(routes)('%s renders without a component crash when APIs fail', async route => {
    window.history.replaceState(null, '', `/#/${route}`);
    render(<Boundary><App /></Boundary>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(screen.queryByTestId('route-crash')).not.toBeInTheDocument();
    expect(screen.getByTestId('route-navigation')).toBeInTheDocument();
    expect(screen.getAllByRole('main')[0].childElementCount).toBeGreaterThan(0);
    if (['recyclebin', 'maintenance-profile-server-maintenance'].includes(route)) {
      expect(screen.getByRole('alert')).toHaveTextContent('Test API unavailable');
    }
  });
});
