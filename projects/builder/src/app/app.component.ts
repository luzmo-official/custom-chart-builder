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
import { isValidMessageSource, setUpSecureIframe } from './helpers/iframe.utils';
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
export class AppComponent implements OnInit, OnDestroy {
  protected authService = inject(AuthService);
  private luzmoAPIService = inject(LuzmoApiService);
  private ws = new WebSocket('ws://localhost:8080');

  private iframe: HTMLIFrameElement | null = null;
  private blobUrl: string | null = null;
  moduleLoaded = false;
  private resizeAnimationFrame: number | null = null;
  private renderPending = false;
  private scriptContent = '';
  private styleContent = '';


  private queryInProgress = false;
  private lastQueryTime = 0;
  private queryThrottleTime = 500; // ms

  private querySubject = new BehaviorSubject<ItemQuery | null>(null);
  private queryReady$ = this.querySubject.asObservable();

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

  private fetchQuery(): void {
    const now = Date.now();

    // Don't fetch if a query is already in progress or if we've recently fetched
    if (this.queryInProgress || (now - this.lastQueryTime < this.queryThrottleTime)) {
      return;
    }

    if (!this.iframe || !this.moduleLoaded) {
      console.log('Cannot fetch query: iframe not ready or module not loaded');
      return;
    }

    const slots = this.slotsSubject.getValue();

    // Skip if all slots are empty
    if (!slots.some(slot => slot.content.length > 0)) {
      console.log('Skipping query fetch: all slots are empty');
      return;
    }

    console.log('Requesting query build with slots:', slots);
    this.queryInProgress = true;
    this.lastQueryTime = now;

    this.iframe.contentWindow?.postMessage({
      type: 'buildQuery',
      slots: slots,
      slotConfigurations: this.slotConfigs
    }, '*');

    // Set a safety timeout to reset queryInProgress flag if no response received
    setTimeout(() => {
      if (this.queryInProgress) {
        console.log('Query request timed out, resetting status');
        this.queryInProgress = false;
      }
    }, 5000); // 5-second timeout
  }

  // Message handler for iframe
  private handleMessage = (event: MessageEvent) => {
    if (!isValidMessageSource(event, this.iframe)) {
      return;
    }

    if (event.data.type === 'moduleLoaded') {
      this.moduleLoaded = true;
      console.log('Module loaded successfully');

      // If we have data, render the chart
      this.chartData$.pipe(take(1)).subscribe(data => {
        this.performRender(data);
      });
    }
    else if (event.data.type === 'queryLoaded') {
      this.queryInProgress = false;

      // Update the query subject with the new query
      this.querySubject.next(event.data.query);
    }
    else if (event.data.type === 'moduleError') {
      console.error('Module error:', event.data.error);
    }
  };


// 3. Update your chartData$ to use the queryReady$ observable
  chartData$ = this.slotsSubject.pipe(
    untilDestroyed(this),
    switchMap((slots) => {
      const allRequiredSlotsFilled = this.slotConfigs
        .filter((s) => s.isRequired)
        .map((s) => slots.find((slot) => slot.name === s.name))
        .every((s) => s && s.content.length > 0);

      if (allRequiredSlotsFilled && slots.some(s => s.content.length > 0)) {
        // Only fetch the query if we're not already doing so and module is loaded
        if (this.moduleLoaded && !this.queryInProgress) {
          console.log('Fetching query due to slot changes');
          this.fetchQuery();
        }

        // Wait for query to be available
        return this.queryReady$.pipe(
          // Take the first valid query
          take(1),
          // Then use it to fetch data
          switchMap(query => {
            // If no custom query is available yet, use the default
            const finalQuery = query || buildLuzmoQuery(slots);

            console.log('Using query for data fetch:', finalQuery);
            this.queryingData$.next(true);

            return this.luzmoAPIService.queryLuzmoDataset([finalQuery]).pipe(
              tap(() => this.queryingData$.next(false)),
              map((result) => result.data)
            );
          })
        );
      } else {
        return of([]);
      }
    }),
    tap(data => {
      if (this.moduleLoaded) {
        this.performRender(data);
      }
    }),
    shareReplay(1)
  );

  displayedChartData$ = this.chartData$.pipe(map((data) => data.slice(0, 25)));

  @ViewChild('chartContainer') container!: ElementRef;

  @HostListener('window:resize')
  onResize(): void {
    if (this.authService.isAuthenticated$.getValue() && this.moduleLoaded && this.iframe) {
      this.performResize();
    }
  }

  async ngOnInit() {
    window.addEventListener('message', this.handleMessage);

    this.authService.isAuthenticated$
      .pipe(
        filter((isAuthenticated) => isAuthenticated),
        take(1)
      )
      .subscribe(async () => {
        this.ws.onmessage = async (message) => {
          if (message.data === 'watcher-rebuild') {
            await this.loadBundle();
          }
        };

        await this.loadBundle();
      });
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.handleMessage);

    if (this.resizeAnimationFrame !== null) {
      cancelAnimationFrame(this.resizeAnimationFrame);
    }

    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }

  private async loadBundle() {
    try {
      const scriptResponse = await fetch('/custom-chart/bundle.js?t=' + Date.now());
      this.scriptContent = await scriptResponse.text();

      this.scriptContent = this.scriptContent.replaceAll('\\', '\\\\')     // Escape backslashes first
        .replaceAll('`', '\\`')       // Escape backticks
        .replaceAll('$', String.raw`\$`)      // Escape dollar signs
        .replaceAll('\'', String.raw`\'`)      // Escape single quotes
        .replaceAll('"', String.raw`\"`);

      // Load style content
      try {
        const styleResponse = await fetch('/custom-chart/styles.css?t=' + Date.now());
        this.styleContent = await styleResponse.text();
      } catch (error) {
        console.warn('No styles found, continuing without styles');
        this.styleContent = '';
      }

      // Setup iframe
      const chartContainer = this.container.nativeElement;
      chartContainer.innerHTML = '';

      // Create the iframe
      setUpSecureIframe(chartContainer, this.scriptContent, this.styleContent)
        .then(({ iframe, blobUrl }) => {
          this.iframe = iframe;
          this.blobUrl = blobUrl;
        })
        .catch(error => {
          console.error('Failed to setup iframe:', error);
        });
    } catch (error) {
      console.error('Failed to load bundle:', error);
    }
  }

  private performRender(data: ItemData['data'] = []): void {
    if (this.renderPending || !this.iframe) {
      return;
    }

    const renderData = {
      data: data,
      slots: this.slotsSubject.getValue(),
      slotConfigurations: this.slotConfigs,
      options: {},
      language: 'en',
      dimensions: {
        width: this.container.nativeElement.clientWidth,
        height: this.container.nativeElement.clientHeight
      }
    };

    this.renderPending = true;

    requestAnimationFrame(() => {
      try {
        this.iframe?.contentWindow?.postMessage({
          type: 'render',
          data: renderData
        }, '*');
      }
      catch (error) {
        console.error('Render error:', error);
      }
      finally {
        this.renderPending = false;
      }
    });
  }

  private performResize(): void {
    if (this.resizeAnimationFrame !== null) {
      cancelAnimationFrame(this.resizeAnimationFrame);
    }

    const resizeData = {
      slots: this.slotsSubject.getValue(),
      slotConfigurations: this.slotConfigs,
      options: {},
      language: 'en',
      dimensions: {
        width: this.container.nativeElement.clientWidth,
        height: this.container.nativeElement.clientHeight
      }
    };

    this.resizeAnimationFrame = requestAnimationFrame(() => {
      this.iframe?.contentWindow?.postMessage({
        type: 'resize',
        data: resizeData
      }, '*');
      this.resizeAnimationFrame = null;
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
