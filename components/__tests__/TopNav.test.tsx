import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TopNav from '../TopNav';

vi.mock('../TopbarNavigation', () => ({
  default: () => <nav aria-label="Responsive navigation" />,
}));
vi.mock('../ProductQuickSearchLauncher', () => ({ default: () => <button>Search</button> }));
vi.mock('../InternalChatLauncher', () => ({ default: () => <button>Chat</button> }));
vi.mock('../NotificationCenter', () => ({ default: () => <button>Notifications</button> }));

describe('TopNav responsive shell', () => {
  afterEach(cleanup);

  it('compresses branding, spacing, and account details on narrow screens', () => {
    render(
      <TopNav
        user={{ id: 'owner-1', email: 'owner@example.com', full_name: 'Master User', role: 'Owner' }}
        onNavigate={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(screen.getByRole('banner')).toHaveClass('px-3', 'sm:px-4', '2xl:px-6');
    expect(screen.getByText('TND-OPC')).toHaveClass('hidden', 'sm:inline');
    expect(screen.getByText('Master User')).toHaveClass('hidden', '2xl:block');
  });
});
