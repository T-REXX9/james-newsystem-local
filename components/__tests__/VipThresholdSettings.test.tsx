import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import VipThresholdSettings from '../Maintenance/Customer/VipThresholdSettings';

const addToastMock = vi.fn();
const getVipTierConfigMock = vi.fn();
const setVipTierConfigMock = vi.fn();

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

vi.mock('../../services/vipTierSettingsService', () => ({
  getVipTierConfig: (...args: any[]) => getVipTierConfigMock(...args),
  setVipTierConfig: (...args: any[]) => setVipTierConfigMock(...args),
}));

describe('VipThresholdSettings', () => {
  beforeEach(() => {
    addToastMock.mockReset();
    getVipTierConfigMock.mockResolvedValue({
      silver_entry_threshold: 10000,
      gold_entry_threshold: 30000,
      silver_maintenance_threshold: 5000,
      gold_maintenance_threshold: 10000,
    });
    setVipTierConfigMock.mockResolvedValue({
      silver_entry_threshold: 12000,
      gold_entry_threshold: 35000,
      silver_maintenance_threshold: 6000,
      gold_maintenance_threshold: 12000,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads the saved vip thresholds and allows master user to save updates', async () => {
    const user = userEvent.setup();

    render(
      <VipThresholdSettings
        currentUser={{ id: '1', role: 'Master User', full_name: 'Master User' } as any}
      />
    );

    expect(await screen.findByText('VIP Thresholds')).toBeInTheDocument();

    const silverQualificationInput = screen.getByLabelText(/silver qualification threshold/i);
    expect(silverQualificationInput).toHaveValue(10000);
    await user.clear(silverQualificationInput);
    await user.type(silverQualificationInput, '12000');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(setVipTierConfigMock).toHaveBeenCalledWith({
        silver_entry_threshold: 12000,
        gold_entry_threshold: 30000,
        silver_maintenance_threshold: 5000,
        gold_maintenance_threshold: 10000,
      });
    });

    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      title: 'VIP thresholds updated',
    }));
    expect(screen.getAllByText('₱12,000').length).toBeGreaterThan(0);
  });

  it('renders the thresholds as read-only guidance for non-master users', async () => {
    render(
      <VipThresholdSettings
        currentUser={{ id: '2', role: 'Sales Agent', full_name: 'Sales Agent' } as any}
      />
    );

    expect(await screen.findByText('VIP Thresholds')).toBeInTheDocument();
    expect(screen.getByText(/only Master User or Owner can update them/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/silver qualification threshold/i)).toBeDisabled();
  });
});
