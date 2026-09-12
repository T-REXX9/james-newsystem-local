import React from 'react';
import CustomerSalesReportChat from './CustomerSalesReportChat';
import { UserProfile } from '../types';

interface CallReportActivityPanelProps {
  contactId: string;
  currentUser: UserProfile | null;
  assignedAgentName?: string;
  compact?: boolean;
}

/** @deprecated Prefer CustomerSalesReportChat. Kept as a thin wrapper for older call sites/tests. */
const CallReportActivityPanel: React.FC<CallReportActivityPanelProps> = ({
  contactId,
  currentUser,
  compact = false,
}) => (
  <CustomerSalesReportChat
    contactId={contactId}
    currentUser={currentUser}
    compact={compact}
  />
);

export default CallReportActivityPanel;
