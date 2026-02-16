import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Menu,
  X,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import type { UserProfile } from '../types';
import { useKeyboardShortcuts, getShortcutDisplay } from '../hooks/useKeyboardShortcuts';
import { useSmartDropdownPosition } from '../hooks/useSmartDropdownPosition';
import { MODULE_ID_ALIASES } from '../constants';
import {
  TOPBAR_MENU_CONFIG,
  TopbarMainMenu,
  TopbarSubmenu,
  TopbarMenuItem,
} from '../utils/topbarMenuConfig';

interface TopbarNavigationProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  user?: UserProfile | null;
}

const CANONICAL_TO_ALIASES: Record<string, string[]> = Object.entries(MODULE_ID_ALIASES).reduce(
  (acc, [alias, canonical]) => {
    if (!acc[canonical]) acc[canonical] = [];
    acc[canonical].push(alias);
    return acc;
  },
  {} as Record<string, string[]>
);

const TopbarNavigation: React.FC<TopbarNavigationProps> = ({ activeTab, onNavigate, user }) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const menuButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dropdownRefs = useRef<Array<HTMLDivElement | null>>([]);
  const menuCloseTimeout = useRef<number | null>(null);

  const normalizedActiveTab = MODULE_ID_ALIASES[activeTab] || activeTab;

  const canAccessRoute = useCallback((route: string) => {
    if (!user) return false;

    const canonical = MODULE_ID_ALIASES[route] || route;

    if (canonical === 'maintenance-profile-server-maintenance') {
      return user.role === 'Owner' || user.role === 'Developer';
    }

    if (user.role === 'Owner') return true;

    const rights = user.access_rights || [];
    if (rights.length === 0) return false;
    if (rights.includes('*')) return true;
    if (rights.includes(canonical)) return true;

    const aliases = CANONICAL_TO_ALIASES[canonical] || [];
    return aliases.some((aliasId) => rights.includes(aliasId));
  }, [user]);

  const filteredMenus = useMemo(() => {
    const filterItems = (items: TopbarMenuItem[]) =>
      items.filter((item) => canAccessRoute(item.route));

    const filterSubmenus = (submenus: TopbarSubmenu[]) =>
      submenus
        .map((submenu) => ({
          ...submenu,
          items: filterItems(submenu.items),
        }))
        .filter((submenu) => submenu.items.length > 0);

    return TOPBAR_MENU_CONFIG.map((menu) => {
      if (!menu.submenus) return menu;
      const submenus = filterSubmenus(menu.submenus);
      return { ...menu, submenus };
    }).filter((menu) => {
      if (menu.route) return canAccessRoute(menu.route);
      return (menu.submenus || []).length > 0;
    });
  }, [canAccessRoute]);

  const navigateTo = useCallback(
    (route: string) => {
      onNavigate(route);
      setOpenMenuId(null);
      setIsMobileMenuOpen(false);
      if (menuCloseTimeout.current) {
        window.clearTimeout(menuCloseTimeout.current);
        menuCloseTimeout.current = null;
      }
    },
    [onNavigate]
  );

  const closeMenus = useCallback(() => {
    setOpenMenuId(null);
  }, []);

  const clearMenuCloseTimer = () => {
    if (menuCloseTimeout.current) {
      window.clearTimeout(menuCloseTimeout.current);
      menuCloseTimeout.current = null;
    }
  };

  const scheduleMenuClose = () => {
    clearMenuCloseTimer();
    menuCloseTimeout.current = window.setTimeout(() => {
      closeMenus();
    }, 200);
  };

  const focusMenuButton = (index: number) => {
    const button = menuButtonRefs.current[index];
    if (button) {
      button.focus();
    }
  };

  const handleTopMenuKeyDown = (event: React.KeyboardEvent, index: number, menu: TopbarMainMenu) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusMenuButton((index + 1) % filteredMenus.length);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusMenuButton((index - 1 + filteredMenus.length) % filteredMenus.length);
    }
    if (event.key === 'ArrowDown' && menu.submenus) {
      event.preventDefault();
      setOpenMenuId(menu.id);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (menu.route) {
        navigateTo(menu.route);
      } else if (menu.submenus) {
        setOpenMenuId(menu.id);
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenus();
    }
  };

  const isMenuActive = (menu: TopbarMainMenu) => {
    if (menu.route) return normalizedActiveTab === menu.route;
    return menu.submenus?.some((submenu) =>
      submenu.items.some((item) => item.route === normalizedActiveTab)
    );
  };

  const shortcutMap = [
    { key: '1', label: 'Home', route: 'home' },
    { key: '2', label: 'Warehouse', route: 'warehouse-inventory-product-database' },
    { key: '3', label: 'Sales', route: 'sales-transaction-sales-inquiry' },
    { key: '4', label: 'Accounting', route: 'accounting-transactions-freight-charges-debit' },
    { key: '5', label: 'Maintenance', route: 'maintenance-customer-customer-data' },
    { key: '6', label: 'Communication', route: 'communication-text-menu-text-messages' },
  ];

  const shortcuts = useMemo(
    () => [
      {
        key: '?',
        handler: () => setShowHelp(true),
        description: 'Show keyboard shortcuts',
      },
      {
        key: 'escape',
        handler: closeMenus,
        description: 'Close menus',
      },
      ...shortcutMap.map((shortcut) => ({
        key: shortcut.key,
        alt: true,
        handler: () => navigateTo(shortcut.route),
        description: `Go to ${shortcut.label}`,
      })),
    ],
    [closeMenus, navigateTo]
  );

  useKeyboardShortcuts(shortcuts, true);


  return (
    <nav className="flex items-center min-w-0 flex-1" aria-label="Topbar Navigation">
      <div className="md:hidden mr-3">
        <button
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="p-2 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Toggle navigation"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <ul className="hidden md:flex items-center space-x-4 text-[12px] lg:text-sm font-semibold max-w-full pr-2">
        {filteredMenus.map((menu, index) => {
          const isActive = isMenuActive(menu);
          const isOpen = openMenuId === menu.id;
          const submenuCount = menu.submenus?.length || 0;

          // Enhanced responsive width handling
          const containerClass = submenuCount <= 1
            ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 p-4 w-max min-w-[240px] max-w-[min(400px,90vw)] px-4 mx-2'
            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 p-4 min-w-[600px] max-w-[min(900px,90vw)] px-4 mx-2';

          // Responsive grid with mobile breakpoints
          const gridClass = submenuCount <= 1
            ? 'grid gap-4 grid-cols-1'
            : 'grid gap-4 grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]';

          // Use smart positioning hook for each dropdown
          const dropdownPosition = useSmartDropdownPosition(
            menuButtonRefs.current[index],
            dropdownRefs.current[index],
            isOpen,
            { preferredAlignment: 'center', offset: 16, padding: 16 }
          );

          return (
            <li key={menu.id} className="relative">
              <div
                className="relative"
                onMouseEnter={() => {
                  clearMenuCloseTimer();
                  setOpenMenuId(menu.submenus ? menu.id : null);
                }}
                onMouseLeave={scheduleMenuClose}
              >
                <button
                  ref={(el) => {
                    menuButtonRefs.current[index] = el;
                  }}
                  onClick={() => (menu.route ? navigateTo(menu.route) : setOpenMenuId(menu.id))}
                  onKeyDown={(event) => handleTopMenuKeyDown(event, index, menu)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-md transition-colors
                    ${isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'}
                  `}
                  aria-expanded={isOpen}
                  aria-haspopup={menu.submenus ? 'true' : undefined}
                >
                  <menu.icon className="w-4 h-4" />
                  <span>{menu.label}</span>
                  {menu.submenus && <ChevronDown className="w-4 h-4" />}
                </button>

                {menu.submenus && isOpen && (
                  <div
                    ref={(el) => {
                      dropdownRefs.current[index] = el;
                    }}
                    className="absolute top-full pt-4 z-[60]"
                    style={{
                      ...dropdownPosition,
                      visibility: Object.keys(dropdownPosition).length > 0 ? 'visible' : 'hidden',
                      opacity: Object.keys(dropdownPosition).length > 0 ? 1 : 0,
                      transition: 'opacity 120ms ease-out, transform 120ms ease-out, left 120ms ease-out, right 120ms ease-out, top 120ms ease-out, bottom 120ms ease-out',
                    }}
                    onMouseEnter={clearMenuCloseTimer}
                    onMouseLeave={scheduleMenuClose}
                    role="menu"
                  >
                    <div className={`${containerClass} scrollbar-thin`}>
                      <div className={gridClass}>
                        {menu.submenus.map((submenu) => (
                          <div key={submenu.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-3">
                              <submenu.icon className="w-4 h-4" />
                              {submenu.label}
                            </div>
                            <div className="space-y-1">
                              {submenu.items.map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => navigateTo(item.route)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                      closeMenus();
                                    }
                                  }}
                                  className={`
                                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md leading-snug
                                    ${item.route === normalizedActiveTab ? 'bg-brand-blue/10 text-brand-blue' : 'hover:bg-white/70 dark:hover:bg-slate-900'}
                                  `}
                                  role="menuitem"
                                >
                                  <item.icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-800 shadow-lg md:hidden z-[60] backdrop-blur-sm">
          <div className="max-h-[calc(100vh-theme(spacing.20))] overflow-y-auto p-4 space-y-4 scrollbar-thin scroll-smooth">
            {filteredMenus.map((menu) => (
              <div key={menu.id}>
                <button
                  onClick={() => (menu.route ? navigateTo(menu.route) : undefined)}
                  className="w-full flex items-center gap-2 text-left font-semibold text-sm py-2"
                  aria-expanded={menu.submenus ? 'true' : undefined}
                  aria-haspopup={menu.submenus ? 'true' : undefined}
                >
                  <menu.icon className="w-4 h-4" />
                  {menu.label}
                </button>
                {menu.submenus && (
                  <div className="mt-2 space-y-3 pl-6">
                    {menu.submenus.map((submenu) => (
                      <div key={submenu.id} className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 py-1">
                          <submenu.icon className="w-4 h-4" />
                          {submenu.label}
                        </div>
                        <div className="space-y-1" role="menu">
                          {submenu.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => navigateTo(item.route)}
                              className="w-full text-left text-sm py-2 px-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] flex items-center"
                              role="menuitem"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-blue" />
                <h3 className="font-semibold">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Search</span>
                <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  {getShortcutDisplay({ key: 'k', meta: true, handler: () => {}, description: '' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Show help</span>
                <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">?</span>
              </div>
              {shortcutMap.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between">
                  <span>{shortcut.label}</span>
                  <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {getShortcutDisplay({ key: shortcut.key, alt: true, handler: () => {}, description: '' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default TopbarNavigation;
