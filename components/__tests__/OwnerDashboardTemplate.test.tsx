import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerDashboardTemplate, { OwnerDashboardTemplateProps } from '../OwnerDashboardTemplate';

vi.mock('@mui/x-charts-pro/LineChartPro', () => ({
  LineChartPro: () => <div data-testid="revenue-chart" />,
}));

const fixture: OwnerDashboardTemplateProps = {
  dateLabel: 'June 18, 2026',
  monthLabel: 'June 2026',
  currentSales: 685_445,
  monthlyTarget: 3_000_000,
  remainingTarget: 2_314_555,
  totalPotential: 5_660_000,
  targetAchieved: 22.85,
  pipelineVsTarget: 188.67,
  customerCategories: [
    {
      id: 'priority',
      label: 'Priority List',
      customers: 98,
      currentSales: 2_200_000,
      averageSales: 2_200_000,
      potentialSales: 2_200_000,
      note: 'Current active buyers',
      tone: 'green',
    },
    {
      id: 'recovery',
      label: 'Recovery List',
      customers: 189,
      currentSales: 1_890_000,
      averageSales: 1_890_000,
      potentialSales: 1_890_000,
      note: 'Needs recovery contact',
      tone: 'red',
    },
    {
      id: 'verified',
      label: 'Verified Prospects',
      customers: 73,
      currentSales: 365_000,
      averageSales: 5_000,
      potentialSales: 365_000,
      note: 'By assigned agent',
      tone: 'blue',
    },
    {
      id: 'unverified',
      label: 'Unverified Prospects',
      customers: 241,
      currentSales: 1_205_000,
      averageSales: 5_000,
      potentialSales: 1_205_000,
      note: 'Needs call / verification',
      tone: 'orange',
    },
  ],
  revenueSeries: [
    { id: 'priority', label: 'Priority List Sales', data: [1, 2, 3], color: '#078b3e' },
    { id: 'total', label: 'Total Actual Sales', data: [2, 4, 6], color: '#7c3aed' },
  ],
  revenueDays: ['May 19', 'May 20', 'May 21'],
  monthlyTargetLine: 3_000_000,
  cases: [
    { label: 'Inquiry & Orders', open: 4, pending: 2, tone: 'blue' },
    { label: 'Delivery Issues', open: 1, pending: 1, tone: 'green' },
  ],
  notifications: [{ label: 'Incident Reports Awaiting Approval', count: 3 }],
  actions: [{ label: 'Recovery Customers Not Contacted', count: 12 }],
  attendance: { present: 1, absent: 9 },
  agents: [
    { name: 'Maria Santos', calls: 142, actualSales: 285_000, target: 800_000, achievement: 35.6 },
    { name: 'James Cruz', calls: 128, actualSales: 210_000, target: 750_000, achievement: 28 },
  ],
  activity: {
    calls: 387,
    texts: 241,
    aiSms: 132,
    successfulOutcomes: 73,
    conversionRate: 18.86,
  },
  search: '',
  selectedAgentId: null,
  agentOptions: [{ id: 'a1', name: 'Maria Santos' }],
  onSearchChange: vi.fn(),
  onAgentChange: vi.fn(),
  onResetFilters: vi.fn(),
  onOpenCategory: vi.fn(),
  onOpenNotifications: vi.fn(),
  onOpenAttendance: vi.fn(),
  onOpenActionList: vi.fn(),
};

describe('OwnerDashboardTemplate', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the complete reference dashboard structure', () => {
    render(<OwnerDashboardTemplate {...fixture} />);

    expect(
      screen.getByRole('heading', { name: /daily call monitoring — owner dashboard/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/current month sales \(mtd\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Monthly Target$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/customer lists/i)).toBeInTheDocument();
    expect(screen.getByText(/revenue trend/i)).toBeInTheDocument();
    expect(screen.getByText(/sales funnel/i)).toBeInTheDocument();
    expect(screen.getByText(/customer case overview/i)).toBeInTheDocument();
    expect(screen.getByText(/notifications & approvals/i)).toBeInTheDocument();
    expect(screen.getByText(/owner daily action list/i)).toBeInTheDocument();
    expect(screen.getByText(/top agent performance/i)).toBeInTheDocument();
    expect(screen.getByText(/sales activity summary/i)).toBeInTheDocument();
    expect(screen.getByTestId('revenue-chart')).toBeInTheDocument();
  });

  it('forwards notification, attendance, and customer actions', () => {
    const onOpenNotifications = vi.fn();
    const onOpenAttendance = vi.fn();
    const onOpenCategory = vi.fn();

    render(
      <OwnerDashboardTemplate
        {...fixture}
        onOpenNotifications={onOpenNotifications}
        onOpenAttendance={onOpenAttendance}
        onOpenCategory={onOpenCategory}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /view all notifications/i }));
    fireEvent.click(screen.getByRole('button', { name: /view full attendance details/i }));
    fireEvent.click(screen.getByRole('button', { name: /priority list/i }));

    expect(onOpenNotifications).toHaveBeenCalledOnce();
    expect(onOpenAttendance).toHaveBeenCalledOnce();
    expect(onOpenCategory).toHaveBeenCalledWith('priority');
  });

  it('renders stable empty states', () => {
    render(
      <OwnerDashboardTemplate
        {...fixture}
        customerCategories={[]}
        notifications={[]}
        actions={[]}
        agents={[]}
      />
    );

    expect(screen.getByText(/no customer data available/i)).toBeInTheDocument();
    expect(screen.getAllByText(/no pending items/i)).toHaveLength(2);
    expect(screen.getByText(/no agent performance available/i)).toBeInTheDocument();
  });

  it('uses the compact wide-screen layout needed for readable viewport fitting', () => {
    render(<OwnerDashboardTemplate {...fixture} />);

    expect(screen.getByTestId('customer-category-grid')).toHaveClass('2xl:grid-cols-2');
    expect(screen.getByTestId('dashboard-detail-grid')).toHaveClass(
      '2xl:grid-cols-7',
      'break-words',
      '[&>*]:min-w-0'
    );
    expect(screen.getByTestId('sales-activity-panel')).toHaveClass('2xl:col-span-2');
  });

  it('lets a master user edit the monthly target inline', async () => {
    const user = userEvent.setup();
    const onSaveMonthlyTarget = vi.fn();

    render(
      <OwnerDashboardTemplate
        {...fixture}
        canEditMonthlyTarget
        onSaveMonthlyTarget={onSaveMonthlyTarget}
      />
    );

    await user.click(screen.getByRole('button', { name: /edit monthly target/i }));
    const input = screen.getByLabelText(/monthly target/i);
    await user.clear(input);
    await user.type(input, '4500000');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSaveMonthlyTarget).toHaveBeenCalledWith(4_500_000);
  });
});
