import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FamilyService } from './family.service';
import { PaymentMethodService } from './payment-method.service';

describe('PaymentMethodService', () => {
  const user = signal<unknown>(null);
  const from = vi.fn();

  let familyId: string | null = null;
  let service: PaymentMethodService;

  beforeEach(() => {
    user.set(null);
    familyId = null;
    from.mockReset();

    TestBed.configureTestingModule({
      providers: [
        PaymentMethodService,
        {
          provide: AuthService,
          useValue: { user },
        },
        {
          provide: FamilyService,
          useValue: {
            get familyId() {
              return familyId;
            },
          },
        },
        {
          provide: SupabaseService,
          useValue: { client: { from } },
        },
      ],
    });

    service = TestBed.inject(PaymentMethodService);
  });

  it('returns no payment methods without a family', async () => {
    user.set({ id: 'user-1' });

    await expect(service.getPaymentMethods()).resolves.toEqual([]);

    expect(from).not.toHaveBeenCalled();
  });

  it('loads active payment methods for the current family in sort order', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'payment-method-1',
          family_id: 'family-1',
          name: 'UPI',
          is_active: true,
          sort_order: 1,
        },
      ],
      error: null,
    });
    const eq = vi.fn();
    eq.mockReturnValue({ eq, order });
    const select = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });
    user.set({ id: 'user-1' });
    familyId = 'family-1';

    await expect(service.getPaymentMethods()).resolves.toEqual([
      {
        id: 'payment-method-1',
        familyId: 'family-1',
        name: 'UPI',
        isActive: true,
        sortOrder: 1,
      },
    ]);

    expect(from).toHaveBeenCalledWith('payment_methods');
    expect(eq).toHaveBeenNthCalledWith(1, 'family_id', 'family-1');
    expect(eq).toHaveBeenNthCalledWith(2, 'is_active', true);
    expect(order).toHaveBeenCalledWith('sort_order', { ascending: true });
  });
});
