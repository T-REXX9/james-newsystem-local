import { describe, expect, it } from 'vitest';
import { TOPBAR_MENU_CONFIG } from '../../utils/topbarMenuConfig';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('requested dashboard menu and access rules', () => {
  it('contains exactly the three requested dashboard choices', () => {
    const dashboardMenu = TOPBAR_MENU_CONFIG.find((menu) => menu.id === 'home');
    const labels = dashboardMenu?.submenus?.flatMap((submenu) => submenu.items.map((item) => item.label));
    expect(labels).toEqual([
      'Daily Call Monitoring Dashboard',
      'Operations Dashboard',
      'Sales Performance Dashboard',
    ]);
  });

  it('uses distinct direct-link routes and enforces management-only pages', () => {
    const app = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
    expect(app).toContain("case 'operations-management-dashboard':");
    expect(app).toContain("case 'sales-performance-management-dashboard':");
    expect(app.match(/if \(!isCompanyOwnerRole\(userProfile\?\.role\)\) return renderAccessDenied\(\);/g)).toHaveLength(2);
  });

  it('labels the old management page as Sales Performance Dashboard', () => {
    const management = readFileSync(resolve(process.cwd(), 'components/ManagementView.tsx'), 'utf8');
    expect(management).toContain('Sales Performance Dashboard');
  });
});
