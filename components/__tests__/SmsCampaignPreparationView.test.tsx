import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { SmsCampaignPreparationView } from '../SmsCampaignPreparationView';
import { ToastProvider } from '../ToastProvider';
import * as customerDatabaseService from '../../services/customerDatabaseLocalApiService';
import { getGatewayDevices, queueSmsCampaign, getSmsHistory } from '../../services/smsService';
import * as aiSalesAgentService from '../../services/aiSalesAgentService';

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  fetchContacts: vi.fn(),
}));

vi.mock('../../services/smsService', () => ({
  getGatewayDevices: vi.fn(),
  queueSmsCampaign: vi.fn(),
  getSmsHistory: vi.fn(),
}));

vi.mock('../../services/aiSalesAgentService', () => ({
  getMessageTemplates: vi.fn(),
}));

const mockedFetchContacts = vi.mocked(customerDatabaseService.fetchContacts);
const mockedGetGatewayDevices = vi.mocked(getGatewayDevices);
const mockedQueueSmsCampaign = vi.mocked(queueSmsCampaign);
const mockedGetSmsHistory = vi.mocked(getSmsHistory);
const mockedGetMessageTemplates = vi.mocked(aiSalesAgentService.getMessageTemplates);

const ownerUser = { id: '1', user_type: '1', role: 'Company Owner' } as any;

const sampleCustomer = (month: string) => ({
  id: 'customer-1',
  company: 'Acme Parts',
  status: 'Active',
  mobile: '09171234567',
  contactPersons: [{ name: 'Maria', mobile: '09171234567', birthday: `1990-${month}-15` }],
}) as any;

const sampleDevices = {
  devices: {
    'gateway-1': {
      sim_cards: [
        { subscriptionId: 15, slotIndex: 0, carrierName: 'Globe' },
        { subscriptionId: 16, slotIndex: 1, carrierName: 'Smart' },
      ],
    },
  },
};

describe('SmsCampaignPreparationView', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchContacts.mockResolvedValue([]);
    mockedGetGatewayDevices.mockResolvedValue({ devices: {} });
    mockedQueueSmsCampaign.mockResolvedValue(undefined);
    mockedGetSmsHistory.mockResolvedValue({ history: [] });
    mockedGetMessageTemplates.mockResolvedValue([]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders safely when customer data is empty and never reads length from undefined', async () => {
    render(
      <ToastProvider>
        <SmsCampaignPreparationView currentUser={ownerUser} />
      </ToastProvider>,
    );

    expect(await screen.findByText('SMS Blasting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Queue 0 Messages/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Birthdays\s+0/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No Purchase > 1 Month\s+0/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /VIP Re-engagement\s+0/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prospective\s+0/i })).toBeInTheDocument();
  });

  it('supports campaign queueing, SIM selection, and copy on the default birthday campaign', async () => {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    mockedFetchContacts.mockResolvedValue([sampleCustomer(month)]);
    mockedGetGatewayDevices.mockResolvedValue(sampleDevices as any);

    render(
      <ToastProvider>
        <SmsCampaignPreparationView currentUser={ownerUser} />
      </ToastProvider>,
    );

    expect(await screen.findByRole('button', { name: /Birthdays\s+1/i })).toBeInTheDocument();

    const noPurchaseTab = screen.getByRole('button', { name: /No Purchase > 1 Month\s+0/i });
    expect(noPurchaseTab).toBeTruthy();
    fireEvent.click(noPurchaseTab);
    expect(await screen.findByText('No clients match this campaign')).toBeInTheDocument();

    const birthdayTab = screen.getByRole('button', { name: /Birthdays\s+1/i });
    fireEvent.click(birthdayTab);
    expect(await screen.findByText('Acme Parts')).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'SIM 1 — Globe' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SIM 2 — Smart' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Happy Birthday Maria'));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '16' } });
    fireEvent.click(screen.getByRole('button', { name: /Queue 1 Messages/i }));

    await waitFor(() => {
      expect(mockedQueueSmsCampaign).toHaveBeenCalledWith(
        [{ phone: '09171234567', message: expect.stringContaining('Happy Birthday Maria') }],
        16,
      );
    });
  });

  it('supports Master User custom message queueing and activity history', async () => {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    mockedFetchContacts.mockResolvedValue([sampleCustomer(month)]);
    mockedGetGatewayDevices.mockResolvedValue(sampleDevices as any);

    render(
      <ToastProvider>
        <SmsCampaignPreparationView currentUser={ownerUser} />
      </ToastProvider>,
    );

    expect(await screen.findByRole('button', { name: /Birthdays\s+1/i })).toBeInTheDocument();

    const logsTab = screen.getAllByRole('button').find(button => button.textContent?.includes('Logs'));
    expect(logsTab).toBeTruthy();
    fireEvent.click(logsTab!);

    expect(await screen.findByText('System Logs')).toBeInTheDocument();
    expect(screen.getByText(/Gateway devices loaded/i)).toBeInTheDocument();

    const historyTab = screen.getAllByRole('button').find(button => button.textContent?.includes('Activity History'));
    expect(historyTab).toBeTruthy();
    fireEvent.click(historyTab!);

    expect(await screen.findByText('Recent SMS Activity')).toBeInTheDocument();

    const customTab = screen.getAllByRole('button').find(button => button.textContent?.includes('Custom Message'));
    expect(customTab).toBeTruthy();
    fireEvent.click(customTab!);

    expect(await screen.findByText('Compose Custom Message')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Acme Parts')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

        const textarea = screen.getByPlaceholderText(/Write your custom SMS message here/i);
    fireEvent.change(textarea, { target: { value: 'Hello this is a custom blast' } });

    const manualInput = screen.getByPlaceholderText(/09171234567, 09181234567/i);
    fireEvent.change(manualInput, { target: { value: '09991234567, 09997654321 ' } });

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '16' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Queue 3 Messages/i })).not.toBeDisabled();
    });

    mockedQueueSmsCampaign.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /Queue 3 Messages/i }));

    await waitFor(() => {
      expect(mockedQueueSmsCampaign).toHaveBeenCalledWith(
        [
          { phone: '09171234567', message: 'Hello this is a custom blast' },
          { phone: '09991234567', message: 'Hello this is a custom blast' },
          { phone: '09997654321', message: 'Hello this is a custom blast' },
        ],
        16,
      );
    });
  });
});
