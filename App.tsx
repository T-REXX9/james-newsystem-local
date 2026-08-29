








import React, { useState, useEffect } from 'react';
import { canRetraceWorkflowHistory, createWorkflowHistoryState, ensureWorkflowHistoryState, preserveCurrentHistoryState } from './utils/workflowHistory';
import TopNav from './components/TopNav';
import Login from './components/Login';
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
import StockAdjustmentView from './components/StockAdjustmentView';
import SalesReport from './components/SalesReport';
import FastSlowInventoryReport from './components/FastSlowInventoryReport';
import InventoryAuditReport from './components/InventoryAuditReport';
import InventoryReport from './components/InventoryReport';
import SuggestedStockReport from './components/SuggestedStockReport';
import IncidentItemsReport from './components/IncidentItemsReport';

import AccessControlSettings from './components/AccessControlSettings';
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
import DailyCollectionEntryView from './components/DailyCollectionEntryView';
import CustomerLedgerView from './components/CustomerLedgerView';
import AdjustmentEntryView from './components/AdjustmentEntryView';
import CollectionSummaryView from './components/CollectionSummaryView';
import StatementOfAccountView from './components/StatementOfAccountView';
import AccountsReceivableView from './components/AccountsReceivableView';
import FreightChargesDebitView from './components/FreightChargesDebitView';
import FreightChargesReportView from './components/FreightChargesReportView';
import SalesReturnReport from './components/SalesReturnReport';
import SalesReturnPage from './components/SalesReturnPage';
import PurchaseHistoryReportView from './components/PurchaseHistoryReportView';
import InactiveActiveCustomersReport from './components/InactiveActiveCustomersReport';
import OldNewCustomersReport from './components/OldNewCustomersReport';

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
import VipThresholdSettings from './components/Maintenance/Customer/VipThresholdSettings';
import SpecialPrice from './components/Maintenance/Product/SpecialPrice';
import ActivityLogs from './components/Maintenance/Profile/ActivityLogs';
import OperationsDashboard from './components/OperationsDashboard';

// System Enhancement Components
import LoyaltyDiscountRulesView from './components/LoyaltyDiscountRulesView';
import ProfitThresholdSettings from './components/ProfitThresholdSettings';
import AIMessageTemplatesView from './components/AIMessageTemplatesView';
import SmsCampaignPreparationView from './components/SmsCampaignPreparationView';
import SmsTemplatesView from './components/SmsTemplatesView';
import CallAutoReplySettingsView from './components/CallAutoReplySettingsView';

import { logAuth } from './services/activityLogService';
import { UserProfile } from './types';
import { Filter, Lock } from 'lucide-react';
import { ToastProvider } from './components/ToastProvider';
import { NotificationProvider } from './components/NotificationProvider';
import CustomLoadingSpinner from './components/CustomLoadingSpinner';
import { AVAILABLE_APP_MODULES, isCompanyOwnerRole, MODULE_ID_ALIASES, ROLE_NAMES } from './constants';
import {
  getLocalAuthSession,
  LocalAuthSession,
  localAuthChangedEventName,
  logoutFromLocalApi,
  restoreLocalAuthSession,
} from './services/localAuthService';

const CANONICAL_TO_ALIASES: Record<string, string[]> = Object.entries(MODULE_ID_ALIASES).reduce(
  (acc, [alias, canonical]) => {
    if (!acc[canonical]) acc[canonical] = [];
    acc[canonical].push(alias);
    return acc;
  },
  {} as Record<string, string[]>
);

const normalizeModuleId = (moduleId: string): string => MODULE_ID_ALIASES[moduleId] || moduleId;

const DEFAULT_ACTIVE_TAB = 'dashboard';

const getRouteStateFromLocation = (): { tab: string; payload?: Record<string, string> } => {
  if (typeof window === 'undefined') {
    return { tab: DEFAULT_ACTIVE_TAB };
  }

  const rawHash = window.location.hash.replace(/^#\/?/, '');
  if (!rawHash) {
    return { tab: DEFAULT_ACTIVE_TAB };
  }

  const [rawTab, rawQuery = ''] = rawHash.split('?');
  const tab = normalizeModuleId(rawTab || DEFAULT_ACTIVE_TAB);
  const params = new URLSearchParams(rawQuery);
  const payload = Object.fromEntries(params.entries());

  return Object.keys(payload).length > 0 ? { tab, payload } : { tab };
};

const writeRouteStateToLocation = (
  tab: string,
  payload?: Record<string, string>,
  mode: 'push' | 'replace' = 'replace'
) => {
  if (typeof window === 'undefined') return;

  const canonicalTab = normalizeModuleId(tab || DEFAULT_ACTIVE_TAB);
  const params = new URLSearchParams(payload || {});
  const nextHash = params.toString() ? `#/${canonicalTab}?${params.toString()}` : `#/${canonicalTab}`;

  if (window.location.hash === nextHash) {
    return;
  }

  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (mode === 'push') {
    window.history.pushState(createWorkflowHistoryState(window.location.hash), '', nextUrl);
  } else {
    window.history.replaceState(preserveCurrentHistoryState(), '', nextUrl);
  }
};

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
  const initialRouteState = getRouteStateFromLocation();
  const initialStoredSession = getLocalAuthSession();
  const [session, setSession] = useState<any>(() => initialStoredSession ? {
    token: initialStoredSession.token,
    user: { id: initialStoredSession.userProfile.id },
  } : null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => initialStoredSession?.userProfile || null);
  // A cached session is only a candidate until /auth/me validates it. Keep
  // authenticated providers unmounted so stale tokens cannot trigger a burst
  // of notification and chat requests during startup.
  const [appLoading, setAppLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(initialRouteState.tab);
  const [canNavigateBack, setCanNavigateBack] = useState(false);
  const [moduleContext, setModuleContext] = useState<Record<string, Record<string, string>>>(
    initialRouteState.payload ? { [initialRouteState.tab]: initialRouteState.payload } : {}
  );

  const applyLocalAuthSession = (authSession: LocalAuthSession | null) => {
    if (!authSession) {
      setSession(null);
      setUserProfile(null);
      return;
    }

    setSession({
      token: authSession.token,
      user: { id: authSession.userProfile.id },
    });
    setUserProfile(authSession.userProfile);
  };

  // 1. Auth Logic
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const restored = await restoreLocalAuthSession();
        if (!mounted) return;
        applyLocalAuthSession(restored);
        if (restored) {
          const routeState = getRouteStateFromLocation();
          writeRouteStateToLocation(routeState.tab, routeState.payload, 'replace');
        }
      } catch (error) {
        console.error('Error restoring local auth session:', error);
        if (mounted) applyLocalAuthSession(null);
      } finally {
        if (mounted) setAppLoading(false);
      }
    };

    const handler = (event: Event) => {
      const custom = event as CustomEvent<LocalAuthSession | null>;
      applyLocalAuthSession(custom.detail || null);
      const routeState = getRouteStateFromLocation();
      setActiveTab(routeState.tab);
      setModuleContext(routeState.payload ? { [routeState.tab]: routeState.payload } : {});
      writeRouteStateToLocation(routeState.tab, routeState.payload, 'replace');
      setAppLoading(false);
    };

    bootstrap();
    window.addEventListener(localAuthChangedEventName, handler as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener(localAuthChangedEventName, handler as EventListener);
    };
  }, []);

  useEffect(() => {
    ensureWorkflowHistoryState();
    setCanNavigateBack(canRetraceWorkflowHistory());
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab: string; payload?: Record<string, string> }>;
      if (!customEvent.detail?.tab) return;
      const canonicalTab = normalizeModuleId(customEvent.detail.tab);
      setModuleContext((prev) => ({
        ...prev,
        [canonicalTab]: customEvent.detail.payload || {},
        [customEvent.detail.tab]: customEvent.detail.payload || {},
      }));
      setActiveTab(canonicalTab);
      writeRouteStateToLocation(canonicalTab, customEvent.detail.payload, 'push');
      setCanNavigateBack(canRetraceWorkflowHistory());
    };

    window.addEventListener('workflow:navigate', handler as EventListener);
    return () => window.removeEventListener('workflow:navigate', handler as EventListener);
  }, []);

  useEffect(() => {
    const syncFromLocation = () => {
      const routeState = getRouteStateFromLocation();
      setActiveTab(routeState.tab);
      setModuleContext((prev) => ({
        ...prev,
        [routeState.tab]: routeState.payload || {},
      }));
      setCanNavigateBack(canRetraceWorkflowHistory());
    };

    window.addEventListener('hashchange', syncFromLocation);
    window.addEventListener('popstate', syncFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncFromLocation);
      window.removeEventListener('popstate', syncFromLocation);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await logAuth('LOGOUT');
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
    await logoutFromLocalApi();
  };

  const handleSetActiveTab = (tab: string) => {
    const canonicalTab = normalizeModuleId(tab);
    setModuleContext((prev) => ({ ...prev, [canonicalTab]: {} }));
    setActiveTab(canonicalTab);
    writeRouteStateToLocation(canonicalTab, undefined, 'push');
    setCanNavigateBack(canRetraceWorkflowHistory());
  };

  const handleNavigateBack = () => {
    if (!canRetraceWorkflowHistory()) return;
    window.history.back();
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

  // Permission Check Logic: role-first, then explicit overrides (supports legacy and canonical IDs)
  const checkPermission = (moduleId: string) => {
    if (!userProfile) return false;

    const canonical = normalizeModuleId(moduleId);

    // Special case: Recycle Bin only for owner-level accounts
    if (canonical === 'maintenance-profile-server-maintenance' || moduleId === 'recyclebin') {
      return isCompanyOwnerRole(userProfile.role);
    }

    // Step 1: Check if the user's role grants access
    if (isCompanyOwnerRole(userProfile.role)) return true;

    const rights = userProfile.access_rights || [];
    const hasExplicitRights = rights.length > 0;

    if (hasExplicitRights && rights.includes('*')) return true;

    // Sales Agents should always reach their home/dashboard even if access_rights is misconfigured.
    if (
      (canonical === 'home' || moduleId === 'dashboard') &&
      (userProfile.role === ROLE_NAMES.SALES_AGENT || userProfile.role === 'sales_agent')
    ) {
      return true;
    }

    if (!hasExplicitRights) {
      return false;
    }

    // Step 2: Check if the user has explicit access via access_rights (role-based or overridden)
    const idsToCheck = expandModuleIds(canonical);
    return idsToCheck.some((id) => rights.includes(id));
  };

  /**
   * Check if the user can perform a specific action (add/edit/delete) on a module.
   * Returns true if the action is allowed, false otherwise.
   * Owner role always has full action permissions.
   */
  const checkActionPermission = (moduleId: string, action: 'can_add' | 'can_edit' | 'can_delete'): boolean => {
    if (!userProfile) return false;
    if (isCompanyOwnerRole(userProfile.role)) return true;

    const canonical = normalizeModuleId(moduleId);
    const actionPerms = userProfile.action_permissions;
    if (!actionPerms) return true; // If no action permissions defined, allow by default

    const modulePerms = actionPerms[canonical];
    if (!modulePerms) return true; // If no specific module action perms, allow by default

    return modulePerms[action] ?? true;
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
        const isSalesAgent = userProfile?.role === ROLE_NAMES.SALES_AGENT || userProfile?.role === 'sales_agent';

        return isSalesAgent ? (
          <div className="p-4 h-full overflow-y-auto bg-slate-100 dark:bg-slate-950">
            <DailyCallMonitoringView currentUser={userProfile} />
          </div>
        ) : (
          <OwnerDailyCallMonitoringUnifiedView currentUser={userProfile} />
        );
      }
      case 'staff':
      case 'maintenance-profile-staff':
        return <Staff />;
      case 'products':
      case 'warehouse-inventory-product-database':
        return (
          <div className="h-full overflow-y-auto">
            <ProductDatabase
              currentUser={userProfile}
              initialProductId={
                moduleContext['warehouse-inventory-product-database']?.productId ||
                moduleContext.products?.productId
              }
              initialCreate={
                (moduleContext['warehouse-inventory-product-database']?.create ||
                  moduleContext.products?.create) === '1'
              }
              initialPartNo={
                moduleContext['warehouse-inventory-product-database']?.partNo ||
                moduleContext.products?.partNo
              }
              initialDescription={
                moduleContext['warehouse-inventory-product-database']?.description ||
                moduleContext.products?.description
              }
            />
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
          <div className="flex h-full items-center justify-center bg-slate-100 p-6">
            <div className="max-w-xl rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Transfer Product Disabled</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The new system uses one centralized quantity per item code, so warehouse-to-warehouse product transfers are no longer required.
              </p>
            </div>
          </div>
        );
      case 'warehouse-inventory-stock-adjustment':
        return (
          <div className="h-full overflow-y-auto">
            <StockAdjustmentView
              initialAdjustmentId={
                moduleContext['warehouse-inventory-stock-adjustment']?.adjustmentId ||
                moduleContext.stockadjustment?.adjustmentId
              }
              initialAdjustmentNo={
                moduleContext['warehouse-inventory-stock-adjustment']?.adjustmentNo ||
                moduleContext.stockadjustment?.adjustmentNo
              }
            />
          </div>
        );
      case 'warehouse-inventory-inventory-audit':
        return (
          <div className="h-full overflow-y-auto">
            <InventoryAuditReport />
          </div>
        );
      case 'warehouse-purchasing-purchase-request':
        return (
          <PurchaseRequestModule
            initialPRId={
              moduleContext['warehouse-purchasing-purchase-request']?.prId ||
              moduleContext.purchaserequest?.prId
            }
          />
        );
      case 'warehouse-purchasing-purchase-order':
        return (
          <div className="h-full overflow-y-auto">
            <PurchaseOrderView
              initialPOId={
                moduleContext['warehouse-purchasing-purchase-order']?.poId ||
                moduleContext.purchaseorder?.poId
              }
              initialPORefNo={
                moduleContext['warehouse-purchasing-purchase-order']?.poRefNo ||
                moduleContext.purchaseorder?.poRefNo
              }
              initialPRId={
                moduleContext['warehouse-purchasing-purchase-order']?.prId ||
                moduleContext.purchaseorder?.prId
              }
            />
          </div>
        );
      case 'warehouse-purchasing-receiving-stock':
        return (
          <div className="h-full overflow-y-auto">
            <ReceivingStock
              initialRRId={
                moduleContext['warehouse-purchasing-receiving-stock']?.rrId ||
                moduleContext.receivingstock?.rrId
              }
              initialRRRefNo={
                moduleContext['warehouse-purchasing-receiving-stock']?.rrRefNo ||
                moduleContext.receivingstock?.rrRefNo
              }
            />
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
          <div className="h-full overflow-y-auto print:h-auto print:overflow-visible">
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
      case 'warehouse-reports-incident-items-report':
        return (
          <div className="h-full overflow-y-auto">
            <IncidentItemsReport />
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
      case 'sales-transaction-sales-inquiry': {
        const context = moduleContext['sales-transaction-sales-inquiry'] || moduleContext.salesinquiry || {};
        return (
          <div className="h-full overflow-y-auto">
            <SalesInquiryView
              initialFilterDay={context.dashboardDate ? String(Number(context.dashboardDate.slice(8, 10))) : undefined}
              initialFilterMonth={context.dashboardMonth}
              initialFilterYear={context.dashboardYear}
              initialDateFilterApplied={Boolean(context.dashboardMonth && context.dashboardYear)}
              initialContactId={
                moduleContext['sales-transaction-sales-inquiry']?.contactId ||
                moduleContext.salesinquiry?.contactId
              }
              initialInquiryId={
                moduleContext['sales-transaction-sales-inquiry']?.inquiryId ||
                moduleContext.salesinquiry?.inquiryId
              }
              initialPrefillToken={
                moduleContext['sales-transaction-sales-inquiry']?.prefillToken ||
                moduleContext.salesinquiry?.prefillToken
              }
            />
          </div>
        );
      }
      case 'salesorder':
      case 'sales-transaction-sales-order': {
        const context = moduleContext['sales-transaction-sales-order'] || moduleContext.salesorder || {};
        return (
          <div className="h-full overflow-y-auto">
            <SalesOrderView
              initialMonth={context.dashboardMonth}
              initialYear={context.dashboardYear}
              initialOrderId={
                moduleContext['sales-transaction-sales-order']?.orderId ||
                moduleContext.salesorder?.orderId
              }
            />
          </div>
        );
      }
      case 'orderslip':
      case 'sales-transaction-order-slip': {
        const context = moduleContext['sales-transaction-order-slip'] || moduleContext.orderslip || {};
        return (
          <div className="h-full overflow-y-auto">
            <OrderSlipView
              initialMonth={context.dashboardMonth}
              initialYear={context.dashboardYear}
              initialStatus={context.dashboardSlipStatus as 'all' | import('./types').OrderSlipStatus | undefined}
              initialSlipId={
                moduleContext['sales-transaction-order-slip']?.orderSlipId ||
                moduleContext.orderslip?.orderSlipId
              }
              initialSlipRefNo={
                moduleContext['sales-transaction-order-slip']?.orderSlipRefNo ||
                moduleContext.orderslip?.orderSlipRefNo
              }
            />
          </div>
        );
      }
      case 'invoice':
      case 'sales-transaction-invoice':
        return (
          <div className="h-full overflow-y-auto">
            <InvoiceView
              initialInvoiceId={
                moduleContext['sales-transaction-invoice']?.invoiceId ||
                moduleContext.invoice?.invoiceId
              }
              initialInvoiceRefNo={
                moduleContext['sales-transaction-invoice']?.invoiceRefNo ||
                moduleContext.invoice?.invoiceRefNo
              }
            />
          </div>
        );
      case 'communication-sms-blasting':
      case 'sales-transaction-marketing-campaigns':
        return <SmsCampaignPreparationView currentUser={userProfile} />;
      case 'sales-transaction-product-promotions':
        // Owner sees management dashboard, others see list view
        const isOwner = isCompanyOwnerRole(userProfile?.role);
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
        if (!isCompanyOwnerRole(userProfile?.role)) return renderAccessDenied();
        return (
          <div className="h-full overflow-y-auto">
            <ManagementView currentUser={userProfile} />
          </div>
        );
      case 'operations-management-dashboard':
        if (!isCompanyOwnerRole(userProfile?.role)) return renderAccessDenied();
        return <OperationsDashboard onNavigate={(tab, payload) => {
          const canonicalTab = normalizeModuleId(tab);
          setModuleContext((prev) => ({ ...prev, [canonicalTab]: payload || {} }));
          setActiveTab(canonicalTab);
          writeRouteStateToLocation(canonicalTab, payload, 'push');
        }} />;
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
        return (
          <div className="h-full overflow-y-auto">
            <SalesReturnReport />
          </div>
        );
      case 'accounting-reports-freight-charges-report':
        return (
          <div className="h-full overflow-y-auto">
            <FreightChargesReportView />
          </div>
        );
      case 'accounting-reports-accounts-receivable-report': {
        const context = moduleContext['accounting-reports-accounts-receivable-report'] || {};
        return <div className="h-full overflow-y-auto"><AccountsReceivableView initialDateType={context.dashboardDate ? 'custom' : undefined} initialDateFrom={context.dashboardDate ? '2000-01-01' : undefined} initialDateTo={context.dashboardDate} /></div>;
      }
      case 'accounting-reports-purchase-history':
        return (
          <div className="h-full overflow-y-auto">
            <PurchaseHistoryReportView />
          </div>
        );
      case 'accounting-reports-inactive-active-customers':
        return (
          <div className="h-full overflow-y-auto">
            <InactiveActiveCustomersReport />
          </div>
        );
      case 'accounting-reports-old-new-customers':
        return (
          <div className="h-full overflow-y-auto">
            <OldNewCustomersReport />
          </div>
        );

      case 'sales-transaction-daily-call-monitoring': {
        const isSalesAgent = userProfile?.role === ROLE_NAMES.SALES_AGENT || userProfile?.role === 'sales_agent';
        const context = moduleContext['sales-transaction-daily-call-monitoring'] || {};
        return isSalesAgent ? (
          <DailyCallMonitoringView currentUser={userProfile} initialSelectedDate={context.dashboardDate} />
        ) : (
          <OwnerDailyCallMonitoringUnifiedView currentUser={userProfile} initialSelectedDate={context.dashboardDate} />
        );
      }
      case 'accounting-transactions-freight-charges-debit':
        return (
          <div className="h-full overflow-y-auto">
            <FreightChargesDebitView />
          </div>
        );
      case 'accounting-transactions-sales-return-credit': {
        const context = moduleContext['accounting-transactions-sales-return-credit'] || {};
        return (
          <div className="h-full overflow-y-auto">
            <SalesReturnPage initialMonth={context.dashboardMonth} initialYear={context.dashboardYear} initialStatus={context.dashboardReturnStatus} />
          </div>
        );
      }
      case 'accounting-transactions-adjustment-entry':
        return (
          <div className="h-full overflow-y-auto">
            <AdjustmentEntryView
              initialAdjustmentNo={
                moduleContext['accounting-transactions-adjustment-entry']?.adjustmentNo ||
                moduleContext.adjustmententry?.adjustmentNo
              }
            />
          </div>
        );
      case 'accounting-transactions-daily-collection-entry':
        return (
          <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
            <DailyCollectionEntryView />
          </div>
        );
      case 'accounting-accounting-customer-ledger':
        return (
          <div className="h-full overflow-y-auto">
            <CustomerLedgerView />
          </div>
        );
      case 'accounting-accounting-collection-summary': {
        const context = moduleContext['accounting-accounting-collection-summary'] || {};
        return (
          <div className="h-full overflow-y-auto">
            <CollectionSummaryView initialDateType={context.dashboardMonthStart && context.dashboardMonthEnd ? 'custom' : undefined} initialDateFrom={context.dashboardMonthStart} initialDateTo={context.dashboardMonthEnd} />
          </div>
        );
      }
      case 'accounting-accounting-statement-of-account':
        return (
          <div className="h-full overflow-y-auto">
            <StatementOfAccountView />
          </div>
        );
      case 'accounting-accounting-accounts-receivable':
        return <div className="h-full overflow-y-auto"><AccountsReceivableView /></div>;
      case 'maintenance-customer-customer-data':
        return (
          <div className="h-full overflow-y-auto">
            <CustomerData />
          </div>
        );

      case 'maintenance-customer-customer-group':
        return <CustomerGroups />;
      case 'maintenance-customer-vip-thresholds':
        return (
          <div className="h-full overflow-y-auto">
            <VipThresholdSettings currentUser={userProfile} />
          </div>
        );
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
      case 'maintenance-profile-activity-logs': {
        const context = moduleContext['maintenance-profile-activity-logs'] || {};
        return <ActivityLogs initialDateFrom={context.dashboardDate} initialDateTo={context.dashboardDate} />;
      }
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
        return (
          <div className="h-full overflow-y-auto">
            <ProfitThresholdSettings currentUser={userProfile} />
          </div>
        );
      case 'maintenance-system-ai-templates':
        return <AIMessageTemplatesView currentUser={userProfile} />;
      case 'communication-sms-templates':
        return <SmsTemplatesView currentUser={userProfile} />;
      case 'communication-call-auto-replies':
        return <CallAutoReplySettingsView currentUser={userProfile} />;
      case 'calls':
      case 'communication-productivity-daily-call-monitoring': {
        const isSalesAgent = userProfile?.role === ROLE_NAMES.SALES_AGENT || userProfile?.role === 'sales_agent';
        return isSalesAgent ? (
          <DailyCallMonitoringView currentUser={userProfile} />
        ) : (
          <OwnerDailyCallMonitoringUnifiedView currentUser={userProfile} />
        );
      }

      default:
        return <div className="p-8"><h1 className="text-xl font-bold">Page not found</h1><p>This page is no longer available.</p><button onClick={() => handleSetActiveTab('home')} className="mt-4 text-blue-600">Go to Dashboard</button></div>;
    }
  };

  return (
    <ToastProvider>
      {!appLoading && session && userProfile && (
        <NotificationProvider userId={userProfile.id}>
          <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 flex flex-col print:h-auto print:overflow-visible">
            <TopNav
              activeTab={activeTab}
              onNavigate={handleSetActiveTab}
              user={userProfile}
              onSignOut={handleSignOut}
              onBack={handleNavigateBack}
              canGoBack={canNavigateBack}
            />

            <div className="flex flex-1 overflow-hidden pt-16 print:block print:flex-none print:overflow-visible print:pt-0">
              <main className="flex-1 overflow-hidden flex flex-col relative bg-slate-100 dark:bg-slate-950 print:block print:overflow-visible">
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
