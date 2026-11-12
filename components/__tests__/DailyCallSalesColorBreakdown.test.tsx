import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import DailyCallSalesColorBreakdown from '../DailyCallSalesColorBreakdown';

const fetchBreakdown = vi.fn();
vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchDailyCallSalesColorBreakdown: (...args: unknown[]) => fetchBreakdown(...args),
}));

const emptyColors = {
  green: { customer_count: 0, sales: 0 },
  yellow: { customer_count: 0, sales: 0 },
  purple: { customer_count: 0, sales: 0 },
  white: { customer_count: 0, sales: 0 },
  red: { customer_count: 0, sales: 0 },
};

describe('DailyCallSalesColorBreakdown', () => {
  afterEach(() => {
    cleanup();
    fetchBreakdown.mockReset();
  });

  it('shows each agent, color totals, company total, and unassigned sales', async () => {
    fetchBreakdown.mockResolvedValue({
      month: '2026-10',
      company_total: 2750,
      blocked_customers: { total: 3084, existing_client: 1000, verified_prospective: 1000, unverified_prospective: 1084 },
      agents: [{
        id: '63', name: 'Mira Santos', customer_count: 2, sales: 2000, unclassified_sales: 0,
        colors: { ...emptyColors, green: { customer_count: 1, sales: 2000 }, yellow: { customer_count: 1, sales: 0 } },
      }],
      unassigned: { id: '', name: 'Unassigned', customer_count: 1, sales: 750, unclassified_sales: 250,
        colors: { ...emptyColors, green: { customer_count: 1, sales: 500 } } },
    });

    render(<DailyCallSalesColorBreakdown />);

    expect(await screen.findByText(/Mira Santos/)).toBeInTheDocument();
    expect(screen.getByText('Team sales by Daily Call status')).toBeInTheDocument();
    expect(screen.getByText('Green')).toBeInTheDocument();
    expect(screen.getByText('Yellow')).toBeInTheDocument();
    expect(screen.getByText('Purple')).toBeInTheDocument();
    expect(screen.getByText('White')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Blacklisted / rejected customers' })).toBeInTheDocument();
    expect(screen.getByText('3,084 total')).toBeInTheDocument();
    expect(screen.getByText('Existing client').parentElement).toHaveTextContent('1,000');
    expect(screen.getByText('Verified prospective').parentElement).toHaveTextContent('1,000');
    expect(screen.getByText('Unverified prospective').parentElement).toHaveTextContent('1,084');
    expect(screen.getByText(/Company total/)).toHaveTextContent('₱2,750');
    const unassignedRow = screen.getByText('Unassigned').closest('tr');
    expect(unassignedRow).toBeInTheDocument();
    expect(unassignedRow).toHaveTextContent('No customer ID');
    expect(unassignedRow).toHaveTextContent('₱250');
  });

  it('keeps rendering when an older response has no blocked customer breakdown', async () => {
    fetchBreakdown.mockResolvedValue({
      month: '2026-10',
      company_total: 0,
      agents: [],
      unassigned: { id: '', name: 'Unassigned', customer_count: 0, sales: 0, unclassified_sales: 0, colors: emptyColors },
    });

    render(<DailyCallSalesColorBreakdown />);

    expect(await screen.findByText('Team sales by Daily Call status')).toBeInTheDocument();
    expect(screen.getByText('Blacklisted / rejected customers')).toBeInTheDocument();
    expect(screen.getByText('0 total')).toBeInTheDocument();
    expect(screen.getByText('Existing client').parentElement).toHaveTextContent('0');
  });
});
