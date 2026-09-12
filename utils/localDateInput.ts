const PHILIPPINE_TIME_ZONE = 'Asia/Manila';

const philippineDateParts = (date: Date): { year: number; month: number; day: number } => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
};

/** Calendar YYYY-MM-DD in Philippine time. */
export const formatLocalDateInput = (date: Date = new Date()): string => {
  const { year, month, day } = philippineDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** Local calendar date N days before `date` (default: today). */
export const localDateDaysAgo = (days: number, date: Date = new Date()): string => {
  const { year, month, day } = philippineDateParts(date);
  return formatLocalDateInput(new Date(Date.UTC(year, month - 1, day - days, 12)));
};
