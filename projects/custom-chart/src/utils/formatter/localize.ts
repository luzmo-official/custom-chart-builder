import {
  isBoolean,
  isEmpty,
  isEmptyObject,
  isNumeric,
  isObject,
  isString
} from '../types.utils';

export function localize(
  item: Record<string, string> | string | number | boolean,
  locale?: string,
  options?: { allowEmpty: boolean }
): string {
  if (isString(item) || isNumeric(item) || isBoolean(item)) {
    return item.toString();
  } else if (isEmpty(item) || !isObject(item) || isEmptyObject(item)) {
    return '';
  }

  let localizedItem = '';
  const languages = Object.keys(item);

  if (options?.allowEmpty) {
    if (locale && item[locale] !== undefined) {
      localizedItem = item[locale];
    }
    if (localizedItem === undefined) {
      localizedItem = '';
    }
  } else {
    if (locale && item[locale]) {
      localizedItem = item[locale];
    }
    if ((isEmpty(localizedItem) || localizedItem === '') && languages?.length) {
      localizedItem = item[languages[0]];
    }
  }

  return localizedItem;
}
