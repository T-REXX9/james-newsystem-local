import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CustomerRequestsTab from '../CustomerRequestsTab';
import type { Contact, UserProfile } from '../../types';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../services/customerWorkflowLocalApiService', () => ({
    fetchCustomerRequests: vi.fn().mockResolvedValue([]),
    createDiscountRequest: vi.fn(),
    requestCustomerUpdate: vi.fn(),
    reviewCustomerRequest: vi.fn(),
}));

const mockContact: Contact = {
    id: 'c1',
    company: 'Acme Corp',
    customerSince: '2020-01-01',
    team: 'A',
    salesman: 'Agent X',
    referBy: '',
    address: '123 Main St',
    province: 'Metro Manila',
    city: 'Manila',
    area: 'Downtown',
    deliveryAddress: '',
    tin: '123-456',
    priceGroup: 'Regular',
    businessLine: '',
    terms: 'COD',
    transactionType: '',
    vatType: 'VAT' as any,
    vatPercentage: '12',
    dealershipTerms: '',
    dealershipSince: '',
    dealershipQuota: 0,
    creditLimit: 50000,
    status: 'Active' as any,
    isHidden: false,
    debtType: 'Good',
    comment: 'VIP customer',
    contactPersons: [],
    name: 'John Doe',
    title: '',
    email: 'john@acme.com',
    phone: '0917-123-4567',
    mobile: '',
    avatar: '',
    dealValue: 0,
    stage: 'New' as any,
    lastContactDate: '',
    interactions: [],
    comments: [],
    salesHistory: [],
    topProducts: [],
};

const mockUser = {
    id: 'u1',
    email: 'agent@test.com',
    full_name: 'Test Agent',
    role: 'sales_agent',
} as unknown as UserProfile;

describe('CustomerRequestsTab - Field to Update dropdown', () => {
    it('renders the New Request trigger button', () => {
        render(
            <CustomerRequestsTab
                contactId="c1"
                contact={mockContact}
                currentUser={mockUser}
            />
        );
        expect(screen.getByRole('button', { name: /new request/i })).toBeInTheDocument();
    });

    it('opens the create form when New Request is clicked', () => {
        render(
            <CustomerRequestsTab
                contactId="c1"
                contact={mockContact}
                currentUser={mockUser}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /new request/i }));
        // Form should be open — discount percentage is visible only when Discount is selected
        // After clicking New Request, default category is 'contact_details'
        expect(screen.getByLabelText(/field to update/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/current value/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/new value/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/reason \/ notes/i)).toBeInTheDocument();
    });

    it('shows the 10 contact_details fields by default with human-readable labels', () => {
        render(
            <CustomerRequestsTab
                contactId="c1"
                contact={mockContact}
                currentUser={mockUser}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /new request/i }));
        const select = screen.getByLabelText(/field to update/i) as HTMLSelectElement;
        const options = within(select).getAllByRole('option');
        // contact_details has 10 fields: company, name, phone, mobile, email, address, city, province, area, tin
        expect(options.length).toBe(10);
        expect(options.map(o => o.textContent)).toEqual([
            'Company', 'Name', 'Phone', 'Mobile', 'Email',
            'Address', 'City', 'Province', 'Area', 'Tin',
        ]);
    });

    it('switches to the 5 terms fields when Terms is clicked', () => {
        render(
            <CustomerRequestsTab
                contactId="c1"
                contact={mockContact}
                currentUser={mockUser}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /new request/i }));
        fireEvent.click(screen.getByRole('button', { name: /^terms$/i }));
        const select = screen.getByLabelText(/field to update/i) as HTMLSelectElement;
        const options = within(select).getAllByRole('option');
        expect(options.length).toBe(5);
        expect(options.map(o => o.textContent)).toEqual([
            'Terms', 'Price Group', 'Transaction Type', 'Vat Type', 'Credit Limit',
        ]);
    });

    it('switches to ONLY Comment when Others is clicked', () => {
        render(
            <CustomerRequestsTab
                contactId="c1"
                contact={mockContact}
                currentUser={mockUser}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /new request/i }));
        fireEvent.click(screen.getByRole('button', { name: /^others$/i }));
        const select = screen.getByLabelText(/field to update/i) as HTMLSelectElement;
        const options = within(select).getAllByRole('option');
        expect(options.length).toBe(1);
        expect(options[0].textContent).toBe('Comment');
    });

    it('shows the current value of the selected field as read-only', () => {
        render(
            <CustomerRequestsTab
                contactId="c1"
                contact={mockContact}
                currentUser={mockUser}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /new request/i }));
        // Default is contact_details → company → 'Acme Corp'
        const currentValueInput = screen.getByLabelText(/current value/i) as HTMLInputElement;
        expect(currentValueInput.value).toBe('Acme Corp');
        expect(currentValueInput.readOnly).toBe(true);
    });

    it('new value is the typable input', () => {
        render(
            <CustomerRequestsTab
                contactId="c1"
                contact={mockContact}
                currentUser={mockUser}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /new request/i }));
        const proposedInput = screen.getByLabelText(/new value/i) as HTMLInputElement;
        expect(proposedInput.readOnly).toBe(false);
        fireEvent.change(proposedInput, { target: { value: 'New Company Name' } });
        expect(proposedInput.value).toBe('New Company Name');
    });

    it('changing field updates the read-only current value', () => {
        render(
            <CustomerRequestsTab
                contactId="c1"
                contact={mockContact}
                currentUser={mockUser}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /new request/i }));
        const select = screen.getByLabelText(/field to update/i) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'name' } });
        const currentValueInput = screen.getByLabelText(/current value/i) as HTMLInputElement;
        expect(currentValueInput.value).toBe('John Doe');
    });

    it('hides field/current/new-value inputs when Discount is selected', () => {
        render(
            <CustomerRequestsTab
                contactId="c1"
                contact={mockContact}
                currentUser={mockUser}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /new request/i }));
        fireEvent.click(screen.getByRole('button', { name: /^discount$/i }));
        expect(screen.queryByLabelText(/field to update/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/current value/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/new value/i)).not.toBeInTheDocument();
        expect(screen.getByLabelText(/discount percentage/i)).toBeInTheDocument();
    });
});
