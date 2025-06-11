import type { GenericSlotContent, ItemQueryDimension, Slot, SlotConfig } from '@luzmo/dashboard-contents-types';
import type { ItemQuery, ItemQueryMeasure } from './types';

interface SlotMetadata {
  [key: string]: GenericSlotContent[] | boolean;
}

function generateMetadataFromSlot(slots: Slot[], slotName: string, name: string): SlotMetadata {
  const slot = slots.find((s) => s.name === slotName) || { content: [] };
  const content = slot.content || [];

  return {
    [`content${name}`]: content,
    [`has${name}`]: content.length > 0
  };
}

export function buildLuzmoQuery(slots: Slot[], slotConfigurations: SlotConfig[]): ItemQuery {
  // Create metadata definitions dynamically from slotConfigurations
  const slotDefs: Record<string, SlotMetadata> = {};

  slotConfigurations.map(slotConfig => {
    const capitalizedName = slotConfig.name.charAt(0).toUpperCase() + slotConfig.name.slice(1);

    slotDefs[slotConfig.name] = generateMetadataFromSlot(slots, slotConfig.name, capitalizedName);
  });

  const dimensions: ItemQueryDimension[] = [];
  const measures: ItemQueryMeasure[] = [];

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
          if (item.aggregationFunc) {
            measures.push({
              dataset_id: item.datasetId,
              column_id: item.columnId,
              aggregation: { type: item.aggregationFunc }
            });
          }
          else {
            measures.push({
              dataset_id: item.datasetId,
              column_id: item.columnId
            });
          }
        }
        else {
          dimensions.push({
            dataset_id: item.datasetId,
            column_id: item.columnId
          });
        }
      }
    }
  }

  const query: ItemQuery = {
    dimensions,
    measures,
    limit: { by: 60000 },
    options: {
      locale_id: 'en',
      timezone_id: 'UTC'
    }
  };

  return query;
}
