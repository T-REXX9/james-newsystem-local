import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import VipStandingBadge, { vipStandingLabel } from '../VipStandingBadge';

describe('VipStandingBadge', () => {
  afterEach(cleanup);

  it.each([
    ['regular', 'Regular'],
    ['silver', 'VIP Silver'],
    ['gold', 'VIP Gold'],
    [undefined, 'Regular'],
    ['legacy-value', 'Regular'],
  ])('uses the glossary label for %s', (tier, label) => {
    render(<VipStandingBadge tier={tier} />);
    expect(screen.getByTestId('vip-standing')).toHaveTextContent(`VIP Status: ${label}`);
    expect(vipStandingLabel(tier)).toBe(label);
  });
});
