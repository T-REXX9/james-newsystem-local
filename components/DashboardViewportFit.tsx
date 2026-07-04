import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  calculateDashboardFitScale,
  DashboardViewportSize,
  shouldRecalculateDashboardFit,
} from './ownerDashboardViewportFit';

interface DashboardViewportFitProps {
  children: ReactNode;
  revision?: string | number | boolean;
  maxScale?: number;
  designWidth?: number;
}

const DashboardViewportFit: React.FC<DashboardViewportFitProps> = ({
  children,
  revision = 0,
  maxScale = 1.35,
  designWidth,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const viewportSizeRef = useRef<DashboardViewportSize | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const measure = (force = false) => {
      const nextViewportSize = { width: viewport.clientWidth, height: viewport.clientHeight };
      if (!force && !shouldRecalculateDashboardFit(viewportSizeRef.current, nextViewportSize)) return;
      viewportSizeRef.current = nextViewportSize;
      const measuredContentWidth = designWidth || Math.max(content.scrollWidth, content.firstElementChild?.scrollWidth || 0);
      const nextScale = calculateDashboardFitScale({
        availableWidth: viewport.clientWidth,
        availableHeight: viewport.clientHeight,
        contentWidth: measuredContentWidth,
        contentHeight: content.scrollHeight,
        maxScale,
      });
      setScale((currentScale) => Math.abs(currentScale - nextScale) < 0.002 ? currentScale : nextScale);
    };

    let fitFrame = 0;
    const settleFit = () => {
      window.cancelAnimationFrame(fitFrame);
      let remainingPasses = 8;
      const runPass = () => {
        measure(true);
        remainingPasses -= 1;
        if (remainingPasses > 0) fitFrame = window.requestAnimationFrame(runPass);
      };
      runPass();
    };
    const handleViewportResize = () => {
      const nextViewportSize = { width: viewport.clientWidth, height: viewport.clientHeight };
      if (shouldRecalculateDashboardFit(viewportSizeRef.current, nextViewportSize)) settleFit();
    };

    settleFit();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleViewportResize);
    resizeObserver?.observe(viewport);
    window.addEventListener('resize', handleViewportResize);

    return () => {
      window.cancelAnimationFrame(fitFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleViewportResize);
    };
  }, [designWidth, maxScale, revision]);

  return (
    <div
      ref={viewportRef}
      className="h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      data-dashboard-fit-viewport
      data-testid="dashboard-fit-viewport"
    >
      <div
        ref={contentRef}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${100 / scale}%` }}
        data-dashboard-fit-scale={scale.toFixed(4)}
      >
        {children}
      </div>
    </div>
  );
};

export default DashboardViewportFit;
