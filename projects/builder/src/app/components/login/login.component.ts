import type { HttpErrorResponse } from '@angular/common/http';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import type { OnInit } from '@angular/core';
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import type { FormControl, FormGroup } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { isEmpty, isObject, isString } from '../../helpers/types.utils';
import { AuthService } from '@builder/services/auth.service';
import { EMPTY, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import type { AuthResponse, User } from '../../helpers/types';
import { CommonModule } from '@angular/common';
import '@luzmo/lucero/picker';

interface LogInForm {
  email: FormControl<string>;
  password: FormControl<string>;
  busy: FormControl<boolean>;
  errorMsg: FormControl<string>;
}

interface TwoFAForm {
  totp: FormControl<string>;
  busy: FormControl<boolean>;
  errorMsg: FormControl<string>;
}

type RegionType = 'europe' | 'us' | 'custom';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private httpClient = inject(HttpClient);
  private formBuilder = inject(FormBuilder);

  region: RegionType = 'europe';
  vpcAppUrl = '';
  vpcApiUrl = '';
  mode: 'login' | '2FA' = 'login';
  logInForm!: FormGroup<LogInForm>;
  twoFAForm!: FormGroup<TwoFAForm>;

  ngOnInit(): void {
    this.initForms();
    this.setRegionUrls('europe');
  }

  /**
   * Initialize the login and 2FA forms
   */
  private initForms(): void {
    this.logInForm = this.formBuilder.nonNullable.group({
      email: ['', [Validators.email, Validators.required]],
      password: ['', [Validators.required]],
      busy: [false],
      errorMsg: ['']
    });

    this.twoFAForm = this.formBuilder.nonNullable.group({
      totp: ['', [Validators.required]],
      busy: [false],
      errorMsg: ['']
    });
  }

  /**
   * Attempt to log in with email and password
   */
  attemptLogin(email: string, password: string): void {
    this.logInForm.controls.busy.setValue(true);
    this.logInForm.controls.errorMsg.setValue('');

    this.authenticateUser(email, password).subscribe({
      next: (user) => {
        this.logInForm.controls.busy.setValue(false);
        if (user && !isString(user)) {
          this.loginUser(user);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.handleLoginError(error);
      }
    });
  }

  /**
   * Authenticate with the server
   */
  private authenticateUser(email: string, password: string, token?: string) {
    const appUrl = this.authService.getAppUrl();
    const requestBody = token
      ? { email, password, token, useRecoveryCode: false }
      : { email, password };

    return this.httpClient
      .post<AuthResponse>(`${appUrl}/auth/vi`, requestBody, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' })
      })
      .pipe(
        take(1),
        switchMap((response: AuthResponse) => {
          if (isEmpty(response)) {
            return EMPTY;
          }

          if (!token && response.user.twoFactorAuthentication) {
            this.mode = '2FA';
            return of('2FA');
          }

          // Ensure we clear previous state before setting new one
          this.authService.setAuthenticated(false);
          this.authService.setAuthenticated(true, response.user);
          return this.authService.loadUser(response.user.id);
        })
      );
  }

  /**
   * Submit 2FA verification
   */
  submit2FA(email: string, password: string, token: string): void {
    this.twoFAForm.controls.busy.setValue(true);
    this.twoFAForm.controls.errorMsg.setValue('');

    this.authenticateUser(email, password, token).subscribe({
      next: (user) => {
        this.twoFAForm.controls.busy.setValue(false);
        if (user && !isString(user)) {
          this.loginUser(user);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.handle2FAError(error);
      }
    });
  }

  /**
   * Handle 2FA form errors
   */
  private handle2FAError(error: HttpErrorResponse): void {
    this.twoFAForm.controls.totp.setValue('');
    this.twoFAForm.controls.busy.setValue(false);
    this.logInForm.controls.errorMsg.setValue(
      this.getErrorMessage(error.error, 'login')
    );
    this.mode = 'login';
  }

  /**
   * Handle login form errors
   */
  private handleLoginError(error: HttpErrorResponse): void {
    this.logInForm.controls.busy.setValue(false);
    this.logInForm.controls.errorMsg.setValue(
      this.getErrorMessage(error, 'login')
    );
    this.authService.setAuthenticated(false);
  }

  /**
   * Cancel 2FA verification
   */
  cancel2FA(): void {
    this.mode = 'login';
    this.logInForm.controls.password.setValue('');
    this.logInForm.controls.busy.setValue(false);
  }

  /**
   * Handle region change
   */
  onRegionChanged(event: CustomEvent<RegionType>): void {
    this.setRegionUrls(event.detail);
  }

  /**
   * Set URLs based on the selected region
   */
  private setRegionUrls(region: RegionType): void {
    this.region = region;

    if (region === 'us') {
      this.authService.setRegion('US');
      this.vpcAppUrl = '';
      this.vpcApiUrl = '';
    } else if (region === 'europe') {
      this.authService.setRegion('Europe');
      this.vpcAppUrl = '';
      this.vpcApiUrl = '';
    }
    // 'custom' region URLs are set via the input fields
  }

  private removeTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  onVpcAppUrlChanged(event: Event): void {
    const url = (event.target as HTMLInputElement).value?.trim();
    if (url) {
      const cleanUrl = this.removeTrailingSlash(url);
      this.vpcAppUrl = cleanUrl;
      this.authService.setAppUrl(cleanUrl);
    }
  }

  onVpcApiUrlChanged(event: Event): void {
    const url = (event.target as HTMLInputElement).value?.trim();
    if (url) {
      const cleanUrl = this.removeTrailingSlash(url);
      this.vpcApiUrl = cleanUrl;
      this.authService.setApiUrl(cleanUrl);
    }
  }

  private loginUser(user: User): void {
    if (isEmpty(user)) {
      this.logInForm.controls.errorMsg.setValue(
        this.getErrorMessage(null, 'login')
      );
      this.authService.setAuthenticated(false);
    } else {
      this.logInForm.controls.errorMsg.setValue('');
      this.authService.setAuthenticated(true, user);
    }
  }

  private getErrorMessage(
    error: null | string | HttpErrorResponse,
    action: string
  ): string {
    if (isString(error)) {
      return error;
    }

    if (error && isObject(error) && !isEmpty(error) && isString(error.error)) {
      return error.error;
    }

    return `Oops, unable to ${action}!`;
  }
}
