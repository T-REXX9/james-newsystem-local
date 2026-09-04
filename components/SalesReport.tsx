import React from 'react';
import { UserProfile } from '../types';
import SalesReportFilter from './SalesReportFilter';
import type { SalesReportRouteView } from '../utils/workflowNavigate';

interface SalesReportProps {
  currentUser?: UserProfile;
  initialView?: SalesReportRouteView;
}

const SalesReport: React.FC<SalesReportProps> = ({ currentUser, initialView }) => {
  return (
    <div className="flex h-full flex-col bg-[#f4f4f4]">
      <SalesReportFilter currentUser={currentUser} initialView={initialView} />
    </div>
  );
};

export default SalesReport;
