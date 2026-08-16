import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('keeps the navigation inline on laptop-width screens and reserves the compact menu for narrower layouts', async () => {
    const user = userEvent.setup();
    render(
      <TopbarNavigation
        activeTab="maintenance-profile-staff"
        onNavigate={vi.fn()}
        user={owner}
      />
    );

    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle.parentElement).toHaveClass('xl:hidden');

    const desktopList = screen.getByRole('list');
    expect(desktopList).toHaveClass('hidden', 'xl:flex');

    await user.click(toggle);
    const compactMenu = document.querySelector('[data-responsive-nav="compact"]');
    expect(compactMenu).toHaveClass('xl:hidden');
    expect(within(compactMenu as HTMLElement).getByRole('button', { name: 'DASHBOARDS' })).toBeVisible();
    expect(within(compactMenu as HTMLElement).queryByText('Transfer Stock')).not.toBeInTheDocument();
  });

  it('renders navigable menu items as links that preserve open-in-new-tab gestures', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <TopbarNavigation
        activeTab="home"
        onNavigate={onNavigate}
        user={owner}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    const compactMenu = document.querySelector('[data-responsive-nav="compact"]') as HTMLElement;
    const productDatabaseLink = within(compactMenu).getByRole('menuitem', { name: 'Product Database' });

    expect(productDatabaseLink).toHaveAttribute('href', '#/warehouse-inventory-product-database');
    expect(productDatabaseLink).toHaveAttribute('target', '_blank');
    expect(productDatabaseLink).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(productDatabaseLink, { ctrlKey: true });
    expect(onNavigate).not.toHaveBeenCalled();

    await user.click(productDatabaseLink);
    expect(onNavigate).toHaveBeenCalledWith('warehouse-inventory-product-database');
  });
});
