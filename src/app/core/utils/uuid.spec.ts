import { generateUUID } from './uuid';

describe('generateUUID', () => {
  it('uses crypto.randomUUID when available', () => {
    const origDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'uuid-from-randomUUID' },
    });

    try {
      expect(generateUUID()).toBe('uuid-from-randomUUID');
    } finally {
      if (origDesc) Object.defineProperty(globalThis, 'crypto', origDesc);
    }
  });

  it('falls back to getRandomValues when randomUUID missing', () => {
    const origDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = i + 1;
          return arr;
        },
      },
    });

    try {
      const id = generateUUID();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      // basic v4 pattern check
      expect(id[14]).toBe('4');
    } finally {
      if (origDesc) Object.defineProperty(globalThis, 'crypto', origDesc);
    }
  });
});
