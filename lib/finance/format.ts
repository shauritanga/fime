export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(value);
}

// Dates are stored as local calendar dates (YYYY-MM-DD). Don't use toISOString() here:
// it converts to UTC, which is still "yesterday" just after midnight east of Greenwich.
export function toISODate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function currentPeriod() {
  return todayISO().slice(0, 7);
}

export function periodFromISODate(value: string) {
  return value.slice(0, 7);
}

export function shiftPeriod(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number);
  return toISODate(new Date(year, month - 1 + offset, 1, 12)).slice(0, 7);
}

export function formatPeriod(value: string) {
  return new Intl.DateTimeFormat('en-TZ', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}-01T12:00:00`));
}

export function formatDayHeading(value: string, withYear = false) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (value === todayISO()) {
    return 'Today';
  }
  if (value === toISODate(yesterday)) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat('en-TZ', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
    year: withYear ? 'numeric' : undefined,
  }).format(new Date(`${value}T12:00:00`));
}

export function formatSignedMoney(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatMoney(Math.abs(value))}`;
}

export function isValidISODate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && toISODate(date) === value;
}

// Older versions let dates be typed by hand, so stored values may not be real dates.
export function formatShortDate(value: string) {
  if (!isValidISODate(value)) {
    return value;
  }
  return new Intl.DateTimeFormat('en-TZ', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

export function formatFullDate(value: string) {
  if (!isValidISODate(value)) {
    return value;
  }
  return new Intl.DateTimeFormat('en-TZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

/** The same day next month, or that month's last day when it is shorter. */
export function addMonth(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toISODate(new Date(year, month, Math.min(day, lastDay), 12));
}
