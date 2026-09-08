import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CallRecordsView from '../CallRecordsView';
import { fetchCallRecords } from '../../services/callingSystemService';
import type { CallRecord } from '../../services/callingSystemService';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('../../services/callingSystemService', () => ({
  fetchCallRecords: vi.fn(),
}));

describe('CallRecordsView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a dedicated Staff phone column without horizontal scrolling', async () => {
    const records: CallRecord[] = [
      {
        lid: 42,
        lagent_id: 42,
        ldevice_id: 'device-uuid-42',
        lcustomer_id: 7,
        lphone_number: '09171234567',
        ldirection: 'outbound',
        lduration_seconds: 125,
        lcall_timestamp: '2026-09-08 10:15:00',
        lsource: 'hardware',
        agent_first_name: '',
        agent_last_name: '',
        customer_company: 'North Star Trading',
        concern: 'Need updated pricing',
        action: 'Sent revised price list',
        report_body: 'Concern: Need updated pricing\nAction: Sent revised price list',
      },
    ];

    vi.mocked(fetchCallRecords).mockResolvedValue(records);

    render(<CallRecordsView currentUser={null} />);

    expect(await screen.findByText('Staff phone')).toBeInTheDocument();
    expect(screen.getByText('Remarks')).toBeInTheDocument();
    expect(screen.getByText('North Star Trading')).toBeInTheDocument();
    expect(screen.getByText('09171234567')).toBeInTheDocument();
    expect(screen.getByText('Need updated pricing')).toBeInTheDocument();
    expect(screen.getByText('Sent revised price list')).toBeInTheDocument();
    expect(screen.getAllByText('Staff #42')).toHaveLength(2);
    expect(screen.getByTestId('call-records-scroll-region').className).toContain('overflow-x-hidden');
  });
});
