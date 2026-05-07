import type { GenericSlotContent, ItemQueryDimension, ItemQueryMeasure, Slot, SlotConfig } from '@luzmo/dashboard-contents-types';
import type { ItemQuery } from './types';

interface SlotMetadata {
  [key: string]: GenericSlotContent[] | boolean;
}

const DEFAULT_QUERY_LIMIT = { by: 100000, offset: 0 };

function getFieldReference(item: GenericSlotContent): Pick<ItemQueryDimension,'column_id' | 'formula_id' | 'dataset_id'> {
  return {
    dataset_id: item.datasetId,
    ...(item.formulaId
      ? { formula_id: item.formulaId }
      : { column_id: item.columnId }),
  };
}

function getMeasureReference(item: GenericSlotContent): ItemQueryMeasure {
  return {
    dataset_id: item.datasetId,
    ...(item.formulaId
      ? { formula_id: item.formulaId }
      : item.formula
        ? { formula: item.formula }
        : { column_id: item.columnId }),
  };
}

function generateMetadataFromSlot(slots: Slot[], slotName: string, name: string): SlotMetadata {
  const slot = slots.find((s) => s.name === slotName) || { content: [] };
  const content = slot.content || [];

  return {
    [`content${name}`]: content,
    [`has${name}`]: content.length > 0
  };
}

export function buildLuzmoQuery(
  slots: Slot[],
  slotConfigurations: SlotConfig[],
  limit?: ItemQuery['limit']
): ItemQuery[] {
  // Create metadata definitions dynamically from slotConfigurations
  const slotDefs: Record<string, SlotMetadata> = {};

  slotConfigurations.map(slotConfig => {
    const capitalizedName = slotConfig.name.charAt(0).toUpperCase() + slotConfig.name.slice(1);

    slotDefs[slotConfig.name] = generateMetadataFromSlot(slots, slotConfig.name, capitalizedName);
  });

  const dimensions: ItemQueryDimension[] = [];
  const measures: ItemQueryMeasure[] = [];
  const order: ItemQuery['order'] = [];

  // Add dimensions and measures dynamically based on slot configurations
  for (const slotConfig of slotConfigurations) {
    const slotDef = slotDefs[slotConfig.name];
    const capitalizedName = slotConfig.name.charAt(0).toUpperCase() + slotConfig.name.slice(1);
    const hasKey = `has${capitalizedName}`;
    const contentKey = `content${capitalizedName}`;

    if (slotDef[hasKey] as boolean) {
      for (const item of slotDef[contentKey] as GenericSlotContent[]) {
        // Determine if this should be a dimension or measure based, on slot type
        if (slotConfig.type === 'numeric') {
          const measureReference = getMeasureReference(item);

          if (item.aggregationFunc) {
            measures.push({
              ...measureReference,
              aggregation: { type: item.aggregationFunc }
            });
          }
          else {
            measures.push(measureReference);
          }
        }
        else {
          dimensions.push({
            ...getFieldReference(item),
            ...(item.level !== undefined && item.level !== null && { level: item.level })
          });
        }
      }
    }
  }

  const query: ItemQuery[] = [{
    dimensions,
    measures,
    order,
    limit: limit ? limit : DEFAULT_QUERY_LIMIT,
    options: {
      locale_id: 'en',
      timezone_id: 'UTC'
    }
  }];

  return query;
}
