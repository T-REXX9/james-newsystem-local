import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TopbarNavigation from '../TopbarNavigation';

const owner = {
  id: 'owner-1',
  email: 'owner@example.com',
  role: 'Owner',
  access_rights: ['*'],
};

describe('TopbarNavigation responsive layout', () => {
  afterEach(cleanup);

  it('uses the compact menu until the screen is wide enough for every navigation item', async () => {
    const user = userEvent.setup();
    render(
      <TopbarNavigation
        activeTab="maintenance-profile-staff"
        onNavigate={vi.fn()}
        user={owner}
      />
    );

    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle.parentElement).toHaveClass('2xl:hidden');

    const desktopList = screen.getByRole('list');
    expect(desktopList).toHaveClass('hidden', '2xl:flex');

    await user.click(toggle);
    const compactMenu = document.querySelector('[data-responsive-nav="compact"]');
    expect(compactMenu).toHaveClass('2xl:hidden');
    expect(within(compactMenu as HTMLElement).getByRole('button', { name: 'HOME' })).toBeVisible();
  });
});
