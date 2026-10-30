import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { fetchStarredCustomerIds } from '../services/customerStarService';
import { CUSTOMER_STAR_UPDATED_EVENT } from '../utils/customerStarEvents';
import type { CustomerStarUpdatedDetail } from '../utils/customerStarEvents';

const CustomerStarContext = createContext<Set<string> | null>(null);

export const CustomerStarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [starredIds, setStarredIds] = useState<Set<string> | null>(null);
  const latestRefreshId = useRef(0);

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
    refresh();
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
    window.addEventListener(CUSTOMER_STAR_UPDATED_EVENT, handleStarUpdate);
    return () => {
      mounted = false;
      latestRefreshId.current += 1;
      window.removeEventListener(CUSTOMER_STAR_UPDATED_EVENT, handleStarUpdate);
    };
  }, []);

  return <CustomerStarContext.Provider value={starredIds}>{children}</CustomerStarContext.Provider>;
};

export const useCustomerStarredIds = (): Set<string> | null => useContext(CustomerStarContext);

interface CustomerStarIndicatorProps {
  customerId?: string | number | null;
  isStarred?: boolean;
  className?: string;
}

/** Shows the shared, read-only star marker next to a customer name. */
const CustomerStarIndicator: React.FC<CustomerStarIndicatorProps> = ({ customerId, isStarred, className = 'h-3.5 w-3.5' }) => {
  const starredIds = useContext(CustomerStarContext);
  const normalizedId = String(customerId ?? '').trim();
  const starred = normalizedId && starredIds ? starredIds.has(normalizedId) : Boolean(isStarred);
  return starred ? <Star aria-label="Starred customer" title="Starred customer" className={`${className} shrink-0 text-amber-500`} fill="currentColor" /> : null;
};

export default CustomerStarIndicator;
