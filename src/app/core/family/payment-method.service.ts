import { Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FamilyService } from './family.service';

interface PaymentMethodRow {
  id: string;
  family_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface PaymentMethod {
  id: string;
  familyId: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentMethodService {
  private readonly auth = inject(AuthService);
  private readonly family = inject(FamilyService);
  private readonly supabase = inject(SupabaseService);

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    if (!this.auth.user()) {
      return [];
    }

    const familyId = this.family.familyId;

    if (!familyId) {
      return [];
    }

    const { data, error } = await this.supabase.client
      .from('payment_methods')
      .select('id, family_id, name, is_active, sort_order')
      .eq('family_id', familyId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    return ((data ?? []) as PaymentMethodRow[]).map((paymentMethod) => ({
      id: paymentMethod.id,
      familyId: paymentMethod.family_id,
      name: paymentMethod.name,
      isActive: paymentMethod.is_active,
      sortOrder: paymentMethod.sort_order,
    }));
  }
}
