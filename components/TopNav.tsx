
import React, { useState, useEffect } from 'react';
import { LogOut, Sun, Moon } from 'lucide-react';
import { UserProfile } from '../types';
import NotificationCenter from './NotificationCenter';
import TopbarNavigation from './TopbarNavigation';

interface TopNavProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
}

  const TopNav: React.FC<TopNavProps> = ({ activeTab = 'home', onNavigate, user, onSignOut }) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check local storage or default to dark (since index.html has class="dark")
    const savedTheme = localStorage.getItem('theme');
    const html = document.documentElement;

    if (savedTheme === 'light') {
        setIsDark(false);
        html.classList.remove('dark');
    } else {
        setIsDark(true);
        html.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        setIsDark(false);
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        setIsDark(true);
    }
  };

  return (
    <div className="h-16 bg-gradient-to-r from-brand-blue to-[#0a3d74] flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-50 text-white shadow-md print:hidden">
      <div className="flex items-center space-x-6 flex-1 min-w-0">
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => onNavigate?.('home')}>
           <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center font-bold border border-white/10 group-hover:bg-white/20 transition-colors">T</div>
           <div className="flex items-center">
             <span className="font-bold text-lg tracking-tight">TND-OPC</span>
           </div>
        </div>

        {onNavigate && (
          <TopbarNavigation activeTab={activeTab} onNavigate={onNavigate} user={user} />
        )}
      </div>

      <div className="flex items-center space-x-4 pr-4 shrink-0">
         {/* Theme Switcher */}
         <button
           onClick={toggleTheme}
           className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
           title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
         >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
         </button>

         {/* Notification Center */}
         <NotificationCenter />
         
         {user ? (
           <div className="flex items-center space-x-3 pl-5 border-l border-white/10">
               <img 
                 src={user.avatar_url || "https://i.pravatar.cc/150?u=default"} 
                 alt="Profile" 
                 className="w-8 h-8 rounded-full border border-white/10 shadow-sm bg-white/20" 
               />
               <div className="flex flex-col items-start">
                 <span className="text-sm font-medium text-white/90 hidden md:block leading-tight">{user.full_name || user.email}</span>
                 <span className="text-[10px] text-white/50 hidden md:block uppercase">{user.role || 'Sales Agent'}</span>
               </div>
               <button onClick={onSignOut} className="ml-2 text-white/50 hover:text-white transition-colors" title="Sign Out">
                 <LogOut className="w-4 h-4" />
               </button>
           </div>
         ) : (
           <div className="flex items-center space-x-3 pl-5 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse"></div>
           </div>
         )}
      </div>
    </div>
  );
};

export default TopNav;
