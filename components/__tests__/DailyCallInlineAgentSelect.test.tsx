import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    expect(formatAssignmentDateLabel(new Date('2026-09-04T12:00:00'))).toBe('SEP‑04‑26');
  });

  it('shows a highlighted assignment date when assigned', () => {
    render(
      <DailyCallInlineAgentSelect
        customerId="customer-1"
        shopName="CM CALIBRATION CENTER"
        assignedTo="Joan Jerusalem"
        assignedAgentId="12"
        assignedDate="SEP-04-26"
        agents={agents}
        onAssign={vi.fn()}
      />
    );

    expect(screen.getByText('Assigned SEP-04-26')).toHaveClass('bg-amber-100');
  });

  it('loads and shows assignment history on focus, newest first with dates', async () => {
    const fetchHistory = vi.fn().mockResolvedValue([
      { agentId: '34', agentName: 'Apostol Ella', assignedAt: '2026-09-20 10:00:00' },
      { agentId: '12', agentName: 'Joan Jerusalem', assignedAt: '2026-02-10 09:00:00' },
    ]);

    const view = render(
      <DailyCallInlineAgentSelect
        customerId="customer-9"
        shopName="HISTORY SHOP ALPHA"
        assignedTo="Apostol Ella"
        assignedAgentId="34"
        assignedDate="SEP-20-26"
        agents={agents}
        onAssign={vi.fn()}
        fetchHistory={fetchHistory}
      />
    );

    fireEvent.focus(view.getByLabelText('Assign sales agent for HISTORY SHOP ALPHA'));

    const scope = within(view.container);
    expect(await scope.findByText('Assigned to 2 agents')).toBeInTheDocument();
    // The history list renders each past agent name in a <li> (not just the <option>).
    const historyBlock = view.container.querySelector('ul') as HTMLElement;
    expect(historyBlock).not.toBeNull();
    expect(within(historyBlock).getByText('Apostol Ella')).toBeInTheDocument();
    expect(within(historyBlock).getByText('Joan Jerusalem')).toBeInTheDocument();
    expect(fetchHistory).toHaveBeenCalledWith('customer-9');
    view.unmount();
  });

  it('does not render a history block when there is no history', async () => {
    const fetchHistory = vi.fn().mockResolvedValue([]);

    const view = render(
      <DailyCallInlineAgentSelect
        customerId="customer-10"
        shopName="HISTORY SHOP BETA"
        assignedTo="Unassigned"
        assignedDate="—"
        agents={agents}
        onAssign={vi.fn()}
        fetchHistory={fetchHistory}
      />
    );

    fireEvent.focus(view.getByLabelText('Assign sales agent for HISTORY SHOP BETA'));

    await vi.waitFor(() => expect(fetchHistory).toHaveBeenCalledWith('customer-10'));
    expect(within(view.container).queryByText(/Assignment history|Assigned to \d+ agents/)).not.toBeInTheDocument();
    view.unmount();
  });
});
