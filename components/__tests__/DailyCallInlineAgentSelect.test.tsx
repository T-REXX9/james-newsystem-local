import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyCallInlineAgentSelect, { formatAssignmentDateLabel, resolveInlineAgentSelectValue } from '../DailyCallInlineAgentSelect';

describe('DailyCallInlineAgentSelect', () => {
  const agents = [
    { id: '12', email: 'joan@example.com', full_name: 'Joan Jerusalem', role: 'Sales Agent' },
    { id: '34', email: 'ella@example.com', full_name: 'Apostol Ella', role: 'Sales Agent' },
  ];

  it('resolves the selected agent by id or name', () => {
    expect(resolveInlineAgentSelectValue('Unassigned', '', agents)).toBe('');
    expect(resolveInlineAgentSelectValue('Joan Jerusalem', '12', agents)).toBe('12');
    expect(resolveInlineAgentSelectValue('Apostol Ella', '', agents)).toBe('34');
  });

  it('calls onAssign when a new agent is selected and highlights the assignment date', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();

    render(
      <DailyCallInlineAgentSelect
        customerId="customer-1"
        shopName="CM CALIBRATION CENTER"
        assignedTo="Unassigned"
        assignedDate="—"
        agents={agents}
        onAssign={onAssign}
      />
    );

    await user.selectOptions(screen.getByLabelText('Assign sales agent for CM CALIBRATION CENTER'), '12');

    expect(onAssign).toHaveBeenCalledWith('customer-1', agents[0]);
    expect(formatAssignmentDateLabel(new Date('2026-09-04T12:00:00'))).toBe('September 4, 2026');
  });

  it('shows a highlighted assignment date when assigned', () => {
    render(
      <DailyCallInlineAgentSelect
        customerId="customer-1"
        shopName="CM CALIBRATION CENTER"
        assignedTo="Joan Jerusalem"
        assignedAgentId="12"
        assignedDate="September 4, 2026"
        agents={agents}
        onAssign={vi.fn()}
      />
    );

    expect(screen.getByText('Assigned September 4, 2026')).toHaveClass('bg-amber-100');
  });
});
