import { AsyncPipe } from '@angular/common';
import type { OnInit } from '@angular/core';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { luzmoEllipsisVertical, luzmoPlus } from '@luzmo/icons';
import { chartTypeError } from '../../helpers/custom-chart-upload';
import { LuzmoActionMenu } from '@luzmo/ngx-lucero/action-menu';
import { LuzmoButton } from '@luzmo/ngx-lucero/button';
import { LuzmoFieldLabel } from '@luzmo/ngx-lucero/field-label';
import { LuzmoIcon } from '@luzmo/ngx-lucero/icon';
import { LuzmoMenuItem } from '@luzmo/ngx-lucero/menu-item';
import { LuzmoNotice } from '@luzmo/ngx-lucero/notice';
import { LuzmoProgressCircle } from '@luzmo/ngx-lucero/progress-circle';
import { LuzmoTextField } from '@luzmo/ngx-lucero/text-field';
import { BehaviorSubject, of } from 'rxjs';
import { catchError, filter, finalize, map, switchMap, take, tap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { LuzmoApiService } from '../../services/luzmo-api.service';
import type { CustomChart } from '../../helpers/types';

@Component({
  selector: 'app-custom-charts-list',
  standalone: true,
  imports: [
    AsyncPipe,
    FormsModule,
    LuzmoActionMenu,
    LuzmoButton,
    LuzmoFieldLabel,
    LuzmoIcon,
    LuzmoMenuItem,
    LuzmoNotice,
    LuzmoProgressCircle,
    LuzmoTextField
  ],
  templateUrl: './custom-charts-list.component.html',
  styleUrls: ['./custom-charts-list.component.scss']
})
export class CustomChartsListComponent implements OnInit {
  private authService = inject(AuthService);
  private luzmoAPIService = inject(LuzmoApiService);
  private destroyRef = inject(DestroyRef);

  protected readonly luzmoPlus = luzmoPlus;
  protected readonly luzmoEllipsisVertical = luzmoEllipsisVertical;

  protected readonly uploadsDisabledReason =
    'Manifest has validation errors. Fix manifest.json to enable uploads.';

  @Input() manifestError: string | null = null;

  /** Emits the current chart count whenever the list is loaded or reloaded. */
  @Output() chartsLoaded = new EventEmitter<number>();

  get hasManifestError(): boolean {
    return this.manifestError !== null;
  }

  isLoading$ = new BehaviorSubject<boolean>(true);
  customCharts: CustomChart[] = [];

  showAddForm = false;
  newChartType = '';
  newChartName = '';
  isUploading$ = new BehaviorSubject<boolean>(false);
  uploadError: string | null = null;
  successMessage: string | null = null;

  confirmingChartId: string | null = null;
  reuploadError: string | null = null;

  ngOnInit(): void {
    this.authService.isAuthenticated$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((isAuthenticated) => isAuthenticated),
        switchMap(() => this.loadCharts$())
      )
      .subscribe({
        next: (charts) => {
          this.customCharts = charts;
          this.isLoading$.next(false);
          this.chartsLoaded.emit(charts.length);
        },
        error: (error) => {
          console.error('Error loading custom charts:', error);
          this.customCharts = [];
          this.isLoading$.next(false);
          this.chartsLoaded.emit(0);
        }
      });
  }

  private loadCharts$() {
    this.isLoading$.next(true);
    return this.luzmoAPIService.loadCustomCharts().pipe(
      map((result) => result.rows ?? []),
      catchError((error) => {
        console.error('Error loading custom charts:', error);
        return of<CustomChart[]>([]);
      }),
      tap(() => this.isLoading$.next(false))
    );
  }

  private reloadCharts(): void {
    this.loadCharts$()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (charts) => {
          this.customCharts = charts;
          this.chartsLoaded.emit(charts.length);
        },
        error: (error) => {
          console.error('Error reloading custom charts:', error);
        }
      });
  }

  get canUpload(): boolean {
    return (
      this.newChartType.trim().length > 0 &&
      this.newChartName.trim().length > 0 &&
      !this.isUploading$.value &&
      !this.hasManifestError &&
      this.chartTypeError === null
    );
  }

  get isAddFormValid(): boolean {
    return (
      this.newChartType.trim().length > 0 &&
      this.newChartName.trim().length > 0 &&
      !this.hasManifestError &&
      this.chartTypeError === null
    );
  }

  get chartTypeError(): string | null {
    const type = this.newChartType.trim();
    if (!type) {
      return null;
    }
    return chartTypeError(type) ?? this.duplicateTypeError;
  }

  /**
   * Returns an inline error string when the currently typed chart type already
   * exists in the loaded list, or `null` when the input is empty or unique.
   *
   * Evaluated on every change-detection pass while the form is open so the
   * Upload button and inline message stay in sync with the input.
   */
  get duplicateTypeError(): string | null {
    const type = this.newChartType.trim();
    if (!type) {
      return null;
    }
    return this.customCharts.some((chart) => chart.type === type)
      ? `A custom chart with type "${type}" already exists.`
      : null;
  }

  openAddForm(): void {
    if (this.confirmingChartId !== null) {
      return;
    }
    this.showAddForm = true;
    this.newChartType = '';
    this.newChartName = '';
    this.uploadError = null;
    this.successMessage = null;
  }

  cancelAdd(): void {
    if (this.isUploading$.value) {
      return;
    }
    this.showAddForm = false;
    this.newChartType = '';
    this.newChartName = '';
    this.uploadError = null;
  }

  submitAdd(): void {
    if (!this.canUpload) {
      return;
    }

    const type = this.newChartType.trim();
    const name = this.newChartName.trim();

    this.uploadError = null;
    this.successMessage = null;
    this.isUploading$.next(true);

    this.luzmoAPIService
      .createCustomChart(type, name)
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isUploading$.next(false))
      )
      .subscribe({
        next: () => {
          this.showAddForm = false;
          this.newChartType = '';
          this.newChartName = '';
          this.uploadError = null;
          this.successMessage = `Custom chart "${name}" uploaded successfully.`;
          this.reloadCharts();
        },
        error: (error) => {
          console.error('Error creating custom chart:', error);
          this.uploadError = this.extractErrorMessage(error);
        }
      });
  }

  private extractErrorMessage(error: unknown): string {
    if (!error) {
      return 'Upload failed.';
    }
    if (typeof error === 'string') {
      return error;
    }
    const err = error as { error?: any; message?: string };
    if (err.error) {
      if (typeof err.error === 'string') {
        return err.error;
      }
      if (err.error.message) {
        return err.error.message;
      }
      if (err.error.error) {
        return typeof err.error.error === 'string'
          ? err.error.error
          : err.error.error.message ?? 'Upload failed.';
      }
    }
    return err.message ?? 'Upload failed.';
  }

  trackById(_index: number, chart: CustomChart): string {
    return chart.id;
  }

  reuploadChart(chart: CustomChart): void {
    if (this.isUploading$.value) {
      return;
    }
    this.confirmingChartId = chart.id;
    this.reuploadError = null;
    this.successMessage = null;
  }

  cancelReupload(): void {
    if (this.isUploading$.value) {
      return;
    }
    this.confirmingChartId = null;
    this.reuploadError = null;
  }

  confirmReupload(chart: CustomChart): void {
    if (
      this.isUploading$.value ||
      this.confirmingChartId !== chart.id ||
      this.hasManifestError
    ) {
      return;
    }

    this.reuploadError = null;
    this.successMessage = null;
    this.isUploading$.next(true);

    this.luzmoAPIService
      .reuploadCustomChart(chart.id)
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isUploading$.next(false))
      )
      .subscribe({
        next: () => {
          this.confirmingChartId = null;
          this.reuploadError = null;
          this.successMessage = `Custom chart "${this.localizedName(chart)}" updated successfully.`;
          this.reloadCharts();
        },
        error: (error) => {
          console.error('Error re-uploading custom chart:', error);
          this.reuploadError = this.extractErrorMessage(error);
        }
      });
  }

  localizedName(chart: CustomChart): string {
    const name = chart.name;
    if (!name) {
      return chart.id;
    }
    return name['en'] ?? Object.values(name)[0] ?? chart.id;
  }

  /**
   * Resolves the icon URL for a custom chart.
   *
   * The API returns `icon` / `icon_candidate` as bare file names (e.g. `<id>.svg`).
   * They must be served from the **app host** (not the API host) under
   * `/custom-chart-assets/`, with auth passed as `key` + `token` query params.
   *
   * Prefers the candidate (unpublished) icon over the live one, matching the
   * Luzmo admin-style behavior - so newly uploaded charts show their pending
   * icon immediately.
   *
   * `updated_at` is folded into the query string as a cache buster: the icon
   * file name stays the same across re-uploads (`<id>_candidate.svg`), so
   * without this the browser would keep serving the previously cached bytes
   * even though the file on the server has changed.
   */
  iconUrl(chart: CustomChart): string | null {
    const path = chart.icon_candidate ?? chart.icon ?? null;
    return this.buildAssetUrl(path, chart.updated_at);
  }

  private buildAssetUrl(
    path: string | null | undefined,
    cacheBuster?: string | null
  ): string | null {
    if (!path) {
      return null;
    }
    const { key, token } = this.authService.getCredentials();
    if (!key || !token) {
      return null;
    }
    const appUrl = this.authService.getAppUrl().replace(/\/$/, '');
    const params: Record<string, string> = { key, token };
    if (cacheBuster) {
      params['v'] = cacheBuster;
    }
    const query = new URLSearchParams(params).toString();
    return `${appUrl}/custom-chart-assets/${path}?${query}`;
  }
}
