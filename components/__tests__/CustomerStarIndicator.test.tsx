import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomerStarIndicator, { CustomerStarProvider } from '../CustomerStarIndicator';
import { fetchStarredCustomerIds } from '../../services/customerStarService';
import { CUSTOMER_STAR_UPDATED_EVENT } from '../../utils/customerStarEvents';

vi.mock('../../services/customerStarService', () => ({ fetchStarredCustomerIds: vi.fn() }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

afterEach(() => vi.clearAllMocks());

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
