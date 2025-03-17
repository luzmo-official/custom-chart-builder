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
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { filter, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import manifestJson from '../../../custom-chart/src/manifest.json';
import { isValidMessageSource, setUpSecureIframe } from './helpers/iframe.utils';
import { ItemData, ItemQuery } from './helpers/types';

import { SlotsConfigSchema } from './slot-schema';

/**
 * Main component for the Luzmo Custom Chart Builder application
 * Provides dataset selection, chart configuration, and visualization
 */
@UntilDestroy()
@Component({
  selector: 'app-root',
  imports: [NgxJsonViewerModule, LoginComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent implements OnInit, OnDestroy {
  // Services
  protected authService = inject(AuthService);
  private luzmoAPIService = inject(LuzmoApiService);

  // WebSocket connection for real-time updates
  private ws = new WebSocket('ws://localhost:8080');

  // IFrame and visualization state
  private iframe: HTMLIFrameElement | null = null;
  private blobUrl: string | null = null;
  moduleLoaded = false;
  private resizeAnimationFrame: number | null = null;
  private renderPending = false;
  private scriptContent = '';
  private styleContent = '';

  // Query management
  private queryInProgress = false;
  private lastQueryTime = 0;
  private queryThrottleTime = 500; // ms
  private querySubject = new Subject<ItemQuery | null>();
  private queryReady$ = this.querySubject.asObservable();

  // Loading state indicators
  loadingAllDatasets$ = new BehaviorSubject<boolean>(false);
  loadingDatasetDetail$ = new BehaviorSubject<boolean>(false);
  queryingData$ = new BehaviorSubject<boolean>(false);

  slotConfigs: SlotConfig[] = [];
  manifestValidationError: string | null = null;

  private slotsSubject = new BehaviorSubject<Slot[]>(
    this.slotConfigs.map(slotConfig => ({ name: slotConfig.name, content: [] }))
  );

  // User and dataset state
  private selectedDatasetIdSubject = new Subject<string>();

  // Observable streams
  currentUser$ = this.authService.isAuthenticated$.pipe(
    filter(isAuthenticated => isAuthenticated),
    switchMap(() => this.authService.getOrLoadUser())
  );

  datasets$ = this.authService.isAuthenticated$
    .pipe(
      untilDestroyed(this),
      filter(isAuthenticated => isAuthenticated),
      tap(() => setTimeout(() => this.loadingAllDatasets$.next(true), 0)),
      filter(() => !this.loadingAllDatasets$.value),
      switchMap(() => this.luzmoAPIService.loadAllDatasets()),
      map(result => result.rows),
      tap(() => setTimeout(() => this.loadingAllDatasets$.next(false), 0))
    );

  columns$ = this.selectedDatasetIdSubject
    .pipe(
      untilDestroyed(this),
      switchMap(datasetId => this.luzmoAPIService.loadDatasetWithColumns(datasetId)),
      map(result => result.rows[0]),
      map(dataset => this.transformColumnsData(dataset))
    );

  chartData$ = this.slotsSubject
    .pipe(
      untilDestroyed(this),
      switchMap(slots => this.fetchChartData(slots)),
      tap(data => {
        if (this.moduleLoaded) {
          this.performRender(data);
        }
      }),
      shareReplay(1)
    );

  displayedChartData$ = this.chartData$.pipe(
    map(data => data.slice(0, 25))
  );

  @ViewChild('chartContainer') container!: ElementRef;

  private initializeSlotConfigs(): void {
    try {
      // Validate the slots array from manifest
      const validationResult = SlotsConfigSchema.safeParse(manifestJson.slots);

      if (!validationResult.success) {
        // Format validation errors
        const formattedErrors = validationResult.error.errors.map(err =>
          `${err.path.join('.')}: ${err.message}`
        ).join('\n');

        this.manifestValidationError = `Manifest slot validation failed:\n${formattedErrors}`;
        console.error(this.manifestValidationError, validationResult.error);

        // Use an empty array for slots to avoid further errors
        this.slotConfigs = [];
      } else {
        this.slotConfigs = validationResult.data as SlotConfig[];
        this.manifestValidationError = null;
      }
    } catch (error) {
      this.manifestValidationError = `Failed to load slot configurations from manifest: ${error instanceof Error ? error.message : String(error)}`;
      console.error(this.manifestValidationError, error);

      // Use an empty array for slots
      this.slotConfigs = [];
    }

    // Initialize slots subject with empty slots
    this.slotsSubject = new BehaviorSubject<Slot[]>(
      this.slotConfigs.map(slotConfig => ({ name: slotConfig.name, content: [] }))
    );
  }

  /**
   * Transforms the raw dataset columns into the format expected by the chart builder
   */
  private transformColumnsData(dataset: any): any[] {
    return dataset.columns.map((column: any) => ({
      columnId: column.id,
      column: column.id,
      currency: column.currency?.symbol,
      datasetId: dataset.id,
      set: dataset.id,
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
    }));
  }

  /**
   * Fetches chart data based on the current slot configuration
   */
  private fetchChartData(slots: Slot[]): Observable<any[]> {
    const allRequiredSlotsFilled = this.areAllRequiredSlotsFilled(slots);

    if (allRequiredSlotsFilled && slots.some(s => s.content.length > 0)) {
      // Only fetch the query if we're not already doing so and module is loaded
      if (this.moduleLoaded && !this.queryInProgress) {
        console.log('Fetching query due to slot changes');
        this.fetchQuery();
      }

      // Wait for query to be available
      return this.queryReady$.pipe(
        take(1),
        switchMap(query => {
          // If no custom query is available yet, use the default
          const finalQuery = query || buildLuzmoQuery(slots);

          console.log('Using query for data fetch:', finalQuery);
          this.queryingData$.next(true);

          return this.luzmoAPIService.queryLuzmoDataset([finalQuery]).pipe(
            tap(() => this.queryingData$.next(false)),
            map(result => result.data)
          );
        })
      );
    } else {
      return of([]);
    }
  }

  /**
   * Checks if all required slots are filled with data
   */
  private areAllRequiredSlotsFilled(slots: Slot[]): boolean {
    return this.slotConfigs
      .filter(config => config.isRequired)
      .map(config => slots.find(slot => slot.name === config.name))
      .every(slot => slot && slot.content.length > 0);
  }

  /**
   * Triggers chart query building
   */
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

  /**
   * Handles messages from the iframe
   */
  private handleMessage = (event: MessageEvent): void => {
    if (!isValidMessageSource(event, this.iframe)) {
      return;
    }

    switch (event.data.type) {
      case 'moduleLoaded':
        this.handleModuleLoaded();
        break;
      case 'queryLoaded':
        this.handleQueryLoaded(event.data.query);
        break;
      case 'moduleError':
        console.error('Module error:', event.data.error);
        break;
    }
  };

  /**
   * Handles module loaded event from iframe
   */
  private handleModuleLoaded(): void {
    this.moduleLoaded = true;
    console.log('Module loaded successfully');

    // If we have data, render the chart
    this.chartData$.pipe(take(1)).subscribe(data => {
      this.performRender(data);
    });
  }

  /**
   * Handles query loaded event from iframe
   */
  private handleQueryLoaded(query: ItemQuery): void {
    this.queryInProgress = false;
    this.querySubject.next(query);
  }

  /**
   * Performs the chart rendering
   */
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

  /**
   * Performs chart resizing
   */
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

  /**
   * Loads the chart bundle into the iframe
   */
  private async loadBundle(): Promise<void> {
    try {
      // Load script content
      const scriptResponse = await fetch('/custom-chart/index.js?t=' + Date.now());
      this.scriptContent = await scriptResponse.text();

      // Escape special characters in script content
      this.scriptContent = this.escapeScriptContent(this.scriptContent);

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

  /**
   * Escapes special characters in script content
   */
  private escapeScriptContent(script: string): string {
    return script
      .replaceAll('\\', '\\\\')     // Escape backslashes first
      .replaceAll('`', '\\`')       // Escape backticks
      .replaceAll('$', String.raw`\$`)      // Escape dollar signs
      .replaceAll('\'', String.raw`\'`)      // Escape single quotes
      .replaceAll('"', String.raw`\"`);
  }

  // #region Lifecycle Methods

  @HostListener('window:resize')
  onResize(): void {
    if (this.authService.isAuthenticated$.getValue() && this.moduleLoaded && this.iframe) {
      this.performResize();
    }
  }

  async ngOnInit(): Promise<void> {
    this.initializeSlotConfigs();
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

  // #endregion

  // #region Event Handlers

  /**
   * Handles column drop events
   */
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

  /**
   * Handles dataset selection events
   */
  onDatasetSelected(event: CustomEvent<string>): void {
    const datasetId = event.detail;
    this.selectedDatasetIdSubject.next(datasetId);
  }

  /**
   * Handles logout events
   */
  logout(): void {
    this.authService.setAuthenticated(false);
  }

  // #endregion
}
