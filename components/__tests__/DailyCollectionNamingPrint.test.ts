import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const entry = readFileSync(resolve(process.cwd(), 'components/DailyCollectionEntryView.tsx'), 'utf8');
const report = readFileSync(resolve(process.cwd(), 'components/CollectionSummaryView.tsx'), 'utf8');

describe('Daily Collection naming and approved output', () => {
  it('uses Daily Collection Entry and displays the creating agent', () => {
    expect(entry).toContain('Daily Collection Entry');
    expect(entry).toContain('Created by: {selectedHeader?.created_by');
  });

  it('gates Print to approved/posted records and keeps Collection Report naming', () => {
    expect(entry).toContain("status === 'Approved' || status === 'Posted'");
    expect(report).toContain('Collection Report');
  });
});
