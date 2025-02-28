import { AsyncPipe } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { LoginComponent } from '@builder/components/login/login.component';
import { buildLuzmoQuery } from '@builder/helpers/getData';
import { AuthService } from '@builder/services/auth.service';
import { LuzmoApiService } from '@builder/services/luzmo-api.service';
import '@luzmo/analytics-components-kit/draggable-data-item';
import '@luzmo/analytics-components-kit/droppable-slot';
import '@luzmo/analytics-components-kit/picker';
import '@luzmo/analytics-components-kit/progress-circle';
import { Slot, SlotConfig } from '@luzmo/dashboard-contents-types';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxJsonViewerModule } from 'ngx-json-viewer';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { filter, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import { defaultSlotConfigs } from '../../../custom-chart/src/slots.config';
import { ItemData, ItemQuery } from './helpers/types';

@UntilDestroy()
@Component({
  selector: 'app-root',
  imports: [NgxJsonViewerModule, LoginComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit {
  protected authService = inject(AuthService);
  private luzmoAPIService = inject(LuzmoApiService);
  private ws = new WebSocket('ws://localhost:8080');
  private render?: ( args:
    {
      container: HTMLElement,
      data: ItemData['data'],
      slots: Slot[],
      slotConfigurations: SlotConfig[],
      options: any,
      language: string,
      dimensions: { width: number; height: number }
    }
  ) => void;
  private resize?: ( args: {
       container: HTMLElement,
       slots: Slot[],
       slotConfigurations: SlotConfig[],
       options: any,
       language: string,
       dimensions: { width: number; height: number }
     }
  ) => void;
  private buildQuery?: (slots: Slot[], slotsConfig: SlotConfig[]) => ItemQuery;

  currentUser$ = this.authService.isAuthenticated$.pipe(
    filter((isAuthenticated) => isAuthenticated),
    switchMap(() => this.authService.getOrLoadUser())
  );

  loadingAllDatasets$ = new BehaviorSubject<boolean>(false);
  loadingDatasetDetail$ = new BehaviorSubject<boolean>(false);
  queryingData$ = new BehaviorSubject<boolean>(false);

  datasets$ = this.authService.isAuthenticated$.pipe(
    untilDestroyed(this),
    filter((isAuthenticated) => isAuthenticated),
    tap(() => setTimeout(() => this.loadingAllDatasets$.next(true), 0)),
    filter(() => !this.loadingAllDatasets$.value),
    switchMap(() => this.luzmoAPIService.loadAllDatasets()),
    map((result) => result.rows),
    tap(() => setTimeout(() => this.loadingAllDatasets$.next(false), 0))
  );

  private selectedDatasetIdSubject = new Subject<string>();
  columns$ = this.selectedDatasetIdSubject.pipe(
    untilDestroyed(this),
    // tap(() => setTimeout(() => this.loadingDatasetDetail$.next(true), 0)),
    switchMap((datasetId) =>
      this.luzmoAPIService.loadDatasetWithColumns(datasetId)
    ),
    map((result) => result.rows[0]),
    map((dataset) =>
      dataset.columns.map((column) => ({
        columnId: column.id,
        column: column.id,currency: column.currency?.symbol,
        datasetId: dataset.id,
          set:dataset.id,
        description: column.description,
        format: column.format,
        hierarchyLevels: (column.hierarchyLevels || []).map((level: any) => ({
          id: level.id,
          level: level.level,
          label: level.name,
        })),
        label: column.name,
        level: column.level,
        lowestLevel: column.lowestLevel,
        subtype: column.subtype,
        type: column.type,
      }))
    )
    // tap(() => setTimeout(() => this.loadingDatasetDetail$.next(false), 0))
  );

  slotConfigs: SlotConfig[] = defaultSlotConfigs;
  private slotsSubject = new BehaviorSubject<Slot[]>(
    this.slotConfigs.map((slotConfig) => ({
      name: slotConfig.name,
      content: [],
    }))
  );

  chartData$ = this.slotsSubject.pipe(
    untilDestroyed(this),
    switchMap((slots) => {
      const allRequiredSlotsFilled = defaultSlotConfigs
        .filter((s) => s.isRequired)
        .map((s) => slots.find((slot) => slot.name === s.name))
        .every((s) => s && s.content.length > 0);

      if (allRequiredSlotsFilled && slots.some(s => s.content.length > 0)) {
        let query: ItemQuery = { dimensions: [], measures: [], options: {} };

          if (this.buildQuery) {
            console.log('Building query with custom function');
            query = this.buildQuery(slots, defaultSlotConfigs);
          }
          else {
            query = buildLuzmoQuery(slots);
          }
          this.queryingData$.next(true);

        return this.luzmoAPIService.queryLuzmoDataset([query]).pipe(
          tap(() => this.queryingData$.next(false)),
          map((result) => result.data)
        );
      } else {
        return of([]);
      }
    }),
    shareReplay(1)
  );

  displayedChartData$ = this.chartData$.pipe(map((data) => data.slice(0, 25)));

  @ViewChild('chartContainer') container!: ElementRef;

  @HostListener('window:resize')
  onResize(): void {
    if (this.authService.isAuthenticated$.getValue() && this.resize) {
      this.resize({
        container: this.container.nativeElement,
        slots: this.slotsSubject.getValue(),
        slotConfigurations: this.slotConfigs,
        options: {},
        language: 'en',
        dimensions: {
          width: this.container.nativeElement.clientWidth,
          height: this.container.nativeElement.clientHeight,
        },
      });
    }
  }

  async ngOnInit() {
    this.authService.isAuthenticated$
      .pipe(
        filter((isAuthenticated) => isAuthenticated),
        take(1)
      )
      .subscribe(async () => {
        this.ws.onmessage = async (message) => {
          if (message.data === 'watcher-rebuild') {
            await this.loadBundle();
            this.chartData$
              .pipe(take(1))
              .subscribe((data) => this.renderChart(data));
          }
        };

        await this.loadBundle();
        this.chartData$.subscribe((data) => {
          this.renderChart(data);
        });
      });
  }

  private async loadBundle() {
    // Load and execute the JavaScript bundle
    const response = await fetch('/custom-chart/bundle.js?t=' + Date.now());
    const blob = new Blob([await response.text()], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const module = await import(url);
    URL.revokeObjectURL(url);

    this.render = module.render;
    this.resize = module.resize;
    this.buildQuery = module.buildQuery;

    // Load and apply the CSS file dynamically
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = '/custom-chart/styles.css?t=' + Date.now();
    document.head.appendChild(cssLink);
  }

  private async renderChart(data: ItemData['data'] = []) {
    if (!this.render) {
      return;
    }

    this.render({
      container: this.container.nativeElement,
      data,
      slots: this.slotsSubject.getValue(),
      slotConfigurations: this.slotConfigs,
      options: {},
      language: 'en',
      dimensions: {
        width: this.container.nativeElement.clientWidth,
        height: this.container.nativeElement.clientHeight,
      },
    });
  }

  onColumnDropped(
    slotName: string,
    event: CustomEvent<{ slotContents: any[] }>
  ): void {
    const currentSlots = this.slotsSubject.getValue();
    const updatedSlots = currentSlots.map((slot) => {
      if (slot.name === slotName) {
        const content = event.detail.slotContents.map((column) => ({
          columnId: column.columnId,
          column: column.column,
          currency: column.currency,
          datasetId: column.datasetId,
          set: column.datasetId,
          format: column.format,
          label: column.label,
          level: column.level,
          lowestLevel: column.lowestLevel,
          subtype: column.subtype,
          type: column.type
        }));

        return {
          ...slot,
          content
        };
      }
      return slot;
    });

    this.slotsSubject.next(updatedSlots);
  }

  onDatasetSelected(event: CustomEvent<string>): void {
    const datasetId = event.detail;
    this.selectedDatasetIdSubject.next(datasetId);
  }

  logout(): void {
    this.authService.setAuthenticated(false);
  }
}
