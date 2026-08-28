import React, { useEffect, useState } from 'react';
import { CustomerHistoryRecord, fetchCustomerInquiries, fetchCustomerReturns } from '../services/customerWorkflowLocalApiService';

export default function CustomerHistoryTab({ contactId, kind }: { contactId: string; kind: 'inquiries' | 'returns' }) {
  const [rows, setRows] = useState<CustomerHistoryRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRows([]);
    const load = kind === 'returns' ? fetchCustomerReturns : fetchCustomerInquiries;
    load(contactId).then(data => { if (active) setRows(data); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load customer history'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [contactId, kind, refresh]);
  return <section className="space-y-4 p-6">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-bold">{kind === 'returns' ? 'Sales Returns' : 'Sales Inquiries'}</h3>
      <button type="button" onClick={() => setRefresh(n => n + 1)} disabled={loading} className="rounded border px-3 py-1">Refresh</button>
    </div>
    {kind === 'returns' && <p className="text-sm text-slate-500">These are local sales-return credit records. Review and post returns in <a className="text-blue-600 underline" href="#/accounting-transactions-sales-return-credit">Accounting → Sales Return Credit</a>.</p>}
    {error ? <p role="alert" className="text-red-600">{error}</p> : loading ? <p role="status">Loading customer history…</p> : rows.length === 0 ? <p>No {kind === 'returns' ? 'sales returns' : 'sales inquiries'} for this customer.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr>{['Document', 'Date', 'Status', 'Amount', 'Notes'].map(label => <th key={label} className="border-b p-2">{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}><td className="p-2 font-medium">{row.number}</td><td className="p-2">{row.date || '—'}</td><td className="p-2">{row.status}</td><td className="p-2">{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(row.amount)}</td><td className="p-2">{row.notes || '—'}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}
