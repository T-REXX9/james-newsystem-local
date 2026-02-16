import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OwnerDailyCallMonitoringUnifiedView from '../OwnerDailyCallMonitoringUnifiedView';

vi.mock('../DailyCallExcelFormatView', () => ({
  default: () => <div data-testid="daily-call-view">Daily Call View</div>,
}));

vi.mock('../OwnerLiveCallMonitoringView', () => ({
  default: () => <div data-testid="chart-view">Chart View</div>,
}));

describe('OwnerDailyCallMonitoringUnifiedView', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Daily Call view by default', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    expect(screen.getByTestId('daily-call-view')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-view')).not.toBeInTheDocument();
  });

  it('switches to chart view when Chart is clicked', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    fireEvent.click(screen.getAllByRole('button', { name: /chart/i })[0]);

    expect(screen.getByTestId('chart-view')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-call-view')).not.toBeInTheDocument();
  });

  it('switches back to Daily Call view', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    fireEvent.click(screen.getAllByRole('button', { name: /chart/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /daily call/i })[0]);

    expect(screen.getByTestId('daily-call-view')).toBeInTheDocument();
  });
});
