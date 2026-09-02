import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');

    const email = this.email().trim();
    const password = this.password();
    const confirmPassword = this.confirmPassword();

    if (!email || !password || !confirmPassword) {
      this.errorMessage.set('Please complete all fields.');
      return;
    }

    if (password.length < 6) {
      this.errorMessage.set(
        'Password must be at least 6 characters.',
      );
      return;
    }

    if (password !== confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);

    try {
      const { data, error } = await this.auth.signUp(
        email,
        password,
      );

      if (error) {
        this.errorMessage.set(error.message);
        return;
      }

      if (data.session) {
        await this.router.navigate(['/']);
        return;
      }

      this.successMessage.set(
        'Account created. Check your email to confirm your account.',
      );
    } catch {
      this.errorMessage.set(
        'Unable to create your account. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}