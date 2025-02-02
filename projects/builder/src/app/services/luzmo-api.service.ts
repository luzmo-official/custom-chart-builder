import { Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { Securable, RowsData, ItemData, ItemQuery } from '../../../../custom-chart/src/helpers/types';

@Injectable({
  providedIn: 'root'
})
export class LuzmoApiService {
  private _key: string = '';
  private _token: string = '';

  set key(value: string) {
    this._key = value;
  }

  set token(value: string) {
    this._token = value;
  }

  loadAllDatasets(): Observable<RowsData<Pick<Securable, 'id' | 'name' | 'created_at' | 'subtype'>>> {
    return from(fetch('https://api.luzmo.com/0.1.0/securable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get',
        version: '0.1.0',
        key: this._key,
        token: this._token,
        find: {
          attributes: ['id', 'updated_at', 'created_at', 'name', 'subtype'],
          where: { type: 'dataset', is_variant: false },
          order: [['created_at', 'desc']],
          options: { public: false, owned: true }
        }
      })
    })).pipe(
      switchMap(response => from(response.json()))
    );
  }

  // TODO: fix columns type
  loadDatasetWithColumns(datasetId: string): Observable<RowsData<Pick<Securable, 'id' | 'name' | 'created_at' | 'subtype'> & { columns: any[] }>> {
    return from(fetch('https://api.luzmo.com/0.1.0/securable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get',
        version: '0.1.0',
        key: this._key,
        token: this._token,
        find: {
          attributes: ['id', 'name'],
          where: { id: datasetId },
          include: [
            {
              model: 'Column',
              attributes: ['id', 'name', 'description', 'type', 'subtype', 'format', 'highestLevel', 'lowestLevel', 'duration_levels', 'duration_format'
              ],
              separate: true,
              order: [['order', 'asc']],
              include: [
                {
                  model: 'HierarchyLevel',
                  attributes: ['id', 'color', 'level', 'name'],
                  separate: true,
                  order: [['level', 'asc']]
                },
                { model: 'Currency', attributes: ['id', 'name', 'symbol'] }
              ]
            }
          ]
        }
      })
    })).pipe(
      switchMap(response => from(response.json()))
    );
  }

  queryLuzmoDataset(query: ItemQuery): Observable<ItemData> {
    return from(fetch('https://api.luzmo.com/0.1.0/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get',
        version: '0.1.0',
        key: this._key,
        token: this._token,
        find: { queries: [query] }
      })
    })).pipe(
      switchMap(response => from(response.json()))
    );
  }
}