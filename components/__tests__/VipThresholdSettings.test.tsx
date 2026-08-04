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
      one_time_discount_threshold: 10000,
      unlimited_discount_threshold: 30000,
      discount_percentage: 10,
    });
    setVipTierConfigMock.mockResolvedValue({
      one_time_discount_threshold: 12000,
      unlimited_discount_threshold: 30000,
      discount_percentage: 10,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads the saved vip thresholds and allows master user to save updates', async () => {
    const user = userEvent.setup();

    render(
      <VipThresholdSettings
        currentUser={{ id: '1', role: 'Master User', full_name: 'Master User', user_type: '1' } as any}
      />
    );

    expect(await screen.findByText('VIP Thresholds')).toBeInTheDocument();

    const oneTimeDiscountInput = screen.getByLabelText(/one-time discount threshold/i);
    expect(oneTimeDiscountInput).toHaveValue(10000);
    await user.clear(oneTimeDiscountInput);
    await user.type(oneTimeDiscountInput, '12000');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(setVipTierConfigMock).toHaveBeenCalledWith({
        one_time_discount_threshold: 12000,
        unlimited_discount_threshold: 30000,
        discount_percentage: 10,
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
    expect(screen.getByText(/only an owner-level user can update them/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/one-time discount threshold/i)).toBeDisabled();
  });
});
