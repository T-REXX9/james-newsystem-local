import React, { createContext, useContext, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { fetchStarredCustomerIds } from '../services/customerStarService';
import { CUSTOMER_STAR_UPDATED_EVENT } from '../utils/customerStarEvents';

const CustomerStarContext = createContext<Set<string> | null>(null);

export const CustomerStarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [starredIds, setStarredIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void fetchStarredCustomerIds()
        .then((ids) => {
          if (mounted) setStarredIds(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
        })
        .catch(() => {
          // Keep rendering any page-provided star state when lookup is unavailable.
        });
    };
    refresh();
    window.addEventListener(CUSTOMER_STAR_UPDATED_EVENT, refresh);
    return () => {
      mounted = false;
      window.removeEventListener(CUSTOMER_STAR_UPDATED_EVENT, refresh);
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
