import { AsyncPipe } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  OnDestroy,
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
import { ItemData, ItemQuery } from './helpers/types';
import { isValidMessageSource, setUpSecureIframe } from './helpers/iframe.utils';

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
  private buildQuery?: (slots: Slot[]) => ItemQuery;

  currentUser$ = this.authService.isAuthenticated$
    .pipe(
      filter(isAuthenticated => isAuthenticated),
      switchMap(() => this.authService.getOrLoadUser())
    );

  loadingAllDatasets$ = new BehaviorSubject<boolean>(false);
  loadingDatasetDetail$ = new BehaviorSubject<boolean>(false);
  queryingData$ = new BehaviorSubject<boolean>(false);

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

  private selectedDatasetIdSubject = new Subject<string>();
  columns$ = this.selectedDatasetIdSubject
    .pipe(
      untilDestroyed(this),
      // tap(() => setTimeout(() => this.loadingDatasetDetail$.next(true), 0)),
      switchMap(datasetId => this.luzmoAPIService.loadDatasetWithColumns(datasetId)),
      map(result => result.rows[0]),
      map(dataset =>
        dataset.columns.map(column => ({
          columnId: column.id,
          currency: column.currency?.symbol,
          datasetId: dataset.id,
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
      ),
      // tap(() => setTimeout(() => this.loadingDatasetDetail$.next(false), 0))
    );

  slotConfigs: SlotConfig[] = defaultSlotConfigs;
  private slotsSubject = new BehaviorSubject<Slot[]>(this.slotConfigs.map(slotConfig => ({ name: slotConfig.name, content: [] })));

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
      if (event.data.query) {
        this.buildQuery = () => event.data.query;
      }
    }
    else if (event.data.type === 'moduleError') {
      console.error('Module error:', event.data.error);
    }
  };

  chartData$ = this.slotsSubject
    .pipe(
      untilDestroyed(this),
      switchMap(slots => {
        const allRequiredSlotsFilled = defaultSlotConfigs
          .filter(s => s.isRequired)
          .map(s => slots.find(slot => slot.name === s.name))
          .every(s => s && s.content.length > 0);

        if (allRequiredSlotsFilled && slots.some(s => s.content.length > 0)) {
          let query: ItemQuery;

          console.log(this.buildQuery)

          if (this.buildQuery) {
            query = this.buildQuery(slots);
          }
          else {
            query = buildLuzmoQuery(slots);
          }
          this.queryingData$.next(true);

          return this.luzmoAPIService.queryLuzmoDataset([query])
            .pipe(
              tap(() => this.queryingData$.next(false)),
              map(result => result.data)
            );
        }
        else {
          return of([]);
        }
      }),
      tap(data => {
        if (this.moduleLoaded && data.length > 0) {
          this.performRender(data);
        }
      }),
      shareReplay(1)
    );

  displayedChartData$ = this.chartData$.pipe(map(data => data.slice(0, 25)));

  @ViewChild('chartContainer') container!: ElementRef;

  @HostListener('window:resize')
  onResize(): void {
    if (this.authService.isAuthenticated$.getValue() === true && this.moduleLoaded && this.iframe) {
      this.performResize();
    }
  }

  async ngOnInit() {
    window.addEventListener('message', this.handleMessage);
    
    this.authService.isAuthenticated$
      .pipe(
        filter(isAuthenticated => isAuthenticated),
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
          
          // We'll wait for the moduleLoaded message to handle rendering
        })
        .catch(error => {
          console.error('Failed to setup iframe:', error);
        });
    } catch (error) {
      console.error('Failed to load bundle:', error);
    }
  }

  private performRender(data: ItemData['data'] = []): void {
    if (this.renderPending || !this.iframe || !data.length) {
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

  onColumnDropped(slotName: string, event: CustomEvent<{ slotContents: any[] }>): void {
    const currentSlots = this.slotsSubject.getValue();
    const updatedSlots = currentSlots.map((slot) => {
      if (slot.name === slotName) {
        const droppedColumn = event.detail.slotContents[0];
        const content = event.detail.slotContents.map((column) => ({
          columnId: droppedColumn.columnId,
          currency: droppedColumn.currency,
          datasetId: droppedColumn.datasetId,
          format: droppedColumn.format,
          label: droppedColumn.label,
          level: droppedColumn.level,
          lowestLevel: droppedColumn.lowestLevel,
          subtype: droppedColumn.subtype,
          type: droppedColumn.type
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
