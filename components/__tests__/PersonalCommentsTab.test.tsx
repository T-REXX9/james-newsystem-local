import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PersonalCommentsTab from '../PersonalCommentsTab';

const addToastMock = vi.fn();
const fetchManagementInstructionsMock = vi.fn(async () => []);
const createManagementInstructionMock = vi.fn();

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchManagementInstructions: (...args: unknown[]) => fetchManagementInstructionsMock(...args),
  createManagementInstruction: (...args: unknown[]) => createManagementInstructionMock(...args),
}));

vi.mock('../../services/supabaseService', () => ({
  fetchPersonalComments: vi.fn(async () => []),
  createPersonalComment: vi.fn(),
}));

describe('PersonalCommentsTab management instructions', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads and saves management instructions through the local system API', async () => {
    fetchManagementInstructionsMock.mockResolvedValueOnce([{
      id: 'instruction-1',
      contact_id: 'contact-1',
      author_id: 'master-1',
      author_name: 'James',
      text: 'Call the purchasing manager before sending a quotation.',
      timestamp: '2026-08-21T12:00:00.000Z',
    }]);
    createManagementInstructionMock.mockResolvedValueOnce({
      id: 'instruction-2',
      contact_id: 'contact-1',
      author_id: 'master-1',
      author_name: 'Master User',
      text: 'Confirm the delivery address.',
      timestamp: '2026-08-21T13:00:00.000Z',
    });
    const user = userEvent.setup();

    render(
      <PersonalCommentsTab
        contactId="contact-1"
        currentUserId="master-1"
        currentUserName="Master User"
        mode="instruction"
        autoFocus
      />
    );

    expect(await screen.findByText('Call the purchasing manager before sending a quotation.')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Write the instruction for the assigned agent...');
    expect(input).toHaveFocus();
    await user.type(input, 'Confirm the delivery address.');
    await user.click(screen.getByRole('button', { name: 'Save Instruction' }));

    await waitFor(() => {
      expect(createManagementInstructionMock).toHaveBeenCalledWith(
        'contact-1',
        'Master User',
        'Confirm the delivery address.'
      );
    });
    expect(screen.getByText('Confirm the delivery address.')).toBeInTheDocument();
    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Instruction added' }));
  });
});
