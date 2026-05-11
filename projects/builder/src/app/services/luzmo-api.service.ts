import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService } from '@builder/services/auth.service';
import type { DatasetDataField } from '@luzmo/analytics-components-kit/types';
import { loadDataFieldsForDatasets } from '@luzmo/analytics-components-kit/utils';
import { from, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { CustomChart, ItemQuery, ItemQueryResponse, Securable, RowsData, Theme } from '../helpers/types';

@Injectable({
  providedIn: 'root'
})
export class LuzmoApiService {
  private authService = inject(AuthService);
  private httpClient = inject(HttpClient);

  loadAllDatasets() {
    return this.httpClient.post<
      RowsData<Pick<Securable, 'id' | 'name' | 'created_at' | 'subtype'>>
    >(
      `${this.authService.getApiUrl()}/0.1.0/securable`,
      {
        action: 'get',
        version: '0.1.0',
        key: this.authService.getCredentials().key,
        token: this.authService.getCredentials().token,
        find: {
          attributes: ['id', 'updated_at', 'created_at', 'name', 'subtype'],
          where: { type: 'dataset', is_variant: false },
          order: [['created_at', 'desc']],
          options: { public: false }
        }
      },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  loadDatasetDataFields(datasetId: string) {
    const { key, token } = this.authService.getCredentials();

    return from(
      loadDataFieldsForDatasets([datasetId], {
        dataBrokerConfig: {
          apiUrl: this.authService.getApiUrl(),
          authKey: key,
          authToken: token
        }
      })
    ).pipe(
      map((datasets): DatasetDataField[] => datasets[0]?.dataFields ?? [])
    );
  }

  loadCustomThemes() {
    return this.httpClient.post<RowsData<Theme>>(
      `${this.authService.getApiUrl()}/0.1.0/theme`,
      {
        action: 'get',
        version: '0.1.0',
        key: this.authService.getCredentials().key,
        token: this.authService.getCredentials().token,
        find: {
          attributes: ['id', 'name', 'theme', 'updated_at', 'created_at'],
          order: [['name', 'asc']]
        }
      },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  loadCustomCharts() {
    return this.httpClient.request<RowsData<CustomChart>>(
      'SEARCH',
      `${this.authService.getApiUrl()}/0.1.0/customchart`,
      {
        body: {
          action: 'get',
          version: '0.1.0',
          key: this.authService.getCredentials().key,
          token: this.authService.getCredentials().token,
          find: {
            attributes: [
              'id',
              'name',
              'icon',
              'icon_candidate',
              'type',
              'status',
              'updated_at',
              'created_at'
            ],
            where: {},
            order: [['updated_at', 'desc']]
          }
        },
        headers: new HttpHeaders({ 'Content-Type': 'application/json' })
      }
    );
  }

  queryLuzmoDataset(queries: ItemQuery[]) {
    return this.httpClient.post<ItemQueryResponse>(
      `${this.authService.getApiUrl()}/0.1.0/data`,
      {
        action: 'get',
        version: '0.1.0',
        key: this.authService.getCredentials().key,
        token: this.authService.getCredentials().token,
        find: { queries }
      },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  /**
   * Triggers a fresh `npm run build` on the local dev server (server.js).
   * The endpoint is reachable via the `/custom-chart` proxy declared in proxy.conf.json.
   */
  triggerBuild() {
    return this.httpClient
      .post<{ ok: boolean; error: string | null }>(
        '/custom-chart/build',
        {},
        { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
      )
      .pipe(
        switchMap((result) =>
          result?.ok
            ? from([void 0])
            : throwError(
                () => new Error(result?.error || 'Build failed on dev server.')
              )
        )
      );
  }

  /**
   * Fetches the freshly produced bundle.zip from the dev server.
   * Uses `responseType: 'blob'` and disables caching to avoid stale responses.
   */
  fetchBundleZip() {
    return this.httpClient.get('/custom-chart/bundle.zip', {
      responseType: 'blob',
      headers: new HttpHeaders({ 'cache-control': 'no-cache' })
    });
  }

  /**
   * End-to-end "upload as new custom chart" flow:
   *   1. Trigger a fresh build.
   *   2. Fetch the resulting bundle.zip.
   *   3. POST it as multipart form-data to the Luzmo customchart API.
   *
   * Note: do not set Content-Type manually — the browser writes the multipart boundary.
   */
  createCustomChart(type: string, name: string) {
    const { key, token } = this.authService.getCredentials();

    return this.triggerBuild().pipe(
      switchMap(() => this.fetchBundleZip()),
      switchMap((zip) => {
        const form = new FormData();
        form.append('version', '0.1.0');
        form.append('action', 'create');
        form.append('key', key);
        form.append('token', token);
        form.append('properties.name', JSON.stringify({ en: name }));
        form.append('properties.type', type);
        form.append('file', zip, 'bundle.zip');

        return this.httpClient.post<CustomChart>(
          `${this.authService.getApiUrl()}/0.1.0/customchart`,
          form
        );
      })
    );
  }

  /**
   * Re-upload (replace) an existing custom chart's code with the current local build.
   *
   * Same build+fetch dance as `createCustomChart`, but uses `action: 'update'` and the
   * existing chart `id`. Name and type are immutable post-creation, so they are not sent.
   */
  reuploadCustomChart(chartId: string) {
    const { key, token } = this.authService.getCredentials();

    return this.triggerBuild().pipe(
      switchMap(() => this.fetchBundleZip()),
      switchMap((zip) => {
        const form = new FormData();
        form.append('version', '0.1.0');
        form.append('action', 'update');
        form.append('key', key);
        form.append('token', token);
        form.append('id', chartId);
        form.append('file', zip, 'bundle.zip');

        return this.httpClient.post<CustomChart>(
          `${this.authService.getApiUrl()}/0.1.0/customchart`,
          form
        );
      })
    );
  }
}
