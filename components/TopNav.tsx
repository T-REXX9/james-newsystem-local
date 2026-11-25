
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LogOut, Type } from 'lucide-react';
import { UserProfile } from '../types';
import NotificationCenter from './NotificationCenter';
import TopbarNavigation from './TopbarNavigation';
import InternalChatLauncher from './InternalChatLauncher';
import ProductQuickSearchLauncher from './ProductQuickSearchLauncher';

interface TopNavProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
  onBack?: () => void;
  canGoBack?: boolean;
  user?: UserProfile | null;
  onSignOut?: () => void;
  pageFontScale?: number;
  onPageFontScaleChange?: (scale: number) => void;
}

const MIN_PAGE_FONT_SCALE = 0.8;
const MAX_PAGE_FONT_SCALE = 1.5;
const PAGE_FONT_SCALE_STEP = 0.01;

const TopNav: React.FC<TopNavProps> = ({ activeTab = 'home', onNavigate, onBack, canGoBack = false, user, onSignOut, pageFontScale = 1, onPageFontScaleChange }) => {
  const [isPageFontPanelOpen, setIsPageFontPanelOpen] = useState(false);
  const pageFontControlRef = useRef<HTMLDivElement>(null);
  const pageFontTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  useEffect(() => {
    setIsPageFontPanelOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isPageFontPanelOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!pageFontControlRef.current?.contains(event.target as Node)) {
        setIsPageFontPanelOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPageFontPanelOpen(false);
        pageFontTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPageFontPanelOpen]);

  return (
    <header className="h-16 bg-gradient-to-r from-brand-blue to-[#0a3d74] flex items-center justify-between px-3 sm:px-4 2xl:px-6 fixed top-0 left-0 right-0 z-[1000] text-white shadow-md print:hidden">
      <div className="flex items-center gap-1 sm:gap-3 2xl:gap-6 flex-1 min-w-0">
        {onBack && <button type="button" aria-label="Go back to previous page" onClick={onBack} disabled={!canGoBack} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></button>}
        <div className="flex shrink-0 items-center space-x-2 sm:space-x-3 cursor-pointer group" onClick={() => onNavigate?.('home')}>
           <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/10 rounded-lg flex items-center justify-center font-bold border border-white/10 group-hover:bg-white/20 transition-colors">T</div>
           <div className="flex items-center">
             <span className="hidden sm:inline font-bold text-lg tracking-tight">TND-OPC</span>
           </div>
        </div>

        {onNavigate && (
          <TopbarNavigation activeTab={activeTab} onNavigate={onNavigate} user={user} />
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 2xl:gap-4 2xl:pr-4 shrink-0">
         <ProductQuickSearchLauncher user={user || null} />
         <InternalChatLauncher user={user || null} />

         {/* Notification Center */}
         <NotificationCenter />

         <div className="relative shrink-0" ref={pageFontControlRef}>
           <button
             ref={pageFontTriggerRef}
             type="button"
             onClick={() => setIsPageFontPanelOpen((open) => !open)}
             aria-label={`Adjust current page font size, ${Math.round(pageFontScale * 100)} percent`}
             aria-expanded={isPageFontPanelOpen}
             aria-controls="page-font-size-panel"
             title="Adjust current page font size"
             className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
           >
             <Type className="h-5 w-5" aria-hidden="true" />
           </button>
           {isPageFontPanelOpen && (
             <div
               id="page-font-size-panel"
               role="group"
               aria-labelledby="page-font-size-label"
               className="absolute right-0 top-full z-[1100] mt-2 w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-white/15 bg-[#0a3d74] p-4 text-white shadow-xl"
             >
               <div className="flex items-center justify-between gap-3">
                 <label id="page-font-size-label" htmlFor="page-font-size-slider" className="text-sm font-semibold">Page text size</label>
                 <output htmlFor="page-font-size-slider" aria-live="polite" className="text-sm font-semibold tabular-nums">
                   {Math.round(pageFontScale * 100)}%
                 </output>
               </div>
               <input
                 id="page-font-size-slider"
                 type="range"
                 min={MIN_PAGE_FONT_SCALE * 100}
                 max={MAX_PAGE_FONT_SCALE * 100}
                 step={PAGE_FONT_SCALE_STEP * 100}
                 value={Math.round(pageFontScale * 100)}
                 aria-label="Current page font size"
                 aria-valuetext={`${Math.round(pageFontScale * 100)} percent`}
                 onChange={(event) => onPageFontScaleChange?.(Number(event.currentTarget.value) / 100)}
                 className="mt-4 w-full cursor-pointer accent-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
               />
               <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                 <span>{MIN_PAGE_FONT_SCALE * 100}%</span>
                 <button
                   type="button"
                   onClick={() => onPageFontScaleChange?.(1)}
                   disabled={pageFontScale === 1}
                   className="rounded px-2 py-1 text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                 >
                   Reset
                 </button>
                 <span>{MAX_PAGE_FONT_SCALE * 100}%</span>
               </div>
             </div>
           )}
         </div>
         
         {user ? (
           <div className="flex min-w-0 items-center gap-1 border-l border-white/10 pl-1 sm:gap-2 sm:pl-3 2xl:gap-3 2xl:pl-5">
               <img 
                 src={user.avatar_url || "https://i.pravatar.cc/150?u=default"} 
                 alt="Profile" 
                 className="hidden sm:block w-8 h-8 rounded-full border border-white/10 shadow-sm bg-white/20"
               />
               <div className="flex min-w-0 flex-col items-start">
                 <span className="max-w-[7.5rem] truncate text-xs font-medium leading-tight text-white/90 sm:max-w-[11rem] sm:text-sm">{user.full_name || user.email}</span>
                 <span className="max-w-[7.5rem] truncate text-[10px] uppercase text-white/50 sm:max-w-[11rem]">{[user.role || 'Sales Agent', user.team].filter(Boolean).join(' · ')}</span>
               </div>
               <button onClick={onSignOut} className="p-2 text-white/60 hover:text-white transition-colors" title="Sign Out">
                 <LogOut className="w-4 h-4" />
               </button>
           </div>
         ) : (
           <div className="flex items-center pl-1 sm:pl-3 2xl:pl-5 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse"></div>
           </div>
         )}
      </div>
    </header>
  );
};

export default TopNav;
