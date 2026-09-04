import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddContactModal from '../AddContactModal';
import { ToastProvider } from '../ToastProvider';
import { CustomerStatus, DealStage } from '../../types';

describe('AddContactModal preferred brand', () => {
  afterEach(() => {
    cleanup();
  });

  it('only offers Ishinomoto and Others and submits the selected value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (data: any) => ({ id: 'c-1', ...data }));

    render(
      <ToastProvider>
        <AddContactModal isOpen onClose={() => undefined} onSubmit={onSubmit} mode="create" />
      </ToastProvider>
    );

    await user.type(screen.getByPlaceholderText('e.g. Acme Corp'), 'Brand Test Co');

    const preferredBrand = screen.getByLabelText('Preferred Brand');
    const options = Array.from(preferredBrand.querySelectorAll('option')).map((option) => option.textContent);
    expect(options).toEqual(['Select preferred brand', 'Ishinomoto', 'Others']);

    await user.selectOptions(preferredBrand, 'Ishinomoto');
    await user.click(screen.getByRole('button', { name: /save customer|create customer|save|create/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].preferredBrand).toBe('Ishinomoto');
    expect(onSubmit.mock.calls[0][0].company).toBe('Brand Test Co');
  });

  it('loads existing preferred brand in edit mode', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (data: any) => ({ id: 'c-1', ...data }));

    render(
      <ToastProvider>
        <AddContactModal
          isOpen
          onClose={() => undefined}
          onSubmit={onSubmit}
          mode="edit"
          initialData={{
            id: 'c-1',
            company: 'Existing Co',
            preferredBrand: 'Others',
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
            contactPersons: [],
            name: 'Existing Co',
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
          }}
        />
      </ToastProvider>
    );

    expect(screen.getByLabelText('Preferred Brand')).toHaveValue('Others');
    await user.selectOptions(screen.getByLabelText('Preferred Brand'), 'Ishinomoto');
    await user.click(screen.getByRole('button', { name: /save customer|update customer|save|update/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].preferredBrand).toBe('Ishinomoto');
  });
});
