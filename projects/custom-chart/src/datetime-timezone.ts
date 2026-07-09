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

/**
 * For date-level groupings and above, the server already returns values in the
 * dashboard timezone. Parse the wall-clock portion without applying a UTC shift.
 */
function parseServerDatetime(value: unknown): Date {
  const stringValue = value instanceof Date ? value.toISOString() : String(value);
  const wallClock = stringValue.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?)/)?.[1];

  return wallClock ? new Date(wallClock) : new Date(stringValue);
}

/**
 * Converts a UTC instant to a Date whose local components match the wall clock in the
 * given timezone. The Luzmo formatter (via d3-time-format) formats dates in local time,
 * so we build a Date whose local getters reflect the target timezone's wall clock.
 *
 * Uses a fixed `en-US` locale so the intermediate string has a predictable format that
 * `new Date()` can parse reliably across browsers. The locale only affects parsing — the
 * actual timezone shift comes from the `timeZone` option.
 */
function utcToDisplayDate(date: Date, timezoneId: string): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: timezoneId }));
}

/**
 * Shifts a datetime value for display based on the column's aggregation level.
 * Date-level values are parsed as-is; sub-day values are converted from UTC to the dashboard timezone.
 */
export function transformDateToTimezone(value: unknown, level = 9, timezoneId = 'UTC'): Date {
  if (level <= DATE_LEVEL_AND_ABOVE) {
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
  timezoneId = 'UTC'
): string | number | Date {
  if (!slotContent || slotContent.type !== 'datetime') {
    return rawValue as string | number | Date;
  }

  const level = slotContent.drilldownLevel || slotContent.level || 9;

  if (!isDefaultDatetimeDisplayMode(slotContent.datetimeDisplayMode)) {
    return rawValue as string | number | Date;
  }

  return transformDateToTimezone(rawValue, level, timezoneId);
}
