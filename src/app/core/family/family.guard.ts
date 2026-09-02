import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { FamilyService } from './family.service';

export const familyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const family = inject(FamilyService);
  const router = inject(Router);

  await auth.waitUntilReady();

  if (!auth.user()) {
    return router.createUrlTree(['/auth/login']);
  }

  const membership = await family.loadMembership();

  if (membership) {
    return true;
  }

  return router.createUrlTree(['/family/setup']);
};