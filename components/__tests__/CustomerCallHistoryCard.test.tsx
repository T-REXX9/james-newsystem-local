import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CustomerCallHistoryCard from '../CustomerCallHistoryCard';
import { fetchHardwareCallLogs } from '../../services/callingSystemService';

vi.mock('../../services/callingSystemService', () => ({
  fetchHardwareCallLogs: vi.fn(),
}));

const mockedFetchHardwareCallLogs = vi.mocked(fetchHardwareCallLogs);

describe('CustomerCallHistoryCard', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads call history for the selected customer', async () => {
    mockedFetchHardwareCallLogs.mockResolvedValue([
      {
        lid: 1,
        lagent_id: 42,
        ldevice_id: 'device-42',
        lphone_number: '09171234567',
        ldirection: 'inbound',
        lduration_seconds: 65,
        lcall_timestamp: '2026-08-24 10:00:00',
        agent_first_name: 'Ana',
        agent_last_name: 'Sales',
      },
    ]);

    render(<CustomerCallHistoryCard customerId="77" />);

    await waitFor(() => expect(mockedFetchHardwareCallLogs).toHaveBeenCalledWith({ customerId: '77' }));
    expect(await screen.findByText('Incoming')).toBeInTheDocument();
    expect(screen.getByText('1m 5s')).toBeInTheDocument();
    expect(screen.getByText('09171234567')).toBeInTheDocument();
  });

  it('shows an empty state when the customer has no hardware calls', async () => {
    mockedFetchHardwareCallLogs.mockResolvedValue([]);

    render(<CustomerCallHistoryCard customerId="77" />);

    expect(await screen.findByText('No hardware call history for this customer.')).toBeInTheDocument();
  });
});
