import { ItemQueryDimension, Slot, SlotConfig } from '@luzmo/dashboard-contents-types';
import {
  createColumnHelper,
  getCoreRowModel,
  ColumnDef,
} from '@tanstack/table-core';
import { useTable, flexRender } from './use-table';

const localize = (
  value: Record<string, string> | undefined,
  language: string
) => {
  return value?.[language] ?? value?.[Object.keys(value ?? {})[0]] ?? '';
};

/**
 * Renders a custom chart inside the specified container element.
 *
 * @param container - The HTML element where the chart will be rendered.
 * @param data - An array of arrays, representing the data points to be plotted.
 * @param dimensions - An object containing the width, height, margin and padding of the chart.
 *
 */
export const render = ({
  container,
  data = [],
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width, height } = { width: 0, height: 0 },
}: {
  container: HTMLElement;
  data: any[][];
  slots: Slot[];
  slotConfigurations: SlotConfig[];
  options: Record<string, any>;
  language: string;
  dimensions: { width: number; height: number };
}): void => {
  container.innerHTML = '';

  // styles
  const style = document.createElement('style');
  style.textContent = `
    table {
      margin: 0 !important;
      border-collapse: collapse;
      width: 100%;
      font-family: Arial, sans-serif;
      margin: 20px 0;
      font-size: 13px;
      width: 100%;
    }
    th, td {
      border: 1px solid rgba(0,0,0,.08);
      border-left: none;
      border-right: none;
      padding: .5rem;
      text-align: right;
    }
    .category {
      text-align: left;
      padding-left: 2rem;
      white-space: nowrap;
    }
    th {
      background-color: #316df0;
      color: white;
      padding: .75rem .5rem;
    }
    .negative {
      color: red;
    }
    .highlight {
      background-color: rgba(0, 0, 0, 0.05);
      font-weight: bold;
    }
    .highlight td {
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }
    .grandtotal {
      background-color: #316df0;
      font-weight: bold;
      color: white;
    }
    .grandtotal .negative {
      color: #ff9898;
    }
    .grandtotal td {
      border-bottom: 0;
      padding: 0.75rem 0.5rem;
    }
    .month-header {
      text-align: center;
      color: white;
      text-transform: capitalize;
    }
    .empty-row {
      height: .75rem;
    }
    .empty-row + tr td {
      border-top: none;
    }
    .empty-row td {
      border: none;
      padding: 0;
    }
    .month-tr {
      background-color: #316df0;
    }
  `;
  container.appendChild(style);

  const measureSlotContent = slots?.find(
    (slot) => slot.name === 'measure'
  )?.content;
  const numberOfMeasures = measureSlotContent?.length ?? 0;
  const measureLabels =
    measureSlotContent?.map((measure) => localize(measure?.label, 'fr')) ?? [];

  let hasDifference = false;
  if (numberOfMeasures === 2) {
    measureLabels.push('Ecart');
    hasDifference = true;
  }

  // put that to options
  const hasCumul = true;

  const orderSlotContent = slots?.find(
    (slot) => slot.name === 'order'
  )?.content;
  const hasOrder = (orderSlotContent?.length ?? 0) > 0;

  const categorySlotContent = slots?.find(
    (slot) => slot.name === 'category'
  )?.content;
  const numberOfCategories = categorySlotContent?.length ?? 0;

  if (data?.length === 0) {
    return;
  } else if (data?.length >= 1) {
    if (data[0].length < 3) {
      container.innerHTML = 'Fill in all the columns';
      return;
    }
  }

  let months: string[] = [];
  let years: number[] = [];
  const measures: string[] = measureLabels;

  /**
   * Data processing to a structure Tanstack can use
   *
   * 1. Create a record for each category
   * 2. Add the measures to the records, split out per month
   * 3. Add the difference to the records if just 2 measures
   */

  let allDataRecords: Record<string, string | number>[] = [];
  data.forEach((row) => {
    const month = row[0];
    // add to months if not already present
    if (!months.includes(month)) {
      months.push(month);
    }
    // add to years if not already present
    const year = new Date(month).getFullYear();
    if (!years.includes(year)) {
      years.push(year);
    }
    // create category with subcategories
    const categoryIndexAsOf = hasOrder ? 2 : 1;
    const measureIndexAsOf = categoryIndexAsOf + numberOfCategories;

    // create the record level categories
    const categories: Record<string, string> = {};
    let categoryKey = '';
    for (let i = 0; i < numberOfCategories; i++) {
      const category = row[categoryIndexAsOf + i];
      const subKey =
        typeof category?.id !== 'undefined' ? category.id : category;
      categoryKey = (categoryKey ? categoryKey + ' || ' : '') + subKey;
      categories.category = categoryKey;
      categories['category-' + (i + 1)] = subKey;
    }

    // check if structure already has a record for the category combo
    let foundCategory = false;
    let categoryRecord = allDataRecords.find(
      (record) => record.category === categories.category
    );
    if (!categoryRecord) {
      categoryRecord = { ...categories };
    } else {
      foundCategory = true;
    }

    if (hasOrder) {
      const order = row[1];
      if (typeof order !== 'undefined') {
        categoryRecord.order = order;
      }
    }

    for (let i = 0; i < numberOfMeasures; i++) {
      const key = month + ' || ' + measureLabels[i];
      const value = row[measureIndexAsOf + i];
      categoryRecord[key] = value;
    }

    if (hasDifference) {
      categoryRecord[month + ' || Ecart'] =
        row[measureIndexAsOf + 1] - row[measureIndexAsOf];
    }

    if (!foundCategory) {
      allDataRecords.push(categoryRecord);
    }
  });

  if (hasCumul) {
    // add cumul to the records
    allDataRecords.forEach((record) => {
      for (const measure of measures) {
        record['Cumul' + ' || ' + measure] = 0;
        for (const month of months) {
          record['Cumul' + ' || ' + measure] =
            Number(record['Cumul' + ' || ' + measure] ?? 0) +
            Number(record[month + ' || ' + measure] ?? 0);
        }
      }
    });
  }
  /**
   * Calculate sorting
   *
   * 1. Sort by order of the lowest category
   * 2. Retrieve the order of the categories if there are more than one
   * 3. Sort by that
   */

  // sort by category and order
  // first we sort by order of the lowest category
  allDataRecords = allDataRecords.sort((a: any, b: any) => {
    if (a.order && b.order) {
      return a.order - b.order;
    }
    return 0;
  });
  // then we retrieve the order of the categories if there are more than one
  const orders: any = {};
  for (let i = 1; i <= numberOfCategories; i++) {
    orders[`category-${i}`] = [] as any[];
    allDataRecords.forEach((record) => {
      if (!orders[`category-${i}`].includes(record[`category-${i}`])) {
        orders[`category-${i}`].push(record[`category-${i}`]);
      }
    });
  }

  /**
   * Calculating sub totals and adding them to the records
   *
   * 0. Fetch the initial value
   * 1. Calculate the sub totals for each category
   * 2. Add them to the records
   * 3. Calculate the grand totals
   * 4. Add them to the records
   *
   */

  // we calculate the group totals per month / measure / category
  //for now only top category
  const measuresInAllRecords = Object.keys(allDataRecords[0]).filter(
    (_, index) => index > numberOfCategories + (hasOrder ? 1 : 0)
  );
  if (numberOfCategories > 1) {
    for (const category of orders['category-1']) {
      if (!['Initial', 'Final'].includes(category)) {
        const newSubTotalsRecord: any = {
          category: category,
          subtotal: true,
        };
        for (let i = 1; i <= numberOfCategories; i++) {
          newSubTotalsRecord[`category-${i}`] = category;
        }
        const records = allDataRecords.filter((record) =>
          category === 'Cashflow Net'
            ? !['Initial', 'Final'].includes(String(record['category-1'])) &&
            !record.subtotal
            : record['category-1'] === category
        );
        for (const measure of measuresInAllRecords) {
          const subTotal = records.reduce(
            (acc, record) => acc + Number(record[measure]),
            0
          );
          newSubTotalsRecord[measure] = subTotal;
        }
        allDataRecords.push(newSubTotalsRecord);
      }
    }
  }
  // For the cumul, use values of the first month
  if (hasCumul) {
    const firstMonth = months[0];
    const initialData =
      allDataRecords.find(
        (record) => record.category === 'Initial || Solde Initial'
      ) ?? {};
    for (const measure of measureLabels) {
      initialData['Cumul' + ' || ' + measure] =
        initialData[firstMonth + ' || ' + measure];
    }
  }

  // Add grand total
  orders['category-1'].push('Grand Total');
  const grandTotalRecord: any = {
    category: 'Grand Total',
    subtotal: true,
  };
  for (let i = 1; i <= numberOfCategories; i++) {
    grandTotalRecord[`category-${i}`] = 'Grand Total';
    grandTotalRecord.order = 999999;
    grandTotalRecord.grandtotal = true;
  }
  const allRecordsNoSubtotals = allDataRecords.filter(
    (record) => !record.subtotal
  );
  for (const measure of measuresInAllRecords) {
    grandTotalRecord[measure] = allRecordsNoSubtotals.reduce(
      (acc, record) => acc + Number(record[measure]),
      0
    );
  }
  allDataRecords.push(grandTotalRecord);
  if (hasCumul) {
    const lastMonth = months[months.length - 1];
    const grandTotalData =
      allDataRecords.find((record) => record.category === 'Grand Total') ?? {};
    for (const measure of measureLabels) {
      grandTotalData['Cumul' + ' || ' + measure] =
        grandTotalData[lastMonth + ' || ' + measure];
    }
  }

  // we calculate the grand totals to be able to use later on month / measure

  /**
   * Sorting
   */

  allDataRecords = allDataRecords.sort((a: any, b: any) => {
    for (let i = 1; i <= numberOfCategories; i++) {
      if (a[`category-${i}`] !== b[`category-${i}`]) {
        return (
          orders[`category-${i}`].indexOf(a[`category-${i}`]) -
          orders[`category-${i}`].indexOf(b[`category-${i}`])
        );
      }
      // subtotals below the subcategories
      return 1;
    }
    return -1;
  });

  /**
   * Column accessors
   */

  months = months.sort();
  years = years.sort();

  console.log(allDataRecords);

  const columnHelper = createColumnHelper<any>();

  const columns: ColumnDef<any, any>[] = [
    columnHelper.accessor((row) => row.category, {
      id: 'category',
      cell: (info) => {
        let category = info.getValue();
        // get last string after '||'
        category = category.split(' || ').pop();
        return `<div class="category">${category}</div>`;
      },
      header: () => '<div class="category">en K €</div>',
    }),
  ];
  for (const month of months) {
    const group = columnHelper.group({
      id: month,
      header: () =>
        `<div class="month-header">${new Date(month).toLocaleString('fr-FR', {
          month: 'long',
        })}</div>`,
      columns: measures.map((measure) => {
        return columnHelper.accessor((row) => row[`${month} || ${measure}`], {
          id: month + ' || ' + measure,
          header: (info) => `<span>${measure}</span>`,
          cell: (info) =>
            info.getValue() < 0
              ? `<span class="negative">${info.getValue()}</span>`
              : info.getValue(),
        });
      }),
    });
    columns.push(group);
  }
  if (hasCumul) {
    const cumulGroup = columnHelper.group({
      id: 'Cumul',
      header: () => '<div class="month-header">Cumul</div>',
      columns: measures.map((measure) => {
        return columnHelper.accessor((row) => row[`Cumul || ${measure}`], {
          id: 'Cumul || ' + measure,
          header: (info) => `<span>${measure}</span>`,
          cell: (info) =>
            info.getValue() < 0
              ? `<span class="negative">${info.getValue()}</span>`
              : info.getValue(),
        });
      }),
    });
    columns.push(cumulGroup);
  }

  /**
   * Rendering Tanstack table
   */
  const table = useTable({
    data: allDataRecords,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const renderTable = () => {
    // Create table elements
    const tableElement = document.createElement('table');
    const theadElement = document.createElement('thead');
    const tbodyElement = document.createElement('tbody');
    const tfootElement = document.createElement('tfoot');

    tableElement.appendChild(theadElement);
    tableElement.appendChild(tbodyElement);
    tableElement.appendChild(tfootElement);

    // Render table headers
    table.getHeaderGroups().forEach((headerGroup) => {
      const trElement = document.createElement('tr');
      headerGroup.headers.forEach((header) => {
        const thElement = document.createElement('th');
        if (
          (!header.column.parent || header.id === '1_category_category') &&
          header.id !== 'category'
        ) {
          thElement.classList.add('month-tr');
        }
        thElement.setAttribute('colspan', header.colSpan.toString());
        thElement.innerHTML = header.isPlaceholder
          ? ''
          : flexRender(header.column.columnDef.header, header.getContext());
        trElement.appendChild(thElement);
      });
      theadElement.appendChild(trElement);
    });

    // add empty row
    const emptyTrElement = document.createElement('tr');
    const emptyTdElement = document.createElement('td');
    emptyTrElement.classList.add('empty-row');
    emptyTdElement.classList.add('empty-cell');
    emptyTrElement.appendChild(emptyTdElement);
    theadElement.appendChild(emptyTrElement);

    // Render table rows
    table.getRowModel().rows.forEach((row) => {
      const trElement = document.createElement('tr');
      if (
        row.original.category === 'Initial || Solde Initial' ||
        row.original.subtotal
      ) {
        trElement.classList.add('highlight');
      }
      if (row.original.grandtotal) {
        const emptyTrElement = document.createElement('tr');
        const emptyTdElement = document.createElement('td');
        emptyTrElement.classList.add('empty-row');
        emptyTdElement.classList.add('empty-cell');
        emptyTrElement.appendChild(emptyTdElement);
        tbodyElement.appendChild(emptyTrElement);

        trElement.classList.add('grandtotal');
      }
      row.getVisibleCells().forEach((cell) => {
        const tdElement = document.createElement('td');
        tdElement.innerHTML = flexRender(
          cell.column.columnDef.cell,
          cell.getContext()
        );
        trElement.appendChild(tdElement);
      });
      tbodyElement.appendChild(trElement);
      if (
        row.original.category === 'Initial || Solde Initial' ||
        row.original.subtotal
      ) {
        const emptyTrElement = document.createElement('tr');
        const emptyTdElement = document.createElement('td');
        emptyTrElement.classList.add('empty-row');
        emptyTdElement.classList.add('empty-cell');
        emptyTrElement.appendChild(emptyTdElement);
        tbodyElement.appendChild(emptyTrElement);
      }
    });

    container.appendChild(tableElement);
  };

  renderTable();
};

/**
 * Resizes the custom chart inside the specified container element.
 *
 * @param container - The HTML element where the chart will be rendered.
 * @param dimensions - An object containing the width, height, margin and padding of the chart.
 *
 */
export const resize = ({
  container,
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width, height } = { width: 0, height: 0 },
}: {
  container: HTMLElement;
  slots: Slot[];
  slotConfigurations: SlotConfig[];
  options: Record<string, any>;
  language: string;
  dimensions: { width: number; height: number };
}): void => {
  // render({ container, data: [], slots, slotConfigurations, options, language, dimensions: { width, height } });
};

export const buildQuery = ({
  slots
}: {
  slots: Slot[]
}): ItemQuery => {
  const generateMetadataFromSlot = (
    slots: Slot[],
    slotName: string,
    name: string
  ) => {
    const slot = slots.find((s) => s.name === slotName) || { content: [] };
    const content = slot.content || [];

    return {
      [`content${name}`]: content,
      [`has${name}`]: content.length > 0,
    };
  }

  // Generate metadata from slots
  const dateDef = generateMetadataFromSlot(slots, 'date', 'Date');
  const orderDef = generateMetadataFromSlot(slots, 'order', 'Order');
  const categoryDef = generateMetadataFromSlot(slots, 'category', 'Category');
  const measureDef = generateMetadataFromSlot(slots, 'measure', 'Measure');
  const dimensions: ItemQueryDimension[] = [];
  const measures: ItemQueryMeasure[] = [];

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

  return query;
}
