import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CallCustomerButton from '../CallCustomerButton';
import { queueCallRequest } from '../../services/callingSystemService';

vi.mock('../../services/callingSystemService', () => ({
  queueCallRequest: vi.fn(),
}));

const mockedQueueCallRequest = vi.mocked(queueCallRequest);

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe('CallCustomerButton', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('asks for confirmation and queues the customer phone request', async () => {
    mockedQueueCallRequest.mockResolvedValue({
      queued: true,
      request: { lid: 101, lphone_number: '09171234567' },
      customer_matched: true,
    });

    render(<CallCustomerButton phoneNumber="09171234567" customerId="customer-1" />);
    fireEvent.click(screen.getByRole('button', { name: /call customer: 09171234567/i }));

    await waitFor(() => expect(mockedQueueCallRequest).toHaveBeenCalledWith('09171234567', 'customer-1'));
    expect(toastSuccess).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('does not queue when the user cancels confirmation', () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<CallCustomerButton phoneNumber="09171234567" />);

    fireEvent.click(screen.getByRole('button', { name: /call customer: 09171234567/i }));

    expect(mockedQueueCallRequest).not.toHaveBeenCalled();
  });

  it('is disabled when no phone number is available', () => {
    render(<CallCustomerButton />);

    expect(screen.getByRole('button', { name: /no phone number available/i })).toBeDisabled();
  });
});
