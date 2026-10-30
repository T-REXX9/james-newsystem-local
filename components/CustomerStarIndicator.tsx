import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { fetchStarredCustomerIds } from '../services/customerStarService';
import { fetchCustomerIdentifiers } from '../services/customerIdentifierService';
import type { CustomerIdentifier } from '../services/customerIdentifierService';
import { CUSTOMER_STAR_UPDATED_EVENT } from '../utils/customerStarEvents';
import type { CustomerStarUpdatedDetail } from '../utils/customerStarEvents';

const CustomerStarContext = createContext<Set<string> | null>(null);
const CustomerIdentifierContext = createContext<Map<string, CustomerIdentifier[]> | null>(null);

export const CustomerStarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [starredIds, setStarredIds] = useState<Set<string> | null>(null);
  const [identifiersById, setIdentifiersById] = useState<Map<string, CustomerIdentifier[]> | null>(null);
  const latestRefreshId = useRef(0);
  const latestIdentifierRefreshId = useRef(0);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      const refreshId = ++latestRefreshId.current;
      void fetchStarredCustomerIds()
        .then((ids) => {
          if (mounted && refreshId === latestRefreshId.current) {
            setStarredIds(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
          }
        })
        .catch(() => {
          // Keep rendering any page-provided star state when lookup is unavailable.
        });
    };
    const refreshIdentifiers = () => {
      const refreshId = ++latestIdentifierRefreshId.current;
      void fetchCustomerIdentifiers()
        .then((identifiers) => {
          if (mounted && refreshId === latestIdentifierRefreshId.current) setIdentifiersById(identifiers);
        })
        .catch(() => {
          // Preserve the rest of the customer display if the status lookup is unavailable.
        });
    };
    refresh();
    refreshIdentifiers();
    const handleStarUpdate = (event: Event) => {
      const detail = (event as CustomEvent<CustomerStarUpdatedDetail>).detail;
      if (detail?.customerId) {
        const customerId = String(detail.customerId).trim();
        setStarredIds((current) => {
          const next = new Set(current || []);
          if (detail.isStarred) next.add(customerId);
          else next.delete(customerId);
          return next;
        });
      }
      refresh();
    };
    const handleWindowFocus = () => refreshIdentifiers();
    window.addEventListener(CUSTOMER_STAR_UPDATED_EVENT, handleStarUpdate);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      mounted = false;
      latestRefreshId.current += 1;
      latestIdentifierRefreshId.current += 1;
      window.removeEventListener(CUSTOMER_STAR_UPDATED_EVENT, handleStarUpdate);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  return (
    <CustomerStarContext.Provider value={starredIds}>
      <CustomerIdentifierContext.Provider value={identifiersById}>{children}</CustomerIdentifierContext.Provider>
    </CustomerStarContext.Provider>
  );
};

export const useCustomerStarredIds = (): Set<string> | null => useContext(CustomerStarContext);

interface CustomerStarIndicatorProps {
  customerId?: string | number | null;
  isStarred?: boolean;
  className?: string;
}

const IDENTIFIER_STYLES: Record<CustomerIdentifier, string> = {
  'New Customer': 'bg-emerald-100 text-emerald-800',
  'Existing Customer': 'bg-slate-100 text-slate-700',
  'Verified Prospective': 'bg-blue-100 text-blue-800',
  'Unverified Prospective': 'bg-amber-100 text-amber-800',
  Blacklisted: 'bg-rose-100 text-rose-800',
  'Do Not Call': 'bg-red-100 text-red-800',
};

/** Shows the shared, read-only star marker next to a customer name. */
const CustomerStarIndicator: React.FC<CustomerStarIndicatorProps> = ({ customerId, isStarred, className = 'h-3.5 w-3.5' }) => {
  const starredIds = useContext(CustomerStarContext);
  const identifiersById = useContext(CustomerIdentifierContext);
  const normalizedId = String(customerId ?? '').trim();
  const starred = normalizedId && starredIds ? starredIds.has(normalizedId) : Boolean(isStarred);
  const identifiers = normalizedId ? identifiersById?.get(normalizedId) : undefined;
  return (
    <>
      {starred && <Star aria-label="Starred customer" title="Starred customer" className={`${className} shrink-0 text-amber-500`} fill="currentColor" />}
      {identifiers?.map((identifier) => (
        <span
          key={identifier}
          role="status"
          aria-label={identifier}
          title={identifier}
          className={`ml-1 inline-flex min-w-0 max-w-full whitespace-normal rounded px-1.5 py-0.5 align-middle text-[10px] font-bold leading-tight ${IDENTIFIER_STYLES[identifier]}`}
        >
          {identifier}
        </span>
      ))}
    </>
  );
};

export default CustomerStarIndicator;
