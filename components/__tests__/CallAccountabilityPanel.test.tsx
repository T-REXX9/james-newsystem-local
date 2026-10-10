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

  it('summarizes listed customers called and reported on the selected day', async () => {
    mockedFetchHardwareCallLogs.mockResolvedValue([
      { lid: 21, lagent_id: 42, ldevice_id: 'device-42', lcustomer_id: 101, customer_session_id: 'customer-1', lphone_number: '09170000001', ldirection: 'outbound', lduration_seconds: 30, lcall_timestamp: '2026-08-24 10:00:00' },
      { lid: 22, lagent_id: 42, ldevice_id: 'device-42', lcustomer_id: 101, customer_session_id: 'customer-1', lphone_number: '09170000001', ldirection: 'outbound', lduration_seconds: 20, lcall_timestamp: '2026-08-24 10:05:00' },
      { lid: 23, lagent_id: 42, ldevice_id: 'device-42', lcustomer_id: 102, customer_session_id: 'outside-list', lphone_number: '09170000002', ldirection: 'outbound', lduration_seconds: 20, lcall_timestamp: '2026-08-24 10:10:00' },
    ]);

    render(<CallAccountabilityPanel
      date="2026-08-24"
      agentId={42}
      boardContactIds={['customer-1', 'customer-2']}
      reportedContactIds={['customer-2']}
    />);

    await waitFor(() => expect(screen.getByText('Business details collected')).toBeInTheDocument());
    expect(screen.getByText('Customers on list')).toBeInTheDocument();
    expect(screen.getByText('Called today')).toBeInTheDocument();
    expect(screen.getByText('2', { selector: 'p.text-xl' })).toBeInTheDocument();
    expect(screen.getAllByText('1', { selector: 'p.text-xl' })).toHaveLength(2);
    expect(mockedFetchHardwareCallLogs).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 42,
      fromDate: expect.any(String),
      toDate: expect.any(String),
    }));
  });
});
