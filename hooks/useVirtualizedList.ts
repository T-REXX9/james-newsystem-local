import { useCallback, useEffect, useMemo, useState } from 'react';

export interface VirtualizedListOptions {
  itemHeight?: number;
  viewportHeight?: number;
  overscan?: number;
}

export const useVirtualizedList = <T,>(items: T[], options: VirtualizedListOptions = {}) => {
  const { itemHeight = 96, viewportHeight = 320, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
  const maxScrollTop = Math.max(0, items.length * itemHeight - viewportHeight);
  const clampedScrollTop = Math.min(scrollTop, maxScrollTop);
  const rawStartIndex = Math.max(0, Math.floor(clampedScrollTop / itemHeight) - overscan);
  const maxStartIndex = Math.max(0, items.length - visibleCount);
  const startIndex = Math.min(rawStartIndex, maxStartIndex);
  const endIndex = Math.min(items.length, startIndex + visibleCount);

  useEffect(() => {
    if (scrollTop > maxScrollTop) {
      setScrollTop(maxScrollTop);
    }
  }, [scrollTop, maxScrollTop]);

  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);
  const offsetTop = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;

  return { visibleItems, offsetTop, totalHeight, handleScroll, viewportHeight };
};
