import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Filter,
  Loader2,
  Mail,
  MessageSquare,
  Package,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhilippinePeso,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  FileText,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import AgentCallActivity from './AgentCallActivity';
import CustomerProfileModal from './CustomerProfileModal';
import ContactDetails from './ContactDetails';
import { useToast } from './ToastProvider';
import {
  countCallLogsByChannelInRange,
  countCallLogsInRange,
  countCallOutcomes,
  countUniqueContactsInRange,
  getStartOfMonth,
  getStartOfToday,
  isWithinCurrentMonth
} from './callMetricsUtils';
import {
  fetchCallLogs,
  fetchContacts,
  fetchInquiries,
  fetchPurchases,
  fetchTeamMessages,
  subscribeToCallMonitoringUpdates
} from '../services/supabaseService';
import { supabase } from '../lib/supabaseClient';
import {
  CallLogEntry,
  Contact,
  CustomerStatus,
  Inquiry,
  Purchase,
  TeamMessage,
  UserProfile
} from '../types';
import { useVirtualizedList } from '../hooks/useVirtualizedList';
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  getDaysSince,
  formatComment,
  matchesSearch,
  getPhoneNumber
} from '../utils/formatUtils';
import {
  BUTTON_BASE,
  BUTTON_PRIMARY,
  BUTTON_ICON_BASE,
  BUTTON_ICON_CALL,
  BUTTON_ICON_SMS,
  statusBadgeClasses,
  priorityBadgeClasses,
  DIRECTION_BADGE_CLASSES,
  OUTCOME_BADGE_CLASSES,
  INPUT_BASE,
  CARD_BASE,
  FILTER_TAB_ACTIVE,
  FILTER_TAB_INACTIVE
} from '../utils/uiConstants';

interface DailyCallMonitoringViewProps {
  currentUser: UserProfile | null;
}

interface ActivityItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'report' | 'stock';
}

interface ActivityItemWithRead extends ActivityItem {
  read: boolean;
}

interface MasterRow {
  contact: Contact;
  priority: number;
  lastContact?: string;
  lastPurchase?: string;
  totalSales: number;
  totalInteractions: number;
  latestOutcome?: string;
}

type ClientListKey = 'active' | 'inactivePositive' | 'prospectivePositive';

const PIE_COLORS = ['#2563eb', '#0ea5e9', '#059669', '#f97316'];

const getCurrentMonthPurchases = (purchases: Purchase[]) =>
  purchases.filter((purchase) => isWithinCurrentMonth(purchase.purchased_at) && purchase.status === 'paid');

const clientsNoPurchaseThisMonth = (contacts: Contact[], purchases: Purchase[]) => {
  const currentIds = new Set(
    getCurrentMonthPurchases(purchases).map((purchase) => purchase.contact_id)
  );
  return contacts.filter((contact) => !currentIds.has(contact.id));
};

const calculatePriority = (contact: Contact, daysSinceContact: number, totalSales: number) => {
  return (daysSinceContact * 2) + totalSales / 10000 + (contact.status === CustomerStatus.ACTIVE ? 50 : 0);
};

type DensityMode = 'comfortable' | 'compact' | 'ultra-compact';

const getDensityConfig = (density: DensityMode) => {
  switch (density) {
    case 'comfortable':
      return {
        rowPadding: 'py-3',
        fontSize: 'text-sm',
        chipSize: 'px-3 py-1',
        iconSize: 'w-5 h-5',
        cellPadding: 'px-3',
        badgePadding: 'px-2 py-0.5'
      };
    case 'compact':
      return {
        rowPadding: 'py-2',
        fontSize: 'text-xs',
        chipSize: 'px-2 py-0.5',
        iconSize: 'w-4 h-4',
        cellPadding: 'px-2',
        badgePadding: 'px-1.5 py-0.5'
      };
    case 'ultra-compact':
      return {
        rowPadding: 'py-1.5',
        fontSize: 'text-[11px]',
        chipSize: 'px-1.5 py-0.5',
        iconSize: 'w-3 h-3',
        cellPadding: 'px-1.5',
        badgePadding: 'px-1 py-0.5'
      };
  }
};

const getRowHeight = (density: DensityMode) => {
  switch (density) {
    case 'comfortable':
      return 56;
    case 'compact':
      return 44;
    case 'ultra-compact':
      return 36;
  }
};

type DensityConfig = ReturnType<typeof getDensityConfig>;

interface MasterTableRowProps {
  row: MasterRow;
  densityConfig: DensityConfig;
  tableRowHeight: number;
  selectedClientId: string | null;
  onSelectClient: (contactId: string) => void;
  onCallContact: (contact: Contact) => void;
  onOpenSMSModal: (contact: Contact) => void;
  onOpenPatientChart: (contactId: string) => void;
}

const MasterTableRow = React.memo(({
  row,
  densityConfig,
  tableRowHeight,
  selectedClientId,
  onSelectClient,
  onCallContact,
  onOpenSMSModal,
  onOpenPatientChart
}: MasterTableRowProps) => {
  const isSelected = selectedClientId === row.contact.id;
  return (
    <tr
      className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors cursor-pointer ${densityConfig.rowPadding} ${isSelected ? 'bg-brand-blue/5 dark:bg-brand-blue/10' : ''}`}
      style={{ height: `${tableRowHeight}px` }}
      onClick={() => onSelectClient(row.contact.id)}
    >
      <td className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} overflow-hidden`}>
        <div className="flex items-center gap-2">
          <p className={`font-semibold text-slate-800 dark:text-white truncate ${densityConfig.fontSize}`} title={row.contact.company}>
            {row.contact.company}
          </p>
        </div>
        <p className={`text-slate-500 dark:text-slate-400 truncate ${densityConfig.fontSize}`} title={row.contact.province || 'No location'}>
          {row.contact.province || 'No location'}
        </p>
      </td>
      <td className={`${densityConfig.cellPadding} ${densityConfig.rowPadding}`}>
        <span className={`font-semibold rounded-full ${densityConfig.badgePadding} ${statusBadgeClasses(row.contact.status)} ${densityConfig.fontSize}`}>
          {row.contact.status}
        </span>
      </td>
      <td className={`${densityConfig.cellPadding} ${densityConfig.rowPadding}`}>
        <p className={`font-semibold text-slate-700 dark:text-slate-200 ${densityConfig.fontSize}`} title={row.lastContact ? new Date(row.lastContact).toLocaleDateString() : 'No activity yet'}>
          {formatRelativeTime(row.lastContact)}
        </p>
      </td>
      <td className={`${densityConfig.cellPadding} ${densityConfig.rowPadding}`}>
        <p className={`text-slate-600 dark:text-slate-300 ${densityConfig.fontSize}`} title={row.lastPurchase ? new Date(row.lastPurchase).toLocaleDateString() : 'No purchases'}>
          {formatDate(row.lastPurchase)}
        </p>
      </td>
      <td className={`${densityConfig.cellPadding} ${densityConfig.rowPadding}`}>
        <p className={`font-bold text-slate-800 dark:text-white ${densityConfig.fontSize}`} title={`Total sales: ${formatCurrency(row.totalSales)}`}>
          {formatCurrency(row.totalSales)}
        </p>
        <span className={`inline-block mt-0.5 rounded-full ${densityConfig.badgePadding} font-semibold ${priorityBadgeClasses(row.priority)} ${densityConfig.fontSize}`}>
          {Math.round(row.priority)}
        </span>
      </td>
      <td className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} text-center`}>
        <span className={`inline-block rounded-full ${densityConfig.badgePadding} font-semibold ${priorityBadgeClasses(row.priority)} ${densityConfig.fontSize}`}>
          {Math.round(row.priority)}
        </span>
      </td>
      <td className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} align-middle`}>
        <div className="flex items-center justify-center gap-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCallContact(row.contact);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 transition-all duration-150 hover:bg-brand-blue/20 hover:text-brand-blue active:scale-95 active:bg-brand-blue/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 leading-none shrink-0"
            title="Call"
            aria-label={`Call ${row.contact.company}`}
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSMSModal(row.contact);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 transition-all duration-150 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-300 active:scale-95 active:bg-emerald-200 dark:active:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 leading-none shrink-0"
            title="SMS"
            aria-label={`Send SMS to ${row.contact.company}`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPatientChart(row.contact.id);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 transition-all duration-150 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white active:scale-95 active:bg-slate-300/80 dark:active:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 leading-none shrink-0"
            title="Details"
            aria-label={`Open details for ${row.contact.company}`}
          >
            <ClipboardList className="w-5 h-5" />
          </button>
        </div>
      </td>
    </tr>
  );
}, (previousProps, nextProps) => {
  return (
    previousProps.row.contact.id === nextProps.row.contact.id &&
    previousProps.row.contact.updated_at === nextProps.row.contact.updated_at &&
    previousProps.row.contact.status === nextProps.row.contact.status &&
    previousProps.row.lastContact === nextProps.row.lastContact &&
    previousProps.row.lastPurchase === nextProps.row.lastPurchase &&
    previousProps.row.totalSales === nextProps.row.totalSales &&
    previousProps.row.priority === nextProps.row.priority &&
    previousProps.tableRowHeight === nextProps.tableRowHeight &&
    previousProps.selectedClientId === nextProps.selectedClientId &&
    previousProps.densityConfig.fontSize === nextProps.densityConfig.fontSize &&
    previousProps.densityConfig.rowPadding === nextProps.densityConfig.rowPadding &&
    previousProps.densityConfig.cellPadding === nextProps.densityConfig.cellPadding &&
    previousProps.densityConfig.badgePadding === nextProps.densityConfig.badgePadding
  );
});

const DailyCallMonitoringView: React.FC<DailyCallMonitoringViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [callForwardingEnabled, setCallForwardingEnabled] = useState(false);
  const [showForwardingInput, setShowForwardingInput] = useState(false);
  const [historyTab, setHistoryTab] = useState<'all' | 'calls' | 'sms'>('all');
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [smsRecipient, setSMSRecipient] = useState<Contact | null>(null);
  const [smsMessage, setSMSMessage] = useState('');
  const [sendingSMS, setSendingSMS] = useState(false);

  const [repFilter, setRepFilter] = useState('All');
  const [provinceFilter, setProvinceFilter] = useState('All');
  const [statusFilters, setStatusFilters] = useState<CustomerStatus[]>([]);
  const [noPurchaseOnly, setNoPurchaseOnly] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<'priority' | 'lastContact' | 'lastPurchase' | 'salesValue'>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [readActivityIds, setReadActivityIds] = useState<Set<string>>(() => new Set());
  const [openClientLists, setOpenClientLists] = useState<Record<ClientListKey, boolean>>({
    active: false,
    inactivePositive: false,
    prospectivePositive: false
  });
  const [showPatientChart, setShowPatientChart] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [density, setDensity] = useState<'comfortable' | 'compact' | 'ultra-compact'>('compact');
  const [activeTab, setActiveTab] = useState<'master' | 'today' | 'activity'>('master');
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [masterViewportHeight, setMasterViewportHeight] = useState(420);
  const masterViewportWrapperRef = useRef<HTMLDivElement | null>(null);
  const masterScrollRef = useRef<HTMLDivElement | null>(null);
  const selectionInitializedRef = useRef(false);
  const pendingFilterSnapshotRef = useRef<{ scrollTop: number; selectedClientId: string | null } | null>(null);

  const handleOpenSalesInquiry = useCallback((contactId?: string) => {
    const targetContactId = contactId || selectedClientId || undefined;
    window.dispatchEvent(new CustomEvent('workflow:navigate', {
      detail: {
        tab: 'salesinquiry',
        payload: {
          ...(targetContactId ? { contactId: targetContactId } : {}),
          prefillToken: Date.now().toString(),
          openMode: 'new'
        }
      }
    }));
  }, [selectedClientId]);

  const handleOpenPatientChart = (contactId: string) => {
    setSelectedClientId(contactId);
    setShowPatientChart(true);
  };

  const agentDataName = currentUser?.full_name?.trim() || null;
  const agentDisplayName = useMemo(() => {
    if (currentUser?.full_name?.trim()) {
      return currentUser.full_name.trim();
    }
    if (currentUser?.email) {
      const prefix = currentUser.email.split('@')[0];
      if (prefix) return prefix;
    }
    return 'Sales Agent';
  }, [currentUser]);
  const isSalesAgent = Boolean(currentUser?.role && currentUser.role.toLowerCase().includes('agent'));
  const dataUnavailable = !loading && !hasLoadedData;

  const toggleClientList = useCallback((listKey: ClientListKey) => {
    setOpenClientLists((previous) => ({
      ...previous,
      [listKey]: !previous[listKey]
    }));
  }, []);

  const loadAgentData = useCallback(async () => {
    if (!agentDataName || !isSalesAgent) return;
    setLoading(true);
    try {
      const [contactData, callLogData, inquiryData, purchaseData, messageData] = await Promise.all([
        fetchContacts(),
        fetchCallLogs(),
        fetchInquiries(),
        fetchPurchases(),
        fetchTeamMessages()
      ]);

      const assignedContacts = contactData.filter((contact) => contact.salesman === agentDataName);
      const contactIds = new Set(assignedContacts.map((contact) => contact.id));

      setContacts(assignedContacts);
      setCallLogs(callLogData.filter((log) => log.agent_name === agentDataName));
      setInquiries(inquiryData.filter((inquiry) => contactIds.has(inquiry.contact_id)));
      setPurchases(purchaseData.filter((purchase) => contactIds.has(purchase.contact_id)));
      setTeamMessages(messageData.filter((message) => message.is_from_owner));
      setLoadError(null);
      setHasLoadedData(true);
    } catch (error) {
      console.error('Error loading daily call monitoring data', error);
      setLoadError('Call activity could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [agentDataName, isSalesAgent]);

  useEffect(() => {
    if (!agentDataName || !isSalesAgent) {
      setLoading(false);
      return;
    }
    loadAgentData();
  }, [agentDataName, isSalesAgent, loadAgentData]);

  useEffect(() => {
    if (!agentDataName || !isSalesAgent) return;
    const unsubscribe = subscribeToCallMonitoringUpdates(() => {
      loadAgentData();
    });
    return () => {
      unsubscribe();
    };
  }, [agentDataName, isSalesAgent, loadAgentData]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchValue.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchValue]);

  const handleCallContact = (contact: Contact) => {
    const phoneNumber = contact.mobile || contact.phone || contact.contactPersons[0]?.mobile || contact.contactPersons[0]?.telephone;
    if (!phoneNumber) {
      addToast({ type: 'error', message: 'No phone number available for this contact' });
      return;
    }
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleSMSContact = (contact: Contact) => {
    const phoneNumber = contact.mobile || contact.phone || contact.contactPersons[0]?.mobile || contact.contactPersons[0]?.telephone;
    if (!phoneNumber) {
      addToast({ type: 'error', message: 'No phone number available for this contact' });
      return;
    }
    handleOpenSMSModal(contact);
  };

  const handleEmailContact = (contact: Contact) => {
    const email = contact.email || contact.contactPersons[0]?.email;
    if (!email) {
      addToast({ type: 'error', message: 'No email address available for this contact' });
      return;
    }
    window.location.href = `mailto:${email}`;
  };

  const handleOpenSMSModal = (contact: Contact) => {
    setSMSRecipient(contact);
    setSMSMessage('');
    setShowSMSModal(true);
  };

  const handleSendSMS = async () => {
    if (!smsRecipient || !smsMessage.trim()) return;

    const phoneNumber = smsRecipient.mobile || smsRecipient.phone || smsRecipient.contactPersons[0]?.mobile || smsRecipient.contactPersons[0]?.telephone;
    if (!phoneNumber) {
      addToast({ type: 'error', message: 'No phone number available for this contact' });
      return;
    }

    setSendingSMS(true);
    try {
      const { error } = await supabase
        .from('call_logs')
        .insert({
          contact_id: smsRecipient.id,
          agent_name: agentDataName || 'Unknown',
          channel: 'text',
          direction: 'outbound',
          outcome: 'logged',
          notes: smsMessage.trim(),
          occurred_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error logging SMS:', error);
        addToast({ type: 'error', message: 'Failed to log SMS' });
        return;
      }

      addToast({ type: 'success', message: 'SMS logged successfully' });
      setShowSMSModal(false);
      setSMSRecipient(null);
      setSMSMessage('');

      await loadAgentData();
    } catch (error) {
      console.error('Error sending SMS:', error);
      addToast({ type: 'error', message: 'Failed to send SMS' });
    } finally {
      setSendingSMS(false);
    }
  };

  const handleEnableCallForwarding = (forwardingNumber: string) => {
    if (!forwardingNumber) return;

    const formattedNumber = forwardingNumber.replace(/^0/, '63');
    const forwardCode = `*21*${formattedNumber}#`;

    try {
      window.location.href = `tel:${forwardCode}`;
      setCallForwardingEnabled(true);
      setShowForwardingInput(false);
      addToast({ type: 'success', message: `Call forwarding enabled to ${forwardingNumber}` });
    } catch (error) {
      console.error('Error enabling call forwarding:', error);
      addToast({ type: 'error', message: 'Failed to enable call forwarding. Please try again.' });
    }
  };

  const handleDisableCallForwarding = () => {
    try {
      window.location.href = 'tel:#21#';
      setCallForwardingEnabled(false);
    } catch (error) {
      console.error('Error disabling call forwarding:', error);
      addToast({ type: 'error', message: 'Failed to disable call forwarding. Please try again.' });
    }
  };

  const selectedClient = useMemo(
    () => contacts.find((contact) => contact.id === selectedClientId) || null,
    [contacts, selectedClientId]
  );

  const purchasesByContact = useMemo(() => {
    const map = new Map<string, Purchase[]>();
    purchases.forEach((purchase) => {
      if (!map.has(purchase.contact_id)) {
        map.set(purchase.contact_id, []);
      }
      map.get(purchase.contact_id)!.push(purchase);
    });
    map.forEach((value) => value.sort((a, b) => Date.parse(b.purchased_at) - Date.parse(a.purchased_at)));
    return map;
  }, [purchases]);

  const callLogsByContact = useMemo(() => {
    const map = new Map<string, CallLogEntry[]>();
    callLogs.forEach((log) => {
      if (!map.has(log.contact_id)) {
        map.set(log.contact_id, []);
      }
      map.get(log.contact_id)!.push(log);
    });
    map.forEach((value) => value.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at)));
    return map;
  }, [callLogs]);

  const inquiriesByContact = useMemo(() => {
    const map = new Map<string, Inquiry[]>();
    inquiries.forEach((inquiry) => {
      if (!map.has(inquiry.contact_id)) {
        map.set(inquiry.contact_id, []);
      }
      map.get(inquiry.contact_id)!.push(inquiry);
    });
    map.forEach((value) => value.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at)));
    return map;
  }, [inquiries]);

  const lastContactMap = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach((contact) => {
      if (contact.lastContactDate) {
        map.set(contact.id, contact.lastContactDate);
      }
    });
    callLogs.forEach((log) => {
      const current = map.get(log.contact_id);
      if (!current || Date.parse(log.occurred_at) > Date.parse(current)) {
        map.set(log.contact_id, log.occurred_at);
      }
    });
    inquiries.forEach((inquiry) => {
      const current = map.get(inquiry.contact_id);
      if (!current || Date.parse(inquiry.occurred_at) > Date.parse(current)) {
        map.set(inquiry.contact_id, inquiry.occurred_at);
      }
    });
    return map;
  }, [contacts, callLogs, inquiries]);

  const currentMonthPurchases = useMemo(() => getCurrentMonthPurchases(purchases), [purchases]);
  const quota = currentUser?.monthly_quota || 1_500_000;
  const achievements = useMemo(
    () => currentMonthPurchases.reduce((sum, purchase) => sum + (purchase.amount || 0), 0),
    [currentMonthPurchases]
  );
  const achievementsValue = hasLoadedData ? achievements : null;
  const percentAchieved =
    achievementsValue !== null ? Math.min(100, Math.round(((achievementsValue / quota) * 100) || 0)) : null;
  const remainingQuota = achievementsValue !== null ? Math.max(0, quota - achievementsValue) : null;

  const noPurchaseContacts = useMemo(
    () => clientsNoPurchaseThisMonth(contacts, purchases),
    [contacts, purchases]
  );
  const noPurchaseSet = useMemo(() => new Set(noPurchaseContacts.map((contact) => contact.id)), [noPurchaseContacts]);
  const searchScopedNoPurchase = useMemo(
    () => (debouncedSearch ? noPurchaseContacts.filter((contact) => matchesSearch(contact, debouncedSearch)) : noPurchaseContacts),
    [noPurchaseContacts, debouncedSearch]
  );

  const categorizedEntries = useMemo(() => {
    const buildEntry = (contact: Contact) => {
      const lastContact = lastContactMap.get(contact.id);
      const lastPurchase = purchasesByContact.get(contact.id)?.find((purchase) => purchase.status === 'paid')?.purchased_at;
      const totalSales = purchasesByContact
        .get(contact.id)
        ?.filter((purchase) => purchase.status === 'paid')
        .reduce((sum, purchase) => sum + purchase.amount, 0) || 0;
      return {
        contact,
        lastContact,
        lastPurchase,
        priority: calculatePriority(contact, getDaysSince(lastContact), totalSales)
      };
    };

    const positiveComment = (contact: Contact) => contact.comment?.toLowerCase().includes('positive') || false;

    return {
      active: searchScopedNoPurchase
        .filter((contact) => contact.status === CustomerStatus.ACTIVE)
        .map(buildEntry),
      inactivePositive: searchScopedNoPurchase
        .filter((contact) => contact.status === CustomerStatus.INACTIVE && positiveComment(contact))
        .map(buildEntry),
      prospectivePositive: searchScopedNoPurchase
        .filter((contact) => contact.status === CustomerStatus.PROSPECTIVE && positiveComment(contact))
        .map(buildEntry)
    };
  }, [searchScopedNoPurchase, lastContactMap, purchasesByContact]);

  const activeVirtual = useVirtualizedList(categorizedEntries.active, { viewportHeight: 300, itemHeight: 96 });
  const inactiveVirtual = useVirtualizedList(categorizedEntries.inactivePositive, { viewportHeight: 300, itemHeight: 96 });
  const prospectiveVirtual = useVirtualizedList(categorizedEntries.prospectivePositive, { viewportHeight: 300, itemHeight: 96 });

  const contactLookup = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((contact) => map.set(contact.id, contact));
    return map;
  }, [contacts]);

  const activityBase = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    teamMessages.forEach((message) => {
      items.push({
        id: `msg-${message.id}`,
        title: 'Owner Reply',
        message: message.message,
        timestamp: message.created_at,
        type: 'report'
      });
    });

    purchases.forEach((purchase) => {
      if (purchase.status === 'pending') {
        const company = contactLookup.get(purchase.contact_id)?.company || 'Client';
        items.push({
          id: `stock-${purchase.id}`,
          title: 'Pending Confirmation',
          message: `${company} awaiting confirmation for ₱${Math.round(purchase.amount).toLocaleString()} order`,
          timestamp: purchase.purchased_at,
          type: 'stock'
        });
      }
    });

    return items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [teamMessages, purchases, contactLookup]);

  const activityItems: ActivityItemWithRead[] = useMemo(
    () =>
      activityBase.map((item) => ({
        ...item,
        read: readActivityIds.has(item.id)
      })),
    [activityBase, readActivityIds]
  );

  const unseenActivityCount = useMemo(
    () => activityItems.filter((item) => !item.read).length,
    [activityItems]
  );

  const handleActivityRead = (id: string) => {
    setReadActivityIds((prev) => {
      const updated = new Set(prev);
      updated.add(id);
      return updated;
    });
  };

  const handleActivityReadAll = () => {
    setReadActivityIds(new Set(activityBase.map((item) => item.id)));
  };

  const availableReps = useMemo(() => {
    const reps = Array.from(new Set(contacts.map((contact) => contact.salesman)));
    return ['All', ...reps];
  }, [contacts]);

  const availableProvinces = useMemo(() => {
    const provinces = Array.from(new Set(contacts.map((contact) => contact.province).filter(Boolean)));
    return ['All', ...provinces];
  }, [contacts]);

  const statusOptions: CustomerStatus[] = [
    CustomerStatus.ACTIVE,
    CustomerStatus.INACTIVE,
    CustomerStatus.PROSPECTIVE,
    CustomerStatus.BLACKLISTED
  ];

  const statusMatchesFilter = useCallback(
    (status: CustomerStatus) => !statusFilters.length || statusFilters.includes(status),
    [statusFilters]
  );

  const baseMasterRows = useMemo<MasterRow[]>(() => {
    const rows = contacts.map((contact) => {
      const contactPurchases = purchasesByContact.get(contact.id) || [];
      const lastPaid = contactPurchases.find((purchase) => purchase.status === 'paid');
      const totalSales = contactPurchases
        .filter((purchase) => purchase.status === 'paid')
        .reduce((sum, purchase) => sum + purchase.amount, 0);
      const lastContact = lastContactMap.get(contact.id);
      const totalInteractions =
        (callLogsByContact.get(contact.id)?.length || 0) + (inquiriesByContact.get(contact.id)?.length || 0);
      const priority = calculatePriority(contact, getDaysSince(lastContact), totalSales);
      return {
        contact,
        priority,
        lastContact,
        lastPurchase: lastPaid?.purchased_at,
        totalSales,
        totalInteractions,
        latestOutcome: callLogsByContact.get(contact.id)?.[0]?.outcome
      };
    });
    return rows;
  }, [contacts, purchasesByContact, lastContactMap, callLogsByContact, inquiriesByContact]);

  const masterRows = useMemo<MasterRow[]>(() => {
    const filtered = baseMasterRows.filter((row) => {
      const matchesRep = repFilter === 'All' || row.contact.salesman === repFilter;
      const matchesProvince = provinceFilter === 'All' || row.contact.province === provinceFilter;
      const matchesStatus = statusMatchesFilter(row.contact.status);
      const matchesPurchaseFilter = !noPurchaseOnly || noPurchaseSet.has(row.contact.id);
      const matchesSearchQuery = matchesSearch(row.contact, debouncedSearch);
      return matchesRep && matchesProvince && matchesStatus && matchesPurchaseFilter && matchesSearchQuery;
    });

    const direction = sortDirection === 'asc' ? 1 : -1;
    const sorted = filtered.sort((a, b) => {
      if (sortField === 'priority') {
        return (a.priority - b.priority) * direction * -1;
      } else if (sortField === 'salesValue') {
        return (a.totalSales - b.totalSales) * direction;
      } else if (sortField === 'lastContact') {
        const aTime = a.lastContact ? Date.parse(a.lastContact) : 0;
        const bTime = b.lastContact ? Date.parse(b.lastContact) : 0;
        return (aTime - bTime) * direction;
      } else {
        const aPurchase = a.lastPurchase ? Date.parse(a.lastPurchase) : 0;
        const bPurchase = b.lastPurchase ? Date.parse(b.lastPurchase) : 0;
        return (aPurchase - bPurchase) * direction;
      }
    });

    return sorted;
  }, [
    baseMasterRows,
    repFilter,
    provinceFilter,
    noPurchaseSet,
    noPurchaseOnly,
    statusMatchesFilter,
    debouncedSearch,
    sortField,
    sortDirection
  ]);

  useEffect(() => {
    if (!masterRows.length) {
      if (selectedClientId !== null) {
        setSelectedClientId(null);
      }
      return;
    }
    if (selectedClientId === null) {
      if (!selectionInitializedRef.current) {
        selectionInitializedRef.current = true;
        setSelectedClientId(masterRows[0].contact.id);
      }
      return;
    }
    if (!masterRows.some((row) => row.contact.id === selectedClientId)) {
      setSelectedClientId(null);
      if (masterScrollRef.current) {
        masterScrollRef.current.scrollTop = 0;
      }
    }
  }, [masterRows, selectedClientId]);

  useEffect(() => {
    const wrapper = masterViewportWrapperRef.current;
    if (!wrapper) return;
    const updateHeight = () => {
      if (wrapper.clientHeight > 0) {
        setMasterViewportHeight(wrapper.clientHeight);
      }
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const selectedTimeline = useMemo(() => {
    if (!selectedClientId) return [];
    const calls = (callLogsByContact.get(selectedClientId) || []).map((log) => ({
      id: `call-${log.id}`,
      type: 'call' as const,
      channel: log.channel as 'voice' | 'text',
      direction: log.direction as 'inbound' | 'outbound',
      outcome: log.outcome,
      title: log.channel === 'text' ? 'SMS Touch' : 'Call',
      occurred_at: log.occurred_at,
      detail: log.notes,
      meta: `${log.channel === 'text' ? 'SMS' : 'Voice'} • ${log.direction === 'inbound' ? 'Inbound' : 'Outbound'} • ${log.outcome ? log.outcome.replace('_', ' ') : 'Logged'}`
    }));
    const inquiryEvents = (inquiriesByContact.get(selectedClientId) || []).map((inquiry) => ({
      id: `inq-${inquiry.id}`,
      type: 'inquiry' as const,
      title: 'Inquiry',
      occurred_at: inquiry.occurred_at,
      detail: inquiry.notes || inquiry.title,
      meta: `via ${inquiry.channel}`
    }));

    return [...calls, ...inquiryEvents].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  }, [selectedClientId, callLogsByContact, inquiriesByContact]);

  const filteredTimeline = useMemo(() => {
    if (historyTab === 'all') return selectedTimeline;
    return selectedTimeline.filter((event) => {
      if (historyTab === 'calls') return event.type === 'call' && event.channel === 'voice';
      if (historyTab === 'sms') return event.type === 'call' && event.channel === 'text';
      return true;
    });
  }, [selectedTimeline, historyTab]);

  const todayStart = useMemo(() => getStartOfToday(), []);
  const monthStart = useMemo(() => getStartOfMonth(), []);

  const callsToday = useMemo(
    () => countCallLogsInRange(callLogs, todayStart),
    [callLogs, todayStart]
  );

  const smsToday = useMemo(
    () => countCallLogsByChannelInRange(callLogs, 'text', todayStart),
    [callLogs, todayStart]
  );

  const clientsContactedToday = useMemo(
    () => countUniqueContactsInRange(callLogs, inquiries, todayStart),
    [callLogs, inquiries, todayStart]
  );

  const callsThisMonth = useMemo(
    () => countCallLogsInRange(callLogs, monthStart),
    [callLogs, monthStart]
  );

  const contactsThisMonth = useMemo(
    () => countUniqueContactsInRange(callLogs, inquiries, monthStart),
    [callLogs, inquiries, monthStart]
  );
  const conversionRate = useMemo(
    () => (contactsThisMonth ? Math.round((currentMonthPurchases.length / contactsThisMonth) * 100) : 0),
    [contactsThisMonth, currentMonthPurchases]
  );

  const followUpsDue = useMemo(
    () =>
      callLogs.filter(
        (log) =>
          log.outcome === 'follow_up' &&
          log.next_action_due &&
          Date.parse(log.next_action_due) <= Date.now()
      ).length,
    [callLogs]
  );

  const callOutcomeBreakdown = useMemo(() => {
    const counts = countCallOutcomes(callLogs);
    return [
      { name: 'Positive', value: counts.positive },
      { name: 'Follow-up', value: counts.follow_up },
      { name: 'Negative', value: counts.negative },
      { name: 'Other', value: counts.other }
    ];
  }, [callLogs]);

  const perClientHistory = useMemo(() => {
    return contacts
      .map((contact) => {
        const logs = callLogsByContact.get(contact.id) || [];
        const followUps = logs.filter((log) => log.outcome === 'follow_up').length;
        const positive = logs.filter((log) => log.outcome === 'positive').length;
        const total = logs.length + (inquiriesByContact.get(contact.id)?.length || 0);
        return {
          contact,
          total,
          positive,
          followUps,
          lastInteraction: lastContactMap.get(contact.id)
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [contacts, callLogsByContact, inquiriesByContact, lastContactMap]);

  const toggleStatusFilter = useCallback((status: CustomerStatus) => {
    pendingFilterSnapshotRef.current = {
      scrollTop: masterScrollRef.current?.scrollTop || 0,
      selectedClientId
    };
    setIsFiltering(true);
    React.startTransition(() => {
      setStatusFilters((prev) => {
        if (prev.includes(status)) {
          return prev.filter((item) => item !== status);
        }
        return [...prev, status];
      });
    });
  }, [selectedClientId]);

  const densityConfig = getDensityConfig(density);
  const tableRowHeight = getRowHeight(density);
  const masterVirtual = useVirtualizedList(masterRows, {
    viewportHeight: masterViewportHeight,
    itemHeight: tableRowHeight,
    overscan: 6
  });

  const handleMasterTableScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    masterVirtual.handleScroll(event);
  }, [masterVirtual]);

  const handleSelectClient = useCallback((contactId: string) => {
    setSelectedClientId(contactId);
    setDetailsPanelOpen(true);
  }, []);

  const handleMasterRowCall = useCallback((contact: Contact) => {
    handleCallContact(contact);
  }, [handleCallContact]);

  const handleMasterRowSMS = useCallback((contact: Contact) => {
    handleOpenSMSModal(contact);
  }, [handleOpenSMSModal]);

  const handleMasterRowDetails = useCallback((contactId: string) => {
    setSelectedClientId(contactId);
    setShowPatientChart(true);
  }, []);

  useEffect(() => {
    if (!isFiltering) return;
    const snapshot = pendingFilterSnapshotRef.current;
    if (!snapshot) return;

    const frameId = requestAnimationFrame(() => {
      const selectedStillVisible = snapshot.selectedClientId
        ? masterRows.some((row) => row.contact.id === snapshot.selectedClientId)
        : false;
      const scrollNode = masterScrollRef.current;

      if (selectedStillVisible && scrollNode) {
        const selectedIndex = masterRows.findIndex((row) => row.contact.id === snapshot.selectedClientId);
        const selectedTop = Math.max(0, selectedIndex * tableRowHeight);
        const selectedBottom = selectedTop + tableRowHeight;
        const viewportTop = snapshot.scrollTop;
        const viewportBottom = viewportTop + masterViewportHeight;
        let nextTop = snapshot.scrollTop;

        if (selectedTop < viewportTop || selectedBottom > viewportBottom) {
          nextTop = Math.max(0, selectedTop - Math.max(0, (masterViewportHeight - tableRowHeight) / 2));
        }

        scrollNode.scrollTo({
          top: nextTop,
          behavior: Math.abs(nextTop - snapshot.scrollTop) > tableRowHeight * 2 ? 'smooth' : 'auto'
        });
      } else if (scrollNode) {
        const maxValidScrollTop = Math.max(0, masterRows.length * tableRowHeight - masterViewportHeight);
        scrollNode.scrollTop = maxValidScrollTop;
      }

      pendingFilterSnapshotRef.current = null;
      setIsFiltering(false);
    });

    return () => cancelAnimationFrame(frameId);
  }, [isFiltering, statusFilters, masterRows, masterViewportHeight, tableRowHeight]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center shadow-sm max-w-md">
          <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Sign in to continue</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Please sign in with your sales agent account to view daily call monitoring insights.
          </p>
        </div>
      </div>
    );
  }

  if (!isSalesAgent) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center shadow-sm max-w-md">
          <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Sales agent view</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            The Daily Call Monitoring workspace is tailored for sales agents. Switch to the live owner view to monitor the entire team.
          </p>
        </div>
      </div>
    );
  }

  if (!agentDataName) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center shadow-sm max-w-md">
          <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Profile Required</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Please make sure your profile includes your full name so we can match assigned accounts for {agentDisplayName}.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="flex-shrink-0 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between px-4 lg:px-6 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-brand-blue" />
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Daily Call Monitoring</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tracking every touchpoint for <span className="font-semibold">{agentDisplayName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSummaryCollapsed(!summaryCollapsed)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title={summaryCollapsed ? 'Expand Summary' : 'Collapse Summary'}
          >
            {summaryCollapsed ? <BarChart3 className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Summary
          </button>
          <button
            onClick={loadAgentData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => handleOpenSalesInquiry()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Open Sales Inquiry"
          >
            <FileText className="w-4 h-4" />
            Sales Inquiry
          </button>
          {callForwardingEnabled ? (
            <button
              onClick={handleDisableCallForwarding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/20 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30"
              title="Disable Call Forwarding"
            >
              <PhoneForwarded className="w-4 h-4" />
              Forwarding On
            </button>
          ) : showForwardingInput ? (
            <div className="flex items-center gap-2">
              <input
                type="tel"
                placeholder="09123456789"
                className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue w-36"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    handleEnableCallForwarding(e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    setShowForwardingInput(false);
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => setShowForwardingInput(false)}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForwardingInput(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Enable Call Forwarding"
            >
              <PhoneForwarded className="w-4 h-4" />
              Forward
            </button>
          )}
          <div className="relative">
            <button
              onClick={handleActivityReadAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-blue text-white text-xs font-semibold shadow-sm"
            >
              <Bell className="w-4 h-4" />
              Activity
              {unseenActivityCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20">
                  {unseenActivityCount}
                </span>
              )}
            </button>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
          <button
            onClick={() => {
              const modes: DensityMode[] = ['comfortable', 'compact', 'ultra-compact'];
              const currentIndex = modes.indexOf(density);
              const nextIndex = (currentIndex + 1) % modes.length;
              setDensity(modes[nextIndex]);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title={`Density: ${density.charAt(0).toUpperCase() + density.slice(1)}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <span className="capitalize">{density}</span>
          </button>
        </div>
      </header>

      {!summaryCollapsed && (
        <section className="flex-shrink-0 px-4 lg:px-6 py-2">
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm px-4 py-3">
            <div className="flex items-center gap-3">
              <PhilippinePeso className="w-4 h-4 text-brand-blue flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Monthly Quota</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">{formatCurrency(quota)}</p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Achievement</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">
                  {achievementsValue !== null ? formatCurrency(achievementsValue) : '—'}
                </p>
                <p className={`text-[10px] font-semibold ${percentAchieved !== null && percentAchieved > 80 ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`}>
                  {percentAchieved !== null ? `${percentAchieved}%` : 'N/A'}
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-center gap-3">
              <AlertCircle className={`w-4 h-4 flex-shrink-0 ${remainingQuota !== null && remainingQuota < quota * 0.2 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`} />
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Remaining</p>
                <p className={`text-sm font-bold ${remainingQuota !== null && remainingQuota < quota * 0.2 ? 'text-rose-500' : 'text-slate-800 dark:text-white'}`}>
                  {remainingQuota !== null ? formatCurrency(remainingQuota) : '—'}
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-center gap-3">
              <ClipboardList className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Follow-ups Due</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">
                  {hasLoadedData ? followUpsDue : '—'}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {loadError && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900 rounded-xl p-4 shadow-sm flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-500 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">Unable to load call activity</p>
              <p className="text-sm text-rose-600/80 dark:text-rose-200/80">
                {loadError}
              </p>
            </div>
          </div>
          <button
            onClick={loadAgentData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm font-semibold text-rose-600 dark:text-rose-200 border border-rose-200 dark:border-rose-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      )}

      {/* Master Call View - Main Focus */}
      <section className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-brand-blue/70 rounded-xl shadow-sm mx-4 lg:mx-6 mb-4 overflow-hidden">
        <div className="flex-shrink-0 p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Filter className="w-4 h-4" />
              <span className="text-xs font-semibold text-slate-800 dark:text-white">Master Call View</span>
            </div>
            <div className="flex items-center gap-1">
              {(['master', 'today', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                    activeTab === tab
                      ? 'bg-brand-blue text-white border-brand-blue'
                      : 'bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab === 'master' ? 'All Clients' : tab === 'today' ? "Today's List" : 'Activity'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 px-2.5 py-1.5 rounded-lg flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                className={`bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 flex-1 ${densityConfig.fontSize}`}
                placeholder="Search clients"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </div>
            <select
              className={`${densityConfig.fontSize} bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1`}
              value={repFilter}
              onChange={(event) => setRepFilter(event.target.value)}
            >
              {availableReps.map((rep) => (
                <option key={rep} value={rep}>
                  {rep === 'All' ? 'All Reps' : rep}
                </option>
              ))}
            </select>
            <select
              className={`${densityConfig.fontSize} bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1`}
              value={provinceFilter}
              onChange={(event) => setProvinceFilter(event.target.value)}
            >
              {availableProvinces.map((province) => (
                <option key={province} value={province}>
                  {province === 'All' ? 'All Areas' : province}
                </option>
              ))}
            </select>
            <button
              onClick={() => setNoPurchaseOnly(!noPurchaseOnly)}
              className={`flex items-center gap-1.5 ${densityConfig.fontSize} font-semibold border rounded-lg transition-colors ${
                noPurchaseOnly
                  ? 'bg-brand-blue text-white border-brand-blue'
                  : 'bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              } px-2.5 py-1`}
            >
              No purchase
            </button>
            <div className="flex items-center gap-1">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatusFilter(status)}
                  className={`text-[10px] font-semibold ${densityConfig.badgePadding} rounded-full border transition-colors ${
                    statusFilters.includes(status)
                      ? 'bg-brand-blue text-white border-brand-blue'
                      : 'bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden" ref={masterViewportWrapperRef}>
          {activeTab === 'master' && (
            <div
              ref={masterScrollRef}
              className="h-full overflow-y-auto relative"
              style={{ height: `${masterViewportHeight}px` }}
              onScroll={handleMasterTableScroll}
            >
              {isFiltering && (
                <div className="absolute inset-0 z-20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px] transition-opacity duration-200 pointer-events-none flex items-center justify-center">
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Filtering
                  </div>
                </div>
              )}
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-800" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 sticky top-0 z-10">
                  <tr>
                    <th className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} text-left text-[11px] font-semibold uppercase tracking-wide`} style={{ width: '30%' }}>
                      Client
                    </th>
                    <th className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} text-left text-[11px] font-semibold uppercase tracking-wide`} style={{ width: '12%' }}>
                      Status
                    </th>
                    <th className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} text-left text-[11px] font-semibold uppercase tracking-wide`} style={{ width: '15%' }}>
                      <button
                        className="flex items-center gap-1"
                        onClick={() => {
                          const newField = 'lastContact';
                          if (sortField === newField) {
                            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setSortField(newField);
                            setSortDirection('desc');
                          }
                        }}
                      >
                        Last Contact
                        {sortField === 'lastContact' && (
                          <ArrowUpRight className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                    </th>
                    <th className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} text-left text-[11px] font-semibold uppercase tracking-wide`} style={{ width: '12%' }}>
                      Last Purchase
                    </th>
                    <th className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} text-left text-[11px] font-semibold uppercase tracking-wide`} style={{ width: '15%' }}>
                      <button
                        className="flex items-center gap-1"
                        onClick={() => {
                          const newField = 'salesValue';
                          if (sortField === newField) {
                            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setSortField(newField);
                            setSortDirection('desc');
                          }
                        }}
                      >
                        Potential
                        {sortField === 'salesValue' && (
                          <ArrowUpRight className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                    </th>
                    <th className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} text-left text-[11px] font-semibold uppercase tracking-wide`} style={{ width: '10%' }}>
                      Priority
                    </th>
                    <th className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} text-center text-[11px] font-semibold uppercase tracking-wide`} style={{ width: '160px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800" style={{ transform: `translateY(${masterVirtual.offsetTop}px)` }}>
                  {masterVirtual.visibleItems.map((row) => (
                    <MasterTableRow
                      key={row.contact.id}
                      row={row}
                      densityConfig={densityConfig}
                      tableRowHeight={tableRowHeight}
                      selectedClientId={selectedClientId}
                      onSelectClient={handleSelectClient}
                      onCallContact={handleMasterRowCall}
                      onOpenSMSModal={handleMasterRowSMS}
                      onOpenPatientChart={handleMasterRowDetails}
                    />
                  ))}
                  {masterRows.length > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={7}
                        style={{
                          height: `${Math.max(0, masterVirtual.totalHeight - (masterVirtual.visibleItems.length * tableRowHeight))}px`,
                          padding: 0
                        }}
                      />
                    </tr>
                  )}
                  {masterRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className={`${densityConfig.cellPadding} ${densityConfig.rowPadding} text-center text-sm text-slate-500 dark:text-slate-400`}>
                        {dataUnavailable ? 'Client data is unavailable. Retry loading the dashboard.' : 'No clients match the current filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'today' && (
            <div className="h-full overflow-y-auto p-4">
              {hasLoadedData ? (
                <AgentCallActivity
                  callLogs={callLogs}
                  inquiries={inquiries}
                  contacts={contacts}
                  maxItems={50}
                  title="Today's Call List"
                />
              ) : (
                <div className="text-sm text-rose-500 text-center py-6">Call activity unavailable</div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Activity Highlights</h3>
                <button
                  onClick={handleActivityReadAll}
                  className="text-xs font-semibold text-brand-blue hover:underline"
                >
                  Mark all seen
                </button>
              </div>
              <div className="space-y-3">
                {activityItems.map((activity) => (
                  <div
                    key={activity.id}
                    className={`p-3 rounded-xl border ${activity.read ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60' : 'border-brand-blue/20 bg-blue-50/60 dark:bg-blue-900/30'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        {activity.type === 'report' ? <ShieldAlert className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                        {activity.type === 'report' ? 'Owner' : 'Stock'}
                      </span>
                      {!activity.read && (
                        <button
                          onClick={() => handleActivityRead(activity.id)}
                          className="text-[11px] font-semibold text-brand-blue hover:underline"
                        >
                          Mark seen
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 font-semibold">{activity.title}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{activity.message}</p>
                    <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                      {formatRelativeTime(activity.timestamp)}
                    </div>
                  </div>
                ))}
                {activityItems.length === 0 && (
                  <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-6">No recent activity</div>
                )}
              </div>
            </div>
           )}
        </div>
      </section>
      {detailsPanelOpen && selectedClient && (
        <div className="fixed inset-y-0 right-0 w-[35%] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right-10 duration-300">
          <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Phone className="w-5 h-5 text-brand-blue" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">{selectedClient.company}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedClient.province}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPatientChart(true)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-brand-blue transition-colors"
                title="Open Patient Chart"
              >
                <ClipboardList className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowContactDetails(true)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-brand-blue transition-colors"
                title="Open Full Details"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button
                onClick={() => setDetailsPanelOpen(false)}
                className="p-1 rounded-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                aria-label="Close details panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className={`px-2 py-0.5 rounded-full font-semibold ${statusBadgeClasses(selectedClient.status)}`}>
                {selectedClient.status}
              </span>
              <span>Assigned: {selectedClient.salesman}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCallContact(selectedClient)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-brand-blue hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call
              </button>
              <button
                onClick={() => handleOpenSMSModal(selectedClient)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500 hover:text-white transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                SMS
              </button>
              <button
                onClick={() => handleEmailContact(selectedClient)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-500 hover:text-white transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button
                onClick={() => handleOpenSalesInquiry(selectedClient.id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <FileText className="w-4 h-4" />
                Sales Inquiry
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">Communication History</span>
                <div className="flex items-center gap-1">
                  {(['all', 'calls', 'sms'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setHistoryTab(tab)}
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${
                        historyTab === tab
                          ? 'bg-brand-blue text-white border-brand-blue'
                          : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {tab === 'all' ? 'All' : tab === 'calls' ? 'Calls' : 'SMS'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {filteredTimeline.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        {event.type === 'call' ? (
                          event.channel === 'text' ? (
                            <MessageSquare className="w-4 h-4 text-purple-500" />
                          ) : (
                            <PhoneCall className="w-4 h-4 text-brand-blue" />
                          )
                        ) : (
                          <ClipboardList className="w-4 h-4 text-amber-500" />
                        )}
                        <span>{event.title}</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(event.occurred_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {event.type === 'call' && event.direction && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          event.direction === 'inbound'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {event.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                        </span>
                      )}
                      {event.type === 'call' && event.outcome && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          event.outcome === 'positive'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : event.outcome === 'negative'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}>
                          {event.outcome.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    {event.detail && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-800">
                        {event.detail}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{event.meta}</p>
                  </div>
                ))}
                {filteredTimeline.length === 0 && (
                  <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    {historyTab === 'all' ? 'No activity logged yet' : `No ${historyTab === 'calls' ? 'call' : 'SMS'} history`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {detailsPanelOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setDetailsPanelOpen(false)}
        />
      )}


      {showSMSModal && smsRecipient && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Send SMS</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{smsRecipient.company}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSMSModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  To
                </label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {smsRecipient.mobile || smsRecipient.phone || smsRecipient.contactPersons[0]?.mobile || smsRecipient.contactPersons[0]?.telephone || 'No phone number'}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Message
                </label>
                <textarea
                  value={smsMessage}
                  onChange={(e) => setSMSMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={5}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {smsMessage.length} characters
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Max 160 characters recommended
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowSMSModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendSMS}
                  disabled={!smsMessage.trim() || sendingSMS}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendingSMS ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {sendingSMS ? 'Sending...' : 'Send SMS'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPatientChart && selectedClient && (
        <CustomerProfileModal
          contact={selectedClient}
          currentUser={currentUser}
          onClose={() => setShowPatientChart(false)}
        />
      )}

      {showContactDetails && selectedClient && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950">
          <ContactDetails
            contact={selectedClient}
            currentUser={currentUser}
            onClose={() => setShowContactDetails(false)}
            onUpdate={(updated) => {
              setContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DailyCallMonitoringView;
