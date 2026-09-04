/** Calendar YYYY-MM-DD in the user's local timezone (not UTC). */
export const formatLocalDateInput = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Local calendar date N days before `date` (default: today). */
export const localDateDaysAgo = (days: number, date: Date = new Date()): string => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - days);
  return formatLocalDateInput(copy);
};
