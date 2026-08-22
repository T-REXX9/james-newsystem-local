import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Operations Dashboard route contract', () => {
  it('only links to modules that App can render', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
    const dashboardSource = readFileSync(resolve(process.cwd(), 'components/OperationsDashboard.tsx'), 'utf8');
    const routes = [
      'sales-transaction-sales-inquiry',
      'sales-transaction-sales-order',
      'sales-transaction-order-slip',
      'sales-transaction-daily-call-monitoring',
      'accounting-transactions-sales-return-credit',
      'accounting-accounting-collection-summary',
      'accounting-reports-accounts-receivable-report',
      'maintenance-profile-activity-logs',
    ];

    routes.forEach((route) => {
      expect(dashboardSource).toContain(`'${route}'`);
      expect(appSource).toContain(`case '${route}'`);
    });
  });
});
