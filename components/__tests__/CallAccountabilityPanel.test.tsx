import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CallAccountabilityPanel from '../CallAccountabilityPanel';
import { fetchCallDeviceHealth, fetchHardwareCallLogs } from '../../services/callingSystemService';

vi.mock('../../services/callingSystemService', () => ({
  fetchCallDeviceHealth: vi.fn(),
  fetchHardwareCallLogs: vi.fn(),
}));

const mockedFetchCallDeviceHealth = vi.mocked(fetchCallDeviceHealth);
const mockedFetchHardwareCallLogs = vi.mocked(fetchHardwareCallLogs);

describe('CallAccountabilityPanel', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockedFetchCallDeviceHealth.mockResolvedValue([
      {
        lid: 1,
        lagent_id: 42,
        ldevice_id: 'device-42',
        llast_seen: '2026-08-24 10:00:00',
        effective_status: 'background_active',
        agent_first_name: 'Ana',
        agent_last_name: 'Sales',
      },
    ]);
    mockedFetchHardwareCallLogs.mockResolvedValue([
      {
        lid: 11,
        lagent_id: 42,
        ldevice_id: 'device-42',
        lphone_number: '09171234567',
        ldirection: 'missed',
        lduration_seconds: 0,
        lcall_timestamp: '2026-08-24 09:59:00',
        agent_first_name: 'Ana',
        agent_last_name: 'Sales',
      },
    ]);
  });

  it('shows device health and hardware call metadata', async () => {
    render(<CallAccountabilityPanel />);

    await waitFor(() => expect(screen.getByText('Background active')).toBeInTheDocument());
    expect(screen.getAllByText('Ana Sales')).toHaveLength(2);
    expect(screen.getByText('09171234567')).toBeInTheDocument();
    expect(screen.getByText('Missed incoming')).toBeInTheDocument();
  });

  it('renders an empty state when no call data is available', async () => {
    mockedFetchCallDeviceHealth.mockResolvedValue([]);
    mockedFetchHardwareCallLogs.mockResolvedValue([]);

    render(<CallAccountabilityPanel />);

    await waitFor(() => expect(screen.getByText('No hardware call logs available.')).toBeInTheDocument());
    expect(screen.getByText('Registered phones')).toBeInTheDocument();
  });
});
