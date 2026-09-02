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

  it('caches results and returns cached data on second call', async () => {
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

    await expect(service.getCategories()).resolves.toHaveLength(1);

    // second call should use cache and not call Supabase again
    await expect(service.getCategories()).resolves.toHaveLength(1);

    expect(from).toHaveBeenCalledTimes(1);
  });

  it('shares a single in-flight request for concurrent callers', async () => {
    let resolveOrder: (value: any) => void = () => {};
    const orderPromise = new Promise((res) => {
      resolveOrder = res;
    });

    const order = vi.fn().mockReturnValue(orderPromise as any);
    const eq = vi.fn();
    eq.mockReturnValue({ eq, order });
    const select = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });

    user.set({ id: 'user-1' });
    familyId = 'family-1';

    const p1 = service.getCategories();
    const p2 = service.getCategories();

    // resolve the Supabase response
    resolveOrder({
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

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(from).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('fetches again when family changes', async () => {
    const buildChain = (id: string) => {
      const order = vi.fn().mockResolvedValue({
        data: [
          {
            id,
            family_id: 'family-1',
            name: `Name ${id}`,
            is_active: true,
            sort_order: 1,
          },
        ],
        error: null,
      });
      const eq = vi.fn();
      eq.mockReturnValue({ eq, order });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    };

    // first family
    from.mockImplementationOnce(() => buildChain('category-a'));
    user.set({ id: 'user-1' });
    familyId = 'family-1';
    const first = await service.getCategories();

    // change family
    from.mockImplementationOnce(() => buildChain('category-b'));
    familyId = 'family-2';

    const second = await service.getCategories();

    expect(first).not.toEqual(second);
  });

  it('does not leak cached data after sign-out and new sign-in', async () => {
    // first fetch
    from.mockReset();
    const order1 = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'category-1',
          family_id: 'family-1',
          name: 'First',
          is_active: true,
          sort_order: 1,
        },
      ],
      error: null,
    });
    const eq1 = vi.fn();
    eq1.mockReturnValue({ eq: eq1, order: order1 });
    const select1 = vi.fn().mockReturnValue({ eq: eq1 });
    from.mockReturnValue({ select: select1 });

    user.set({ id: 'user-1' });
    familyId = 'family-1';

    await expect(service.getCategories()).resolves.toHaveLength(1);

    // sign out
    user.set(null);

    // sign in as different user - Supabase should be called again
    from.mockReset();
    const order2 = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'category-2',
          family_id: 'family-1',
          name: 'Second',
          is_active: true,
          sort_order: 1,
        },
      ],
      error: null,
    });
    const eq2 = vi.fn();
    eq2.mockReturnValue({ eq: eq2, order: order2 });
    const select2 = vi.fn().mockReturnValue({ eq: eq2 });
    from.mockReturnValue({ select: select2 });

    user.set({ id: 'user-2' });

    await expect(service.getCategories()).resolves.toHaveLength(1);

    expect(from).toHaveBeenCalled();
  });
});
