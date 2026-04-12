import { describe, expect, it } from 'vitest';
import {
  createChatMentionToken,
  extractPlainTextFromChatMessage,
  getActiveChatMentionContext,
  parseChatMessageSegments,
  resolveChatMentionScope,
} from '../internalChatMentionUtils';

describe('internalChatMentionUtils', () => {
  it('creates persisted mention tokens with encoded ids', () => {
    expect(createChatMentionToken('Sales Order SO-1001', 'sales-order', 'so/1001')).toBe(
      '[Sales Order SO-1001](mention:sales-order:so%2F1001)'
    );
  });

  it('extracts human-readable text from stored mention tokens', () => {
    expect(
      extractPlainTextFromChatMessage(
        'Please open [Invoice INV-22](mention:invoice:inv-22) and [Product BRK-001](mention:product:prod-1).'
      )
    ).toBe('Please open Invoice INV-22 and Product BRK-001.');
  });

  it('parses plain text and mention segments in order', () => {
    expect(
      parseChatMessageSegments(
        'Check [Order Slip OS-88](mention:order-slip:os-88) before sending.'
      )
    ).toEqual([
      { kind: 'text', text: 'Check ' },
      {
        kind: 'mention',
        mention: {
          label: 'Order Slip OS-88',
          entityType: 'order-slip',
          entityId: 'os-88',
          token: '[Order Slip OS-88](mention:order-slip:os-88)',
        },
      },
      { kind: 'text', text: ' before sending.' },
    ]);
  });

  it('recognizes scoped mention keywords like @invoice and tracks the trailing query', () => {
    expect(resolveChatMentionScope('invoice')).toBe('invoice');
    expect(resolveChatMentionScope('invoi')).toBe('invoice');
    expect(resolveChatMentionScope('so')).toBe('sales-order');

    expect(getActiveChatMentionContext('Please open @invoice INV-22', 'Please open @invoice INV-22'.length)).toEqual({
      start: 12,
      end: 27,
      query: 'INV-22',
      scope: 'invoice',
      scopeKeyword: 'invoice',
    });
  });

  it('keeps generic @mentions unscoped when no special keyword is used', () => {
    expect(getActiveChatMentionContext('@teammate', '@teammate'.length)).toEqual({
      start: 0,
      end: 9,
      query: 'teammate',
      scope: 'all',
      scopeKeyword: null,
    });
  });
});
