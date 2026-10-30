import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomerStarIndicator, { CustomerStarProvider } from '../CustomerStarIndicator';
import { fetchStarredCustomerIds } from '../../services/customerStarService';
import { fetchCustomerIdentifiers } from '../../services/customerIdentifierService';
import { CUSTOMER_STAR_UPDATED_EVENT } from '../../utils/customerStarEvents';

vi.mock('../../services/customerStarService', () => ({ fetchStarredCustomerIds: vi.fn() }));
vi.mock('../../services/customerIdentifierService', () => ({ fetchCustomerIdentifiers: vi.fn() }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CustomerStarIndicator', () => {
  it('shows the shared customer identifier beside the customer star', async () => {
    vi.mocked(fetchStarredCustomerIds).mockResolvedValue(['customer-42']);
    vi.mocked(fetchCustomerIdentifiers).mockResolvedValue(new Map([['customer-42', ['New Customer']]]));

    render(
      <CustomerStarProvider>
        <CustomerStarIndicator customerId="customer-42" />
      </CustomerStarProvider>,
    );

    expect(await screen.findByLabelText('New Customer')).toBeInTheDocument();
    expect(screen.getByLabelText('Starred customer')).toBeInTheDocument();
  });
});

describe('CustomerStarProvider', () => {
  it('does not let an older refresh erase a newer star update', async () => {
    const olderRequest = deferred<string[]>();
    const newerRequest = deferred<string[]>();
    vi.mocked(fetchStarredCustomerIds)
      .mockReturnValueOnce(olderRequest.promise)
      .mockReturnValueOnce(newerRequest.promise);

    render(
      <CustomerStarProvider>
        <CustomerStarIndicator customerId="customer-42" />
      </CustomerStarProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent(CUSTOMER_STAR_UPDATED_EVENT, {
        detail: { customerId: 'customer-42', isStarred: true },
      }));
    });
    expect(await screen.findByLabelText('Starred customer')).toBeInTheDocument();

    await act(async () => newerRequest.resolve(['customer-42']));
    await act(async () => olderRequest.resolve([]));

    expect(screen.getByLabelText('Starred customer')).toBeInTheDocument();
  });
});
