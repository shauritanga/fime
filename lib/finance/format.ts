export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(value);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentPeriod() {
  return todayISO().slice(0, 7);
}

export function periodFromISODate(value: string) {
  return value.slice(0, 7);
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-TZ', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}
