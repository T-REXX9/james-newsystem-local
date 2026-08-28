import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import OwnerDailyCallMonitoringUnifiedView from '../OwnerDailyCallMonitoringUnifiedView';

vi.mock('../DailyCallMasterListView', () => ({
  default: () => <div data-testid="master-list-view">Master List View</div>,
}));

describe('OwnerDailyCallMonitoringUnifiedView', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Daily Call Monitoring master list by default', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    expect(screen.getByTestId('master-list-view')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purchase follow-up/i })).not.toBeInTheDocument();
  });

  it('does not render the removed owner workspace toolbar', () => {
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    expect(screen.queryByRole('navigation', { name: /owner dashboard views/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: /daily call monitoring views/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Owner workspace')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /operations dashboard/i })).not.toBeInTheDocument();
  });
});
