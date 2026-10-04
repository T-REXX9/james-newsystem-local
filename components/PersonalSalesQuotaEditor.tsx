import React, { useId, useState } from 'react';
import { updateOwnSalesQuota } from '../services/staffLocalApiService';
import { updateCachedSalesQuota } from '../services/localAuthService';

interface PersonalSalesQuotaEditorProps {
  quota: number;
}

const formatQuota = (value: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
}).format(value);

const PersonalSalesQuotaEditor: React.FC<PersonalSalesQuotaEditorProps> = ({ quota }) => {
  const inputId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(quota));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const openEditor = () => {
    setDraft(String(quota));
    setMessage('');
    setError('');
    setIsEditing(true);
  };

  const saveQuota = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 0 || value > 9999999999999.99) {
      setError('Enter a quota between 0 and 9,999,999,999,999.99.');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const savedQuota = await updateOwnSalesQuota(value);
      updateCachedSalesQuota(savedQuota);
      setIsEditing(false);
      setMessage('Quota saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your quota.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">My quota: <span className="tabular-nums">{formatQuota(quota)}</span></span>
        {!isEditing && (
          <button type="button" onClick={openEditor} className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800">
            Edit my quota
          </button>
        )}
        {message && <span role="status" className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{message}</span>}
      </div>
      {isEditing && (
        <form onSubmit={saveQuota} className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Monthly quota (PHP)</label>
            <input id={inputId} type="number" min="0" max="9999999999999.99" step="0.01" required value={draft} onChange={(event) => setDraft(event.target.value)} className="h-9 w-44 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-900" />
          </div>
          <button type="submit" disabled={isSaving} className="h-9 rounded-md bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60">{isSaving ? 'Saving…' : 'Save quota'}</button>
          <button type="button" disabled={isSaving} onClick={() => setIsEditing(false)} className="h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
};

export default PersonalSalesQuotaEditor;
