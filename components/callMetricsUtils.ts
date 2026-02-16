import { CallLogEntry, Inquiry } from '../types';

export interface CallOutcomeCounts {
  positive: number;
  follow_up: number;
  negative: number;
  other: number;
}

const parseTimestamp = (value?: string | null) => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const isWithinRange = (value: string | null | undefined, start: Date, end?: Date) => {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) return false;
  const startTime = start.getTime();
  const endTime = end ? end.getTime() : Number.POSITIVE_INFINITY;
  return timestamp >= startTime && timestamp < endTime;
};

export const countCallLogsInRange = (callLogs: CallLogEntry[], start: Date, end?: Date) => {
  const rangeEnd = end ?? new Date();
  return callLogs.reduce((count, log) => (isWithinRange(log.occurred_at, start, rangeEnd) ? count + 1 : count), 0);
};

export const countCallLogsByChannelInRange = (
  callLogs: CallLogEntry[],
  channel: CallLogEntry['channel'],
  start: Date,
  end?: Date
) => {
  const rangeEnd = end ?? new Date();
  return callLogs.reduce(
    (count, log) => (log.channel === channel && isWithinRange(log.occurred_at, start, rangeEnd) ? count + 1 : count),
    0
  );
};

export const countUniqueContactsInRange = (
  callLogs: CallLogEntry[],
  inquiries: Inquiry[],
  start: Date,
  end?: Date
) => {
  const rangeEnd = end ?? new Date();
  const ids = new Set<string>();
  callLogs.forEach((log) => {
    if (isWithinRange(log.occurred_at, start, rangeEnd)) {
      ids.add(log.contact_id);
    }
  });
  inquiries.forEach((inquiry) => {
    if (isWithinRange(inquiry.occurred_at, start, rangeEnd)) {
      ids.add(inquiry.contact_id);
    }
  });
  return ids.size;
};

export const countCallOutcomes = (callLogs: CallLogEntry[]): CallOutcomeCounts => {
  return callLogs.reduce<CallOutcomeCounts>(
    (result, log) => {
      if (log.outcome === 'positive') result.positive += 1;
      else if (log.outcome === 'follow_up') result.follow_up += 1;
      else if (log.outcome === 'negative') result.negative += 1;
      else result.other += 1;
      return result;
    },
    { positive: 0, follow_up: 0, negative: 0, other: 0 }
  );
};

export const getStartOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

export const getStartOfWeek = (weekStartsOn = 1) => {
  const start = getStartOfToday();
  const day = start.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  start.setDate(start.getDate() - diff);
  return start;
};

export const getStartOfMonth = (reference = new Date()) => {
  const start = new Date(reference);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const getStartOfNextMonth = (reference = new Date()) => {
  const start = getStartOfMonth(reference);
  start.setMonth(start.getMonth() + 1);
  return start;
};

export const isWithinCurrentMonth = (value?: string | null, reference = new Date()) => {
  if (!value) return false;
  return isWithinRange(value, getStartOfMonth(reference), getStartOfNextMonth(reference));
};
