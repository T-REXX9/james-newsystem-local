import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const master = readFileSync(resolve(process.cwd(), 'components/DailyCallMasterListView.tsx'), 'utf8');
const owner = readFileSync(resolve(process.cwd(), 'components/OwnerDailyCallMonitoringUnifiedView.tsx'), 'utf8');
const customerService = readFileSync(resolve(process.cwd(), 'services/customerDatabaseLocalApiService.ts'), 'utf8');

describe('Daily Call Monitoring revision rules', () => {
  it('adds prospects as unverified and supports verified or blacklisted outcomes', () => {
    expect(master).toContain('title="Add Prospect"');
    expect(master).toContain("verification: 'Unverified'");
    expect(master).toContain("verification: 'Verified'");
    expect(master).toContain("verification: 'Rejected'");
    expect(master).toContain('CustomerStatus.BLACKLISTED');
    expect(customerService).toContain('user_id: actorId || String(getUserContext().userId)');
  });

  it('uses the documented potential formula and requested monitoring filters', () => {
    expect(owner).toContain('+ (verified.length * VERIFIED_PROSPECT_POTENTIAL)');
    expect(owner).not.toContain('[priority, recovery, verified, unverified]');
    expect(master).toContain('Potential Sales = Priority avg monthly (last 12 months) + Recovery avg monthly (last 12 months of active year) + Blacklisted avg monthly (same as Recovery) + ₱5,000 per verified prospect. Unverified prospects are ₱0.');
    expect(master).toContain('Current VIP Status');
    expect(master).toContain('Next VIP Status');
    expect(master).toContain('Last Purchase');
    expect(master).toContain('Found: {unverifiedCreatedCounts.today} today');
    expect(master).toContain('to next VIP');
  });

  it('keeps category summary metrics to current month and monthly potential only', () => {
    expect(master).not.toMatch(/category\.id === 'priority'[\s\S]*Average Monthly Sales/);
    expect(master).toContain(">Current Month Sales</p>");
    expect(master).toContain(">Monthly Sales Potential</p>");
    expect(master).toContain(">Monthly Potential Sales</p>");
    expect(master).toContain("matchesDailyCallMonitorBucket(row, 'priority')");
  });
});
