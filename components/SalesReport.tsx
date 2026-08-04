import React from 'react';
import { UserProfile } from '../types';
import SalesReportFilter from './SalesReportFilter';

interface SalesReportProps {
  currentUser?: UserProfile;
}

const SalesReport: React.FC<SalesReportProps> = ({ currentUser }) => {
  return (
    <div className="flex h-full flex-col bg-[#f4f4f4]">
      <SalesReportFilter currentUser={currentUser} />
    </div>
  );
};

export default SalesReport;
