import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CallAutoReplySettingsView from '../CallAutoReplySettingsView';
import { fetchAutoReplyAudit, fetchAutoReplySettings, saveAutoReplySettings } from '../../services/callingSystemService';
import * as aiSalesAgentService from '../../services/aiSalesAgentService';

vi.mock('../../services/callingSystemService', () => ({
  fetchAutoReplyAudit: vi.fn(),
  fetchAutoReplySettings: vi.fn(),
  saveAutoReplySettings: vi.fn(),
}));

vi.mock('../../services/aiSalesAgentService', () => ({
  getMessageTemplates: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }));
vi.mock('../ToastProvider', () => ({
  useToast: () => toastMock,
}));

const mockedFetchAutoReplyAudit = vi.mocked(fetchAutoReplyAudit);
const mockedFetchAutoReplySettings = vi.mocked(fetchAutoReplySettings);
const mockedSaveAutoReplySettings = vi.mocked(saveAutoReplySettings);
const mockedGetMessageTemplates = vi.mocked(aiSalesAgentService.getMessageTemplates);

const masterUser = { id: '1', user_type: '1', role: 'Master User' } as any;
const staffUser = { id: '2', user_type: '2', role: 'Sales Agent' } as any;

describe('CallAutoReplySettingsView', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockedFetchAutoReplySettings.mockResolvedValue(null);
    mockedFetchAutoReplyAudit.mockResolvedValue([]);
    mockedGetMessageTemplates.mockResolvedValue([
      {
        id: 'template-1',
        name: 'We missed your call',
        content: 'We missed your call and will contact you shortly.',
        language: 'english',
        template_type: 'no_purchase',
        variables: [],
        is_active: true,
      } as any,
    ]);
    mockedSaveAutoReplySettings.mockResolvedValue({
      lis_active: 1,
      ltemplate_id: 'template-1',
      lcooldown_minutes: 120,
    });
  });

  it('shows settings and audit controls for the Master User', async () => {
    render(<CallAutoReplySettingsView currentUser={masterUser} />);

    expect(await screen.findByRole('heading', { name: 'Missed-Call Replies' })).toBeInTheDocument();
    expect(screen.getByText('We missed your call')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /enable automatic replies/i })).toBeInTheDocument();
    expect(screen.getByText('No automatic replies have been queued.')).toBeInTheDocument();
  });

  it('saves the selected template, enabled state, and cooldown', async () => {
    render(<CallAutoReplySettingsView currentUser={masterUser} />);
    await screen.findByText('We missed your call');
    const templateSelect = screen.getByRole('combobox');
    expect(templateSelect).toHaveValue('template-1');
    await waitFor(() => expect(screen.getByRole('button', { name: /save rule/i })).not.toBeDisabled());

    const user = userEvent.setup();
    const checkbox = screen.getByRole('checkbox', { name: /enable automatic replies/i });
    await user.click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked());
    const cooldownInput = screen.getByLabelText('Cooldown (minutes)');
    await user.clear(cooldownInput);
    await user.type(cooldownInput, '120');
    await waitFor(() => expect(cooldownInput).toHaveValue(120));
    await user.click(screen.getByRole('button', { name: /save rule/i }));

    await waitFor(() => expect(mockedSaveAutoReplySettings).toHaveBeenCalledWith({
      isActive: true,
      templateId: 'template-1',
      cooldownMinutes: 120,
    }));
  });

  it('blocks regular staff from the settings page', () => {
    render(<CallAutoReplySettingsView currentUser={staffUser} />);

    expect(screen.getByRole('heading', { name: 'Master User access required' })).toBeInTheDocument();
    expect(mockedFetchAutoReplySettings).not.toHaveBeenCalled();
  });
});
