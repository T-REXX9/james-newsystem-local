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

  it('keeps the desktop view switcher compact beside the dashboard', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    const sidebar = screen.getByRole('navigation', { name: /owner dashboard views/i });
    expect(sidebar).toHaveClass('lg:w-40', 'lg:shrink-0', 'p-2');
    expect(screen.getByRole('button', { name: /chart/i })).toHaveClass('text-xs');
  });

  it('keeps the chart view active when Chart is clicked', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    fireEvent.click(screen.getAllByRole('button', { name: /chart/i })[0]);

    expect(screen.getByTestId('chart-view')).toBeInTheDocument();
    expect(screen.queryByTestId('master-list-view')).not.toBeInTheDocument();
  });

  it('switches back to Master List view', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    fireEvent.click(screen.getAllByRole('button', { name: /master list/i })[0]);

    expect(screen.getByTestId('master-list-view')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-view')).not.toBeInTheDocument();
  });
});
