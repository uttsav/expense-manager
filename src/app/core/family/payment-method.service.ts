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

  private cachedFamilyId: string | null = null;
  private cachedUserId: string | null = null;
  private cachedPaymentMethods: PaymentMethod[] | null = null;
  private inFlightRequest: Promise<PaymentMethod[]> | null = null;

  private clearCache() {
    this.cachedFamilyId = null;
    this.cachedUserId = null;
    this.cachedPaymentMethods = null;
    this.inFlightRequest = null;
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const user = this.auth.user();

    // If not authenticated, ensure cache is cleared and return empty
    if (!user) {
      this.clearCache();
      return [];
    }

    const familyId = this.family.familyId;

    if (!familyId) {
      return [];
    }

    // If cached for same family and same user, return cache
    if (
      this.cachedFamilyId === familyId &&
      this.cachedUserId === user.id &&
      this.cachedPaymentMethods
    ) {
      return this.cachedPaymentMethods;
    }

    // If an in-flight request exists for the same family & user, reuse it
    if (
      this.cachedFamilyId === familyId &&
      this.cachedUserId === user.id &&
      this.inFlightRequest
    ) {
      return this.inFlightRequest;
    }

    // Family or user changed: clear previous cache and start new fetch
    this.clearCache();
    this.cachedFamilyId = familyId;
    this.cachedUserId = user.id;

    this.inFlightRequest = (async () => {
      try {
        const { data, error } = await this.supabase.client
          .from('payment_methods')
          .select('id, family_id, name, is_active, sort_order')
          .eq('family_id', familyId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) {
          throw error;
        }

        const mapped = ((data ?? []) as PaymentMethodRow[]).map((paymentMethod) => ({
          id: paymentMethod.id,
          familyId: paymentMethod.family_id,
          name: paymentMethod.name,
          isActive: paymentMethod.is_active,
          sortOrder: paymentMethod.sort_order,
        }));

        this.cachedPaymentMethods = mapped;

        return mapped;
      } finally {
        // allow subsequent requests to read cachedPaymentMethods
        this.inFlightRequest = null;
      }
    })();

    return this.inFlightRequest;
  }
}
