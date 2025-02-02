import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, HostListener, inject, OnInit, ViewChild } from '@angular/core';
import { buildLuzmoQuery } from '@builder/services/getData';
import { LuzmoApiService } from '@builder/services/luzmo-api.service';
import '@luzmo/analytics-components-kit/draggable-data-item';
import '@luzmo/analytics-components-kit/droppable-slot';
import '@luzmo/analytics-components-kit/edit-option-radio-button-group';
import '@luzmo/analytics-components-kit/picker';
import '@luzmo/analytics-components-kit/progress-circle';
import { Column, GenericSlotContent, Slot, SlotConfig } from '@luzmo/dashboard-contents-types';
import { NgxJsonViewerModule } from 'ngx-json-viewer';
import { map } from 'rxjs';
import { defaultSlotConfigs } from '../../../custom-chart/src/slots.config';
import { ItemData, Securable } from '../../../custom-chart/src/helpers/types';

type ColumnType = typeof AppComponent.prototype.columns[number];

@Component({
  selector: 'app-root',
  imports: [NgxJsonViewerModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent implements OnInit {
  private luzmoAPIService = inject(LuzmoApiService);
  private ws = new WebSocket('ws://localhost:8080');
  private render?: (element: HTMLElement, data: ItemData['data']) => void;
  private resize?: (element: HTMLElement, resizedWidth: number, resizedHeight: number) => void;

  chartData: ItemData['data'] = [];
  displayedChartData: ItemData['data'] = [];
  columns: (Pick<GenericSlotContent, 'columnId' | 'currency' | 'datasetId' | 'format' | 'label' | 'level' | 'lowestLevel' | 'type' | 'subtype'> & { description: Column['description'], hierarchyLevels: { id: string, level: number, label: Record<string, string> }[] })[]
    = [];
  datasets: Pick<Securable, 'id' | 'name' | 'created_at' | 'subtype'>[] = [];
  slotConfigs: SlotConfig[] = defaultSlotConfigs;
  slots: Slot[] = defaultSlotConfigs.map(slotConfig => ({ name: slotConfig.name, content: [] }));
  status = { loadingAllDatasets: false, loadingDatasetDetail: false, queryingData: false };

  @ViewChild('chartContainer') container!: ElementRef;
  @HostListener('window:resize')
  onResize(): void {
    if (this.resize) {
      this.resize(this.container.nativeElement, this.container.nativeElement.clientWidth, this.container.nativeElement.clientHeight);
    }
  }

  async ngOnInit() {
    this.luzmoAPIService.loadAllDatasets()
      .subscribe(datasets => {
        this.datasets = datasets.rows;
        this.status.loadingAllDatasets = false;
      });

    this.ws.onmessage = async (message) => {
      if (message.data === 'watcher-rebuild') {
        await this.loadBundle();
        this.renderChart();
      }
    };

    await this.loadBundle();
    await this.renderChart();
  }

  private async loadBundle() {
    const response = await fetch('/assets/custom-chart/bundle.js?t=' + Date.now());
    const blob = new Blob([await response.text()], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const module = await import(url);
    URL.revokeObjectURL(url);

    this.render = module.render;
    this.resize = module.resize;
  }

  private async renderChart(): Promise<void> {
    if (!this.render) {
      return;
    };

    this.render(this.container.nativeElement, this.chartData);
  }

  onColumnDropped(slotName: string, event: Event & { detail: { slotContents: ColumnType[] } }): void {
    const slot = this.slots.find(s => s.name === slotName);

    if (!slot) {
      return;
    }

    const droppedColumn = event.detail.slotContents[0];
    const mode = !droppedColumn ? 'remove' : 'add';

    slot.content = mode === 'add' ? [{
      columnId: droppedColumn.columnId,
      currency: droppedColumn.currency,
      datasetId: droppedColumn.datasetId,
      format: droppedColumn.format,
      label: droppedColumn.label,
      level: droppedColumn.level,
      lowestLevel: droppedColumn.lowestLevel,
      subtype: droppedColumn.subtype,
      type: droppedColumn.type
    }] : [];

    // Query if at least one slot has filled contents
    if (this.slots.some(s => s.content.length > 0)) {
      const query = buildLuzmoQuery(this.slots);

      this.status.queryingData = true;
      this.luzmoAPIService.queryLuzmoDataset(query)
        .subscribe(queryResult => {
          this.chartData = queryResult.data;
          this.displayedChartData = queryResult.data.slice(0, 25);
          this.status.queryingData = false;
          this.renderChart();

          console.log(queryResult.data)
        });
    }
    else {
      this.chartData = [];
      this.displayedChartData = [];
      this.renderChart();
    }
  }

  loadDatasetWithColumns(datasetId: string) {
    this.status.loadingDatasetDetail = true;

    return this.luzmoAPIService.loadDatasetWithColumns(datasetId)
      .pipe(
        map(result => result.rows[0])
      );
  }

  onDatasetSelected(event: Event & { detail: string }): void {
    const datasetId = event.detail;

    this.loadDatasetWithColumns(datasetId).subscribe(dataset => {
      this.columns = dataset.columns.map(column => ({
        columnId: column.id,
        currency: column.currency?.symbol,
        datasetId,
        description: column.description,
        format: column.format,
        hierarchyLevels: column.hierarchyLevels?.map((level: any) => ({ id: level.id, level: level.level, label: level.name })) || [],
        label: column.name,
        level: column.level,
        lowestLevel: column.lowestLevel,
        subtype: column.subtype,
        type: column.type
      }));

      this.status.loadingDatasetDetail = false;
    });
  }
}
