import { isEmpty } from '../types.utils';

const conversionMatrix: number[][] = [
  // YEAR
  [
    1, // years
    4, // quarters
    12, // months
    52, // weeks
    365, // days
    365 * 24, // hours
    365 * 24 * 60, // minutes
    365 * 24 * 60 * 60, // seconds
    365 * 24 * 60 * 60 * 1000 // milliseconds
  ],
  // QUARTERS
  [
    1 / 4, // year
    1, // quarters
    3, // months
    13, // weeks
    91, // days
    91 * 24, // hours
    91 * 24 * 60, // minutes
    91 * 24 * 60 * 60, // seconds
    91 * 24 * 60 * 60 * 1000 // milliseconds
  ],
  // MONTHS
  [
    1 / 12, // year
    1 / 3, // quarters
    1, // months
    4, // weeks
    30, // days
    30 * 24, // hours
    30 * 24 * 60, // minutes
    30 * 24 * 60 * 60, // seconds
    30 * 24 * 60 * 60 * 1000 // milliseconds
  ],
  // WEEKS
  [
    1 / 52, // year
    1 / 13, // quarters
    1 / 4, // months
    1, // weeks
    7, // days
    7 * 24, // hours
    7 * 24 * 60, // minutes
    7 * 24 * 60 * 60, // seconds
    7 * 24 * 60 * 60 * 1000 // milliseconds
  ],
  // DAYS
  [
    1 / 365, // year
    1 / 91, // quarters
    1 / 30, // months
    1 / 7, // weeks
    1, // days
    24, // hours
    24 * 60, // minutes
    24 * 60 * 60, // seconds
    24 * 60 * 60 * 1000 // milliseconds
  ],
  // HOURS
  [
    1 / (365 * 24), // year
    1 / (91 * 24), // quarters
    1 / (30 * 24), // months
    1 / (7 * 24), // weeks
    1 / 24, // days
    1, // hours
    60, // minutes
    60 * 60, // seconds
    60 * 60 * 1000 // milliseconds
  ],
  // MINUTES
  [
    1 / (365 * 24 * 60), // year
    1 / (91 * 24 * 60), // quarters
    1 / (30 * 24 * 60), // months
    1 / (7 * 24 * 60), // weeks
    1 / (24 * 60), // days
    1 / 60, // hours
    1, // minutes
    60, // seconds
    60 * 1000 // milliseconds
  ],
  // SECONDS
  [
    1 / (365 * 24 * 60 * 60), // year
    1 / (91 * 24 * 60 * 60), // quarters
    1 / (30 * 24 * 60 * 60), // months
    1 / (7 * 24 * 60 * 60), // weeks
    1 / (24 * 60 * 60), // days
    1 / (60 * 60), // hours
    1 / 60, // minutes
    1, // seconds
    1000 // milliseconds
  ],
  // MILLISECONDS
  [
    1 / (365 * 24 * 60 * 60 * 1000), // year
    1 / (91 * 24 * 60 * 60 * 1000), // quarters
    1 / (30 * 24 * 60 * 60 * 1000), // months
    1 / (7 * 24 * 60 * 60 * 1000), // weeks
    1 / (24 * 60 * 60 * 1000), // days
    1 / (60 * 60 * 1000), // hours
    1 / (60 * 1000), // minutes
    1 / 1000, // seconds
    1 // milliseconds
  ]
];

export function calculateDuration(
  value: number,
  inputLevel: number,
  outputLevel: number
): number | void {
  if (isEmpty(value)) {
    return;
  }

  if (!inputLevel || !outputLevel || inputLevel === outputLevel) {
    return value;
  }

  const factor = conversionMatrix[inputLevel - 1][outputLevel - 1];

  if (factor) {
    return value * factor;
  }
}

/* Function to transform duration value from input level to output string split over multiple levels
  -- e.g. what is 4000 minutes expressed in dd:hh:mm:ss format? */
export function buildDurationString(
  value: number,
  content: any,
  selectedLevels: any,
  localFormats: any
): string {
  if (isEmpty(value) || !content.lowestLevel || selectedLevels.length === 0) {
    return '';
  }

  const result = [];
  let minus = 0;

  // translate value in ms to avoid floating point rounding errors
  let valueInMs = Math.round(
    value * conversionMatrix[content.lowestLevel - 1][8]
  );
  const lowestLevel = 9;

  for (const [, d] of selectedLevels.entries()) {
    if (value) {
      valueInMs = valueInMs - minus;

      // get conversion to Ms
      const factor = conversionMatrix[d - 1][lowestLevel - 1];
      const levelValueMs = Math.floor(valueInMs / factor);

      minus = levelValueMs * factor;
      result.push({ level: d, value: levelValueMs });
    } else {
      result.push({ level: d, value: 0 });
    }
  }

  // 5. Build result string based on suffixes and calculated values
  let durationString = '';

  for (const [index, d] of result.entries()) {
    // Only if level is selected in slot menu, add it to the resulting string
    if (content.duration.format === 'time') {
      let formatted: string | number = d.value;

      if ([6, 7, 8].includes(d.level) && d.value < 10) {
        formatted = '0' + d.value.toString();
      } else if (d.level === 9 && d.value < 10) {
        formatted = '00' + d.value.toString();
      } else if (d.level === 9 && d.value < 100) {
        formatted = '0' + d.value.toString();
      }

      durationString +=
        (index === 0 ? '' : d.level === 9 ? '.' : ':') + formatted;
    } else if (content.duration.format === 'long') {
      const formats = localFormats.durationLongSuffix;

      durationString +=
        d.value +
        ' ' +
        formats[d.level] +
        (index === result.length - 1 ? '' : ' ');
    } else {
      const formats = localFormats.durationShortSuffix;

      durationString +=
        d.value +
        '' +
        formats[d.level] +
        (index === result.length - 1 ? '' : ' ');
    }
  }

  return durationString;
}
