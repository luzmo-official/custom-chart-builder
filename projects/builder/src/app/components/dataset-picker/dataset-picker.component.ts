import {
  CdkVirtualScrollViewport,
  ScrollingModule
} from '@angular/cdk/scrolling';
import type { ElementRef, OnInit } from '@angular/core';
import {
  Component,
  EventEmitter,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { NgbDropdown } from '@ng-bootstrap/ng-bootstrap';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { LuzmoApiService } from '../../services/luzmo-api.service';

@UntilDestroy()
@Component({
  selector: 'app-dataset-picker',
  standalone: true,
  imports: [NgbDropdownModule, FormsModule, ScrollingModule],
  templateUrl: './dataset-picker.component.html',
  styleUrls: ['./dataset-picker.component.scss']
})
export class DatasetPickerComponent implements OnInit {
  @Output() datasetSelected = new EventEmitter<string>();

  @ViewChild('datasetDropdown') datasetDropdown!: NgbDropdown;
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChild('searchInput') searchInput!: ElementRef;

  private authService = inject(AuthService);
  private luzmoAPIService = inject(LuzmoApiService);

  searchQuery = '';
  sortOption: 'name' | 'date' = 'date';
  selectedDatasetId: string | null = null;
  selectedDatasetName: string | null = null;
  isLoadingDatasets = true;

  datasets: any[] = [];
  filteredDatasets: any[] = [];

  loadingState$ = new BehaviorSubject<boolean>(true);

  /**
   * Initialize component and set up dataset loading
   */
  ngOnInit(): void {
    // Set up dataset loading when user is authenticated
    this.authService.isAuthenticated$
      .pipe(
        untilDestroyed(this),
        filter((isAuthenticated) => isAuthenticated),
        tap(() => {
          this.isLoadingDatasets = true;
          this.loadingState$.next(true);
        }),
        switchMap(() => this.luzmoAPIService.loadAllDatasets()),
        map((result) =>
          result.rows.map((dataset: any) => {
            dataset.localizedName =
              dataset.name['en'] || dataset.name[Object.keys(dataset.name)[0]];
            return dataset;
          })
        )
      )
      .subscribe({
        next: (datasets) => {
          this.datasets = datasets;
          this.isLoadingDatasets = false;
          this.loadingState$.next(false);
          this.filterDatasets();
        },
        error: (error) => {
          console.error('Error loading datasets:', error);
          this.isLoadingDatasets = false;
          this.loadingState$.next(false);
        }
      });
  }

  /**
   * Handle dropdown open event
   */
  onDropdownOpened(): void {
    // Don't allow opening if still loading
    if (this.isLoadingDatasets) {
      if (this.datasetDropdown) {
        this.datasetDropdown.close();
      }
      return;
    }

    // Wait for the DOM to be ready
    setTimeout(() => {
      if (this.searchInput?.nativeElement) {
        this.searchInput.nativeElement.focus();
      }

      if (this.viewport && this.selectedDatasetId) {
        // If we have a selected item, scroll to it
        const index = this.filteredDatasets.findIndex(
          (d) => d.id === this.selectedDatasetId
        );
        if (index >= 0) {
          this.viewport.scrollToIndex(index, 'smooth');
        }
      }
    });
  }

  trackById(index: number, item: any): string {
    return item.id;
  }

  filterDatasets(): void {
    if (
      this.isLoadingDatasets ||
      !this.datasets ||
      this.datasets.length === 0
    ) {
      this.filteredDatasets = [];
      return;
    }

    let filtered = [...this.datasets];

    // Apply search filter if query exists
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter((dataset) =>
        dataset.localizedName.toLowerCase().includes(query)
      );
    }

    // Sort the datasets
    filtered.sort((a, b) => {
      if (this.sortOption === 'name') {
        return a.localizedName.localeCompare(b.localizedName);
      } else {
        // Sort by date (most recent first)
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    });

    this.filteredDatasets = filtered;
  }

  selectDataset(dataset: any): void {
    this.selectedDatasetId = dataset.id;
    this.selectedDatasetName = dataset.localizedName;
    this.datasetSelected.emit(dataset.id);

    // Close the dropdown after selection
    if (this.datasetDropdown) {
      this.datasetDropdown.close();
    }
  }

  setSortOption(option: 'name' | 'date'): void {
    this.sortOption = option;
    this.filterDatasets();
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
