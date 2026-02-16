import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  ClipboardList,
  FileText,
  Settings,
  Users,
  MessageSquare,
  Map,
  Tag,
  Bot,
  Gift,
  Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TopbarMenuItem {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
}

export interface TopbarSubmenu {
  id: string;
  label: string;
  icon: LucideIcon;
  items: TopbarMenuItem[];
}

export interface TopbarMainMenu {
  id: string;
  label: string;
  icon: LucideIcon;
  route?: string;
  submenus?: TopbarSubmenu[];
}

export const TOPBAR_MENU_CONFIG: TopbarMainMenu[] = [
  {
    id: 'home',
    label: 'HOME',
    icon: LayoutDashboard,
    route: 'home',
  },
  {
    id: 'warehouse',
    label: 'WAREHOUSE',
    icon: Package,
    submenus: [
      {
        id: 'warehouse-inventory',
        label: 'INVENTORY',
        icon: Package,
        items: [
          {
            id: 'warehouse-inventory-stock-movement',
            label: 'Stock Movement',
            route: 'warehouse-inventory-stock-movement',
            icon: ClipboardList,
          },
          {
            id: 'warehouse-inventory-product-database',
            label: 'Product Database',
            route: 'warehouse-inventory-product-database',
            icon: Package,
          },
          {
            id: 'warehouse-inventory-transfer-stock',
            label: 'Transfer Stock',
            route: 'warehouse-inventory-transfer-stock',
            icon: ClipboardList,
          },
          {
            id: 'warehouse-inventory-inventory-audit',
            label: 'Inventory Audit',
            route: 'warehouse-inventory-inventory-audit',
            icon: ClipboardList,
          },
        ],
      },
      {
        id: 'warehouse-purchasing',
        label: 'PURCHASING',
        icon: ShoppingCart,
        items: [
          {
            id: 'warehouse-purchasing-purchase-request',
            label: 'Purchase Request',
            route: 'warehouse-purchasing-purchase-request',
            icon: ClipboardList,
          },
          {
            id: 'warehouse-purchasing-purchase-order',
            label: 'Purchase Order',
            route: 'warehouse-purchasing-purchase-order',
            icon: ClipboardList,
          },
          {
            id: 'warehouse-purchasing-receiving-stock',
            label: 'Receiving Stock',
            route: 'warehouse-purchasing-receiving-stock',
            icon: ClipboardList,
          },
          {
            id: 'warehouse-purchasing-return-to-supplier',
            label: 'Return to Supplier',
            route: 'warehouse-purchasing-return-to-supplier',
            icon: ClipboardList,
          },
        ],
      },
      {
        id: 'warehouse-reports',
        label: 'REPORTS',
        icon: BarChart3,
        items: [
          {
            id: 'warehouse-reports-inventory-report',
            label: 'Inventory Report',
            route: 'warehouse-reports-inventory-report',
            icon: FileText,
          },
          {
            id: 'warehouse-reports-reorder-report',
            label: 'Reorder Report',
            route: 'warehouse-reports-reorder-report',
            icon: FileText,
          },
          {
            id: 'warehouse-reports-item-suggested-for-stock-report',
            label: 'Item Suggested for Stock Report',
            route: 'warehouse-reports-item-suggested-for-stock-report',
            icon: FileText,
          },
          {
            id: 'warehouse-reports-fast-slow-inventory-report',
            label: 'Fast/Slow Inventory Report',
            route: 'warehouse-reports-fast-slow-inventory-report',
            icon: FileText,
          },
        ],
      },
    ],
  },
  {
    id: 'sales',
    label: 'SALES',
    icon: BarChart3,
    submenus: [
      {
        id: 'sales-transaction',
        label: 'TRANSACTION',
        icon: ClipboardList,
        items: [
          {
            id: 'sales-transaction-sales-inquiry',
            label: 'Sales Inquiry',
            route: 'sales-transaction-sales-inquiry',
            icon: FileText,
          },
          {
            id: 'sales-transaction-sales-order',
            label: 'Sales Order',
            route: 'sales-transaction-sales-order',
            icon: FileText,
          },
          {
            id: 'sales-transaction-order-slip',
            label: 'Order Slip',
            route: 'sales-transaction-order-slip',
            icon: FileText,
          },
          {
            id: 'sales-transaction-invoice',
            label: 'Invoice',
            route: 'sales-transaction-invoice',
            icon: FileText,
          },
          {
            id: 'sales-transaction-daily-call-monitoring',
            label: 'Daily Call Monitoring',
            route: 'sales-transaction-daily-call-monitoring',
            icon: Users,
          },
          {
            id: 'sales-transaction-product-promotions',
            label: 'Marketing Campaign',
            route: 'sales-transaction-product-promotions',
            icon: Tag,
          },
        ],
      },
      {
        id: 'sales-reports',
        label: 'REPORTS',
        icon: BarChart3,
        items: [
          {
            id: 'sales-reports-inquiry-report',
            label: 'Inquiry Report',
            route: 'sales-reports-inquiry-report',
            icon: FileText,
          },
          {
            id: 'sales-reports-sales-report',
            label: 'Sales Report',
            route: 'sales-reports-sales-report',
            icon: FileText,
          },
          {
            id: 'sales-reports-sales-development-report',
            label: 'Sales Development Report',
            route: 'sales-reports-sales-development-report',
            icon: FileText,
          },
          {
            id: 'sales-reports-sales-map',
            label: 'Sales Map',
            route: 'sales-reports-sales-map',
            icon: Map,
          },
        ],
      },
    ],
  },
  {
    id: 'accounting',
    label: 'ACCOUNTING',
    icon: FileText,
    submenus: [
      {
        id: 'accounting-transactions',
        label: 'TRANSACTIONS',
        icon: ClipboardList,
        items: [
          {
            id: 'accounting-transactions-freight-charges-debit',
            label: 'Freight Charges',
            route: 'accounting-transactions-freight-charges-debit',
            icon: FileText,
          },
          {
            id: 'accounting-transactions-sales-return-credit',
            label: 'Sales Return',
            route: 'accounting-transactions-sales-return-credit',
            icon: FileText,
          },
          {
            id: 'accounting-transactions-adjustment-entry',
            label: 'Adjustment Entry',
            route: 'accounting-transactions-adjustment-entry',
            icon: FileText,
          },
          {
            id: 'accounting-transactions-daily-collection-entry',
            label: 'Daily Collection Entry',
            route: 'accounting-transactions-daily-collection-entry',
            icon: FileText,
          },
        ],
      },
      {
        id: 'accounting-accounting',
        label: 'ACCOUNTING',
        icon: FileText,
        items: [
          {
            id: 'accounting-accounting-customer-ledger',
            label: 'Customer Ledger',
            route: 'accounting-accounting-customer-ledger',
            icon: FileText,
          },
          {
            id: 'accounting-accounting-collection-summary',
            label: 'Collection Summary',
            route: 'accounting-accounting-collection-summary',
            icon: FileText,
          },
          {
            id: 'accounting-accounting-statement-of-account',
            label: 'Statement of Account',
            route: 'accounting-accounting-statement-of-account',
            icon: FileText,
          },
          {
            id: 'accounting-accounting-accounts-receivable',
            label: 'Accounts Receivable',
            route: 'accounting-accounting-accounts-receivable',
            icon: FileText,
          },
        ],
      },
      {
        id: 'accounting-reports',
        label: 'REPORTS',
        icon: BarChart3,
        items: [
          {
            id: 'accounting-reports-freight-charges-report',
            label: 'Freight Charges Report',
            route: 'accounting-reports-freight-charges-report',
            icon: FileText,
          },
          {
            id: 'accounting-reports-sales-return-report',
            label: 'Sales Return Report',
            route: 'accounting-reports-sales-return-report',
            icon: FileText,
          },
          {
            id: 'accounting-reports-purchase-history',
            label: 'Purchase History',
            route: 'accounting-reports-purchase-history',
            icon: FileText,
          },
          {
            id: 'accounting-reports-inactive-active-customers',
            label: 'Inactive/Active Customers',
            route: 'accounting-reports-inactive-active-customers',
            icon: FileText,
          },
          {
            id: 'accounting-reports-old-new-customers',
            label: 'Old/New Customers',
            route: 'accounting-reports-old-new-customers',
            icon: FileText,
          },

        ],
      },
    ],
  },
  {
    id: 'maintenance',
    label: 'MAINTENANCE',
    icon: Settings,
    submenus: [
      {
        id: 'maintenance-customer',
        label: 'CUSTOMER',
        icon: Users,
        items: [
          {
            id: 'maintenance-customer-customer-data',
            label: 'Customer Data',
            route: 'maintenance-customer-customer-data',
            icon: Users,
          },

          {
            id: 'maintenance-customer-customer-group',
            label: 'Customer Group',
            route: 'maintenance-customer-customer-group',
            icon: Users,
          },
        ],
      },
      {
        id: 'maintenance-product',
        label: 'PRODUCT',
        icon: Package,
        items: [
          {
            id: 'maintenance-product-suppliers',
            label: 'Suppliers',
            route: 'maintenance-product-suppliers',
            icon: Package,
          },
          {
            id: 'maintenance-product-special-price',
            label: 'Special Price',
            route: 'maintenance-product-special-price',
            icon: Package,
          },
          {
            id: 'maintenance-product-category-management',
            label: 'Category Management',
            route: 'maintenance-product-category-management',
            icon: Package,
          },
          {
            id: 'maintenance-product-courier-management',
            label: 'Courier Management',
            route: 'maintenance-product-courier-management',
            icon: Package,
          },
          {
            id: 'maintenance-product-remark-templates',
            label: 'Remark Templates',
            route: 'maintenance-product-remark-templates',
            icon: Package,
          },
        ],
      },
      {
        id: 'maintenance-profile',
        label: 'PROFILE',
        icon: Settings,
        items: [
          {
            id: 'maintenance-profile-staff',
            label: 'Staff',
            route: 'maintenance-profile-staff',
            icon: Users,
          },
          {
            id: 'maintenance-profile-team',
            label: 'Team',
            route: 'maintenance-profile-team',
            icon: Users,
          },
          {
            id: 'maintenance-profile-approver',
            label: 'Approver',
            route: 'maintenance-profile-approver',
            icon: Users,
          },
          {
            id: 'maintenance-profile-activity-logs',
            label: 'Activity Logs',
            route: 'maintenance-profile-activity-logs',
            icon: FileText,
          },
          {
            id: 'maintenance-profile-system-access',
            label: 'System Access',
            route: 'maintenance-profile-system-access',
            icon: Settings,
          },
          {
            id: 'maintenance-profile-server-maintenance',
            label: 'Server Maintenance',
            route: 'maintenance-profile-server-maintenance',
            icon: Settings,
          },
        ],
      },
      {
        id: 'maintenance-system',
        label: 'SYSTEM',
        icon: Settings,
        items: [
          {
            id: 'maintenance-system-loyalty-discounts',
            label: 'Loyalty Discounts',
            route: 'maintenance-system-loyalty-discounts',
            icon: Gift,
          },
          {
            id: 'maintenance-system-profit-protection',
            label: 'Profit Protection',
            route: 'maintenance-system-profit-protection',
            icon: Shield,
          },
        ],
      },
    ],
  },
  {
    id: 'communication',
    label: 'COMMUNICATION',
    icon: MessageSquare,
    submenus: [
      {
        id: 'communication-text-menu',
        label: 'TEXT MENU',
        icon: MessageSquare,
        items: [
          {
            id: 'communication-text-menu-text-messages',
            label: 'Text Messages',
            route: 'communication-text-menu-text-messages',
            icon: MessageSquare,
          },
          {
            id: 'communication-text-menu-inbox',
            label: 'Inbox',
            route: 'communication-text-menu-inbox',
            icon: MessageSquare,
          },
          {
            id: 'communication-text-menu-sent',
            label: 'Sent',
            route: 'communication-text-menu-sent',
            icon: MessageSquare,
          },
          {
            id: 'communication-text-menu-pending',
            label: 'Pending',
            route: 'communication-text-menu-pending',
            icon: MessageSquare,
          },
          {
            id: 'communication-text-menu-failed',
            label: 'Failed',
            route: 'communication-text-menu-failed',
            icon: MessageSquare,
          },
          {
            id: 'communication-text-menu-operator',
            label: 'Operator',
            route: 'communication-text-menu-operator',
            icon: MessageSquare,
          },
        ],
      },
      {
        id: 'ai-service',
        label: 'AI SERVICE',
        icon: Bot,
        items: [
          {
            id: 'ai-service-dashboard',
            label: 'AI Dashboard',
            route: 'ai-service-dashboard',
            icon: Bot,
          },
          {
            id: 'ai-service-standard-answers',
            label: 'Standard Answers',
            route: 'ai-service-standard-answers',
            icon: MessageSquare,
          },
          {
            id: 'ai-service-escalations',
            label: 'Escalation Queue',
            route: 'ai-service-escalations',
            icon: Users,
          },
          {
            id: 'maintenance-system-ai-templates',
            label: 'Message Templates',
            route: 'maintenance-system-ai-templates',
            icon: MessageSquare,
          },
        ],
      },
    ],
  },
];
