import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesMapSidebar from '../SalesMapSidebar';
import type { Contact } from '../../types';

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'contact-1',
  company: 'Acme Hardware',
  customerSince: '2020-01-01',
  team: '',
  salesman: 'Juan',
  referBy: '',
  address: '',
  province: 'Quezon',
  city: 'Lucena',
  area: '',
  deliveryAddress: '',
  tin: '',
  priceGroup: '',
  businessLine: '',
  terms: '',
  transactionType: '',
  vatType: 'Inclusive' as any,
  vatPercentage: '12',
  dealershipTerms: '',
  dealershipSince: '',
  dealershipQuota: 0,
  creditLimit: 0,
  status: 1 as any,
  verification: '',
  isHidden: false,
  debtType: 'Good' as const,
  comment: '',
  contactPersons: [],
  name: 'Acme Hardware',
  title: '',
  email: '',
  phone: '',
  mobile: '',
  dealValue: 0,
  stage: 'New' as any,
  lastContactDate: '',
  interactions: [],
  comments: [],
  salesHistory: [],
  topProducts: [],
  assignedAgent: 'Juan',
  balance: 0,
  totalSales: 0,
  salesByYear: {},
  is_deleted: false,
  updated_at: '',
  ...overrides,
});

describe('SalesMapSidebar — customer selection wiring', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing when no province is selected', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <SalesMapSidebar
        provinceName={null}
        contacts={[]}
        onClose={() => {}}
        onCustomerSelect={onSelect}
      />
    );
    expect(container.firstChild).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders a button per contact when onCustomerSelect is provided', () => {
    const onSelect = vi.fn();
    const contacts: Contact[] = [
      makeContact({ id: 'c-1', company: 'Acme Hardware' }),
      makeContact({ id: 'c-2', company: 'Beta Trading' }),
    ];
    render(
      <SalesMapSidebar
        provinceName="Quezon"
        contacts={contacts}
        onClose={() => {}}
        onCustomerSelect={onSelect}
      />
    );
    // The customer card is now a button, accessible by its aria-label
    const acme = screen.getByRole('button', { name: /open acme hardware in customer database/i });
    const beta = screen.getByRole('button', { name: /open beta trading in customer database/i });
    expect(acme).toBeInTheDocument();
    expect(beta).toBeInTheDocument();
  });

  it('invokes onCustomerSelect with the contact id when a card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const contacts: Contact[] = [
      makeContact({ id: 'c-42', company: 'Acme Hardware' }),
      makeContact({ id: 'c-99', company: 'Beta Trading' }),
    ];
    render(
      <SalesMapSidebar
        provinceName="Quezon"
        contacts={contacts}
        onClose={() => {}}
        onCustomerSelect={onSelect}
      />
    );
    const acme = screen.getByRole('button', { name: /open acme hardware in customer database/i });
    await user.click(acme);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('c-42');
  });

  it('falls back to a non-clickable card when onCustomerSelect is not provided', () => {
    const contacts: Contact[] = [makeContact({ id: 'c-1', company: 'Acme Hardware' })];
    render(
      <SalesMapSidebar
        provinceName="Quezon"
        contacts={contacts}
        onClose={() => {}}
      />
    );
    // Without the prop, the card should not be a button
    expect(screen.queryByRole('button', { name: /open acme hardware/i })).toBeNull();
    // The company name is still rendered
    expect(screen.getByText('Acme Hardware')).toBeInTheDocument();
  });

  it('still renders the empty-state message when contacts is empty', () => {
    render(
      <SalesMapSidebar
        provinceName="Quezon"
        contacts={[]}
        onClose={() => {}}
        onCustomerSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/no customers in this province/i)).toBeInTheDocument();
  });
});
