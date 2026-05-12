import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService } from '@builder/services/auth.service';
import type { DatasetDataField } from '@luzmo/analytics-components-kit/types';
import { loadDataFieldsForDatasets } from '@luzmo/analytics-components-kit/utils';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ItemQuery, ItemQueryResponse, Securable, RowsData, Theme } from '../helpers/types';

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

  queryLuzmoDataset(queries: ItemQuery[]) {
    return this.httpClient.post<ItemQueryResponse | ItemQueryResponse[]>(
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
}
