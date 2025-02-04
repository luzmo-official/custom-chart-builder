import { AsyncPipe } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { LoginComponent } from '@builder/components/login/login.component';
import { AuthService } from '@builder/services/auth.service';
import { buildLuzmoQuery } from '@builder/services/getData';
import { LuzmoApiService } from '@builder/services/luzmo-api.service';
import '@luzmo/analytics-components-kit/draggable-data-item';
import '@luzmo/analytics-components-kit/droppable-slot';
import '@luzmo/analytics-components-kit/edit-option-radio-button-group';
import '@luzmo/analytics-components-kit/picker';
import '@luzmo/analytics-components-kit/progress-circle';
import { Slot, SlotConfig } from '@luzmo/dashboard-contents-types';
import { NgxJsonViewerModule } from 'ngx-json-viewer';
import { BehaviorSubject, of, Subject, Subscription } from 'rxjs';
import { filter, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import { Dimensions, ItemData } from '../../../custom-chart/src/helpers/types';
import { defaultSlotConfigs } from '../../../custom-chart/src/slots.config';

@Component({
  selector: 'app-root',
  imports: [NgxJsonViewerModule, LoginComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent implements OnInit, OnDestroy {
  protected authService = inject(AuthService);
  private luzmoAPIService = inject(LuzmoApiService);
  private ws = new WebSocket('ws://localhost:8080');
  private render?: (element: HTMLElement, data: ItemData['data'], dimensions: Dimensions) => void;
  private resize?: (element: HTMLElement, dimensions: Dimensions) => void;
  private chartDataSubscription?: Subscription;

  currentUser$ = this.authService.isAuthenticated$
    .pipe(
      filter(isAuthenticated => isAuthenticated),
      switchMap(() => this.authService.getOrLoadUser())
    );

  loadingAllDatasets$ = new BehaviorSubject<boolean>(false);
  loadingDatasetDetail$ = new BehaviorSubject<boolean>(false);
  status = { queryingData: false };

  // 1. Once authenticated, load all datasets.
  datasets$ = this.authService.isAuthenticated$
    .pipe(
      filter(isAuthenticated => isAuthenticated),
      tap(() => setTimeout(() => this.loadingAllDatasets$.next(true), 0)),
      filter(() => !this.loadingAllDatasets$.value),
      switchMap(() =>
        this.luzmoAPIService.loadAllDatasets()
          .pipe(
            tap(() => setTimeout(() => this.loadingAllDatasets$.next(false), 0)),
            map(result => result.rows)
          )
      )
    );

  // 2. When a dataset is selected, load its columns.
  private selectedDatasetIdSubject = new Subject<string>();
  columns$ = this.selectedDatasetIdSubject
    .pipe(
      // tap(() => setTimeout(() => this.loadingDatasetDetail$.next(true), 0)),
      switchMap(datasetId =>
        this.luzmoAPIService.loadDatasetWithColumns(datasetId)
          .pipe(
            // tap(() => setTimeout(() => this.loadingDatasetDetail$.next(false), 0)),
            map(result => result.rows[0]),
            map(dataset =>
              dataset.columns.map(column => ({
                columnId: column.id,
                currency: column.currency?.symbol,
                datasetId,
                description: column.description,
                format: column.format,
                hierarchyLevels: (column.hierarchyLevels || []).map((level: any) => ({
                  id: level.id,
                  level: level.level,
                  label: level.name
                })),
                label: column.name,
                level: column.level,
                lowestLevel: column.lowestLevel,
                subtype: column.subtype,
                type: column.type
              }))
            )
          )
      )
    );

  // 3. Chart query triggered by slots.
  slotConfigs: SlotConfig[] = defaultSlotConfigs;
  private slotsSubject = new BehaviorSubject<Slot[]>(this.slotConfigs.map(slotConfig => ({ name: slotConfig.name, content: [] })));

  chartData$ = this.slotsSubject
    .pipe(
      switchMap(slots => {
        // Check if all required slots are filled
        const allRequiredSlotsFilled = defaultSlotConfigs
          .filter(s => s.isRequired)
          .map(s => slots.find(slot => slot.name === s.name))
          .every(s => s && s.content.length > 0);

        if (allRequiredSlotsFilled && slots.some(s => s.content.length > 0)) {
          const query = buildLuzmoQuery(slots);
          this.status.queryingData = true;

          return this.luzmoAPIService.queryLuzmoDataset([query])
            .pipe(
              tap(() => this.status.queryingData = false),
              map(result => result.data)
            );
        }
        else {
          return of([]);
        }
      }),
      shareReplay(1)
    );

  displayedChartData$ = this.chartData$.pipe(map(data => data.slice(0, 25)));

  @ViewChild('chartContainer') container!: ElementRef;
  // Resize the chart when the window is resized.
  @HostListener('window:resize')
  onResize(): void {
    if (this.resize) {
      this.resize(
        this.container.nativeElement,
        { width: this.container.nativeElement.clientWidth, height: this.container.nativeElement.clientHeight }
      );
    }
  }

  async ngOnInit() {
    // Once the user is authenticated, initialize WebSocket and subscribe to chart bundle updates.
    this.authService.isAuthenticated$
      .pipe(
        filter(isAuthenticated => isAuthenticated),
        take(1)
      )
      .subscribe(async () => {
        this.ws.onmessage = async (message) => {
          if (message.data === 'watcher-rebuild') {
            await this.loadBundle();
            this.chartData$
              .pipe(take(1))
              .subscribe(data => this.renderChart(data));
          }
        };

        await this.loadBundle();
        this.chartDataSubscription = this.chartData$.subscribe(data => {
          this.renderChart(data);
        });
      });
  }

  ngOnDestroy() {
    if (this.chartDataSubscription) {
      this.chartDataSubscription.unsubscribe();
    }
  }

  private async loadBundle() {
    const response = await fetch('/custom-chart/bundle.js?t=' + Date.now());
    const blob = new Blob([await response.text()], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const module = await import(url);
    URL.revokeObjectURL(url);

    this.render = module.render;
    this.resize = module.resize;
  }

  private async renderChart(data: ItemData['data'] = []) {
    if (!this.render) {
      return;
    }

    this.render(
      this.container.nativeElement, 
      data,
      { width: this.container.nativeElement.clientWidth, height: this.container.nativeElement.clientHeight }
    );
  }

  // Called when a column is dropped into a slot.
  onColumnDropped(slotName: string, event: CustomEvent<{ slotContents: any[] }>): void {
    const currentSlots = this.slotsSubject.getValue();
    const updatedSlots = currentSlots.map((slot) => {
      if (slot.name === slotName) {
        const droppedColumn = event.detail.slotContents[0];
        return {
          ...slot,
          content: droppedColumn
            ? [{
              columnId: droppedColumn.columnId,
              currency: droppedColumn.currency,
              datasetId: droppedColumn.datasetId,
              format: droppedColumn.format,
              label: droppedColumn.label,
              level: droppedColumn.level,
              lowestLevel: droppedColumn.lowestLevel,
              subtype: droppedColumn.subtype,
              type: droppedColumn.type
            }]
            : []
        };
      }
      return slot;
    });

    this.slotsSubject.next(updatedSlots);
  }

  // Called when the user selects a dataset.
  onDatasetSelected(event: CustomEvent<string>): void {
    const datasetId = event.detail;
    this.selectedDatasetIdSubject.next(datasetId);
  }

  logout(): void {
    this.authService.setAuthenticated(false);
  }
}
