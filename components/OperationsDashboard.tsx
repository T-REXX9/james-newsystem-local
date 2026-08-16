import React from 'react';
import ActivityLogs from './Maintenance/Profile/ActivityLogs';

const OperationsDashboard: React.FC = () => (
  <div className="h-full min-h-0 bg-slate-50">
    <ActivityLogs title="Operations Dashboard" />
  </div>
);

export default OperationsDashboard;
