import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import AddContactModal from '../AddContactModal';
import { ToastProvider } from '../ToastProvider';
import { CustomerStatus, DealStage, Contact } from '../../types';
import { WRITABLE_PRICING_GROUP_OPTIONS } from '../../constants/pricingGroups';

const editContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c-1',
  company: 'Acme',
  preferredBrand: '',
  status: CustomerStatus.ACTIVE,
  customerSince: '',
  team: '',
  salesman: '',
  referBy: '',
  address: '',
  province: '',
  city: '',
  area: '',
  deliveryAddress: '',
  tin: '',
  priceGroup: 'regular',
  businessLine: '',
  terms: '',
  transactionType: '',
  vatType: 'Zero-Rated',
  vatPercentage: '12',
  dealershipTerms: '',
  dealershipSince: '',
  dealershipQuota: 0,
  creditLimit: 0,
  isHidden: false,
  debtType: 'Good',
  comment: '',
  contactPersons: [],
  name: 'Acme',
  title: '',
  email: '',
  phone: '',
  avatar: '',
  dealValue: 0,
  stage: DealStage.NEW,
  lastContactDate: '2026-01-01',
  interactions: [],
  comments: [],
  salesHistory: [],
  topProducts: [],
  ...overrides,
});

describe('AddContactModal price code options', () => {
  afterEach(() => {
    cleanup();
  });

  it('defaults a new customer to vip 3 and only offers vip 1/2/3', () => {
    render(
      <ToastProvider>
        <AddContactModal isOpen onClose={() => undefined} onSubmit={vi.fn()} mode="create" />
      </ToastProvider>
    );

    const priceSelect = screen.getByDisplayValue('vip 3');
    expect(priceSelect).toBeInTheDocument();
    const options = within(priceSelect).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(WRITABLE_PRICING_GROUP_OPTIONS.map((o) => o.value));
    expect(options).not.toContain('regular');
    expect(options).not.toContain('silver');
    expect(options).not.toContain('gold');
  });

  it('maps legacy regular price group to writable vip 3 when editing', () => {
    render(
      <ToastProvider>
        <AddContactModal
          isOpen
          onClose={() => undefined}
          onSubmit={vi.fn()}
          mode="edit"
          initialData={editContact({ priceGroup: 'regular' })}
        />
      </ToastProvider>
    );

    expect(screen.getByDisplayValue('vip 3')).toBeInTheDocument();
  });

  it('maps legacy silver / gold to vip 1 / vip 2 when editing', () => {
    const { rerender } = render(
      <ToastProvider>
        <AddContactModal
          isOpen
          onClose={() => undefined}
          onSubmit={vi.fn()}
          mode="edit"
          initialData={editContact({ priceGroup: 'silver' })}
        />
      </ToastProvider>
    );
    expect(screen.getByDisplayValue('vip 1')).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <AddContactModal
          isOpen
          onClose={() => undefined}
          onSubmit={vi.fn()}
          mode="edit"
          initialData={editContact({ priceGroup: 'gold', id: 'c-2' })}
        />
      </ToastProvider>
    );
    expect(screen.getByDisplayValue('vip 2')).toBeInTheDocument();
  });
});
