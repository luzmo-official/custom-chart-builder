import type { GenericSlotContent } from '@luzmo/dashboard-contents-types';

/**
 * Luzmo datetime levels 1–5 (year, quarter, month, week, day).
 * At these levels the API already returns values in the dashboard timezone.
 * Levels 6+ (hour, minute, second, millisecond) are returned as UTC and need a client-side shift.
 *
 * @see https://developer.luzmo.com/guide/guides--querying-data--options.md
 */
export const DATE_LEVEL_AND_ABOVE = 5;

function isDefaultDatetimeDisplayMode(mode?: string | null): boolean {
  return !mode || mode === 'default';
}

function getBrowserOffsetSuffix(date: Date): string {
  const rawBrowserOffset = /([+-]\d+)\s/.exec(date.toString())?.[1] ?? '+0000';

  return `${rawBrowserOffset.slice(0, 3)}:${rawBrowserOffset.slice(3, 5)}`;
}

/**
 * For date-level groupings and above, the server already returns values in the
 * dashboard timezone. Parse the wall-clock portion without applying a UTC shift.
 * Mirrors TimezoneService.transformDateToTimezone for level <= 5.
 */
function parseServerDatetime(value: unknown): Date {
  const referenceDate = new Date(value as string | number | Date);
  const browserOffset = getBrowserOffsetSuffix(referenceDate);
  const stringValue = value instanceof Date ? value.toISOString() : String(value);
  const wallClock = stringValue.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)?.[1];

  return wallClock ? new Date(`${wallClock}${browserOffset}`) : referenceDate;
}

/**
 * Converts a UTC instant to a Date whose local components match the wall clock in the
 * given timezone. The Luzmo formatter (via d3-time-format) formats dates in local time,
 * so we build a Date whose local getters reflect the target timezone's wall clock.
 *
 * Mirrors TimezoneService.transformDateToTimezone for level > 5: format wall clock in the
 * target timezone, append the browser's UTC offset suffix, then parse back to a Date.
 */
function utcToDisplayDate(date: Date, timezoneId: string): Date {
  const browserOffset = getBrowserOffsetSuffix(date);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  }).formatToParts(date);
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '00';
  const formatted = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${get('fractionalSecond') || '000'}${browserOffset}`;

  return new Date(formatted);
}

/**
 * Shifts a datetime value for display based on the column's aggregation level.
 * Date-level values are parsed as-is; sub-day values are converted from UTC to the dashboard timezone.
 */
export function transformDateToTimezone(value: unknown, level: number | undefined, timezoneId: string): Date {
  if (level !== undefined && level <= DATE_LEVEL_AND_ABOVE) {
    return parseServerDatetime(value);
  }

  const utcDate = value instanceof Date ? value : new Date(String(value));

  return utcToDisplayDate(utcDate, timezoneId);
}

/**
 * Prepares a raw slot value for the Luzmo formatter, applying timezone conversion for
 * datetime columns in default display mode. Non-default display modes (e.g. month_number)
 * pass through unchanged as numeric values.
 */
export function getValueForFormatter(
  rawValue: unknown,
  slotContent: GenericSlotContent | undefined,
  timezoneId?: string
): string | number | Date {
  if (!slotContent || slotContent.type !== 'datetime') {
    return rawValue as string | number | Date;
  }

  const level = slotContent.drilldownLevel ?? slotContent.level;

  if (!isDefaultDatetimeDisplayMode(slotContent.datetimeDisplayMode)) {
    return rawValue as string | number | Date;
  }

  if (!timezoneId) {
    return rawValue instanceof Date ? rawValue : new Date(String(rawValue));
  }

  return transformDateToTimezone(rawValue, level, timezoneId);
}
