import { describe, expect, it } from 'vitest';
import { TOPBAR_MENU_CONFIG } from '../../utils/topbarMenuConfig';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('requested dashboard menu and access rules', () => {
  it('contains exactly the four requested dashboard choices', () => {
    const dashboardMenu = TOPBAR_MENU_CONFIG.find((menu) => menu.id === 'home');
    const labels = dashboardMenu?.submenus?.flatMap((submenu) => submenu.items.map((item) => item.label));
    expect(labels).toEqual([
      'Daily Call Monitoring Dashboard',
      'Operations Dashboard',
      'Sales Performance Dashboard',
      'Call Records',
    ]);
  });

  it('uses distinct direct-link routes and enforces management-only pages', () => {
    const app = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
    expect(app).toContain("case 'operations-management-dashboard':");
    expect(app).toContain("case 'sales-performance-management-dashboard':");
    expect(app).toContain("case 'call-records-dashboard':");
    expect(app.match(/if \(!isMasterUserAccount\(userProfile\)\) return renderAccessDenied\(\);/g)).toHaveLength(3);
  });

  it('marks the extra dashboard pages as master-only in the topbar', () => {
    const dashboardMenu = TOPBAR_MENU_CONFIG.find((menu) => menu.id === 'home');
    const items = dashboardMenu?.submenus?.flatMap((submenu) => submenu.items) || [];
    expect(items.find((item) => item.route === 'home')?.masterOnly).toBeFalsy();
    expect(items.find((item) => item.route === 'operations-management-dashboard')?.masterOnly).toBe(true);
    expect(items.find((item) => item.route === 'sales-performance-management-dashboard')?.masterOnly).toBe(true);
    expect(items.find((item) => item.route === 'call-records-dashboard')?.masterOnly).toBe(true);
  });

  it('labels the old management page as Sales Performance Dashboard', () => {
    const management = readFileSync(resolve(process.cwd(), 'components/ManagementView.tsx'), 'utf8');
    expect(management).toContain('Sales Performance Dashboard');
  });
});
