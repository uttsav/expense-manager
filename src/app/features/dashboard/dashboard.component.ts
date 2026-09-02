import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { FamilyService } from '../../core/family/family.service';

@Component({
  selector: 'app-dashboard',
  template: `
    <main class="dashboard">
      <h1>Family Expenses</h1>

      <p>
        Welcome{{ familyService.membership()?.name
          ? ', ' + familyService.membership()?.name
          : '' }}.
      </p>

      <p>
        Your family workspace is ready.
      </p>

      <button type="button" (click)="signOut()">
        Sign out
      </button>
    </main>
  `,
  styles: `
    .dashboard {
      min-height: 100vh;
      display: grid;
      place-content: center;
      gap: 12px;
      padding: 24px;
    }

    h1,
    p {
      margin: 0;
    }

    button {
      margin-top: 16px;
      height: 44px;
      padding: 0 20px;
      border: 0;
      border-radius: 8px;
      background: #171717;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
  `,
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly familyService = inject(FamilyService);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/auth/login']);
  }
}