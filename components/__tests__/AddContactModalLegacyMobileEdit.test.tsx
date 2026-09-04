import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddContactModal from '../AddContactModal';
import { ToastProvider } from '../ToastProvider';
import { CustomerStatus, DealStage, Contact } from '../../types';

const baseEditContact: Contact = {
  id: 'c-1',
  company: 'Existing Co',
  preferredBrand: '',
  status: CustomerStatus.ACTIVE,
  customerSince: '2026-01-01',
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
  contactPersons: [
    {
      id: 'cp-1',
      enabled: true,
      name: 'ERLINDA RENTUZA ROGERO',
      position: '',
      birthday: '1970-01-01',
      telephone: '',
      mobile: '09177081946 , 09171476584',
      email: '',
    },
  ],
  name: 'ERLINDA RENTUZA ROGERO',
  title: '',
  email: '',
  phone: '',
  mobile: '09177081946 , 09171476584',
  avatar: '',
  dealValue: 0,
  stage: DealStage.NEW,
  lastContactDate: '2026-01-01',
  interactions: [],
  comments: [],
  salesHistory: [],
  topProducts: [],
};

describe('AddContactModal legacy mobile on edit', () => {
  afterEach(() => {
    cleanup();
  });

  it('allows saving preferred brand when legacy oversize mobile is unchanged', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (data: any) => ({ id: 'c-1', ...data }));

    render(
      <ToastProvider>
        <AddContactModal
          isOpen
          onClose={() => undefined}
          onSubmit={onSubmit}
          mode="edit"
          initialData={baseEditContact}
        />
      </ToastProvider>
    );

    expect(screen.getByDisplayValue('09177081946 , 09171476584')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Preferred Brand'), 'Ishinomoto');
    await user.click(screen.getByRole('button', { name: /update customer/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].preferredBrand).toBe('Ishinomoto');
    expect(onSubmit.mock.calls[0][0].contactPersons[0].mobile).toBe('09177081946 , 09171476584');
    expect(screen.queryByText(/keep mobile number under 15 characters/i)).not.toBeInTheDocument();
  });

  it('still blocks when the user changes mobile to a new oversize value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (data: any) => ({ id: 'c-1', ...data }));

    render(
      <ToastProvider>
        <AddContactModal
          isOpen
          onClose={() => undefined}
          onSubmit={onSubmit}
          mode="edit"
          initialData={baseEditContact}
        />
      </ToastProvider>
    );

    const mobileInput = screen.getByDisplayValue('09177081946 , 09171476584');
    await user.clear(mobileInput);
    await user.type(mobileInput, '09177081946 , 09999999999');
    await user.selectOptions(screen.getByLabelText('Preferred Brand'), 'Others');
    await user.click(screen.getByRole('button', { name: /update customer/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/keep mobile number under 15 characters/i).length).toBeGreaterThan(0);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
