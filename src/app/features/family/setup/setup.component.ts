import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { FamilyService } from '../../../core/family/family.service';

@Component({
  selector: 'app-family-setup',
  imports: [FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent {
  private readonly familyService = inject(FamilyService);
  private readonly router = inject(Router);

  protected readonly familyName = signal('');
  protected readonly memberName = signal('');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');

  async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.errorMessage.set('');

    const familyName = this.familyName().trim();
    const memberName = this.memberName().trim();

    if (!familyName || !memberName) {
      this.errorMessage.set(
        'Please enter your family name and your name.',
      );
      return;
    }

    this.loading.set(true);

    try {
      await this.familyService.createFamily(
        familyName,
        memberName,
      );

      await this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Failed to create family', error);

      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'Unable to create your family. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}