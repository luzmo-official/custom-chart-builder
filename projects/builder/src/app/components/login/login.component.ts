import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { isEmpty, isObject, isString } from '@builder/helpers/types.utils';
import { AuthService } from '@builder/services/auth.service';
import { EMPTY } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { AuthResponse, User } from '../../helpers/types';
import { CommonModule } from '@angular/common';

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

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule]
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private httpClient = inject(HttpClient);
  private formBuilder = inject(FormBuilder);

  logInForm!: FormGroup<LogInForm>;
  twoFAForm!: FormGroup<TwoFAForm>;

  ngOnInit(): void {
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

  attemptLogin(email: string, password: string): void {
    this.logInForm.controls.busy.setValue(true);
    this.httpClient
      .post<AuthResponse>(
        'https://app.luzmo.com/auth/vi',
        { email, password },
        { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
      )
      .pipe(
        take(1),
        switchMap(response => {
          if (isEmpty(response)) {
            return EMPTY;
          }
          else {
            this.authService.setAuthenticated(true, response.user);
            return this.authService.loadUser(response.user.id);
          }
        })
      )
      .subscribe({
        next: (user) => {
          this.logInForm.controls.busy.setValue(false);

          if (user && !isString(user)) {
            this.loginUser(user);
          }
        },
        error: (error: HttpErrorResponse) => {
          console.error('error', error);
          this.logInForm.controls.busy.setValue(false);
          this.logInForm.controls.errorMsg.setValue(this.getErrorMessage(error, 'login'));
          this.authService.setAuthenticated(false);
        }
      });
  }

  private loginUser(user: User): void {
    if (isEmpty(user)) {
      this.logInForm.controls.errorMsg.setValue(this.getErrorMessage(null, 'login'));
      this.authService.setAuthenticated(false);
    }
    else {
      this.logInForm.controls.errorMsg.setValue('');
      this.authService.setAuthenticated(true, user);
    }
  }

  private getErrorMessage(error: null | string | HttpErrorResponse, action: string): string {
    if (isString(error)) {
      return error;
    }

    if (error && isObject(error) && !isEmpty(error) && isString(error.error)) {
      return error.error;
    }

    return 'Oops, unable to ' + action + '!';
  }
}
