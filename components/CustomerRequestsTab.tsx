import React, { useEffect, useState } from 'react';
import { CustomerRequest, fetchCustomerRequests, reviewCustomerRequest } from '../services/customerWorkflowLocalApiService';
import { UserProfile } from '../types';
import { isCompanyOwnerRole } from '../constants';

export default function CustomerRequestsTab({ contactId, currentUser }: { contactId: string; currentUser: UserProfile | null }) {
  const [rows, setRows] = useState<CustomerRequest[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const owner = isCompanyOwnerRole(currentUser?.role);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRows([]);
    fetchCustomerRequests(contactId).then(data => { if (active) setRows(data); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load requests'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [contactId, refresh]);
  const review = async (row: CustomerRequest, decision: 'approved' | 'rejected') => {
    setBusy(row.id); setError('');
    try {
      await reviewCustomerRequest(contactId, row.id, decision, notes[row.id] || '');
      setRefresh(n => n + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Review failed'); }
    finally { setBusy(''); }
  };
  return <section className="space-y-4 p-5">
    <div className="flex justify-between"><h3 className="font-bold">Customer Requests</h3><button type="button" disabled={loading || !!busy} onClick={() => setRefresh(n => n + 1)} className="rounded border px-3 py-1">Refresh</button></div>
    <p className="text-sm text-slate-500">Customer edits apply only after owner approval. Discount approval records authorization; it does not automatically change prices on existing sales documents.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {loading ? <p role="status">Loading requests…</p> : !rows.length && !error ? <p>No customer requests.</p> : rows.map(row => <article key={row.id} className="space-y-3 rounded border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex justify-between gap-3"><strong>{row.kind === 'discount' ? 'Discount request' : 'Customer update'}</strong><span>{row.status}</span></div>
      <p className="text-xs text-slate-500">{row.submitted_by_name} · {row.submitted_at}</p>
      <dl className="space-y-1 text-sm">{Object.entries(row.payload).map(([key, value]) => <div key={key}><dt className="inline font-semibold">{key.replaceAll('_', ' ')}: </dt><dd className="inline whitespace-pre-wrap break-words">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '')}</dd></div>)}</dl>
      {row.review_note && <p className="text-sm">Review note: {row.review_note}</p>}
      {owner && row.status === 'pending' && <div className="space-y-2">
        <label className="block text-sm">Review note<input maxLength={2000} value={notes[row.id] || ''} onChange={e => setNotes(old => ({ ...old, [row.id]: e.target.value }))} className="ml-2 rounded border bg-transparent p-1" /></label>
        <button type="button" disabled={!!busy} onClick={() => void review(row, 'approved')} className="mr-3 rounded bg-emerald-600 px-3 py-2 text-white">Approve</button>
        <button type="button" disabled={!!busy} onClick={() => void review(row, 'rejected')} className="rounded border px-3 py-2">Reject</button>
      </div>}
    </article>)}
  </section>;
}
