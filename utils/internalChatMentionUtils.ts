export type ChatMentionEntityType = 'sales-inquiry' | 'sales-order' | 'order-slip' | 'invoice' | 'product';

export interface ChatMentionLink {
  label: string;
  entityType: ChatMentionEntityType;
  entityId: string;
  token: string;
}

export type ChatMentionScope = ChatMentionEntityType | 'all';

export interface ActiveChatMentionContext {
  start: number;
  end: number;
  query: string;
  scope: ChatMentionScope;
  scopeKeyword: string | null;
}

export type ChatMessageSegment =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'mention';
      mention: ChatMentionLink;
    };

const CHAT_MENTION_REGEX = /\[([^\]\n]+)\]\(mention:([a-z-]+):([^)]+)\)/g;

const CHAT_MENTION_TYPES = new Set<ChatMentionEntityType>([
  'sales-inquiry',
  'sales-order',
  'order-slip',
  'invoice',
  'product',
]);

const CHAT_MENTION_SCOPE_ALIASES: Record<string, ChatMentionEntityType> = {
  salesinquiry: 'sales-inquiry',
  'sales-inquiry': 'sales-inquiry',
  inquiry: 'sales-inquiry',
  si: 'sales-inquiry',
  salesorder: 'sales-order',
  'sales-order': 'sales-order',
  order: 'sales-order',
  so: 'sales-order',
  orderslip: 'order-slip',
  'order-slip': 'order-slip',
  slip: 'order-slip',
  os: 'order-slip',
  invoice: 'invoice',
  inv: 'invoice',
  product: 'product',
  products: 'product',
  prod: 'product',
};

const normalizeMentionLabel = (value: string): string =>
  String(value || '')
    .replace(/[\[\]\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isChatMentionEntityType = (value: string): value is ChatMentionEntityType =>
  CHAT_MENTION_TYPES.has(value as ChatMentionEntityType);

export const resolveChatMentionScope = (keyword: string): ChatMentionEntityType | null =>
  {
    const normalized = String(keyword || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const exactMatch = CHAT_MENTION_SCOPE_ALIASES[normalized];
    if (exactMatch) {
      return exactMatch;
    }

    const matchingEntityTypes = Array.from(
      new Set(
        Object.entries(CHAT_MENTION_SCOPE_ALIASES)
          .filter(([alias]) => alias.startsWith(normalized))
          .map(([, entityType]) => entityType)
      )
    );

    return matchingEntityTypes.length === 1 ? matchingEntityTypes[0] : null;
  };

export const createChatMentionToken = (
  label: string,
  entityType: ChatMentionEntityType,
  entityId: string
): string => {
  const normalizedLabel = normalizeMentionLabel(label);
  const normalizedId = String(entityId || '').trim();
  if (!normalizedLabel || !normalizedId) {
    return normalizedLabel;
  }

  return `[${normalizedLabel}](mention:${entityType}:${encodeURIComponent(normalizedId)})`;
};

export const extractPlainTextFromChatMessage = (message: string): string =>
  String(message || '').replace(CHAT_MENTION_REGEX, (_, label: string) => normalizeMentionLabel(label));

export const parseChatMessageSegments = (message: string): ChatMessageSegment[] => {
  const input = String(message || '');
  if (!input) {
    return [];
  }

  const segments: ChatMessageSegment[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(CHAT_MENTION_REGEX)) {
    const fullMatch = match[0] || '';
    const label = normalizeMentionLabel(match[1] || '');
    const rawType = String(match[2] || '').trim();
    const rawId = String(match[3] || '').trim();
    const start = match.index ?? -1;
    if (start < 0) {
      continue;
    }

    if (start > lastIndex) {
      segments.push({
        kind: 'text',
        text: input.slice(lastIndex, start),
      });
    }

    if (label && rawId && isChatMentionEntityType(rawType)) {
      segments.push({
        kind: 'mention',
        mention: {
          label,
          entityType: rawType,
          entityId: decodeURIComponent(rawId),
          token: fullMatch,
        },
      });
    } else {
      segments.push({
        kind: 'text',
        text: fullMatch,
      });
    }

    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < input.length) {
    segments.push({
      kind: 'text',
      text: input.slice(lastIndex),
    });
  }

  return segments;
};

export const getActiveChatMentionContext = (
  value: string,
  cursorPosition: number
): ActiveChatMentionContext | null => {
  const safeCursor = Math.max(0, Math.min(cursorPosition, value.length));
  const beforeCursor = value.slice(0, safeCursor);
  const match = beforeCursor.match(/(^|\s)@([^\n\r]*)$/);

  if (!match) {
    return null;
  }

  const rawBody = String(match[2] || '');
  const start = safeCursor - rawBody.length - 1;
  if (start < 0) {
    return null;
  }

  if (rawBody.includes('[') || rawBody.includes('](')) {
    return null;
  }

  const trimmedBody = rawBody.trimStart();
  if (!trimmedBody) {
    return {
      start,
      end: safeCursor,
      query: '',
      scope: 'all',
      scopeKeyword: null,
    };
  }

  const firstSpaceIndex = trimmedBody.search(/\s/);
  const keyword = (firstSpaceIndex >= 0 ? trimmedBody.slice(0, firstSpaceIndex) : trimmedBody).trim();
  const scopedType = resolveChatMentionScope(keyword);

  if (scopedType) {
    const query = firstSpaceIndex >= 0 ? trimmedBody.slice(firstSpaceIndex).trimStart() : '';
    return {
      start,
      end: safeCursor,
      query,
      scope: scopedType,
      scopeKeyword: keyword,
    };
  }

  if (/\s/.test(trimmedBody)) {
    return null;
  }

  return {
    start,
    end: safeCursor,
    query: trimmedBody,
    scope: 'all',
    scopeKeyword: null,
  };
};
