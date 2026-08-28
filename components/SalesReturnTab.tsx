import React from 'react';
import CustomerHistoryTab from './CustomerHistoryTab';
export default function SalesReturnTab({ contactId }: { contactId: string; currentUserId?: string }) {
  return <CustomerHistoryTab contactId={contactId} kind="returns" />;
}
