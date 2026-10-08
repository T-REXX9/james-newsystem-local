import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerStatus, DealStage, type Contact } from '../../types';
import DuplicateCustomersView from '../Maintenance/Customer/DuplicateCustomersView';
import { fetchContacts } from '../../services/customerDatabaseLocalApiService';

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContactById: vi.fn(),
  fetchContacts: vi.fn(),
}));

vi.mock('../ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

const contact = (overrides: Partial<Contact>): Contact => ({
  id: '', company: '', customerSince: '', team: '', salesman: '', referBy: '',
  address: '', province: '', city: '', area: '', deliveryAddress: '', tin: '',
  priceGroup: '', businessLine: '', terms: '', transactionType: '', vatType: 'Exclusive',
  vatPercentage: '', dealershipTerms: '', dealershipSince: '', dealershipQuota: 0,
  creditLimit: 0, status: CustomerStatus.ACTIVE, isHidden: false, debtType: 'Good', comment: '',
  contactPersons: [], name: '', title: '', email: '', phone: '', avatar: '', dealValue: 0,
  stage: DealStage.NEW, lastContactDate: '', interactions: [], ...overrides,
});

describe('DuplicateCustomersView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('starts both customer pickers empty, excludes records without IDs, and keeps IDs out of option labels', async () => {
    vi.mocked(fetchContacts).mockResolvedValue([
      contact({ id: '', company: 'Arkn Motorcycle' }),
      contact({ id: 'internal-customer-42', company: 'Beta Parts', mobile: '09171234567' }),
    ]);

    render(<DuplicateCustomersView />);
    const user = userEvent.setup();
    const customerA = await screen.findByRole('button', { name: 'Search and select customer A' });
    const customerB = screen.getByRole('button', { name: 'Search and select customer B' });
    expect(customerA).toBeInTheDocument();
    expect(customerB).toBeInTheDocument();

    await user.click(customerA);
    expect(screen.queryByRole('button', { name: 'Arkn Motorcycle' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beta Parts · 09171234567' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('internal-customer-42');
  });
});
