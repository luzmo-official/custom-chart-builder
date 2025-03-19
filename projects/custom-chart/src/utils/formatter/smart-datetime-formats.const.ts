import type { FormatLocaleDefinition } from 'd3-format';
import type { TimeLocaleDefinition } from 'd3-time-format';

export type DateFormat = {
  key: string;
  lev1: string;
  lev2: string;
  lev3: string;
  lev4: string;
  lev5: string;
  monthType?: string;
  longText?: boolean;
  weekday?: boolean;
  mmdd?: boolean | null;
  separator?: '/' | '-' | '.' | '~';
};

export type TimeFormat = {
  key: string;
  ampm: boolean;
  lev6: string;
  lev7: string;
  lev8: string;
  lev9: string;
};

export const DEFAULT_DATETIME_FORMAT = '%d-%m-%Y';

export interface LocaleFormat
  extends TimeLocaleDefinition,
    FormatLocaleDefinition {
  dateSeparator?: string;
  durationLongSuffix?: string[];
  durationShortSuffix?: string[];
  levels?: string[];
  multi?: string[];
  shortLevels?: string[];
  smartDateFormats?: DateFormat[];
  smartTimeFormats?: TimeFormat[];
}

export const SMART_DATE_FORMATS: DateFormat[] = [
  {
    key: '%a %e %b %Y',
    lev1: '%Y',
    lev2: 'Q%q-%Y',
    lev3: '%b %Y',
    lev4: 'Wk %V-%G',
    lev5: '%a %e %b %Y',
    monthType: 'name',
    longText: false,
    weekday: true
  },
  {
    key: '%e %b %Y',
    lev1: '%Y',
    lev2: 'Q%q-%Y',
    lev3: '%b %Y',
    lev4: 'Wk %V-%G',
    lev5: '%e %b %Y',
    monthType: 'name',
    longText: false,
    weekday: false
  },
  {
    key: '%a %e %B %Y',
    lev1: '%Y',
    lev2: 'Q%q-%Y',
    lev3: '%B %Y',
    lev4: 'Week %V, %G',
    lev5: '%a %e %B %Y',
    monthType: 'name',
    longText: true,
    weekday: true
  },
  {
    key: '%e %B %Y',
    lev1: '%Y',
    lev2: 'Q%q-%Y',
    lev3: '%B %Y',
    lev4: 'Week %V, %G',
    lev5: '%e %B %Y',
    monthType: 'name',
    longText: true,
    weekday: false
  },
  {
    key: '%d/%m/%Y',
    lev1: '%Y',
    lev2: 'Q%q/%Y',
    lev3: '%m/%Y',
    lev4: 'W%V/%G',
    lev5: '%d/%m/%Y',
    monthType: 'number',
    mmdd: false,
    separator: '/'
  },
  {
    key: '%d-%m-%Y',
    lev1: '%Y',
    lev2: 'Q%q-%Y',
    lev3: '%m-%Y',
    lev4: 'W%V-%G',
    lev5: '%d-%m-%Y',
    monthType: 'number',
    mmdd: false,
    separator: '-'
  },
  {
    key: '%d.%m.%Y',
    lev1: '%Y',
    lev2: 'Q%q.%Y',
    lev3: '%m.%Y',
    lev4: 'W%V.%G',
    lev5: '%d.%m.%Y',
    monthType: 'number',
    mmdd: false,
    separator: '.'
  },
  {
    key: '%d~%m~%Y',
    lev1: '%Y',
    lev2: 'Q%q~%Y',
    lev3: '%m~%Y',
    lev4: 'W%V~%G',
    lev5: '%d~%m~%Y',
    monthType: 'number',
    mmdd: false,
    separator: '~'
  },
  {
    key: '%m/%d/%Y',
    lev1: '%Y',
    lev2: 'Q%q/%Y',
    lev3: '%m/%Y',
    lev4: '%G/W%V',
    lev5: '%m/%d/%Y',
    monthType: 'number',
    mmdd: true,
    separator: '/'
  },
  {
    key: '%m-%d-%Y',
    lev1: '%Y',
    lev2: 'Q%q-%Y',
    lev3: '%m-%Y',
    lev4: '%G-W%V',
    lev5: '%m-%d-%Y',
    monthType: 'number',
    mmdd: true,
    separator: '-'
  },
  {
    key: '%m.%d.%Y',
    lev1: '%Y',
    lev2: 'Q%q.%Y',
    lev3: '%m.%Y',
    lev4: '%G.W%V',
    lev5: '%m.%d.%Y',
    monthType: 'number',
    mmdd: true,
    separator: '.'
  },
  {
    key: '%m~%d~%Y',
    lev1: '%Y',
    lev2: 'Q%q~%Y',
    lev3: '%m~%Y',
    lev4: '%G~W%V',
    lev5: '%m~%d~%Y',
    monthType: 'number',
    mmdd: true,
    separator: '~'
  },
  {
    key: '%amd/%Y',
    lev1: '%Y',
    lev2: 'Q%q/%Y',
    lev3: '%m/%Y',
    lev4: '%G/W%V',
    lev5: '%amd/%Y',
    monthType: 'number',
    mmdd: null,
    separator: '/'
  },
  {
    key: '%amd-%Y',
    lev1: '%Y',
    lev2: 'Q%q-%Y',
    lev3: '%m-%Y',
    lev4: '%G-W%V',
    lev5: '%amd-%Y',
    monthType: 'number',
    mmdd: null,
    separator: '-'
  },
  {
    key: '%amd.%Y',
    lev1: '%Y',
    lev2: 'Q%q.%Y',
    lev3: '%m.%Y',
    lev4: '%G.W%V',
    lev5: '%amd.%Y',
    monthType: 'number',
    mmdd: null,
    separator: '.'
  },
  {
    key: '%amd~%Y',
    lev1: '%Y',
    lev2: 'Q%q~%Y',
    lev3: '%m~%Y',
    lev4: '%G~W%V',
    lev5: '%amd~%Y',
    monthType: 'number',
    mmdd: null,
    separator: '~'
  }
];

export const SMART_TIME_FORMATS: TimeFormat[] = [
  {
    key: '%H:%M:%S.%L',
    lev6: '%H:00',
    lev7: '%H:%M',
    lev8: '%H:%M:%S',
    lev9: '%H:%M:%S.%L',
    ampm: false
  },
  {
    key: '%I:%M:%S.%L %p',
    lev6: '%I:00 %p',
    lev7: '%I:%M %p',
    lev8: '%I:%M:%S %p',
    lev9: '%I:%M:%S.%L %p',
    ampm: true
  }
];
