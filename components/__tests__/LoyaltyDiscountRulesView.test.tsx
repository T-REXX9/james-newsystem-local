import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoyaltyDiscountRulesView from '../LoyaltyDiscountRulesView';

const addToastMock = vi.fn();
const getAllRulesMock = vi.fn();
const createRuleMock = vi.fn();
const updateRuleMock = vi.fn();
const deleteRuleMock = vi.fn();
const updateRuleStatusMock = vi.fn();
const getStatsMock = vi.fn();
const fetchContactsMock = vi.fn();

vi.mock('../ToastProvider', () => ({
    useToast: () => ({ addToast: addToastMock }),
}));

vi.mock('../../services/loyaltyDiscountLocalApiService', () => ({
    getAllRules: (...args: any[]) => getAllRulesMock(...args),
    createRule: (...args: any[]) => createRuleMock(...args),
    updateRule: (...args: any[]) => updateRuleMock(...args),
    deleteRule: (...args: any[]) => deleteRuleMock(...args),
    updateRuleStatus: (...args: any[]) => updateRuleStatusMock(...args),
    getLoyaltyDiscountStats: (...args: any[]) => getStatsMock(...args),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
    fetchContacts: (...args: any[]) => fetchContactsMock(...args),
}));

const sampleRule = {
    id: 'abc123',
    name: 'Gold Tier',
    description: 'Gold tier discount',
    discount_type: 'purchase_threshold' as const,
    min_purchase_amount: 30000,
    discount_percentage: 5,
    evaluation_period: 'calendar_month' as const,
    is_active: true,
    priority: 10,
    created_by: 'user1',
    created_at: '2026-04-01T00:00:00+00:00',
    is_deleted: false,
};

const sampleStats = {
    total_active_rules: 1,
    clients_eligible_this_month: 3,
    total_discount_given_this_month: 0,
    top_qualifying_clients: [],
};

const currentUser = {
    id: 'user1',
    email: 'test@test.com',
    first_name: 'Test',
    last_name: 'User',
} as any;

describe('LoyaltyDiscountRulesView', () => {
    beforeEach(() => {
        getAllRulesMock.mockResolvedValue([sampleRule]);
        getStatsMock.mockResolvedValue(sampleStats);
        fetchContactsMock.mockResolvedValue([
            { id: 'cust-1', company: 'Alpha Corp' },
            { id: 'cust-2', company: 'Beta Trading' },
        ]);
        addToastMock.mockClear();
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('renders loading spinner initially', () => {
        getAllRulesMock.mockReturnValue(new Promise(() => {})); // never resolves
        getStatsMock.mockReturnValue(new Promise(() => {}));

        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('renders rules after loading', async () => {
        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Gold Tier')).toBeTruthy();
        });

        expect(screen.getByText('Gold tier discount')).toBeTruthy();
    });

    it('renders stats cards', async () => {
        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Active Rules')).toBeTruthy();
        });

        expect(screen.getByText('1')).toBeTruthy(); // total_active_rules
        expect(screen.getByText('3')).toBeTruthy(); // clients_eligible_this_month
    });

    it('renders empty state when no rules', async () => {
        getAllRulesMock.mockResolvedValue([]);

        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('No Discount Rules')).toBeTruthy();
        });

        expect(screen.getByText('Create First Rule')).toBeTruthy();
    });

    it('renders stats note about derived data', async () => {
        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText(/derived from current month invoice/i)).toBeTruthy();
        });
    });

    it('opens create modal on Add Rule click', async () => {
        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Gold Tier')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Add Rule'));

        await waitFor(() => {
            expect(screen.getByText('Create Discount Rule')).toBeTruthy();
        });
    });

    it('shows error toast on load failure', async () => {
        getAllRulesMock.mockRejectedValue(new Error('Network error'));

        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(addToastMock).toHaveBeenCalledWith('Network error', 'error');
        });
    });

    it('calls createRule on save and shows success toast', async () => {
        createRuleMock.mockResolvedValue({ ...sampleRule, id: 'new1', name: 'Silver Tier' });

        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Gold Tier')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Add Rule'));
        await waitFor(() => {
            expect(screen.getByText('Create Discount Rule')).toBeTruthy();
        });

        const nameInput = screen.getByPlaceholderText('e.g., Gold Tier Discount');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Silver Tier');

        fireEvent.click(screen.getByText('Create'));

        await waitFor(() => {
            expect(createRuleMock).toHaveBeenCalled();
            expect(addToastMock).toHaveBeenCalledWith('Discount rule created successfully', 'success');
        });
    });

    it('shows error toast when create fails', async () => {
        createRuleMock.mockRejectedValue(new Error('Server error'));

        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Gold Tier')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Add Rule'));
        await waitFor(() => {
            expect(screen.getByText('Create Discount Rule')).toBeTruthy();
        });

        const nameInput = screen.getByPlaceholderText('e.g., Gold Tier Discount');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Test Rule');

        fireEvent.click(screen.getByText('Create'));

        await waitFor(() => {
            expect(addToastMock).toHaveBeenCalledWith('Server error', 'error');
        });
    });

    it('calls deleteRule and shows success toast', async () => {
        deleteRuleMock.mockResolvedValue(undefined);
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Gold Tier')).toBeTruthy();
        });

        const deleteBtn = screen.getByTitle('Delete');
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(deleteRuleMock).toHaveBeenCalledWith('abc123');
            expect(addToastMock).toHaveBeenCalledWith('Discount rule deleted', 'success');
        });
    });

    it('calls updateRuleStatus on toggle', async () => {
        updateRuleStatusMock.mockResolvedValue({ ...sampleRule, is_active: false });

        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Gold Tier')).toBeTruthy();
        });

        const toggleBtn = screen.getByTitle('Disable');
        fireEvent.click(toggleBtn);

        await waitFor(() => {
            expect(updateRuleStatusMock).toHaveBeenCalledWith('abc123', false);
            expect(addToastMock).toHaveBeenCalledWith('Rule disabled', 'success');
        });
    });

    it('does not show success toast when API returns no id', async () => {
        createRuleMock.mockResolvedValue(null);

        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Gold Tier')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Add Rule'));
        await waitFor(() => {
            expect(screen.getByText('Create Discount Rule')).toBeTruthy();
        });

        const nameInput = screen.getByPlaceholderText('e.g., Gold Tier Discount');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Test');

        fireEvent.click(screen.getByText('Create'));

        await waitFor(() => {
            expect(addToastMock).toHaveBeenCalledWith(
                expect.stringContaining('unexpected response'),
                'error'
            );
        });
    });

    it('shows customer picker when customer based type is selected', async () => {
        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Gold Tier')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Add Rule'));
        await waitFor(() => {
            expect(screen.getByText('Create Discount Rule')).toBeTruthy();
        });

        fireEvent.click(screen.getAllByText('Customer Based').at(-1) as HTMLElement);

        await waitFor(() => {
            expect(fetchContactsMock).toHaveBeenCalled();
            expect(screen.getByPlaceholderText('Search customers...')).toBeTruthy();
        });
    });

    it('shows date range inputs when date range type is selected', async () => {
        render(<LoyaltyDiscountRulesView currentUser={currentUser} />);

        await waitFor(() => {
            expect(screen.getByText('Gold Tier')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Add Rule'));
        await waitFor(() => {
            expect(screen.getByText('Create Discount Rule')).toBeTruthy();
        });

        fireEvent.click(screen.getAllByText('Date Range').at(-1) as HTMLElement);

        expect(document.querySelectorAll('input[type="date"]')).toHaveLength(2);
    });
});
