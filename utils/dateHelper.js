const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const safeTimezone = (timezone) => {
  if (!timezone) return 'UTC';

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
};

export const dayKey = (date = new Date(), timezone = 'UTC') =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date instanceof Date ? date : new Date(date));

export const dayKeyToUtcDate = (key) => new Date(`${key}T00:00:00.000Z`);

export const shiftDayKey = (key, days) => {
  const shifted = new Date(dayKeyToUtcDate(key).getTime() + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
};

export const previousDayKey = (key) => shiftDayKey(key, -1);

export const nextDayKey = (key) => shiftDayKey(key, 1);

export const diffInDayKeys = (fromKey, toKey) =>
  Math.round((dayKeyToUtcDate(toKey).getTime() - dayKeyToUtcDate(fromKey).getTime()) / DAY_MS);

export const weekdayIndexOfDayKey = (key) => dayKeyToUtcDate(key).getUTCDay();

export const startOfWeekDayKey = (key, startOfWeek = 'monday') => {
  const weekday = weekdayIndexOfDayKey(key);
  const offset = startOfWeek === 'sunday' ? weekday : (weekday + 6) % 7;
  return shiftDayKey(key, -offset);
};

export const buildDailyBuckets = (endKey, options = {}) => {
  const { days = 7, startOfWeek = 'monday', alignToWeek = true } = options;
  const firstKey = alignToWeek ? startOfWeekDayKey(endKey, startOfWeek) : shiftDayKey(endKey, -(days - 1));

  return Array.from({ length: days }, (_, index) => {
    const key = shiftDayKey(firstKey, index);
    return { key, label: WEEKDAY_LABELS[weekdayIndexOfDayKey(key)], count: 0 };
  });
};

export const buildWeeklyBuckets = (endKey, options = {}) => {
  const { weeks = 8, startOfWeek = 'monday' } = options;
  const currentWeekStart = startOfWeekDayKey(endKey, startOfWeek);

  return Array.from({ length: weeks }, (_, index) => {
    const key = shiftDayKey(currentWeekStart, -(weeks - 1 - index) * 7);
    const endOfWeek = shiftDayKey(key, 6);
    return { key, label: `${key.slice(5)} - ${endOfWeek.slice(5)}`, count: 0 };
  });
};

export const buildMonthlyBuckets = (endKey, options = {}) => {
  const { months = 12 } = options;
  const [year, month] = endKey.split('-').map(Number);

  return Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return { key, label: MONTH_LABELS[date.getUTCMonth()], count: 0 };
  });
};

export const buildYearMonthBuckets = (year) =>
  MONTH_LABELS.map((label, index) => ({
    key: `${year}-${String(index + 1).padStart(2, '0')}`,
    label,
    count: 0
  }));

export const zeroFill = (buckets, rows, countField = 'count') => {
  const lookup = new Map(rows.map((row) => [String(row._id), row[countField] ?? row.count ?? 0]));

  return buckets.map((bucket) => ({
    ...bucket,
    [countField]: lookup.get(bucket.key) ?? 0
  }));
};

export const weekRangeFromDayKey = (key, startOfWeek = 'sunday') => {
  const start = startOfWeekDayKey(key, startOfWeek);
  const end = shiftDayKey(start, 6);

  return {
    startKey: start,
    endKey: end,
    start: dayKeyToUtcDate(start),
    end: new Date(dayKeyToUtcDate(end).getTime() + DAY_MS - 1)
  };
};

export const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

export const startOfDayUtc = (date) => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

export const endOfDayUtc = (date) => {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
};

export { DAY_MS, MONTH_LABELS, WEEKDAY_LABELS };
