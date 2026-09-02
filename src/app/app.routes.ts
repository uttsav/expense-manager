import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { familyGuard } from './core/family/family.guard';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component')
        .then((m) => m.LoginComponent),
  },

  {
    path: 'auth/signup',
    loadComponent: () =>
      import('./features/auth/signup/signup.component')
        .then((m) => m.SignupComponent),
  },

  {
    path: 'family/setup',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/family/setup/setup.component')
        .then((m) => m.SetupComponent),
  },

  {
    path: 'dashboard',
    canActivate: [familyGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component')
        .then((m) => m.DashboardComponent),
  },

  {
    path: 'expenses/add',
    canActivate: [familyGuard],
    loadComponent: () =>
      import('./features/expenses/add-expense/add-expense.component')
        .then((m) => m.AddExpenseComponent),
  },

  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },

  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
