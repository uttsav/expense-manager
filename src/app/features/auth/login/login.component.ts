import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');

  async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.errorMessage.set('');

    const email = this.email().trim();
    const password = this.password();

    if (!email || !password) {
      this.errorMessage.set('Please enter your email and password.');
      return;
    }

    this.loading.set(true);

    try {
      const { error } = await this.auth.signIn(email, password);

      if (error) {
        this.errorMessage.set(error.message);
        return;
      }

      await this.router.navigate(['/']);
    } catch {
      this.errorMessage.set(
        'Unable to sign in. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}