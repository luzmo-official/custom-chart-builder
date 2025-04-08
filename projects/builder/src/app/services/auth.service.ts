import { inject, Injectable } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import type { Observable } from 'rxjs';
import { BehaviorSubject, take } from 'rxjs';
import { map } from 'rxjs/operators';
import type { AuthResponse, RowsData, User } from '../helpers/types';
import { isBoolean, isEmpty } from '../helpers/types.utils';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs/internal/observable/of';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private user?: User;
  private httpClient = inject(HttpClient);
  private cookieService = inject(CookieService);

  // Cookie configuration
  private cookieDomain = 'localhost';
  private cookieExpiry = new Date();
  private cookiePath = '/';

  // Default URLs based on region
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

  private _region: 'US' | 'Europe' = 'Europe'; // Default region

  // Authentication state
  private authenticated = this.checkAuthentication();
  isAuthenticated$ = new BehaviorSubject<boolean>(this.authenticated);
  private isAuthenticating = false;

  // URLs with priority: 1. Cookies, 2. Defaults
  private _appUrl =
    this.getCookie('appUrl') || this.defaultUrls[this._region].appUrl;
  private _apiUrl =
    this.getCookie('apiUrl') || this.defaultUrls[this._region].apiUrl;

  /**
   * Checks if user is authenticated based on cookies
   */
  private checkAuthentication(): boolean {
    return (
      !isEmpty(this.getCookie('k')) &&
      !isEmpty(this.getCookie('t')) &&
      !isEmpty(this.getCookie('e')) &&
      new Date(Number.parseInt(this.getCookie('e'), 10)) >= new Date()
    );
  }

  /**
   * Gets the current authentication state
   */
  isAuthenticated(): boolean {
    return this.isAuthenticated$.getValue();
  }

  /**
   * Sets the authentication state of the user.
   */
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
        // Logout
        this.user = undefined;
        this.clearAuthCookies();
        this._appUrl = this.defaultUrls[this._region].appUrl;
        this._apiUrl = this.defaultUrls[this._region].apiUrl;
      } else if (user && this.isAuthResponse(user) && !isEmpty(user.token)) {
        // Login
        this.setCookie('k', user.token.id, new Date(user.token.cookieExpiry));
        this.setCookie(
          't',
          user.token.token,
          new Date(user.token.cookieExpiry)
        );
        this.setCookie(
          'e',
          user.token.tokenExpiry,
          new Date(user.token.cookieExpiry)
        );
        this.setCookie(
          'appUrl',
          this._appUrl,
          new Date(user.token.cookieExpiry)
        );
        this.setCookie(
          'apiUrl',
          this._apiUrl,
          new Date(user.token.cookieExpiry)
        );
      }

      this.authenticated = value;
      this.isAuthenticated$.next(value);
    } finally {
      this.isAuthenticating = false;
    }
  }

  /**
   * Set a cookie with standard options
   */
  private setCookie(name: string, value: string, expiry: Date): void {
    this.cookieService.set(
      name,
      value,
      expiry,
      this.cookiePath,
      this.cookieDomain,
      false,
      'Lax'
    );
  }

  private getCookie(name: string): string {
    return this.cookieService.get(name);
  }

  private clearAuthCookies(): void {
    const cookiesToClear = ['k', 't', 'e', 'appUrl', 'apiUrl'];
    for (const cookie of cookiesToClear) {
      this.cookieService.delete(cookie, this.cookiePath, this.cookieDomain);
    }
  }

  getLoginCookies(): Record<'key' | 'token', string> {
    return {
      key: this.getCookie('k'),
      token: this.getCookie('t')
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
          key: this.getCookie('k'),
          token: this.getCookie('t'),
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
        this.updateUrlCookie('appUrl', value);
      }
    }
  }

  setApiUrl(value: string): void {
    if (!isEmpty(value)) {
      this._apiUrl = value;
      if (this.authenticated) {
        this.updateUrlCookie('apiUrl', value);
      }
    }
  }

  /**
   * Set region and update URLs accordingly
   */
  setRegion(region: 'US' | 'Europe'): void {
    this._region = region;

    // Check if URLs are using default values
    const isUsingDefaultAppUrl = Object.values(this.defaultUrls).some(
      (urls) => urls.appUrl === this._appUrl
    );

    const isUsingDefaultApiUrl = Object.values(this.defaultUrls).some(
      (urls) => urls.apiUrl === this._apiUrl
    );

    // Update to new region defaults if using defaults
    if (isUsingDefaultAppUrl) {
      this._appUrl = this.defaultUrls[region].appUrl;
    }

    if (isUsingDefaultApiUrl) {
      this._apiUrl = this.defaultUrls[region].apiUrl;
    }

    // Update cookies if authenticated
    if (this.authenticated) {
      this.updateUrlCookies();
    }
  }

  /**
   * Reset URLs to region defaults
   */
  resetUrlsToDefaults(): void {
    this._appUrl = this.defaultUrls[this._region].appUrl;
    this._apiUrl = this.defaultUrls[this._region].apiUrl;

    if (this.authenticated) {
      this.updateUrlCookies();
    }
  }

  /**
   * Update URL cookies
   */
  private updateUrlCookies(): void {
    this.updateUrlCookie('appUrl', this._appUrl);
    this.updateUrlCookie('apiUrl', this._apiUrl);
  }

  /**
   * Update a single URL cookie
   */
  private updateUrlCookie(name: 'appUrl' | 'apiUrl', value: string): void {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    this.setCookie(name, value, expiry);
  }

  /**
   * Check if user object is an auth response
   */
  private isAuthResponse(
    user: AuthResponse['user'] | User
  ): user is AuthResponse['user'] {
    return (user as AuthResponse['user']).token !== undefined;
  }
}
