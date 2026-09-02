import { Injectable, signal } from '@angular/core';
import type {
  AuthChangeEvent,
  Session,
  User,
} from '@supabase/supabase-js';

import { SupabaseService } from '../supabase/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly session = signal<Session | null>(null);
  readonly loading = signal(true);

  private readonly initialization: Promise<void>;

  constructor(
    private readonly supabaseService: SupabaseService,
  ) {
    this.initialization = this.initialize();
  }

  private get supabase() {
    return this.supabaseService.client;
  }

  async waitUntilReady(): Promise<void> {
    await this.initialization;
  }

  private async initialize(): Promise<void> {
    const {
      data: { session },
      error,
    } = await this.supabase.auth.getSession();

    if (error) {
      console.error('Failed to restore Supabase session', error);
    }

    this.session.set(session);
    this.user.set(session?.user ?? null);
    this.loading.set(false);

    this.supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        this.session.set(nextSession);
        this.user.set(nextSession?.user ?? null);
      },
    );
  }

  async signUp(email: string, password: string) {
    return this.supabase.auth.signUp({
      email,
      password,
    });
  }

  async signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({
      email,
      password,
    });
  }

  async signOut() {
    return this.supabase.auth.signOut();
  }
}