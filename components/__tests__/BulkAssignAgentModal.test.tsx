import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BulkAssignAgentModal from '../BulkAssignAgentModal';

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchSalesAgents: vi.fn().mockResolvedValue([
    { id: '63', full_name: 'Sales Agent Demo', email: 'agent@example.com', role: 'Sales Agent' },
  ]),
}));

describe('BulkAssignAgentModal', () => {
  afterEach(cleanup);

  it('submits the staff account ID and display name for customer-agent reassignment', async () => {
    const onAssign = vi.fn();
    const user = userEvent.setup();

    render(
      <BulkAssignAgentModal
        isOpen
        onClose={vi.fn()}
        onAssign={onAssign}
        selectedCount={2}
      />,
    );

    await user.selectOptions(await screen.findByRole('combobox'), '63');
    await user.click(screen.getByRole('button', { name: 'Assign Agent' }));

    expect(onAssign).toHaveBeenCalledWith('63', 'Sales Agent Demo');
  });
});
