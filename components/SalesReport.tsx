import React from 'react';
import { UserProfile } from '../types';
import SalesReportFilter from './SalesReportFilter';

interface SalesReportProps {
  currentUser?: UserProfile;
}

const SalesReport: React.FC<SalesReportProps> = ({ currentUser }) => {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <SalesReportFilter currentUser={currentUser} />
    </div>
  );
};

export default SalesReport;
