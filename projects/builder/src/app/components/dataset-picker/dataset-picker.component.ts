import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Output,
  ViewChild,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { luzmoAngleDown, luzmoAngleUp } from '@luzmo/icons';
import { LuzmoActionButton } from '@luzmo/ngx-lucero/action-button';
import { LuzmoActionGroup } from '@luzmo/ngx-lucero/action-group';
import { LuzmoIcon } from '@luzmo/ngx-lucero/icon';
import { LuzmoOptions } from '@luzmo/ngx-lucero/options';
import { LuzmoOverlay } from '@luzmo/ngx-lucero/overlay';
import { LuzmoPopover } from '@luzmo/ngx-lucero/popover';
import { LuzmoSearch } from '@luzmo/ngx-lucero/search';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  take
} from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { LuzmoApiService } from '../../services/luzmo-api.service';

interface DatasetOption {
  value: string;
  label: string;
  description: string;
}

const PAGE_SIZE = 50;
/** Distance (in items) from the bottom at which the next page is fetched. */
const LOAD_MORE_THRESHOLD = 10;

@Component({
  selector: 'app-dataset-picker',
  standalone: true,
  imports: [
    LuzmoOverlay,
    LuzmoPopover,
    LuzmoSearch,
    LuzmoActionGroup,
    LuzmoActionButton,
    LuzmoIcon,
    LuzmoOptions
  ],
  templateUrl: './dataset-picker.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./dataset-picker.component.scss']
})
export class DatasetPickerComponent {
  @Output() datasetSelected = new EventEmitter<string>();

  @ViewChild(LuzmoOverlay) overlayRef?: LuzmoOverlay;
  @ViewChild(LuzmoSearch) searchRef?: LuzmoSearch;
  @ViewChild(LuzmoOptions) optionsRef?: LuzmoOptions;

  private authService = inject(AuthService);
  private luzmoAPIService = inject(LuzmoApiService);
  private destroyRef = inject(DestroyRef);
  // Zoneless: paging/search happens in async pipelines, so re-check explicitly.
  private cdr = inject(ChangeDetectorRef);

  searchQuery = '';
  sortOption: 'name' | 'date' = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';
  selectedDatasetId: string | null = null;
  selectedDatasetName: string | null = null;
  isLoadingDatasets = false;
  isOpen = false;
  private datasetsLoaded = false;
  private totalCount = 0;

  datasets: any[] = [];

  /** Raw search box input; debounced before triggering a server request. */
  private searchInput$ = new Subject<string>();
  /** Fires a data request; `true` appends the next page, `false` resets. */
  private loadTrigger$ = new Subject<boolean>();

  // Cached stable references for the Luzmo custom-element inputs. These
  // elements virtualize their content, so passing a fresh array reference on
  // every change-detection cycle triggers needless re-renders. Recompute only
  // when the underlying source actually changes.
  private datasetOptionsSource: any[] | null = null;
  private datasetOptionsRef: DatasetOption[] = [];
  private selectedValueRef: (string | null)[] = [this.selectedDatasetId];

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((query) => {
        this.searchQuery = query;
        this.reload();
      });

    this.loadTrigger$
      .pipe(
        switchMap((append) => {
          this.isLoadingDatasets = true;
          this.cdr.markForCheck();
          return this.luzmoAPIService
            .loadDatasets({
              limit: PAGE_SIZE,
              offset: append ? this.datasets.length : 0,
              search: this.searchQuery,
              sort: this.sortOption,
              direction: this.sortDirection
            })
            .pipe(
              map((result) => ({ append, result })),
              catchError((error) => {
                console.error('Error loading datasets:', error);
                return of(null);
              })
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((payload) => {
        this.isLoadingDatasets = false;
        if (!payload) {
          this.cdr.markForCheck();
          return;
        }
        const { append, result } = payload;
        const rows = result.rows.map((dataset: any) => {
          dataset.localizedName =
            dataset.name['en'] || dataset.name[Object.keys(dataset.name)[0]];
          return dataset;
        });
        this.totalCount = result.count;
        this.datasets = append ? [...this.datasets, ...rows] : rows;
        if (!append) {
          this.optionsRef?.scrollToTop();
        }
        this.cdr.markForCheck();
      });
  }

  /** Whether more pages remain to be fetched from the server. */
  private get hasMore(): boolean {
    return this.datasets.length < this.totalCount;
  }

  /** Reset to the first page for the current search/sort. */
  private reload(): void {
    this.loadTrigger$.next(false);
  }

  /**
   * Load datasets on demand. Runs at most once (the first time the dropdown is
   * opened) and only once the user is authenticated.
   */
  private ensureDatasetsLoaded(): void {
    if (this.datasetsLoaded) {
      return;
    }
    this.datasetsLoaded = true;
    this.authService.isAuthenticated$
      .pipe(
        filter((isAuthenticated) => isAuthenticated),
        take(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.reload());
  }

  /** Options for luzmo-options, with the created date shown as the description. */
  get datasetOptions(): DatasetOption[] {
    if (this.datasetOptionsSource !== this.datasets) {
      this.datasetOptionsSource = this.datasets;
      this.datasetOptionsRef = this.datasets.map((dataset) => ({
        value: dataset.id,
        label: dataset.localizedName,
        description: this.formatDate(dataset.created_at)
      }));
    }
    return this.datasetOptionsRef;
  }

  /** Stable single-element array for the luzmo-options `value` input. */
  get selectedValue(): (string | null)[] {
    if (this.selectedValueRef[0] !== this.selectedDatasetId) {
      this.selectedValueRef = [this.selectedDatasetId];
    }
    return this.selectedValueRef;
  }

  /** Label shown on the picker trigger. */
  get triggerLabel(): string {
    return this.selectedDatasetName || 'Select a dataset...';
  }

  /** Angle icon reflecting the current sort direction. */
  get sortIcon(): unknown {
    return this.sortDirection === 'asc' ? luzmoAngleUp : luzmoAngleDown;
  }

  /** Load datasets on first open, then focus the search field. */
  onOpened(): void {
    this.isOpen = true;
    this.ensureDatasetsLoaded();
    setTimeout(() => this.searchRef?.nativeElement.focus());
  }

  onClosed(): void {
    this.isOpen = false;
  }

  private closeOverlay(): void {
    if (this.overlayRef) {
      this.overlayRef.nativeElement.open = false;
    }
  }

  onSearchInput(event: Event): void {
    this.searchInput$.next(
      (event.target as unknown as { value?: string }).value ?? ''
    );
  }

  /**
   * Toggle sorting. Switching to a field uses its default direction (name asc,
   * date desc); clicking the active field flips the direction.
   */
  onSortClick(field: 'name' | 'date'): void {
    if (this.sortOption === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortOption = field;
      this.sortDirection = field === 'name' ? 'asc' : 'desc';
    }
    this.reload();
  }

  /** Fetch the next page when the user scrolls near the bottom. */
  onScrolled(event: Event): void {
    const last = (event as CustomEvent).detail?.last ?? 0;
    if (
      !this.isLoadingDatasets &&
      this.hasMore &&
      last >= this.datasets.length - LOAD_MORE_THRESHOLD
    ) {
      this.loadTrigger$.next(true);
    }
  }

  onOptionSelected(event: Event): void {
    const id = (event as CustomEvent).detail?.value?.[0];
    if (!id) {
      return;
    }
    const dataset = this.datasets.find((d) => d.id === id);
    if (dataset) {
      this.selectDataset(dataset);
    }
  }

  selectDataset(dataset: any): void {
    this.selectedDatasetId = dataset.id;
    this.selectedDatasetName = dataset.localizedName;
    this.datasetSelected.emit(dataset.id);
    this.closeOverlay();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return date.toLocaleDateString(undefined, options);
  }
}
