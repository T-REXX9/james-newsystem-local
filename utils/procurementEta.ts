const isValidYmd = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value === '1970-01-01') return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

export const resolvePurchaseOrderEta = (
  purchaseOrderDate?: string | null,
  itemEtas: Array<string | null | undefined> = []
): string | null => {
  const itemEta = itemEtas
    .map((value) => String(value || '').slice(0, 10))
    .find(isValidYmd);
  if (itemEta) return itemEta;

  const orderDate = String(purchaseOrderDate || '').slice(0, 10);
  if (!isValidYmd(orderDate)) return null;

  const [year, month, day] = orderDate.split('-').map(Number);
  const eta = new Date(Date.UTC(year, month - 1, day + 30));
  return [
    String(eta.getUTCFullYear()).padStart(4, '0'),
    String(eta.getUTCMonth() + 1).padStart(2, '0'),
    String(eta.getUTCDate()).padStart(2, '0'),
  ].join('-');
};
