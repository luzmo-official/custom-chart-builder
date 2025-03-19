import { formatLocale } from 'd3-format';
import {
  timeDay,
  timeHour,
  timeMinute,
  timeMonth,
  timeSecond,
  timeWeek,
  timeYear
} from 'd3-time';
import { timeFormat, timeFormatLocale } from 'd3-time-format';
import { buildDurationString, calculateDuration } from './calculate-duration';
import { decomposeNumericFormat } from './decompose-numeric-format';
import { DEFAULT_LOCAL_FORMATS } from './default-local-formats';
import { localize } from './localize';
import {
  DEFAULT_DATETIME_FORMAT,
  SMART_DATE_FORMATS,
  SMART_TIME_FORMATS
} from './smart-datetime-formats.const';
import type { ColumnType } from '@luzmo/dashboard-contents-types';
import { isEmpty, isNumeric, isString } from '../types.utils';

export function formatter(
  content: any,
  options?: {
    level?: number;
    locale?: string;
    localFormats?: Record<string, any>;
    multi?: boolean;
    hideDuration?: boolean;
    hideCurrency?: boolean;
    trimZero?: boolean;
  }
): (value: number | string | Date) => string {
  options = options || {};

  const localFormats = (options.localFormats || DEFAULT_LOCAL_FORMATS) as any;

  let formatFunction: (value: any) => string;
  let numericFormatFunction: (value: number) => string;
  let dateFormatFunction: (value: any) => any;
  let dateFormats: any = [];
  let timeFormats: any = [];
  let type: ColumnType = 'datetime';
  let format: string;

  if (options && options.multi) {
    type = 'datetime';
  }

  if (!content || !content.format) {
    type = 'hierarchy';
  }

  if (content && content.type) {
    type = content.type;
  }

  if (content && content.format) {
    format = content.format;
  } else if (type === 'numeric') {
    format = ',.0f';
  } else if (type === 'datetime') {
    format = DEFAULT_DATETIME_FORMAT;
  } else {
    format = '';
  }

  // we can still have hierarchy or datetime used with count / distinct count as numeric
  // TODO: make sure everything object uses t.work & set the type
  const decomp = decomposeNumericFormat(format);

  if (decomp.precision && decomp.typeFormat) {
    type = 'numeric';
  }

  switch (type) {
    case 'numeric': {
      // 'Split' duration formatting (5d 4h 20m 25s)
      if (
        content.subtype === 'duration' &&
        content.duration &&
        content.duration.levels &&
        content.duration.levels.length > 1 &&
        !options.hideDuration
      ) {
        formatFunction = (value) =>
          isEmpty(value)
            ? ''
            : buildDurationString(
                value,
                content,
                content.duration.levels,
                localFormats
              );
      } else {
        // Normal numeric formatting or 'fixed' duration formatting (120.5h)
        const useFormat = { ...localFormats };

        let typeFormat: string = decomp.typeFormat;
        let localeAwareNumberFormat = false;

        // Check if typeFormat is prefixed with 'a' -> if so, we're in locale-aware formatting mode. Slice off the 'a' for further processing.
        if (typeFormat.length === 2 && typeFormat.startsWith('a')) {
          localeAwareNumberFormat = true;
          typeFormat = typeFormat.slice(1, 2);
          format = format.replace(/a/, '');
        }

        if (localeAwareNumberFormat) {
          useFormat.decimal = localFormats.decimal;
          useFormat.thousands = localFormats.thousands;
        } else {
          if (['z', 'y', 'w'].includes(typeFormat)) {
            useFormat.decimal = ',';
            useFormat.thousands = '.';
          } else {
            useFormat.decimal = '.';
            useFormat.thousands = ',';
          }
        }

        switch (typeFormat) {
          case 'z': {
            format = format.replace('z', 'f');
            break;
          }
          case 'y': {
            format = format.replace('y', '%');
            break;
          }
          case 'w': {
            format = format.replace('w', 's');
            break;
            // No default
          }
        }

        if (content?.subtype === 'currency' && content.currency) {
          const spaceChar = '\u00A0';
          // useFormat.currency is always an array with 2 elements where 1 of them is empty. e.g.: ["", "\u00a0€"].
          const currencySignIndex = useFormat.currency.findIndex(
            (v: string) => v.length > 0
          );
          const hasSpaceBefore =
            useFormat.currency[currencySignIndex].startsWith(spaceChar);
          const hasSpaceAfter =
            useFormat.currency[currencySignIndex].endsWith(spaceChar);
          const currency = `${hasSpaceBefore ? spaceChar : ''}${content.currency}${hasSpaceAfter ? spaceChar : ''}`;

          useFormat.currency[currencySignIndex] = currency;
        }

        const localeFormat = formatLocale(useFormat);

        if (
          typeFormat !== '%' &&
          content?.subtype === 'currency' &&
          content.currency &&
          useFormat.currency &&
          !options?.hideCurrency &&
          !['count', 'distinctcount'].includes(content.aggregationFunc) &&
          !(
            content.aggregationFunc === 'rate' &&
            content.aggregationWeight?.columnSubType === 'currency'
          ) &&
          content.periodOverPeriod?.type !== 'percentageChange'
        ) {
          format = '$' + format;
        }

        if (
          options?.trimZero &&
          ['y', '%'].includes(typeFormat) &&
          useFormat.decimal === ','
        ) {
          numericFormatFunction = (x) =>
            localeFormat
              .format(format)(x)
              .replace(/(,\d*?)0+%$/, '$1%')
              .replace(/,%$/, '%');
        } else if (
          options?.trimZero &&
          ['y', '%'].includes(typeFormat) &&
          useFormat.decimal === '.'
        ) {
          numericFormatFunction = (x) =>
            localeFormat
              .format(format)(x)
              .replace(/(\.\d*?)0+%$/, '$1%')
              .replace(/\.%$/, '%');
        } else if (
          options?.trimZero &&
          ['z', 'f'].includes(typeFormat) &&
          useFormat.decimal === ','
        ) {
          numericFormatFunction = (x) =>
            localeFormat
              .format(format)(x)
              .replace(/(,\d*?)0+$/, '$1')
              .replace(/,$/, '');
        } else if (
          options?.trimZero &&
          ['z', 'f'].includes(typeFormat) &&
          useFormat.decimal === '.'
        ) {
          numericFormatFunction = (x) =>
            localeFormat
              .format(format)(x)
              .replace(/(\.\d*?)0+$/, '$1')
              .replace(/\.$/, '');
        } else if (
          content?.subtype === 'currency' &&
          content.currency &&
          useFormat.currency &&
          typeFormat === 's'
        ) {
          numericFormatFunction = (x) =>
            localeFormat.format(format)(x).replace(/G/, 'B');
        } else {
          // Invalid numeric format if decomp.precision is undefined.
          numericFormatFunction = isEmpty(decomp.precision)
            ? localeFormat.format(',.0f')
            : localeFormat.format(format);
        }

        formatFunction = (value) => {
          if (isEmpty(value)) {
            return '';
          }

          if (
            content.subtype === 'duration' &&
            content.duration &&
            !options.hideDuration
          ) {
            // If difference in duration interpretation level and display level -> re-calculate value (e.g. 1540 min to 25.67 hr)
            const level = content.duration.levels
              ? content.duration.levels[0]
              : content.lowestLevel;

            if (level !== content.lowestLevel) {
              value = calculateDuration(value, content.lowestLevel, level);
            }

            return (
              numericFormatFunction(value) +
              localFormats?.durationShortSuffix?.[level]
            );
          }

          return numericFormatFunction(value);
        };
      }

      break;
    }
    case 'datetime': {
      dateFormats = localFormats?.smartDateFormats ?? SMART_DATE_FORMATS;
      timeFormats = localFormats?.smartTimeFormats ?? SMART_TIME_FORMATS;

      if (isEmpty(content.datetimeDisplayMode)) {
        if (options?.level) {
          const level = options.level;
          const matchingDateFormat: any = dateFormats.find((f: any) =>
            format.includes(f.key)
          );
          const matchingTimeFormat: any = timeFormats.find((f: any) =>
            format.includes(f.key)
          );

          // If no matching dateFormat found in the defined smartDateFormats list (see top of file), default to the first one of the list.
          const dateFormatValue = matchingDateFormat
            ? matchingDateFormat['lev' + Math.min(level, 5)]
            : dateFormats[0]['lev' + Math.min(level, 5)];
          // If no matching timeFormat found in the defined smartTimeFormats list (see top of file), default to the first one of the list.
          const timeFormatValue =
            level > 5
              ? matchingTimeFormat
                ? matchingTimeFormat['lev' + level]
                : timeFormats[0]['lev' + level]
              : '';

          format =
            level > 5
              ? dateFormatValue + ', ' + timeFormatValue
              : dateFormatValue;

          const isLocaleAwareDateFormat =
            format.includes('%amd') && options.level >= 5;
          const isLocaleAwareSeparator = matchingDateFormat
            ? options.level >= 2 && matchingDateFormat.separator === '~'
            : false;

          if (isLocaleAwareDateFormat) {
            // Replace locale-aware date format '%amd' by the correct '%d-%m' or '%m-%d' format, retrieved from the locale JSON.
            format = isLocaleAwareSeparator
              ? // Fully use the date format defined in the locale JSON, including its separators.
                format.replaceAll(
                  new RegExp(/%amd[.~\/-]%Y/g),
                  localFormats.date.slice(0, 8)
                )
              : // Use the date format defined in the locale JSON, but replace the seperators to the hardcoded separator configured in the slot menu.
                format.replaceAll(
                  new RegExp(/%amd[.~\/-]%Y/g),
                  localFormats.date
                    .slice(0, 8)
                    .replaceAll(
                      new RegExp(/[.~\/-]/g),
                      matchingDateFormat.separator
                    )
                );
          } else {
            format = isLocaleAwareSeparator
              ? // No locale aware date format but locale aware separator: replace locale aware '~' separator by correct separator from locale JSON.
                format.replaceAll(
                  new RegExp(/[~]/g),
                  localFormats.dateSeparator
                )
              : // No locale aware format and no locale aware separator: no action required.
                format;
          }
        }

        if (options?.multi) {
          const formatMillisecond = timeFormat(localFormats.multi[0]);
          const formatSecond = timeFormat(localFormats.multi[1]);
          const formatMinute = timeFormat(localFormats.multi[2]);
          const formatHour = timeFormat(localFormats.multi[3]);
          const formatDay = timeFormat(localFormats.multi[4]);
          const formatWeek = timeFormat(localFormats.multi[6]);
          const formatMonth = timeFormat(localFormats.multi[7]);
          const formatYear = timeFormat(localFormats.multi[8]);

          // Define filter conditions
          dateFormatFunction = (date) => {
            let temporaryFunction: (value: Date) => string;

            if (timeSecond(date) < date) {
              temporaryFunction = formatMillisecond;
            } else if (timeMinute(date) < date) {
              temporaryFunction = formatSecond;
            } else if (timeHour(date) < date) {
              temporaryFunction = formatMinute;
            } else if (timeDay(date) < date) {
              temporaryFunction = formatHour;
            } else if (timeMonth(date) < date) {
              temporaryFunction =
                timeWeek(date) < date ? formatDay : formatWeek;
            } else if (timeYear(date) < date) {
              temporaryFunction = formatMonth;
            } else {
              temporaryFunction = formatYear;
            }

            return temporaryFunction(date);
          };
        } else {
          const localeFormat = timeFormatLocale(localFormats);
          dateFormatFunction = localeFormat.format(format);
        }
      } else {
        const minMax: Record<string, { min: number; max: number }> = {
          quarter_number: { min: 1, max: 4 },
          month_name: { min: 1, max: 12 },
          month_number: { min: 1, max: 12 },
          week_number: { min: 1, max: 53 },
          day_in_month: { min: 1, max: 31 },
          day_in_year: { min: 1, max: 366 },
          weekday_name: { min: 0, max: 7 },
          weekday_number: { min: 0, max: 7 },
          hour_in_day: { min: 0, max: 23 },
          minute_in_hour: { min: 0, max: 59 },
          second_in_minute: { min: 0, max: 59 }
        };

        const getFormattedLevelName = (
          names: { shortNames: string[]; longNames: string[] },
          mode: 'letter' | 'short' | 'long',
          index: number
        ): string => {
          if (mode === 'letter') {
            return names.shortNames?.length > 0 &&
              names.shortNames[index]?.length > 0
              ? names.shortNames[index]?.charAt(0)
              : 'N/A';
          } else if (mode === 'short') {
            return names.shortNames?.length > 0 && names.shortNames[index]
              ? names.shortNames[index]
              : 'N/A';
          }

          return names.longNames?.length > 0 && names.longNames[index]
            ? names.longNames[index]
            : 'N/A';
        };

        if (
          [
            'quarter_number',
            'month_number',
            'week_number',
            'day_in_month',
            'day_in_year',
            'weekday_number',
            'hour_in_day',
            'minute_in_hour',
            'second_in_minute'
          ].includes(content.datetimeDisplayMode)
        ) {
          dateFormatFunction = (value: number) =>
            isNumeric(value) &&
            value >= minMax[content.datetimeDisplayMode].min &&
            value <= minMax[content.datetimeDisplayMode].max
              ? value
              : 'N/A';
        } else if (content.datetimeDisplayMode === 'month_name') {
          dateFormatFunction = (value: number) => {
            const shortNames: string[] = [...localFormats.shortMonths];
            const longNames: string[] = [...localFormats.months];

            // Map value to an array index: substract 1.
            return isNumeric(value) &&
              value >= minMax[content.datetimeDisplayMode].min &&
              value <= minMax[content.datetimeDisplayMode].max
              ? getFormattedLevelName(
                  { shortNames, longNames },
                  content.monthNameFormat,
                  value - 1
                )
              : 'N/A';
          };
        } else if (content.datetimeDisplayMode === 'weekday_name') {
          dateFormatFunction = (value: number) => {
            const shortNames: string[] = [...localFormats.shortDays];
            const longNames: string[] = [...localFormats.days];

            // days and shortDays arrays have Sunday as first day of the week by default. If slot is configured for monday as start of the week: re-sort array.
            if (content.weekStart === 'monday') {
              shortNames.push(shortNames.shift() ?? '');
              longNames.push(longNames.shift() ?? '');
            }

            // Map value to an array index: substract 1.
            return isNumeric(value) &&
              value >= minMax[content.datetimeDisplayMode].min &&
              value <= minMax[content.datetimeDisplayMode].max
              ? getFormattedLevelName(
                  { shortNames, longNames },
                  content.weekDayNameFormat,
                  value - 1
                )
              : 'N/A';
          };
        } else {
          const localeFormat = timeFormatLocale(localFormats);
          dateFormatFunction = localeFormat.format(format);
        }
      }

      formatFunction = (value) => {
        if (isEmpty(value)) {
          return '';
        }

        const formattedValue = dateFormatFunction(value);

        return isString(formattedValue)
          ? formattedValue.trim()
          : formattedValue;
      };

      break;
    }
    case 'hierarchy': {
      formatFunction = (value) =>
        localize(value, options ? options.locale : undefined);
      break;
    }

    default: {
      formatFunction = (value) => value;
      break;
    }
  }

  return formatFunction;
}
