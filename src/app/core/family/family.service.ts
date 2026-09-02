import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface FamilyMembership {
  id: string;
  family_id: string;
  user_id: string;
  name: string;
  role: 'owner' | 'member';
}

@Injectable({
  providedIn: 'root',
})
export class FamilyService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  readonly membership = signal<FamilyMembership | null>(null);
  readonly loading = signal(false);

  async loadMembership(): Promise<FamilyMembership | null> {
    await this.auth.waitUntilReady();

    const user = this.auth.user();

    if (!user) {
      this.membership.set(null);
      return null;
    }

    this.loading.set(true);

    try {
      const { data, error } = await this.supabase.client
        .from('family_members')
        .select('id, family_id, user_id, name, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      this.membership.set(data);

      return data;
    } finally {
      this.loading.set(false);
    }
  }

  async createFamily(
    familyName: string,
    memberName: string,
  ): Promise<void> {
    const { error } = await this.supabase.client.rpc(
      'create_family',
      {
        family_name: familyName,
        member_name: memberName,
      },
    );

    if (error) {
      throw error;
    }

    await this.loadMembership();
  }

  get familyId(): string | null {
    return this.membership()?.family_id ?? null;
  }

  get isOwner(): boolean {
    return this.membership()?.role === 'owner';
  }
}