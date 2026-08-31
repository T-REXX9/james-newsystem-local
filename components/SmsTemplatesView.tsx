import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Search, Edit2, Trash2, X, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { UserProfile, AIMessageTemplate, CreateAIMessageTemplateDTO } from '../types';
import * as aiSalesAgentService from '../services/aiSalesAgentService';
import { useToast } from './ToastProvider';

interface Props {
  currentUser: UserProfile | null;
}

const SMS_CAMPAIGN_TYPES = [
  'birthday',
  'no_purchase_1_month',
  'no_purchase_2_months',
  'no_purchase_3_plus',
  'vip_reengage',
  'prospective'
];

export const SmsTemplatesView: React.FC<Props> = ({ currentUser }) => {
  const [templates, setTemplates] = useState<AIMessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AIMessageTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { addToast } = useToast();

  const [form, setForm] = useState<CreateAIMessageTemplateDTO>({
    name: '',
    language: 'english',
    template_type: 'birthday',
    content: '',
    variables: [],
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all templates and filter only the ones belonging to SMS campaigns
      const data = await aiSalesAgentService.getMessageTemplates();
      const smsTemplates = data.filter(t => SMS_CAMPAIGN_TYPES.includes(t.template_type));
      setTemplates(smsTemplates);
    } catch (error) {
      console.error('Failed to load SMS templates:', error);
      addToast({ type: 'error', message: 'Failed to load templates' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenModal = (template?: AIMessageTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setForm({
        name: template.name,
        language: template.language,
        template_type: template.template_type,
        content: template.content,
        variables: template.variables || [],
      });
    } else {
      setEditingTemplate(null);
      setForm({
        name: '',
        language: 'english',
        template_type: 'birthday',
        content: '',
        variables: [],
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim() || !form.template_type) {
      addToast({ type: 'warning', message: 'Name, Type, and Content are required' });
      return;
    }

    try {
      setSaving(true);
      if (editingTemplate) {
        await aiSalesAgentService.updateMessageTemplate(editingTemplate.id, form);
        addToast({ type: 'success', message: 'Template updated successfully' });
      } else {
        await aiSalesAgentService.createMessageTemplate(form);
        addToast({ type: 'success', message: 'Template created successfully' });
      }
      handleCloseModal();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
      addToast({ type: 'error', message: 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      setDeleting(id);
      await aiSalesAgentService.deleteMessageTemplate(id);
      addToast({ type: 'success', message: 'Template deleted' });
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      addToast({ type: 'error', message: 'Failed to delete template' });
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (template: AIMessageTemplate) => {
    try {
      await aiSalesAgentService.updateMessageTemplate(template.id, {
        is_active: !template.is_active
      });
      addToast({ type: 'success', message: `Template ${template.is_active ? 'disabled' : 'enabled'}` });
      loadData();
    } catch (error) {
      console.error('Toggle error:', error);
      addToast({ type: 'error', message: 'Failed to update template status' });
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex h-full flex-col bg-[#f5f7fa] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#315574]">SMS Templates</h1>
          <p className="text-sm text-slate-500">Manage templates for automated SMS Blasting campaigns.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded bg-[#1675bd] px-4 py-2 font-medium text-white hover:bg-[#125d98]"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      <div className="mb-4 flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-[#1675bd] focus:outline-none focus:ring-1 focus:ring-[#1675bd]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-slate-500">Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-slate-500">No templates found.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 font-medium text-slate-700 shadow-sm">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Campaign Type</th>
                <th className="px-4 py-3">Content</th>
                <th className="px-4 py-3 text-center">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTemplates.map(template => (
                <tr key={template.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-[#315574]">{template.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      {template.template_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-md truncate" title={template.content}>
                    {template.content}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`inline-flex ${template.is_active ? 'text-green-600' : 'text-slate-400'}`}
                    >
                      {template.is_active ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(template)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#1675bd]"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={deleting === template.id}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-[#315574]">
                {editingTemplate ? 'Edit SMS Template' : 'New SMS Template'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Template Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#1675bd] focus:outline-none focus:ring-1 focus:ring-[#1675bd]"
                  placeholder="e.g., Birthday Promo 2026"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Campaign Type</label>
                <select
                  value={form.template_type}
                  onChange={e => setForm({ ...form, template_type: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#1675bd] focus:outline-none focus:ring-1 focus:ring-[#1675bd]"
                >
                  <option value="birthday">Birthday</option>
                  <option value="no_purchase_1_month">No Purchase 1 Month</option>
                  <option value="no_purchase_2_months">No Purchase 2 Months</option>
                  <option value="no_purchase_3_plus">No Purchase &gt; 3 Months</option>
                  <option value="vip_reengage">VIP Re-engagement</option>
                  <option value="prospective">Prospective</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Message Content</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  className="w-full h-32 rounded border border-slate-300 px-3 py-2 text-sm resize-none focus:border-[#1675bd] focus:outline-none focus:ring-1 focus:ring-[#1675bd]"
                  placeholder="Enter the SMS message content. You can use {name} to insert the customer's name."
                />
                <p className="mt-1 text-xs text-slate-500">
                  Tip: Use <code className="bg-slate-100 px-1 py-0.5 rounded">{'{name}'}</code> to automatically insert the recipient's name.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-lg">
              <button
                onClick={handleCloseModal}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded bg-[#1675bd] px-4 py-2 text-sm font-medium text-white hover:bg-[#125d98] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmsTemplatesView;
