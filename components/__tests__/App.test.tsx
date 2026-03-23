import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import App from '../../App';
import { restoreLocalAuthSession, logoutFromLocalApi, localAuthChangedEventName } from '../../services/localAuthService';

vi.mock('../../services/localAuthService', () => ({
  restoreLocalAuthSession: vi.fn(),
  logoutFromLocalApi: vi.fn(),
  localAuthChangedEventName: 'local-auth-changed',
}));

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

vi.mock('../../components/SalesInquiryView', () => ({
  default: () => <div>SalesInquiryView</div>
}));

const mockedRestoreLocalAuthSession = vi.mocked(restoreLocalAuthSession);
const mockedLogoutFromLocalApi = vi.mocked(logoutFromLocalApi);
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockedRestoreLocalAuthSession.mockReset();
  mockedLogoutFromLocalApi.mockReset();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

describe('App authentication flow', () => {
  it('renders login when there is no active session', async () => {
    mockedRestoreLocalAuthSession.mockResolvedValue(null);

    render(<App />);

    expect(await screen.findByText('LoginComponent')).toBeInTheDocument();
  });

  it('loads and renders dashboard when a local auth session exists', async () => {
    mockedRestoreLocalAuthSession.mockResolvedValue({
      token: 'token-1',
      context: {
        token: 'token-1',
        user: {
          id: 1,
          main_userid: 1,
          email: 'owner@example.com',
        },
        main_userid: 1,
        user_type: '1',
        session_branch: 'mainbranch',
        logintype: '1',
        industry: 'Shop',
      },
      userProfile: {
        id: '1',
        email: 'owner@example.com',
        full_name: 'Owner User',
        role: 'Owner',
        access_rights: ['*'],
      },
    } as any);

    render(<App />);

    await waitFor(() => expect(screen.getByTestId('topnav')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('topnav'));
    await waitFor(() => expect(mockedLogoutFromLocalApi).toHaveBeenCalled());
  });

  it('restores the current module from the URL hash on refresh', async () => {
    window.history.replaceState(null, '', '/#/sales-transaction-sales-inquiry');

    mockedRestoreLocalAuthSession.mockResolvedValue({
      token: 'token-1',
      context: {
        token: 'token-1',
        user: {
          id: 1,
          main_userid: 1,
          email: 'owner@example.com',
        },
        main_userid: 1,
        user_type: '1',
        session_branch: 'mainbranch',
        logintype: '1',
        industry: 'Shop',
      },
      userProfile: {
        id: '1',
        email: 'owner@example.com',
        full_name: 'Owner User',
        role: 'Owner',
        access_rights: ['*'],
      },
    } as any);

    render(<App />);

    expect(await screen.findByText('SalesInquiryView')).toBeInTheDocument();
  });

  it('reacts to local auth changed event after bootstrap', async () => {
    mockedRestoreLocalAuthSession.mockResolvedValue(null);

    render(<App />);
    expect(await screen.findByText('LoginComponent')).toBeInTheDocument();

    window.dispatchEvent(
      new CustomEvent(localAuthChangedEventName, {
        detail: {
          token: 'token-2',
          context: {
            token: 'token-2',
            user: { id: 2, main_userid: 1, email: 'agent@example.com' },
            main_userid: 1,
            user_type: '2',
            session_branch: 'mainbranch',
            logintype: '2',
            industry: 'Shop',
          },
          userProfile: {
            id: '2',
            email: 'agent@example.com',
            full_name: 'Sales Agent',
            role: 'Sales Agent',
            access_rights: ['home'],
          },
        },
      })
    );

    expect(await screen.findByTestId('topnav')).toBeInTheDocument();
  });

  it('renders login when restored session fails', async () => {
    mockedRestoreLocalAuthSession.mockRejectedValue(new Error('restore failed'));

    render(<App />);

    expect(await screen.findByText('LoginComponent')).toBeInTheDocument();
  });
});
