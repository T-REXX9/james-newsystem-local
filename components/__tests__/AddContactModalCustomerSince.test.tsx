import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddContactModal from '../AddContactModal';
import { ToastProvider } from '../ToastProvider';
import { CustomerStatus, DealStage, Contact } from '../../types';

const editContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c-1',
  company: '3JDS CALIBRATION CENTER',
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
  name: '3JDS CALIBRATION CENTER',
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

describe('AddContactModal Customer Since', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps Customer Since empty when editing a contact with no relationship start', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (data: any) => ({ id: 'c-1', ...data }));

    render(
      <ToastProvider>
        <AddContactModal
          isOpen
          onClose={() => undefined}
          onSubmit={onSubmit}
          mode="edit"
          initialData={editContact({ customerSince: '' })}
        />
      </ToastProvider>
    );

    expect(screen.getByLabelText('Customer Since')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: /update customer/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].customerSince).toBe('');
  });

  it('shows and saves the relationship-start date in edit mode', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (data: any) => ({ id: 'c-1', ...data }));

    render(
      <ToastProvider>
        <AddContactModal
          isOpen
          onClose={() => undefined}
          onSubmit={onSubmit}
          mode="edit"
          initialData={editContact({ customerSince: '2019-05-24' })}
        />
      </ToastProvider>
    );

    expect(screen.getByLabelText('Customer Since')).toHaveValue('2019-05-24');

    await user.click(screen.getByRole('button', { name: /update customer/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].customerSince).toBe('2019-05-24');
  });
});
