export function generateUUID(): string {
  // runtime-safe access to global crypto
  const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;

  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // fall through to getRandomValues fallback
    }
  }

  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalCrypto.getRandomValues(bytes);

    // Per RFC4122 v4: set bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return (
      hex.substr(0, 8) + '-' +
      hex.substr(8, 4) + '-' +
      hex.substr(12, 4) + '-' +
      hex.substr(16, 4) + '-' +
      hex.substr(20, 12)
    );
  }

  // Last-resort fallback (unpredictable but kept for SSR safety).
  let timestamp = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (timestamp + Math.random() * 16) % 16 | 0;
    timestamp = Math.floor(timestamp / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
