import { useEffect, useLayoutEffect, useState, useMemo, useCallback, RefObject } from 'react';

interface PositionStyles {
  transform?: string;
  left?: string;
  right?: string;
  maxHeight?: string;
  overflowY?: 'auto' | 'visible';
  top?: string;
  bottom?: string;
}

type Alignment = 'left' | 'center' | 'right';

interface UseSmartDropdownPositionOptions {
  preferredAlignment?: Alignment;
  offset?: number;
  padding?: number;
}

/**
 * Custom hook for smart dropdown positioning with viewport boundary detection
 * 
 * @param triggerRef - Reference to the trigger element (button)
 * @param dropdownRef - Reference to the dropdown element
 * @param isOpen - Whether the dropdown is currently open
 * @param options - Configuration options
 * @returns Position styles object to apply to the dropdown
 */
export function useSmartDropdownPosition(
  triggerRef: RefObject<HTMLElement> | HTMLElement | null,
  dropdownRef: RefObject<HTMLElement> | HTMLElement | null,
  isOpen: boolean,
  options: UseSmartDropdownPositionOptions = {}
): PositionStyles {
  const {
    preferredAlignment = 'center',
    offset = 16,
    padding = 16,
  } = options;

  // Start with default center positioning to prevent jolting
  const [positionStyles, setPositionStyles] = useState<PositionStyles>({
    left: '50%',
    transform: 'translateX(-50%)',
  });

  const calculatePosition = useCallback(() => {
    // Get the actual elements from refs or direct elements
    const triggerElement = triggerRef && 'current' in triggerRef ? triggerRef.current : triggerRef;
    const dropdownElement = dropdownRef && 'current' in dropdownRef ? dropdownRef.current : dropdownRef;

    if (!triggerElement || !dropdownElement) {
      return {};
    }

    if (!isOpen) {
      return {};
    }

    const triggerRect = triggerElement.getBoundingClientRect();
    const dropdownRect = dropdownElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const styles: PositionStyles = {};

    // Calculate available space in all directions
    const spaceAbove = triggerRect.top;
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;

    // Determine horizontal alignment
    const dropdownWidth = dropdownRect.width;
    const triggerCenter = triggerRect.left + triggerRect.width / 2;

    if (dropdownWidth > viewportWidth - padding * 2) {
      // Dropdown is wider than viewport - use full width with padding
      styles.left = `${padding}px`;
      styles.right = `${padding}px`;
      styles.transform = 'none';
    } else if (preferredAlignment === 'center') {
      // Try center alignment first
      const centeredLeft = triggerCenter - dropdownWidth / 2;
      const centeredRight = triggerCenter + dropdownWidth / 2;

      if (centeredLeft >= padding && centeredRight <= viewportWidth - padding) {
        // Center alignment fits
        styles.left = '50%';
        styles.transform = 'translateX(-50%)';
      } else if (centeredRight > viewportWidth - padding) {
        // Would overflow right - align to right edge
        styles.right = `${Math.max(padding, viewportWidth - triggerRect.right)}px`;
        styles.transform = 'none';
      } else {
        // Would overflow left - align to left edge
        styles.left = `${Math.max(padding, triggerRect.left)}px`;
        styles.transform = 'none';
      }
    } else if (preferredAlignment === 'right') {
      const rightAlignedLeft = triggerRect.right - dropdownWidth;
      if (rightAlignedLeft >= padding) {
        styles.right = `${viewportWidth - triggerRect.right}px`;
        styles.transform = 'none';
      } else {
        styles.left = `${padding}px`;
        styles.transform = 'none';
      }
    } else {
      // Left alignment
      const leftAlignedRight = triggerRect.left + dropdownWidth;
      if (leftAlignedRight <= viewportWidth - padding) {
        styles.left = `${triggerRect.left}px`;
        styles.transform = 'none';
      } else {
        styles.right = `${padding}px`;
        styles.transform = 'none';
      }
    }

    // Determine vertical positioning
    const dropdownHeight = dropdownRect.height;
    const availableSpaceBelow = spaceBelow - offset;
    const availableSpaceAbove = spaceAbove - offset;

    if (dropdownHeight <= availableSpaceBelow) {
      // Fits below - default position
      styles.top = 'auto';
      styles.bottom = 'auto';
      styles.maxHeight = `${availableSpaceBelow}px`;
    } else if (dropdownHeight <= availableSpaceAbove) {
      // Doesn't fit below but fits above
      styles.bottom = `calc(100% + ${offset}px)`;
      styles.top = 'auto';
      styles.maxHeight = `${availableSpaceAbove}px`;
    } else {
      // Doesn't fit in either direction - use the larger space
      if (availableSpaceBelow >= availableSpaceAbove) {
        styles.top = 'auto';
        styles.bottom = 'auto';
        styles.maxHeight = `${availableSpaceBelow}px`;
        styles.overflowY = 'auto';
      } else {
        styles.bottom = `calc(100% + ${offset}px)`;
        styles.top = 'auto';
        styles.maxHeight = `${availableSpaceAbove}px`;
        styles.overflowY = 'auto';
      }
    }

    return styles;
  }, [triggerRef, dropdownRef, isOpen, preferredAlignment, offset, padding]);

  // Debounced recalculation function
  const recalculatePosition = useCallback(() => {
    requestAnimationFrame(() => {
      const newStyles = calculatePosition();
      setPositionStyles(newStyles);
    });
  }, [calculatePosition]);

  // Use layout effect for immediate calculation before paint to prevent jolting
  useLayoutEffect(() => {
    if (isOpen) {
      // Synchronous calculation before browser paint
      const newStyles = calculatePosition();
      setPositionStyles(newStyles);
    } else {
      // Reset styles when closed
      setPositionStyles({});
    }
  }, [isOpen, calculatePosition]);

  // Debounced resize handler
  useEffect(() => {
    if (!isOpen) return;

    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(recalculatePosition, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [isOpen, recalculatePosition]);

  // Debounced scroll handler
  useEffect(() => {
    if (!isOpen) return;

    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(recalculatePosition, 150);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      clearTimeout(timeoutId);
    };
  }, [isOpen, recalculatePosition]);

  return positionStyles;
}

