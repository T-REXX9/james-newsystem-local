import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomerStarIndicator, { CustomerStarProvider } from '../CustomerStarIndicator';
import { fetchStarredCustomerIds } from '../../services/customerStarService';
import { fetchCustomerIdentifiers } from '../../services/customerIdentifierService';
import { CUSTOMER_IDENTIFIERS_UPDATED_EVENT, CUSTOMER_STAR_UPDATED_EVENT } from '../../utils/customerStarEvents';

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
  it('shows the shared Do Not Call identifier badge', async () => {
    vi.mocked(fetchStarredCustomerIds).mockResolvedValue([]);
    vi.mocked(fetchCustomerIdentifiers).mockResolvedValue(new Map([['customer-42', ['Do Not Call']]]));

    render(
      <CustomerStarProvider>
        <CustomerStarIndicator customerId="customer-42" />
      </CustomerStarProvider>,
    );

    await act(async () => {});
    expect(await screen.findByRole('status', { name: 'Do Not Call' })).toHaveTextContent('Do Not Call');
  });
  it('shows the Do Not Call badge alongside the customer identity badge', async () => {
    vi.mocked(fetchStarredCustomerIds).mockResolvedValue([]);
    vi.mocked(fetchCustomerIdentifiers).mockResolvedValue(new Map([['customer-42', ['Do Not Call', 'Existing Customer']]]));

    render(
      <CustomerStarProvider>
        <CustomerStarIndicator customerId="customer-42" />
      </CustomerStarProvider>,
    );

    expect(await screen.findByRole('status', { name: 'Do Not Call' })).toHaveTextContent('Do Not Call');
    expect(screen.getByRole('status', { name: 'Existing Customer' })).toHaveTextContent('Existing Customer');
  });
});

describe('CustomerStarProvider', () => {
  it('refreshes customer identifiers after an identifier update event', async () => {
    vi.mocked(fetchStarredCustomerIds).mockResolvedValue([]);
    vi.mocked(fetchCustomerIdentifiers)
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([['customer-42', ['Do Not Call']]]));

    render(
      <CustomerStarProvider>
        <CustomerStarIndicator customerId="customer-42" />
      </CustomerStarProvider>,
    );

    await waitFor(() => expect(fetchCustomerIdentifiers).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.dispatchEvent(new Event(CUSTOMER_IDENTIFIERS_UPDATED_EVENT));
    });

    expect(await screen.findByRole('status', { name: 'Do Not Call' })).toBeInTheDocument();
  });

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
