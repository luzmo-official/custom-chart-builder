import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { BehaviorSubject, of, take } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import type { AuthResponse, RowsData, User } from '../helpers/types';
import { isBoolean, isEmpty } from '../helpers/types.utils';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface StoredAuth {
  key: string;
  token: string;
  apiUrl: string;
  appUrl: string;
  tokenExpiry?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private static readonly AUTH_STORAGE_KEY = 'authentication';

  private user?: User;
  private httpClient = inject(HttpClient);

  private defaultUrls = {
    US: {
      appUrl: 'https://app.us.luzmo.com',
      apiUrl: 'https://api.us.luzmo.com'
    },
    Europe: {
      appUrl: 'https://app.luzmo.com',
      apiUrl: 'https://api.luzmo.com'
    }
  };

  private _region: 'US' | 'Europe' = 'Europe';

  private _key = '';
  private _token = '';
  private _appUrl = this.defaultUrls[this._region].appUrl;
  private _apiUrl = this.defaultUrls[this._region].apiUrl;

  private authenticated = this.restoreSession();
  isAuthenticated$ = new BehaviorSubject<boolean>(this.authenticated);
  private isAuthenticating = false;

  private restoreSession(): boolean {
    const auth = this.getStoredAuth();
    if (!auth || !auth.key || !auth.token || !auth.appUrl || !auth.apiUrl) {
      this.clearStoredAuth();
      return false;
    }

    if (auth.tokenExpiry) {
      const expiryMs = Number.parseInt(auth.tokenExpiry, 10);
      if (Number.isNaN(expiryMs) || new Date(expiryMs) < new Date()) {
        this.clearStoredAuth();
        return false;
      }
    }

    this._key = auth.key;
    this._token = auth.token;
    this._appUrl = auth.appUrl;
    this._apiUrl = auth.apiUrl;
    return true;
  }

  isAuthenticated(): boolean {
    return this.isAuthenticated$.getValue();
  }

  setAuthenticated(value: boolean, user?: AuthResponse['user'] | User): void {
    if (
      !isBoolean(value) ||
      this.isAuthenticating ||
      this.authenticated === value
    ) {
      return;
    }

    this.isAuthenticating = true;

    try {
      if (value === false) {
        this.user = undefined;
        this._key = '';
        this._token = '';
        this.clearStoredAuth();
        this._appUrl = this.defaultUrls[this._region].appUrl;
        this._apiUrl = this.defaultUrls[this._region].apiUrl;
      } else if (user && this.isAuthResponse(user) && !isEmpty(user.token)) {
        this._key = user.token.id;
        this._token = user.token.token;
        this.persistAuth(user.token.tokenExpiry);
      }

      this.authenticated = value;
      this.isAuthenticated$.next(value);
    } finally {
      this.isAuthenticating = false;
    }
  }

  getCredentials(): Record<'key' | 'token', string> {
    return {
      key: this._key,
      token: this._token
    };
  }

  getOrLoadUser(): Observable<User | null> {
    return this.user ? of(this.user) : this.loadUser();
  }

  loadUser(uid = 'me'): Observable<User | null> {
    return this.httpClient
      .post<RowsData<User>>(
        `${this._apiUrl}/0.1.0/user`,
        {
          action: 'get',
          version: '0.1.0',
          key: this._key,
          token: this._token,
          find: {
            where: { id: uid },
            include: [{ model: 'Organization', attributes: ['id', 'name'] }]
          }
        },
        { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
      )
      .pipe(
        take(1),
        map((result) => {
          if (!result.rows?.length) {
            this.setAuthenticated(false);
            return null;
          }

          const [user] = result.rows;

          if (!user.organizations?.[0]) {
            this.setAuthenticated(false);
            return user;
          }

          this.setUser(user);
          this.setAuthenticated(true);

          return this.user as User;
        })
      );
  }

  authenticateWithKeyToken(key: string, token: string): Observable<User | null> {
    this.user = undefined;
    this.clearStoredAuth();

    this._key = key;
    this._token = token;

    return this.loadUser('me').pipe(
      tap(() => {
        if (this.isAuthenticated()) {
          this.persistAuth();
        } else {
          this._key = '';
          this._token = '';
        }
      }),
      catchError(() => {
        this._key = '';
        this._token = '';
        this.setAuthenticated(false);
        return of(null);
      })
    );
  }

  getUser(): User {
    return this.user || ({} as User);
  }

  setUser(value: User): User {
    return (this.user = { ...value });
  }

  getAppUrl(): string {
    return this._appUrl;
  }

  getApiUrl(): string {
    return this._apiUrl;
  }

  setAppUrl(value: string): void {
    if (!isEmpty(value)) {
      this._appUrl = value;
      if (this.authenticated) {
        this.persistAuth();
      }
    }
  }

  setApiUrl(value: string): void {
    if (!isEmpty(value)) {
      this._apiUrl = value;
      if (this.authenticated) {
        this.persistAuth();
      }
    }
  }

  setRegion(region: 'US' | 'Europe'): void {
    this._region = region;

    const isUsingDefaultAppUrl = Object.values(this.defaultUrls).some(
      (urls) => urls.appUrl === this._appUrl
    );

    const isUsingDefaultApiUrl = Object.values(this.defaultUrls).some(
      (urls) => urls.apiUrl === this._apiUrl
    );

    if (isUsingDefaultAppUrl) {
      this._appUrl = this.defaultUrls[region].appUrl;
    }

    if (isUsingDefaultApiUrl) {
      this._apiUrl = this.defaultUrls[region].apiUrl;
    }

    if (this.authenticated) {
      this.persistAuth();
    }
  }

  resetUrlsToDefaults(): void {
    this._appUrl = this.defaultUrls[this._region].appUrl;
    this._apiUrl = this.defaultUrls[this._region].apiUrl;

    if (this.authenticated) {
      this.persistAuth();
    }
  }

  private persistAuth(tokenExpiry?: string): void {
    try {
      const existing = this.getStoredAuth();
      const data: StoredAuth = {
        key: this._key,
        token: this._token,
        apiUrl: this._apiUrl,
        appUrl: this._appUrl,
        tokenExpiry: tokenExpiry ?? existing?.tokenExpiry
      };
      localStorage.setItem(AuthService.AUTH_STORAGE_KEY, JSON.stringify(data));
    } catch {
      console.warn('Storage unavailable. Auth will continue in-memory only.');
    }
  }

  private getStoredAuth(): StoredAuth | null {
    try {
      const data = localStorage.getItem(AuthService.AUTH_STORAGE_KEY);
      if (!data) {
        return null;
      }
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private clearStoredAuth(): void {
    try {
      localStorage.removeItem(AuthService.AUTH_STORAGE_KEY);
    } catch {
      // Storage unavailable — nothing to clear
      console.warn('Storage unavailable.');
    }
  }

  private isAuthResponse(
    user: AuthResponse['user'] | User
  ): user is AuthResponse['user'] {
    return (user as AuthResponse['user']).token !== undefined;
  }
}
