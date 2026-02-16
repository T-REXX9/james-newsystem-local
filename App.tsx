








import React, { useState, useEffect } from 'react';
import TopNav from './components/TopNav';
import PipelineView from './components/PipelineView';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import StaffView from './components/StaffView';
import DailyCallMonitoringView from './components/DailyCallMonitoringView';
import OwnerDailyCallMonitoringUnifiedView from './components/OwnerDailyCallMonitoringUnifiedView';
import ProductDatabase from './components/ProductDatabase';
import CustomerDatabase from './components/CustomerDatabase';
import ReorderReport from './components/ReorderReport';
import SalesInquiryView from './components/SalesInquiryView';
import SalesOrderView from './components/SalesOrderView';
import OrderSlipView from './components/OrderSlipView';
import InvoiceView from './components/InvoiceView';
import InquiryReportFilter from './components/InquiryReportFilter';
import SalesDevelopmentReport from './components/SalesDevelopmentReport';
import StockMovementView from './components/StockMovementView';
import TransferStockView from './components/TransferStockView';
import SalesReport from './components/SalesReport';
import FastSlowInventoryReport from './components/FastSlowInventoryReport';
import InventoryAuditReport from './components/InventoryAuditReport';
import InventoryReport from './components/InventoryReport';
import SuggestedStockReport from './components/SuggestedStockReport';

import AccessControlSettings from './components/AccessControlSettings';
import TasksView from './components/TasksView';
import SalespersonDashboardView from './components/SalespersonDashboardView';
import ManagementView from './components/ManagementView';
import RecycleBinView from './components/RecycleBinView';
import ReportsView from './components/ReportsView';
import PurchaseOrderView from './components/PurchaseOrderView';
import ReceivingStock from './components/ReceivingStock';
import PurchaseRequestModule from './components/PurchaseRequest';
import ReturnToSupplier from './components/ReturnToSupplier';
import SalesMap from './components/SalesMap';
import PromotionManagementView from './components/PromotionManagementView';
import PromotionListView from './components/PromotionListView';

// Maintenance Modules
import Suppliers from './components/Maintenance/Product/Suppliers';
import Categories from './components/Maintenance/Product/Categories';
import Couriers from './components/Maintenance/Product/Couriers';
import RemarkTemplates from './components/Maintenance/Product/RemarkTemplates';
import Teams from './components/Maintenance/Profile/Teams';
import Approvers from './components/Maintenance/Profile/Approvers';
import Staff from './components/Maintenance/Profile/Staff';
import CustomerGroups from './components/Maintenance/Customer/CustomerGroups';
import { CustomerData } from './components/Maintenance/Customer/CustomerData';
import { Pipeline } from './components/Maintenance/Customer/Pipeline';
import SpecialPrice from './components/Maintenance/Product/SpecialPrice';
import ActivityLogs from './components/Maintenance/Profile/ActivityLogs';

// AI Customer Service Components
import AIDashboardView from './components/AIDashboardView';
import AIStandardAnswersView from './components/AIStandardAnswersView';
import AIEscalationPanel from './components/AIEscalationPanel';

// System Enhancement Components
import LoyaltyDiscountRulesView from './components/LoyaltyDiscountRulesView';
import ProfitThresholdSettings from './components/ProfitThresholdSettings';
import AIMessageTemplatesView from './components/AIMessageTemplatesView';

import { supabase } from './lib/supabaseClient';
import { logAuth } from './services/activityLogService';
import { UserProfile } from './types';
import { Filter, Lock } from 'lucide-react';
import { ToastProvider } from './components/ToastProvider';
import { NotificationProvider } from './components/NotificationProvider';
import CustomLoadingSpinner from './components/CustomLoadingSpinner';
import { AVAILABLE_APP_MODULES, DEFAULT_STAFF_ACCESS_RIGHTS, MODULE_ID_ALIASES } from './constants';

const CANONICAL_TO_ALIASES: Record<string, string[]> = Object.entries(MODULE_ID_ALIASES).reduce(
  (acc, [alias, canonical]) => {
    if (!acc[canonical]) acc[canonical] = [];
    acc[canonical].push(alias);
    return acc;
  },
  {} as Record<string, string[]>
);

const normalizeModuleId = (moduleId: string): string => MODULE_ID_ALIASES[moduleId] || moduleId;

const expandModuleIds = (canonicalId: string): string[] => {
  const aliases = CANONICAL_TO_ALIASES[canonicalId] || [];
  return [canonicalId, ...aliases];
};

const getModuleLabel = (moduleId: string): string => {
  const canonical = normalizeModuleId(moduleId);
  const match = AVAILABLE_APP_MODULES.find((m) => m.id === canonical);
  return match?.label || canonical;
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appLoading, setAppLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [moduleContext, setModuleContext] = useState<Record<string, Record<string, string>>>({});

  // 1. Auth Logic
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchUserProfile(session.user.id);
      else setAppLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        // Reset to dashboard on every login to prevent access issues when switching accounts
        setActiveTab('dashboard');
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setAppLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab: string; payload?: Record<string, string> }>;
      if (!customEvent.detail?.tab) return;
      setModuleContext((prev) => ({
        ...prev,
        [customEvent.detail.tab]: customEvent.detail.payload || {},
      }));
      setActiveTab(normalizeModuleId(customEvent.detail.tab));
    };

    window.addEventListener('workflow:navigate', handler as EventListener);
    return () => window.removeEventListener('workflow:navigate', handler as EventListener);
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const setFallbackProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = user.user_metadata?.role || 'Owner';
        const fallbackProfile = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name,
          avatar_url: user.user_metadata?.avatar_url,
          role,
          access_rights:
            user.user_metadata?.access_rights ||
            (role === 'Owner'
              ? ['*']
              : DEFAULT_STAFF_ACCESS_RIGHTS)
        };
        setUserProfile(fallbackProfile);
      } else {
        setUserProfile({
          id: userId,
          email: '',
          role: 'Unknown',
          access_rights: [],
        });
      }
    };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile', error);
        await setFallbackProfile();
        return;
      }

      if (data) {
        setUserProfile(data);
      } else {
        await setFallbackProfile();
      }
    } catch (e) {
      console.error('Error fetching profile', e);
      await setFallbackProfile();
    } finally {
      setAppLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logAuth('LOGOUT');
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
  };

  const handleSetActiveTab = (tab: string) => {
    setActiveTab(normalizeModuleId(tab));
  };

  // 2. Render Logic
  const renderComingSoon = (title: string) => (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
        <Filter className="w-10 h-10 text-slate-400 dark:text-slate-600 opacity-50" />
      </div>
      <h2 className="text-2xl font-bold text-slate-400 dark:text-slate-500">{title}</h2>
      <p className="text-slate-400 dark:text-slate-500 max-w-md">This module is currently under development.</p>
    </div>
  );

  const renderAccessDenied = () => (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-fadeIn">
      <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center">
        <Lock className="w-10 h-10 text-rose-400 dark:text-rose-500" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Access Denied</h2>
      <p className="text-slate-400 dark:text-slate-500 max-w-md">
        You do not have permission to view the <strong>{getModuleLabel(activeTab)}</strong> module.
        Please contact the administrator if you need access.
      </p>
      <button
        onClick={() => handleSetActiveTab('home')}
        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );

  // Permission Check Logic (supports legacy and canonical IDs)
  const checkPermission = (moduleId: string) => {
    if (!userProfile) return false;

    const canonical = normalizeModuleId(moduleId);

    // Special case: Recycle Bin only for Owner or Developer
    if (canonical === 'maintenance-profile-server-maintenance' || moduleId === 'recyclebin') {
      return userProfile.role === 'Owner' || userProfile.role === 'Developer';
    }

    if (userProfile.role === 'Owner') return true;

    const rights = userProfile.access_rights || [];

    if (rights.includes('*')) return true;

    // Sales Agents should always reach their home/dashboard even if access_rights is misconfigured.
    if (
      (canonical === 'home' || moduleId === 'dashboard') &&
      (userProfile.role === 'Sales Agent' || userProfile.role === 'sales_agent')
    ) {
      return true;
    }

    const idsToCheck = expandModuleIds(canonical);
    return idsToCheck.some((id) => rights.includes(id));
  };

  const renderContent = () => {
    const canonicalTab = normalizeModuleId(activeTab);

    // Special case for settings / access control
    if (canonicalTab === 'maintenance-profile-system-access' || activeTab === 'settings') {
      if (checkPermission(canonicalTab)) return <AccessControlSettings />;
      return renderAccessDenied();
    }

    if (!checkPermission(canonicalTab)) {
      return renderAccessDenied();
    }

    switch (canonicalTab) {
      // Role-based home/dashboard routing
      case 'home':
      case 'dashboard': {
        const isSalesAgent = userProfile?.role === 'Sales Agent' || userProfile?.role === 'sales_agent';

        return isSalesAgent ? (
          <div className="p-4 h-full overflow-y-auto bg-slate-100 dark:bg-slate-950">
            <DailyCallMonitoringView currentUser={userProfile} />
          </div>
        ) : (
          <OwnerDailyCallMonitoringUnifiedView currentUser={userProfile} />
        );
      }
      case 'pipelines':
      case 'sales-pipeline-board':
        return <PipelineView currentUser={userProfile} />;
      case 'staff':
      case 'maintenance-profile-staff':
        return <Staff />;
      case 'products':
      case 'warehouse-inventory-product-database':
        return (
          <div className="h-full overflow-y-auto">
            <ProductDatabase currentUser={userProfile} />
          </div>
        );
      case 'reorder':
      case 'warehouse-reports-reorder-report':
        return (
          <div className="h-full overflow-y-auto">
            <ReorderReport />
          </div>
        );
      case 'warehouse-inventory-stock-movement':
        return (
          <div className="h-full overflow-y-auto">
            <StockMovementView />
          </div>
        );
      case 'warehouse-inventory-transfer-stock':
        return (
          <div className="h-full overflow-y-auto">
            <TransferStockView />
          </div>
        );
      case 'warehouse-inventory-inventory-audit':
        return (
          <div className="h-full overflow-y-auto">
            <InventoryAuditReport />
          </div>
        );
      case 'warehouse-purchasing-purchase-request':
        return <PurchaseRequestModule />;
      case 'warehouse-purchasing-purchase-order':
        return (
          <div className="h-full overflow-y-auto">
            <PurchaseOrderView
              initialPOId={
                moduleContext['warehouse-purchasing-purchase-order']?.poId ||
                moduleContext.purchaseorder?.poId
              }
            />
          </div>
        );
      case 'warehouse-purchasing-receiving-stock':
        return (
          <div className="h-full overflow-y-auto">
            <ReceivingStock />
          </div>
        );
      case 'warehouse-purchasing-return-to-supplier':
        return (
          <div className="h-full overflow-y-auto">
            <ReturnToSupplier />
          </div>
        );
      case 'warehouse-reports-inventory-report':
        return (
          <div className="h-full overflow-y-auto">
            <InventoryReport />
          </div>
        );
      case 'warehouse-reports-item-suggested-for-stock-report':
        return (
          <div className="h-full overflow-y-auto">
            <SuggestedStockReport currentUser={userProfile} />
          </div>
        );
      case 'warehouse-reports-fast-slow-inventory-report':
        return (
          <div className="h-full overflow-y-auto">
            <FastSlowInventoryReport />
          </div>
        );
      case 'customers':
      case 'sales-database-customer-database':
        return (
          <div className="h-full overflow-y-auto">
            <CustomerDatabase />
          </div>
        );
      case 'salesinquiry':
      case 'sales-transaction-sales-inquiry':
        return (
          <div className="h-full overflow-y-auto">
            <SalesInquiryView
              initialContactId={
                moduleContext['sales-transaction-sales-inquiry']?.contactId ||
                moduleContext.salesinquiry?.contactId
              }
              initialPrefillToken={
                moduleContext['sales-transaction-sales-inquiry']?.prefillToken ||
                moduleContext.salesinquiry?.prefillToken
              }
            />
          </div>
        );
      case 'salesorder':
      case 'sales-transaction-sales-order':
        return (
          <div className="h-full overflow-y-auto">
            <SalesOrderView
              initialOrderId={
                moduleContext['sales-transaction-sales-order']?.orderId ||
                moduleContext.salesorder?.orderId
              }
            />
          </div>
        );
      case 'orderslip':
      case 'sales-transaction-order-slip':
        return (
          <div className="h-full overflow-y-auto">
            <OrderSlipView
              initialSlipId={
                moduleContext['sales-transaction-order-slip']?.orderSlipId ||
                moduleContext.orderslip?.orderSlipId
              }
            />
          </div>
        );
      case 'invoice':
      case 'sales-transaction-invoice':
        return (
          <div className="h-full overflow-y-auto">
            <InvoiceView
              initialInvoiceId={
                moduleContext['sales-transaction-invoice']?.invoiceId ||
                moduleContext.invoice?.invoiceId
              }
            />
          </div>
        );
      case 'sales-transaction-product-promotions':
        // Owner sees management dashboard, others see list view
        const isOwner = userProfile?.role === 'Owner';
        return (
          <div className="h-full overflow-y-auto">
            {isOwner ? (
              <PromotionManagementView currentUser={userProfile} />
            ) : (
              <PromotionListView currentUser={userProfile} />
            )}
          </div>
        );
      case 'management':
      case 'sales-performance-management-dashboard':
        return (
          <div className="h-full overflow-y-auto">
            <ManagementView currentUser={userProfile} />
          </div>
        );
      case 'sales-reports-inquiry-report':
        return (
          <div className="h-full overflow-y-auto">
            <InquiryReportFilter />
          </div>
        );
      case 'sales-reports-sales-report':
        return (
          <div className="h-full overflow-y-auto">
            <SalesReport currentUser={userProfile} />
          </div>
        );
      case 'sales-reports-sales-development-report':
        return (
          <div className="h-full overflow-y-auto">
            <SalesDevelopmentReport currentUser={userProfile} />
          </div>
        );
      case 'sales-reports-sales-map':
        return (
          <div className="h-full overflow-y-auto">
            <SalesMap />
          </div>
        );
      case 'accounting-reports-accounting-overview':
        return (
          <div className="h-full overflow-y-auto">
            <ReportsView />
          </div>
        );
      case 'accounting-reports-aging-report':
        return renderComingSoon('Aging Report');
      case 'accounting-reports-collection-report':
        return renderComingSoon('Collection Report');
      case 'accounting-reports-sales-return-report':
        return renderComingSoon('Sales Return Report');
      case 'accounting-reports-freight-charges-report':
        return renderComingSoon('Freight Charges Report');
      case 'accounting-reports-accounts-receivable-report':
        return renderComingSoon('Accounts Receivable Report');
      case 'accounting-reports-purchase-history':
        return renderComingSoon('Purchase History');
      case 'accounting-reports-inactive-active-customers':
        return renderComingSoon('Inactive/Active Customers');
      case 'accounting-reports-old-new-customers':
        return renderComingSoon('Old/New Customers');

      case 'sales-transaction-daily-call-monitoring': {
        const isSalesAgent = userProfile?.role === 'Sales Agent' || userProfile?.role === 'sales_agent';
        return isSalesAgent ? (
          <DailyCallMonitoringView currentUser={userProfile} />
        ) : (
          <OwnerDailyCallMonitoringUnifiedView currentUser={userProfile} />
        );
      }
      case 'accounting-transactions-freight-charges-debit':
        return renderComingSoon('Freight Charges (Debit)');
      case 'accounting-transactions-sales-return-credit':
        return renderComingSoon('Sales Return (Credit)');
      case 'accounting-transactions-adjustment-entry':
        return renderComingSoon('Adjustment Entry');
      case 'accounting-transactions-daily-collection-entry':
        return renderComingSoon('Daily Collection Entry');
      case 'accounting-accounting-customer-ledger':
        return renderComingSoon('Customer Ledger');
      case 'accounting-accounting-collection-summary':
        return renderComingSoon('Collection Summary');
      case 'accounting-accounting-statement-of-account':
        return renderComingSoon('Statement of Account');
      case 'accounting-accounting-accounts-receivable':
        return renderComingSoon('Accounts Receivable');
      case 'maintenance-customer-customer-data':
        return (
          <div className="h-full overflow-y-auto">
            <CustomerData />
          </div>
        );

      case 'maintenance-customer-customer-group':
        return <CustomerGroups />;
      case 'maintenance-customer-pipeline':
        return <Pipeline />;
      case 'maintenance-product-suppliers':
        return <Suppliers />;
      case 'maintenance-product-special-price':
        return <SpecialPrice />;
      case 'maintenance-product-category-management':
        return <Categories />;
      case 'maintenance-product-courier-management':
        return <Couriers />;
      case 'maintenance-product-remark-templates':
        return <RemarkTemplates />;
      case 'maintenance-profile-team':
        return (
          <div className="h-full overflow-y-auto">
            <Teams />
          </div>
        );
      case 'maintenance-profile-approver':
        return <Approvers />;
      case 'maintenance-profile-activity-logs':
        return <ActivityLogs />;
      case 'recyclebin':
      case 'maintenance-profile-server-maintenance':
        return (
          <div className="h-full overflow-y-auto">
            <RecycleBinView />
          </div>
        );
      case 'maintenance-profile-system-access':
        return <AccessControlSettings />;
      case 'maintenance-system-loyalty-discounts':
        return <LoyaltyDiscountRulesView currentUser={userProfile} />;
      case 'maintenance-system-profit-protection':
        return <ProfitThresholdSettings currentUser={userProfile} />;
      case 'maintenance-system-ai-templates':
        return <AIMessageTemplatesView currentUser={userProfile} />;
      case 'mail':
      case 'communication-messaging-inbox':
        return renderComingSoon('Inbox');
      case 'communication-text-menu-text-messages':
        return renderComingSoon('Text Messages');
      case 'communication-text-menu-inbox':
        return renderComingSoon('Inbox');
      case 'communication-text-menu-sent':
        return renderComingSoon('Sent');
      case 'communication-text-menu-pending':
        return renderComingSoon('Pending');
      case 'communication-text-menu-failed':
        return renderComingSoon('Failed');
      case 'communication-text-menu-operator':
        return renderComingSoon('Operator');
      case 'calendar':
      case 'communication-productivity-calendar':
        return renderComingSoon('Calendar');
      case 'calls':
      case 'communication-productivity-daily-call-monitoring': {
        const isSalesAgent = userProfile?.role === 'Sales Agent' || userProfile?.role === 'sales_agent';
        return isSalesAgent ? (
          <DailyCallMonitoringView currentUser={userProfile} />
        ) : (
          <OwnerDailyCallMonitoringUnifiedView currentUser={userProfile} />
        );
      }
      case 'tasks':
      case 'communication-productivity-tasks':
        return <TasksView currentUser={userProfile} />;

      // AI Customer Service Routes
      case 'ai-service-dashboard':
        return (
          <div className="h-full overflow-y-auto">
            <AIDashboardView currentUser={userProfile} />
          </div>
        );
      case 'ai-service-standard-answers':
        return (
          <div className="h-full overflow-y-auto">
            <AIStandardAnswersView currentUser={userProfile} />
          </div>
        );
      case 'ai-service-escalations':
        return (
          <div className="h-full overflow-y-auto">
            <AIEscalationPanel currentUser={userProfile} />
          </div>
        );

      default:
        return renderComingSoon(getModuleLabel(canonicalTab));
    }
  };

  return (
    <ToastProvider>
      {session && userProfile && (
        <NotificationProvider userId={userProfile.id}>
          <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 flex flex-col">
            <TopNav
              activeTab={activeTab}
              onNavigate={handleSetActiveTab}
              user={userProfile}
              onSignOut={handleSignOut}
            />

            <div className="flex flex-1 overflow-hidden pt-16">
              <main className="flex-1 overflow-hidden flex flex-col relative bg-slate-100 dark:bg-slate-950">
                {renderContent()}
              </main>
            </div>
          </div>
        </NotificationProvider>
      )}
      {/* Show loading spinner when app is loading OR when session exists but profile is still being fetched */}
      {(appLoading || (session && !userProfile)) && (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
          <CustomLoadingSpinner label="Loading application" />
        </div>
      )}
      {!session && !appLoading && <Login />}
    </ToastProvider>
  );
};

export default App;
