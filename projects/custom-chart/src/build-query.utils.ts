import { DatetimeDisplayMode, GenericSlotContent, ItemQueryAggregation, ItemQueryDimension, ItemQueryMeasure, Slot, SlotConfig } from "@luzmo/dashboard-contents-types";

export enum AdHocExpression {
  default = 'DEFAULT',
  quarter_number = 'QUARTER',
  month_name = 'MONTH',
  month_number = 'MONTH',
  week_number = 'WEEK',
  day_in_month = 'DAY',
  day_in_year = 'DAY_OF_YEAR',
  weekday_name = 'DAY_OF_WEEK',
  weekday_number = 'DAY_OF_WEEK',
  hour_in_day = 'HOUR',
  minute_in_hour = 'MINUTE',
  second_in_minute = 'SECOND'
}

  // if order is undefined and type is numeric, it is a measure
  export function getSlotMeasureBySlotDefinition(slots: SlotConfig[]): SlotConfig[] {
    return slots?.filter(s => s.type === 'numeric' && s.order === undefined) ?? [];
  }

  // if order is defined and type is numeric, it is a dimension.
  export function getSlotCategoryBySlotDefinition(slots: SlotConfig[]): SlotConfig[] {
    return slots?.filter(s => s.type === 'categorical' || (s.type === 'numeric' && s.order !== undefined)) ?? [];
  }

  export function isWeightedAggregation(aggregation: ItemQueryAggregation): boolean {
    return ['stddev', 'weightedaverage', 'rate', 'average'].includes(aggregation);
  }

  export function isUUID(value: any): boolean {
    return /^[\dA-Fa-f]{8}-[\dA-Fa-f]{4}-4[\dA-Fa-f]{3}-[89ABab][\dA-Fa-f]{3}-[\dA-Fa-f]{12}$/.test(value);
  }

  export function isEmpty(value: any): boolean {
    return value === null || value === undefined;
  }

  export function addToMeasures(measures: ItemQueryMeasure[], content: GenericSlotContent, cumulativeSumAggregation?: any): void {
    measures = measures || [];
  
    if (content.type === 'numeric') {
      if (content.formula) {
        measures.push(isUUID(content.formula)
          ? { formula_id: content.formula }
          : { formula: content.formula, dataset_id: content.set }
        );
      }
      else if (content.aggregationFunc && isWeightedAggregation(content.aggregationFunc) && content.aggregationWeight) {
        measures.push({
          dataset_id: content.set, column_id: content.column, aggregation: {
            type: content.aggregationFunc,
            dataset_id: content.aggregationWeight.set,
            column_id: content.aggregationWeight.column
          }
        });
      }
      else if (content.aggregationFunc && content.aggregationFunc === 'cumulativesum') {
        measures.push({
          dataset_id: content.set,
          column_id: content.column,
          aggregation: cumulativeSumAggregation ?? { type: 'sum' }
        });
      }
      else if (content.aggregationFunc && ['sum', 'average', 'median', 'stddev', 'min', 'max', 'distinctcount'].includes(content.aggregationFunc)) {
        measures.push({ dataset_id: content.set, column_id: content.column, aggregation: { type: content.aggregationFunc } });
      }
      else if (content.aggregationFunc && content.aggregationFunc === 'count') {
        measures.push({ dataset_id: content.set, column_id: '*' });
      }
      else {
        measures.push({ dataset_id: content.set, column_id: content.column });
      }
  
      if (!content.format) {
        content.format = ',.0f';
      }
    }
    else {
      const format = content.format || ',.0f';
  
      const d3_format_re = /(?:([^{])?([<=>^]))?([ ()+\-])?([#$])?(0)?(\d+)?([,_])?(\.-?\d+)?([%a-z])?/i;
      const match = d3_format_re.exec(format);
  
      if (match?.[8] === undefined || match?.[9] === undefined || !content.format) {
        content.format = ',.0f';
      }
  
      if (content.aggregationFunc && content.aggregationFunc === 'distinctcount') {
        measures.push({ dataset_id: content.set, column_id: content.column, aggregation: { type: content.aggregationFunc } });
      }
      else {
        measures.push({ dataset_id: content.set, column_id: '*' });
      }
    }
  }

  export function getAdHocExpression(slotContent: GenericSlotContent): string | null {
    const expression: DatetimeDisplayMode | null = !slotContent.datetimeDisplayMode ? null : AdHocExpression[slotContent.datetimeDisplayMode] as any;
  
    if (isEmpty(slotContent.set) || isEmpty(slotContent.column) || isEmpty(expression)) {
      return null;
    }
  
    if (AdHocExpression[slotContent.datetimeDisplayMode as DatetimeDisplayMode] === 'DAY_OF_WEEK' && slotContent.weekStart === 'sunday') {
      return `(${expression}({${slotContent.set}:${slotContent.column}}) % 7) + 1`;
    }
  
    return `${expression}({${slotContent.set}:${slotContent.column}})`;
  }
  
  export function addToDimensions(dimensions: ItemQueryDimension[], content: GenericSlotContent, noBins?: boolean): void {
    dimensions = dimensions || [];

    console.log('Adding to dimension', dimensions, content);
  
    if (content.formula) {
      dimensions.push({ formula_id: content.formula });
    }
    else if (content.type === 'numeric') {
      let discretization: { type: 'none' | 'linear'; bins?: number };
  
      if (noBins) {
        discretization = { type: 'none' };
      }
      else if (content.bins && content.bins.enabled) {
        discretization = { type: 'linear', bins: content.bins.number };
      }
      else if (content.bins && !content.bins.enabled) {
        discretization = { type: 'none' };
      }
      else {
        discretization = { type: 'linear', bins: 10 };
      }
  
      dimensions.push({ dataset_id: content.set, column_id: content.column, level: 1, discretization });
    }
    else if (content.type === 'datetime' && !isEmpty(content.datetimeDisplayMode)) {
      dimensions.push({
        dataset_id: content.set,
        expression: getAdHocExpression(content) as string,
        discretization: { type: 'none' }
      });
    }
    else {
      dimensions.push({
        dataset_id: content.set,
        column_id: content.column,
        level: content.drilldownLevel || content.level || 1
      });
    }
  }
