import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OwnerDailyCallMonitoringUnifiedView from '../OwnerDailyCallMonitoringUnifiedView';

vi.mock('../DailyCallMasterListView', () => ({
  default: () => <div data-testid="master-list-view">Master List View</div>,
}));

vi.mock('../OwnerLiveCallMonitoringView', () => ({
  default: () => <div data-testid="chart-view">Chart View</div>,
}));

describe('OwnerDailyCallMonitoringUnifiedView', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Chart view by default', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    expect(screen.getByTestId('chart-view')).toBeInTheDocument();
    expect(screen.queryByTestId('master-list-view')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase follow-up/i })).not.toBeInTheDocument();
  });

  it('renders the desktop view switcher as a sidebar', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    const sidebar = screen.getByRole('navigation', { name: /owner dashboard views/i });
    expect(sidebar).toHaveClass('lg:h-full', 'lg:w-56', 'lg:border-r');
    expect(screen.getByRole('button', { name: /chart/i })).toHaveClass('text-sm');
  });

  it('keeps the chart view active when Chart is clicked', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    fireEvent.click(screen.getAllByRole('button', { name: /chart/i })[0]);

    expect(screen.getByTestId('chart-view')).toBeInTheDocument();
    expect(screen.queryByTestId('master-list-view')).not.toBeInTheDocument();
  });

  it('switches back to Master List view', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    fireEvent.click(screen.getAllByRole('button', { name: /staff dashboard/i })[0]);

    expect(screen.getByTestId('master-list-view')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-view')).not.toBeInTheDocument();
  });

  it('renames the first sidebar item for main users', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={{ id: '1', email: 'main@example.com', role: 'MAIN' }} />);

    expect(screen.getByRole('button', { name: /management\/staff dashboard/i })).toBeInTheDocument();
  });

  it('renames the first sidebar item for staff users', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={{ id: '2', email: 'staff@example.com', role: 'Staff' }} />);

    expect(screen.getByRole('button', { name: /^staff dashboard$/i })).toBeInTheDocument();
  });
});
