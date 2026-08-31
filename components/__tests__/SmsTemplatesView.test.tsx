import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { SmsTemplatesView } from '../SmsTemplatesView';
import { ToastProvider } from '../ToastProvider';
import * as aiSalesAgentService from '../../services/aiSalesAgentService';

vi.mock('../../services/aiSalesAgentService', () => ({
  getMessageTemplates: vi.fn(),
  createMessageTemplate: vi.fn(),
  updateMessageTemplate: vi.fn(),
  deleteMessageTemplate: vi.fn(),
}));

const mockedGetMessageTemplates = vi.mocked(aiSalesAgentService.getMessageTemplates);
const mockedCreateMessageTemplate = vi.mocked(aiSalesAgentService.createMessageTemplate);

const ownerUser = { id: '1', user_type: '1', role: 'Company Owner' } as any;

describe('SmsTemplatesView', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetMessageTemplates.mockResolvedValue([]);
    mockedCreateMessageTemplate.mockResolvedValue(undefined);
  });

  it('renders safely when no templates exist', async () => {
    render(
      <ToastProvider>
        <SmsTemplatesView currentUser={ownerUser} />
      </ToastProvider>,
    );

    expect(await screen.findByText('SMS Templates')).toBeInTheDocument();
    expect(screen.getByText('No templates found.')).toBeInTheDocument();
  });

  it('allows creating a new template for the more-than-three-month campaign', async () => {
    render(
      <ToastProvider>
        <SmsTemplatesView currentUser={ownerUser} />
      </ToastProvider>,
    );

    expect(await screen.findByText('SMS Templates')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /New Template/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Birthday Promo 2026'), { target: { value: 'Three Plus Re-engagement' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'no_purchase_3_plus' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter the SMS message content/i), { target: { value: 'Hello {name}, we would love to serve you again.' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));

    await waitFor(() => {
      expect(mockedCreateMessageTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Three Plus Re-engagement',
          content: 'Hello {name}, we would love to serve you again.',
          template_type: 'no_purchase_3_plus',
        }),
      );
    });
  });

  it('allows creating a new template', async () => {
    render(
      <ToastProvider>
        <SmsTemplatesView currentUser={ownerUser} />
      </ToastProvider>,
    );

    expect(await screen.findByText('SMS Templates')).toBeInTheDocument();

    const newBtn = screen.getByRole('button', { name: /New Template/i });
    fireEvent.click(newBtn);

    expect(screen.getByText('New SMS Template')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('e.g., Birthday Promo 2026');
    fireEvent.change(nameInput, { target: { value: 'My Test Template' } });

    const contentInput = screen.getByPlaceholderText(/Enter the SMS message content/i);
    fireEvent.change(contentInput, { target: { value: 'Hello {name}, this is a test' } });

    const saveBtn = screen.getByRole('button', { name: /Save Template/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockedCreateMessageTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Test Template',
          content: 'Hello {name}, this is a test',
          template_type: 'birthday',
        })
      );
    });
  });
});
