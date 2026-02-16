import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import App from '../../App';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => {
  const auth = {
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn()
  };
  const from = vi.fn();

  return {
    supabase: {
      auth,
      from
    }
  };
});

vi.mock('../../components/Login', () => ({
  default: () => <div>LoginComponent</div>
}));

vi.mock('../../components/TopNav', () => ({
  default: ({ onSignOut }: { onSignOut: () => void }) => (
    <button data-testid="topnav" onClick={onSignOut}>TopNav</button>
  )
}));

vi.mock('../../components/Dashboard', () => ({
  default: () => <div>Dashboard</div>
}));

vi.mock('../../components/SalesAgentDashboard', () => ({
  default: () => <div>SalesAgentDashboard</div>
}));

vi.mock('../../components/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ addToast: vi.fn() })
}));

vi.mock('../../components/NotificationProvider', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('../../components/OwnerLiveCallMonitoringView', () => ({
  default: () => <div>OwnerLiveCallMonitoringView</div>
}));

vi.mock('../../components/OwnerDailyCallMonitoringUnifiedView', () => ({
  default: () => <div>OwnerDailyCallMonitoringUnifiedView</div>
}));

vi.mock('../../components/DailyCallMonitoringView', () => ({
  default: () => <div>DailyCallMonitoringView</div>
}));

const typedSupabase = supabase as unknown as {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    onAuthStateChange: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

const subscription = { unsubscribe: vi.fn() };
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  typedSupabase.auth.getSession.mockReset();
  typedSupabase.auth.getUser.mockReset();
  typedSupabase.auth.onAuthStateChange.mockReset();
  typedSupabase.auth.signOut.mockReset();
  typedSupabase.from.mockReset();
  typedSupabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription } });
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

describe('App authentication flow', () => {
  it('renders login when there is no active session', async () => {
    typedSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    typedSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    render(<App />);

    expect(await screen.findByText('LoginComponent')).toBeInTheDocument();
  });

  it('loads the profile and renders the dashboard when a session exists', async () => {
    typedSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null
    });
    typedSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const profile = { id: 'user-1', role: 'Owner', access_rights: ['*'] };
    const single = vi.fn().mockResolvedValue({ data: profile, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq, single });
    typedSupabase.from.mockReturnValue({ select, eq, single });

    render(<App />);

    await waitFor(() => expect(screen.getByTestId('topnav')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('topnav'));
    await waitFor(() => expect(typedSupabase.auth.signOut).toHaveBeenCalled());
  });

  it('falls back to user metadata when profile fetch fails', async () => {
    typedSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null
    });
    typedSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'main@tnd-opc.com', user_metadata: { role: 'Owner', access_rights: ['*'] } } },
      error: null
    });

    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq, single });
    typedSupabase.from.mockReturnValue({ select, eq, single });

    render(<App />);

    expect(await screen.findByTestId('topnav')).toBeInTheDocument();
  });

  it('shows access denied if profile and user metadata are unavailable', async () => {
    typedSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null
    });
    typedSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq, single });
    typedSupabase.from.mockReturnValue({ select, eq, single });

    render(<App />);

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
  });
});
