
import React, { useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { UserProfile } from '../types';
import NotificationCenter from './NotificationCenter';
import TopbarNavigation from './TopbarNavigation';
import InternalChatLauncher from './InternalChatLauncher';
import ProductQuickSearchLauncher from './ProductQuickSearchLauncher';

interface TopNavProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
}

const TopNav: React.FC<TopNavProps> = ({ activeTab = 'home', onNavigate, user, onSignOut }) => {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  return (
    <header className="h-16 bg-gradient-to-r from-brand-blue to-[#0a3d74] flex items-center justify-between px-3 sm:px-4 2xl:px-6 fixed top-0 left-0 right-0 z-[1000] text-white shadow-md print:hidden">
      <div className="flex items-center gap-1 sm:gap-3 2xl:gap-6 flex-1 min-w-0">
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
         <ProductQuickSearchLauncher />
         <InternalChatLauncher user={user || null} />

         {/* Notification Center */}
         <NotificationCenter />
         
         {user ? (
           <div className="flex items-center gap-1 sm:gap-2 2xl:gap-3 pl-1 sm:pl-3 2xl:pl-5 border-l border-white/10">
               <img 
                 src={user.avatar_url || "https://i.pravatar.cc/150?u=default"} 
                 alt="Profile" 
                 className="hidden sm:block w-8 h-8 rounded-full border border-white/10 shadow-sm bg-white/20"
               />
               <div className="flex flex-col items-start">
                 <span className="text-sm font-medium text-white/90 hidden 2xl:block leading-tight">{user.full_name || user.email}</span>
                 <span className="text-[10px] text-white/50 hidden 2xl:block uppercase">{user.role || 'Sales Agent'}</span>
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
