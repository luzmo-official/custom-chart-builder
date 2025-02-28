import { GenericSlotContent, Slot, ItemQueryDimension } from "@luzmo/dashboard-contents-types";
import { ItemQuery, ItemQueryMeasure, ItemQuerySort } from "./types";

function addToMeasures(measures: ItemQueryMeasure[], content: GenericSlotContent): void {
  if (content.type === 'numeric') {
    if (content.formula) {
      measures.push(isUUID(content.formula)
        ? { formula_id: content.formula }
        : { formula: content.formula, dataset_id: content.datasetId }
      );
    }
    else if (content.aggregationFunc && ['weighted_average', 'weighted_sum'].includes(content.aggregationFunc) && content.aggregationWeight) {
      measures.push({
        dataset_id: content.datasetId,
        column_id: content.columnId,
        aggregation: {
          type: content.aggregationFunc,
          dataset_id: content.aggregationWeight.datasetId,
          column_id: content.aggregationWeight.columnId
        }
      });
    }
    else if (content.aggregationFunc && ['sum', 'average', 'median', 'stddev', 'min', 'max', 'distinctcount'].includes(content.aggregationFunc)) {
      measures.push({
        dataset_id: content.datasetId,
        column_id: content.columnId,
        aggregation: { type: content.aggregationFunc }
      });
    }
    else if (content.aggregationFunc && content.aggregationFunc === 'count') {
      measures.push({ dataset_id: content.datasetId, column_id: '*' });
    }
    else {
      measures.push({ dataset_id: content.datasetId, column_id: content.columnId });
    }

    if (!content.format) {
      content.format = ',.0f';
    }
  }
  else {
    if (content.aggregationFunc && content.aggregationFunc === 'distinctcount') {
      measures.push({
        dataset_id: content.datasetId,
        column_id: content.columnId,
        aggregation: { type: content.aggregationFunc }
      });
    }
    else {
      measures.push({ dataset_id: content.datasetId, column_id: '*' });
    }
  }
}

function addToDimensions(dimensions: ItemQueryDimension[], content: GenericSlotContent, noBins?: boolean): void {
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

    dimensions.push({
      dataset_id: content.datasetId,
      column_id: content.columnId,
      level: 1,
      discretization
    });
  }
  else if (content.type === 'datetime' && content.datetimeDisplayMode) {
    dimensions.push({
      dataset_id: content.datasetId,
      expression: getAdHocExpression(content),
      discretization: { type: 'none' }
    });
  }
  else {
    dimensions.push({
      dataset_id: content.datasetId,
      column_id: content.columnId,
      level: content.drilldownLevel || content.level || 1
    });
  }
}

function addOrderToQuery(query: ItemQuery): void {
  const isOrdered = (
    sort: { dataset_id?: string; expression?: string; column_id?: string; formula_id?: string },
    column: { dataset_id?: string; expression?: string; column_id?: string; formula_id?: string }
  ): boolean => {
    if (sort.dataset_id !== column.dataset_id) {
      return false;
    }

    if (
      (sort.expression && sort.expression === column.expression)
      || sort.column_id === '*'
      || sort.column_id === column.column_id
      || sort.formula_id === column.formula_id
    ) {
      return true;
    }

    return false;
  };

  const order = query.order ?? [];

  if (query.measures?.length > 0) {
    const measureOrder = order.filter((sort: ItemQueryMeasure) =>
      query.measures.some(measure => isOrdered(sort, measure))
    );

    if (measureOrder.length === 0) {
      for (const measure of query.measures) {
        if (measure.column_id && !order.some((sort: ItemQueryMeasure) => isOrdered(sort, measure))) {
          const sort: Partial<ItemQuerySort> = JSON.parse(JSON.stringify(measure));
          sort.order = 'desc';
          order.push(sort);
          break;
        }
      }
    }
  }

  if (query.dimensions?.length > 0) {
    for (const dimension of query.dimensions) {
      if (dimension.column_id && !order.some((sort: ItemQueryDimension) => isOrdered(sort, dimension))) {
        const sort: Partial<ItemQuerySort> = JSON.parse(JSON.stringify(dimension));
        sort.order = 'asc';
        order.push(sort);
      }
    }
  }

  query.order = order;
}

// Helper functions
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function getAdHocExpression(content: GenericSlotContent): string {
  // This is a placeholder - implement based on your needs
  return `format(${content.columnId}, '${content.datetimeDisplayMode}')`;
}

function generateMetadataFromSlot(
  slots: Slot[],
  slotName: string,
  name: string
) {
  const slot = slots.find((s) => s.name === slotName) || { content: [] };
  const content = slot.content || [];

  return {
    [`content${name}`]: content,
    [`has${name}`]: content.length > 0,
  };
}

export function buildLuzmoQuery(slots: Slot[]): ItemQuery {
  // Generate metadata from slots
  const dateDef = generateMetadataFromSlot(slots, 'date', 'Date');
  const orderDef = generateMetadataFromSlot(slots, 'order', 'Order');
  const categoryDef = generateMetadataFromSlot(slots, 'category', 'Category');
  const measureDef = generateMetadataFromSlot(slots, 'measure', 'Measure');
  const dimensions: ItemQueryDimension[] = [];
  const measures: ItemQueryMeasure[] = [];

  console.log(dateDef, categoryDef, measureDef);

  // Add dimensions and measures
  if (dateDef['hasDate']) {
    for (const date of (dateDef as any)['contentDate']) {
      dimensions.push({
        dataset_id: date.datasetId,
        column_id: date.columnId,
      });
    }
  }
  if (orderDef['hasOrder']) {
    for (const order of (orderDef as any)['contentOrder']) {
      dimensions.push({
        dataset_id: order.datasetId,
        column_id: order.columnId,
      });
    }
  }
  if (categoryDef['hasCategory']) {
    for (const category of (categoryDef as any)['contentCategory']) {
      dimensions.push({
        dataset_id: category.datasetId,
        column_id: category.columnId,
      });
    }
  }
  if (measureDef['hasMeasure']) {
    for (const measure of (measureDef as any)['contentMeasure']) {
      measures.push({
        dataset_id: measure.datasetId,
        column_id: measure.columnId,
      });
    }
  }

  if (dimensions.length === 0 && measures.length === 0) {
    const xSlot = slots.find((slot) => (slot.name as any) === 'x');
    const ySlot = slots.find((slot) => (slot.name as any) === 'y');

    // Add dimensions and measures
    if (xSlot && xSlot?.content?.length > 0 && ySlot && ySlot?.content?.length > 0) {
      dimensions.push({ dataset_id: xSlot.content[0].datasetId, column_id: xSlot.content[0].columnId });
      dimensions.push({ dataset_id: ySlot.content[0].datasetId, column_id: ySlot.content[0].columnId });
    }
  }

  console.log('QQ', dimensions, measures);

  // Build query object
  const query: ItemQuery = {
    dimensions,
    measures,
    limit: { by: 60000 },
    options: {
      locale_id: 'en',
      timezone_id: 'UTC',
      rollup_data: false,
    },
  };

  console.log(query);

  return query;
}