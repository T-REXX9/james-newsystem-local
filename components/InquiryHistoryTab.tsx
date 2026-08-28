import React from 'react';
import CustomerHistoryTab from './CustomerHistoryTab';
export default function InquiryHistoryTab({ contactId }: { contactId: string }) {
  return <CustomerHistoryTab contactId={contactId} kind="inquiries" />;
}
