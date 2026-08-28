import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Operations Dashboard route contract', () => {
  it('only links to modules that App can render', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
    const dashboardSource = readFileSync(resolve(process.cwd(), 'components/OperationsDashboard.tsx'), 'utf8');
    // Validate the links actually rendered; calls now open a breakdown modal.
    const routes = [...new Set([...dashboardSource.matchAll(/'((?:sales|accounting|maintenance)-[a-z-]+)'/g)].map(match => match[1]))];
    expect(routes.length).toBeGreaterThan(0);

    routes.forEach((route) => {
      expect(appSource).toContain(`case '${route}'`);
    });
  });
});
