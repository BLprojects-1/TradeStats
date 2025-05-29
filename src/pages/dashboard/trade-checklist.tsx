import React from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import TradeChecklist from '../../components/TradeChecklist';
import TrafficInfoModal from '../../components/TrafficInfoModal';

const TradeChecklistPage = () => {
  return (
    <DashboardLayout title="Trade Checklist">
      <div className="space-y-6">
        <TradeChecklist />
        <TrafficInfoModal />
      </div>
    </DashboardLayout>
  );
};

export default TradeChecklistPage; 