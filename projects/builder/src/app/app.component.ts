import { AsyncPipe } from '@angular/common';
import type { AfterViewChecked, ElementRef, OnDestroy, OnInit } from '@angular/core';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  HostListener,
  inject,
  ViewChild
} from '@angular/core';
import { LoginComponent } from '@builder/components/login/login.component';
import { buildLuzmoQuery } from '@builder/helpers/getData';
import { AuthService } from '@builder/services/auth.service';
import { LuzmoApiService } from '@builder/services/luzmo-api.service';
import '@luzmo/analytics-components-kit/draggable-data-field';
import '@luzmo/analytics-components-kit/droppable-slot';
import type { Slot, SlotConfig, ThemeConfig } from '@luzmo/dashboard-contents-types';
import '@luzmo/lucero/picker';
import '@luzmo/lucero/progress-circle';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxJsonViewerModule } from 'ngx-json-viewer';
import type { Observable } from 'rxjs';
import { BehaviorSubject, of, Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  switchMap,
  take,
  tap
} from 'rxjs/operators';
import manifestJson from '../../../custom-chart/src/manifest.json';
import {
  isValidMessageSource,
  setUpSecureIframe
} from './helpers/iframe.utils';
import type { ItemData, ItemQuery } from './helpers/types';
import { isDataResponse, isErrorResponse } from './helpers/types';
import {
  CdkVirtualScrollViewport,
  ScrollingModule
} from '@angular/cdk/scrolling';
import { FormsModule } from '@angular/forms';
import { DatasetPickerComponent } from './components/dataset-picker/dataset-picker.component';
import { SlotsConfigSchema } from './slot-schema';

// Interface to track query-relevant slot properties without format
interface SlotQuerySignature {
  name: string;
  content: Array<{
    columnId: string;
    datasetId: string;
    aggregationFunc?: string;
  }>;
}

interface DatasetState {
  loading: boolean;
  columns: any[];
}

interface QueryResultInfo {
  rowCount: number;
  durationInSeconds: number;
}

type AppearanceMode = 'light' | 'dark' | 'auto';
const APPEARANCE_MODE_STORAGE_KEY = 'luzmo-builder-appearance-mode';
/**
 * Main component for the Luzmo Custom Chart Builder application
 * Provides dataset selection, chart configuration, and visualization
 */
@UntilDestroy()
@Component({
  selector: 'app-root',
  imports: [
    NgxJsonViewerModule,
    LoginComponent,
    AsyncPipe,
    FormsModule,
    ScrollingModule,
    DatasetPickerComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent implements OnInit, OnDestroy, AfterViewChecked {
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

  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChild('columnListContainer') columnListContainer?: ElementRef<HTMLDivElement>;

  // Loading state indicators
  loadingDatasetDetail$ = new BehaviorSubject<boolean>(false);
  queryingData$ = new BehaviorSubject<boolean>(false);
  queryError$ = new BehaviorSubject<string | null>(null);
  private queryResultInfoSubject = new BehaviorSubject<QueryResultInfo | null>(null);
  queryResultInfo$ = this.queryResultInfoSubject.asObservable();

  slotConfigs: SlotConfig[] = [];
  manifestValidationError: string | null = null;

  private slotsSubject!: BehaviorSubject<Slot[]>;
  private queryRelevantSlotsSubject = new BehaviorSubject<SlotQuerySignature[]>(
    [],
  );

  private selectedDatasetIdSubject = new Subject<string>();

  columnSearchTerm = '';
  hasScrollbar = false;

  currentUser$ = this.authService.isAuthenticated$.pipe(
    filter((isAuthenticated) => isAuthenticated),
    switchMap(() => this.authService.getOrLoadUser()),
  );

  private datasetState: DatasetState = {
    loading: false,
    columns: [],
  };

  get isLoadingDataset(): boolean {
    return this.datasetState.loading;
  }

  get datasetColumns(): any[] {
    return this.datasetState.columns;
  }

  // Filtered columns based on search term
  get filteredDatasetColumns(): any[] {
    if (!this.columnSearchTerm.trim()) {
      return this.datasetColumns;
    }

    const searchTerm = this.columnSearchTerm.toLowerCase().trim();
    return this.datasetColumns.filter((column) => {
      // Search across all language values in the i18n label object
      if (column.label && typeof column.label === 'object') {
        return Object.values(column.label).some(
          (labelValue: any) =>
            labelValue &&
            labelValue.toString().toLowerCase().includes(searchTerm),
        );
      }
      // Fallback for non-i18n labels
      return true;
    });
  }
  columns$ = this.selectedDatasetIdSubject.pipe(
    untilDestroyed(this),
    tap(() => {
      // Update state directly
      this.datasetState.loading = true;
      this.datasetState.columns = [];
    }),
    switchMap((datasetId) =>
      this.luzmoAPIService.loadDatasetWithColumns(datasetId),
    ),
    map((result) => result.rows[0]),
    map((dataset) => this.transformColumnsData(dataset)),
    tap((columns) => {
      // Update state with results
      this.datasetState.columns = columns;
      this.datasetState.loading = false;
      this.columnSearchTerm = '';
    }),
  );

  chartData$!: Observable<any>;
  displayedChartData$!: Observable<any>;
  appearanceOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  appearanceMode: AppearanceMode = 'auto';
  private prefersDarkMedia: MediaQueryList | null = null;
  private systemThemeListenerAttached = false;
  private readonly handleSystemThemeChange = (_event?: MediaQueryListEvent) => {
    if (this.appearanceMode === 'auto') {
      this.applyAppearanceMode('auto', false);
    }
  };
  // Theme picker properties
  chartThemes: { label: string, name: string, theme: ThemeConfig }[] = [
    {
      name: 'light',
      label: 'Default (light)',
      theme: {
        background: 'rgb(245,245,245)',
        itemsBackground: 'rgb(255,255,255)',
        boxShadow: { size: 'none', color: 'rgb(0, 0, 0)' },
        title: {
          align: 'left',
          bold: false,
          italic: false,
          underline: false,
          border: false,
        },
        font: {
          fontFamily: 'Lato',
          'font-style': 'normal',
          'font-weight': 400,
          fontSize: 15,
        },
        colors: [
          'rgb(68,52,255)',
          'rgb(143,133,255)',
          'rgb(218,214,255)',
          'rgb(191,5,184)',
          'rgb(217,105,212)',
          'rgb(242,205,241)',
          'rgb(248,194,12)',
          'rgb(251,218,109)',
          'rgb(254,243,206)',
          'rgb(9,203,120)',
          'rgb(107,224,174)',
          'rgb(206,245,228)',
          'rgb(122,112,112)',
          'rgb(175,169,169)',
          'rgb(228,226,226)',
        ],
        borders: {
          'border-color': 'rgba(216,216,216,1)',
          'border-style': 'none',
          'border-radius': '12px',
          'border-top-width': '0px',
          'border-left-width': '0px',
          'border-right-width': '0px',
          'border-bottom-width': '0px',
        },
        margins: [16, 16],
        mainColor: 'rgb(68,52,255)',
        axis: {},
        legend: { type: 'circle' },
        tooltip: { background: 'rgb(38,38,38)', opacity: 1 },
        itemSpecific: { rounding: 8, padding: 4 },
      },
    },
    {
      name: 'dark',
      label: 'Default (dark)',
      theme: {
        background: 'rgb(61,61,61)',
        itemsBackground: 'rgb(38,38,38)',
        boxShadow: { size: 'none', color: 'rgb(0, 0, 0)' },
        title: {
          align: 'left',
          bold: false,
          italic: false,
          underline: false,
          border: false,
        },
        font: {
          fontFamily: 'Lato',
          'font-style': 'normal',
          'font-weight': 400,
          fontSize: 15,
        },
        colors: [
          'rgb(123,144,255)',
          'rgb(48,36,179)',
          'rgb(199,194,255)',
          'rgb(134,4,129)',
          'rgb(204,55,198)',
          'rgb(236,180,234)',
          'rgb(220,141,0)',
          'rgb(249,206,61)',
          'rgb(253,237,182)',
          'rgb(6,142,84)',
          'rgb(58,213,147)',
          'rgb(181,239,215)',
          'rgb(85,78,78)',
          'rgb(149,141,141)',
          'rgb(215,212,212)',
        ],
        borders: {
          'border-color': 'rgba(216,216,216,1)',
          'border-style': 'none',
          'border-radius': '12px',
          'border-top-width': '0px',
          'border-left-width': '0px',
          'border-right-width': '0px',
          'border-bottom-width': '0px',
        },
        margins: [16, 16],
        mainColor: 'rgb(123,144,255)',
        axis: {},
        legend: { type: 'circle' },
        tooltip: { background: 'rgb(248,248,248)', opacity: 1 },
        itemSpecific: { rounding: 8, padding: 4 },
      },
    },
    {
      name: 'royale',
      label: 'Royale',
      theme: {
        background: '#0A2747',
        itemsBackground: '#111e2f',
        boxShadow: { size: 'S', color: 'rgb(0,0,0)' },
        title: {
          align: 'center',
          bold: false,
          italic: false,
          underline: false,
          border: true,
        },
        borders: { 'border-radius': '3px' },
        margins: [10, 10],
        mainColor: '#f4a92c',
        axis: {},
        legend: { type: 'circle' },
        tooltip: { background: 'rgb(248,248,248)', opacity: 1 },
        colors: [
          '#feeaa1',
          '#e6cc85',
          '#ceaf6a',
          '#b79350',
          '#9f7738',
          '#885d20',
          '#704308',
        ],
        font: { fontFamily: 'Exo', fontSize: 13 },
      },
    },
    {
      name: 'urban',
      label: 'Urban',
      theme: {
        background: '#42403c',
        itemsBackground: '#e4dbcd',
        boxShadow: { size: 'none', color: 'rgb(0,0,0)' },
        title: {
          align: 'center',
          bold: false,
          italic: false,
          underline: false,
          border: true,
        },
        borders: {},
        margins: [5, 5],
        mainColor: '#33b59e',
        axis: {},
        legend: { type: 'circle' },
        tooltip: { background: 'rgb(248,248,248)', opacity: 1 },
        colors: [
          '#33b59e',
          '#453d30',
          '#ffffff',
          '#237869',
          '#165e4e',
          '#b89f76',
          '#7a6138',
          '#543c13',
          '#8a9c98',
          '#44524f',
        ],
        font: { fontFamily: 'Open Sans', fontSize: 13 },
      },
    },
  ];

  selectedTheme = 'light';

  @ViewChild('chartContainer') container!: ElementRef;

  private initializeSlotConfigs(): void {
    try {
      // Validate the slots array from manifest
      const validationResult = SlotsConfigSchema.safeParse(manifestJson.slots);

      if (!validationResult.success) {
        // Format validation errors
        const formattedErrors = validationResult.error.errors
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join('\n');

        this.manifestValidationError = `Manifest slot validation failed:\n${formattedErrors}`;
        console.error(this.manifestValidationError, validationResult.error);

        // Use an empty array for slots to avoid further errors
        this.slotConfigs = [];
      }
      else {
        this.slotConfigs = validationResult.data as SlotConfig[];
        this.manifestValidationError = null;
      }
    }
    catch (error) {
      this.manifestValidationError = `Failed to load slot configurations from manifest: ${error instanceof Error ? error.message : String(error)}`;
      console.error(this.manifestValidationError, error);

      // Use an empty array for slots
      this.slotConfigs = [];
    }

    // Initialize slots subject with empty slots
    this.slotsSubject = new BehaviorSubject<Slot[]>(
      this.slotConfigs.map((slotConfig) => ({
        name: slotConfig.name,
        content: [],
      }))
    );

    // Initialize query-relevant slots subject
    this.queryRelevantSlotsSubject.next(
      this.slotConfigs.map((slotConfig) => ({
        name: slotConfig.name,
        content: [],
      }))
    );

    // Setup observables for both query updates and format updates

    // This observable handles data queries based only on query-relevant slot changes
    this.chartData$ = this.queryRelevantSlotsSubject.pipe(
      untilDestroyed(this),
      // Debounce to avoid rapid consecutive query requests
      debounceTime(300),
      // Only proceed if the query-relevant properties have actually changed
      distinctUntilChanged(
        (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
      ),
      switchMap(() => {
        // Convert query signatures back to full slots for processing
        const fullSlots = this.slotsSubject.getValue();
        return this.fetchChartData(fullSlots);
      }),
      // Render when data arrives (only if no error occurred)
      tap((data) => {
        if (this.moduleLoaded && this.queryError$.getValue() === null) {
          this.performRender(data);
        }
      }),
      catchError((error) => {
        console.error('Chart data stream error:', error);
        this.queryingData$.next(false); // Ensure loader is hidden
        this.queryError$.next('An unexpected error occurred while loading chart data.');
        return of([]); // Return empty data to keep stream alive
      }),
      // Cache the last result to avoid redundant processing
      shareReplay(1)
    );

    // Setup a separate observer for the full slots that includes format
    // This will trigger renders when formats change without triggering new queries
    this.slotsSubject
      .pipe(
        untilDestroyed(this),
        // Debounce to avoid rapid consecutive renders
        debounceTime(50),
        // We want to tap into the latest data whenever slots change (including format changes)
        tap(() => {
          // If module is loaded, get the latest chart data and render
          if (this.moduleLoaded) {
            // Force the chart to re-render with current data
            this.chartData$
              .subscribe((data) => {
                this.performRender(data);
              })
              .unsubscribe();
          }
        }),
      )
      .subscribe();

    this.displayedChartData$ = this.chartData$.pipe(
      map((data) => data.slice(0, 25)),
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
        name: level.name
      })),
      name: column.name,
      label: column.name,
      level: column.level,
      lowestLevel: column.lowestLevel,
      subtype: column.subtype,
      type: column.type
    }));
  }

  /**
   * Extract query-relevant properties from slots
   * This excludes format and other non-query-relevant properties
   */
  private extractQueryRelevantSlots(slots: Slot[]): SlotQuerySignature[] {
    return slots.map((slot) => ({
      name: slot.name,
      content: slot.content.map((item) => ({
        columnId: item.columnId!,
        datasetId: item.datasetId!,
        aggregationFunc: item.aggregationFunc,
      })),
    }));
  }
  private calculateQueryDuration(
    performance?: Record<string, unknown> | null,
  ): number {
    if (!performance || typeof performance !== 'object') {
      return 0;
    }

    const values = Object.entries(performance)
      .filter(([key]) => key !== 'rows')
      .map(([, value]) => value)
      .filter((value) => typeof value === 'number') as number[];
    if (values.length === 0) {
      return 0;
    }

    const total = (performance as Record<string, unknown>)['total'];
    if (typeof total === 'number') {
      return Math.max(total, 0) / 1000;
    }

    return values.reduce((sum, value) => sum + value, 0) / 1000;
  }
  /**
   * Fetches chart data based on the current slot configuration
   */
  private fetchChartData(slots: Slot[]): Observable<any[]> {
    const allRequiredSlotsFilled = this.areAllRequiredSlotsFilled(slots);
    if (allRequiredSlotsFilled && slots.some((s) => s.content.length > 0)) {
      // Only fetch the query if we're not already doing so and module is loaded
      if (this.moduleLoaded && !this.queryInProgress) {
        this.fetchQuery();
      }
      // Wait for query to be available
      return this.queryReady$.pipe(
        switchMap((query) => {
          // If no custom query is available yet, use the default
          const finalQuery = query || buildLuzmoQuery(slots, this.slotConfigs);
          console.log('Fetching data with query', finalQuery);
          this.queryingData$.next(true);
          this.queryError$.next(null);
          this.queryResultInfoSubject.next(null);
          return this.luzmoAPIService.queryLuzmoDataset([finalQuery]).pipe(
            tap(() => {
              this.queryingData$.next(false);
              this.queryError$.next(null); // Clear error on success
            }),
            map((result) => {
              if (isErrorResponse(result)) {
                this.queryError$.next(result.error.message);
                this.queryResultInfoSubject.next(null);
                return [];
              }
              if (isDataResponse(result)) {
                console.log('Query result:', result);
                const durationInSeconds = this.calculateQueryDuration(
                  result.performance ?? null,
                );
                const rowCount = Array.isArray(result.data)
                  ? result.data.length
                  : 0;
                this.queryResultInfoSubject.next({
                  rowCount,
                  durationInSeconds,
                });
                return result.data;
              }
              return [];
            }),
            catchError((error) => {
              console.error('Chart data query failed:', error);
              this.queryingData$.next(false); // Hide loader
              this.queryError$.next(`
                <p>Failed to load chart data. Please check if your query is valid and try again.</p>
                <p><b>Query:</b> ${JSON.stringify(finalQuery, null, 2)}</p>
              `); // Set error message
              this.queryResultInfoSubject.next(null);

              return of([]); // Return empty data on error
            }),
          );
        }),
        catchError((error) => {
          console.error('Query preparation failed:', error);
          this.queryingData$.next(false); // Hide loader
          this.queryError$.next(
            'Failed to prepare query. Please check your configuration.',
          );
          this.queryResultInfoSubject.next(null);

          return of([]); // Return empty data on error
        })
      );
    }
    else {
      this.queryError$.next(null);
      this.queryResultInfoSubject.next(null);

      return of([]);
    }
  }

  /**
   * Checks if all required slots are filled with data
   */
  private areAllRequiredSlotsFilled(slots: Slot[]): boolean {
    return this.slotConfigs
      .filter((config) => config.isRequired)
      .map((config) => slots.find((slot) => slot.name === config.name))
      .every((slot) => slot && slot.content.length > 0);
  }

  /**
   * Triggers chart query building
   */
  private fetchQuery(): void {
    const now = Date.now();

    // Don't fetch if a query is already in progress or if we've recently fetched
    if (
      this.queryInProgress ||
      now - this.lastQueryTime < this.queryThrottleTime
    ) {
      return;
    }

    if (!this.iframe || !this.moduleLoaded) {
      console.log('Cannot fetch query: iframe not ready or module not loaded');
      return;
    }

    const slots = this.slotsSubject.getValue();

    // Skip if all slots are empty
    if (!slots.some((slot) => slot.content.length > 0)) {
      console.log('Skipping query fetch: all slots are empty');
      return;
    }

    console.log('Requesting query build with slots:', slots);
    this.queryInProgress = true;
    this.lastQueryTime = now;

    this.iframe.contentWindow?.postMessage(
      {
        type: 'buildQuery',
        slots: slots,
        slotConfigurations: this.slotConfigs,
      },
      '*',
    );

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

    // If we have data, render the chart
    // Create a subscription that auto-unsubscribes
    this.chartData$
      .subscribe((data) => {
        this.performRender(data);
      })
      .unsubscribe();
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

    // Find the selected theme object from the options array
    const selectedTheme = this.chartThemes.find(
      (t) => t.name === this.selectedTheme,
    );
    const renderData = {
      data: data,
      slots: this.slotsSubject.getValue(),
      slotConfigurations: this.slotConfigs,
      options: {
        theme: selectedTheme?.theme || this.chartThemes[0].theme, // Fallback to first theme if not found
      },
      language: 'en',
      dimensions: this.getContainerDimensions()
    };

    this.renderPending = true;

    requestAnimationFrame(() => {
      try {
        this.iframe?.contentWindow?.postMessage(
          {
            type: 'render',
            data: renderData
          },
          '*'
        );
      } catch (error) {
        console.error('Render error:', error);
      } finally {
        this.renderPending = false;
      }
    });
  }

  /**
   * Get container dimensions (extracted to avoid duplication)
   */
  private getContainerDimensions() {
    return {
      width: this.container?.nativeElement?.clientWidth || 0,
      height: this.container?.nativeElement?.clientHeight || 0,
    };
  }

  /**
   * Performs chart resizing with debounce to improve performance
   */
  private performResize(): void {
    if (this.resizeAnimationFrame !== null) {
      cancelAnimationFrame(this.resizeAnimationFrame);
    }

    // Find the selected theme object from the options array
    const selectedThemeObj = this.chartThemes.find(
      (t) => t.name === this.selectedTheme,
    );

    const resizeData = {
      slots: this.slotsSubject.getValue(),
      slotConfigurations: this.slotConfigs,
      options: {
        theme: selectedThemeObj?.theme || this.chartThemes[0].theme
      },
      language: 'en',
      dimensions: this.getContainerDimensions(),
    };

    this.resizeAnimationFrame = requestAnimationFrame(() => {
      this.iframe?.contentWindow?.postMessage(
        {
          type: 'resize',
          data: resizeData
        },
        '*'
      );
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
        const styleResponse = await fetch(
          '/custom-chart/index.css?t=' + Date.now()
        );
        this.styleContent = await styleResponse.text();
      } catch {
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
        .catch((error) => {
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
      .replaceAll('\\', '\\\\') // Escape backslashes first
      .replaceAll('`', '\\`') // Escape backticks
      .replaceAll('$', String.raw`\$`) // Escape dollar signs
      .replaceAll("'", String.raw`\'`) // Escape single quotes
      .replaceAll('"', String.raw`\"`);
  }

  private initializeAppearanceMode(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.prefersDarkMedia = window.matchMedia('(prefers-color-scheme: dark)');

    let storedMode: AppearanceMode | null = null;

    try {
      const raw = localStorage.getItem(APPEARANCE_MODE_STORAGE_KEY);
      if (this.isAppearanceMode(raw)) {
        storedMode = raw;
      }
    } catch {
      storedMode = null;
    }

    const initialMode = storedMode ?? 'auto';
    this.applyAppearanceMode(initialMode, false);
    this.attachSystemThemeListener();
  }

  private applyAppearanceMode(mode: AppearanceMode, persist = true): void {
    this.appearanceMode = mode;

    if (persist) {
      try {
        localStorage.setItem(APPEARANCE_MODE_STORAGE_KEY, mode);
      } catch {
        // Swallow storage errors (e.g. private browsing).
      }
    }

    this.updateDocumentTheme(mode);
    this.updateChartTheme();
  }

  private updateDocumentTheme(mode: AppearanceMode): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;

    if (mode === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', mode);
    }
  }

  private updateChartTheme(): void {
    const effectiveTheme = this.getEffectiveTheme();
    this.selectedTheme = effectiveTheme;
    
    // Re-render chart if module is loaded and we have data
    if (this.moduleLoaded) {
      this.chartData$
        .pipe(take(1))
        .subscribe((data) => this.performRender(data));
    }
  }

  private getEffectiveTheme(): 'light' | 'dark' {
    if (this.appearanceMode === 'dark') {
      return 'dark';
    }
    
    if (this.appearanceMode === 'light') {
      return 'light';
    }
    
    // For 'auto' mode, check system preference
    if (this.prefersDarkMedia?.matches) {
      return 'dark';
    }
    
    return 'light';
  }

  private attachSystemThemeListener(): void {
    if (this.systemThemeListenerAttached || !this.prefersDarkMedia) {
      return;
    }

    if (typeof this.prefersDarkMedia.addEventListener === 'function') {
      this.prefersDarkMedia.addEventListener(
        'change',
        this.handleSystemThemeChange,
      );
      this.systemThemeListenerAttached = true;
    } else if (typeof this.prefersDarkMedia.addListener === 'function') {
      this.prefersDarkMedia.addListener(this.handleSystemThemeChange);
      this.systemThemeListenerAttached = true;
    }
  }

  private detachSystemThemeListener(): void {
    if (!this.systemThemeListenerAttached || !this.prefersDarkMedia) {
      return;
    }

    if (typeof this.prefersDarkMedia.removeEventListener === 'function') {
      this.prefersDarkMedia.removeEventListener(
        'change',
        this.handleSystemThemeChange,
      );
    } else if (typeof this.prefersDarkMedia.removeListener === 'function') {
      this.prefersDarkMedia.removeListener(this.handleSystemThemeChange);
    }

    this.systemThemeListenerAttached = false;
  }

  private isAppearanceMode(
    value: string | null | undefined,
  ): value is AppearanceMode {
    return value === 'light' || value === 'dark' || value === 'auto';
  }

  @HostListener('window:resize')
  onResize(): void {
    if (
      this.authService.isAuthenticated$.getValue() &&
      this.moduleLoaded &&
      this.iframe
    ) {
      this.performResize();
    }
  }

  async ngOnInit(): Promise<void> {
    this.initializeAppearanceMode();
    this.columns$.subscribe();
    this.initializeSlotConfigs();
    window.addEventListener('message', this.handleMessage);

    this.authService.isAuthenticated$
      .pipe(
        filter((isAuthenticated) => isAuthenticated),
        filter(() => !this.queryInProgress)
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
    this.detachSystemThemeListener();
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

  ngAfterViewChecked(): void {
    if (this.columnListContainer) {
      const element = this.columnListContainer.nativeElement;
      const hasScrollbar = element.scrollHeight > element.clientHeight;
      if (this.hasScrollbar !== hasScrollbar) {
        this.hasScrollbar = hasScrollbar;
      }
    }
  }

  /**
   * Handles column drop events
   */
  onColumnDropped(
    slotName: string,
    slotType: string,
    event: CustomEvent<{ slotContents: any[] }>
  ): void {
    const currentSlots = this.slotsSubject.getValue();
    // Extract the previous content for the slot being updated

    // Create updated slots
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
          type: column.type,
          aggregationFunc:
            slotType === 'numeric'
              ? column.aggregationFunc || 'sum'
              : undefined,
        }));

        return {
          ...slot,
          content
        };
      }
      return slot;
    });

    // Always update the main slots subject for rendering
    this.slotsSubject.next(updatedSlots);

    // Extract query-relevant properties
    const newQuerySlots = this.extractQueryRelevantSlots(updatedSlots);
    const currentQuerySlots = this.queryRelevantSlotsSubject.getValue();

    // Only update the query-relevant subject if there's an actual change in query-relevant properties
    if (JSON.stringify(newQuerySlots) !== JSON.stringify(currentQuerySlots)) {
      this.queryRelevantSlotsSubject.next(newQuerySlots);
    }
  }

  /**
   * Handles dataset selection events
   */
  onDatasetSelected(datasetId: string): void {
    this.selectedDatasetIdSubject.next(datasetId);
  }

  onAppearanceModeChange(event: CustomEvent<string>): void {
    const mode = event.detail;
    if (!this.isAppearanceMode(mode) || mode === this.appearanceMode) {
      return;
    }
    this.applyAppearanceMode(mode);
  }
  onChartThemeChange(event: CustomEvent<string>): void {
    this.selectedTheme = event.detail;
    // Re-render with the new theme
    if (this.moduleLoaded) {
      this.chartData$
        .pipe(take(1))
        .subscribe((data) => this.performRender(data));
    }
  }

  /**
   * Handles logout events
   */
  logout(): void {
    this.authService.setAuthenticated(false);
  }
}
