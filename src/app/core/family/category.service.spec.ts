import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CategoryService } from './category.service';
import { FamilyService } from './family.service';

describe('CategoryService', () => {
  const user = signal<unknown>(null);
  const from = vi.fn();

  let familyId: string | null = null;
  let service: CategoryService;

  beforeEach(() => {
    user.set(null);
    familyId = null;
    from.mockReset();

    TestBed.configureTestingModule({
      providers: [
        CategoryService,
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

    service = TestBed.inject(CategoryService);
  });

  it('returns no categories without an authenticated user', async () => {
    await expect(service.getCategories()).resolves.toEqual([]);

    expect(from).not.toHaveBeenCalled();
  });

  it('loads active categories for the current family in sort order', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'category-1',
          family_id: 'family-1',
          name: 'Baby Shopping',
          is_active: true,
          sort_order: 2,
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

    await expect(service.getCategories()).resolves.toEqual([
      {
        id: 'category-1',
        familyId: 'family-1',
        name: 'Baby Shopping',
        isActive: true,
        sortOrder: 2,
      },
    ]);

    expect(from).toHaveBeenCalledWith('categories');
    expect(eq).toHaveBeenNthCalledWith(1, 'family_id', 'family-1');
    expect(eq).toHaveBeenNthCalledWith(2, 'is_active', true);
    expect(order).toHaveBeenCalledWith('sort_order', { ascending: true });
  });
});
