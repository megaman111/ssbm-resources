/**
 * Property test for HitboxLoader caching idempotence.
 *
 * **Validates: Requirements 4.2**
 *
 * Property 4: Loader caching idempotence — for any character ID, calling
 * HitboxLoader.load() twice returns the same object reference on the second
 * call without issuing a second network request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import HitboxLoader from './hitbox-loader.js';

// Minimal valid character hitbox data stub
function makeFakeCharData(charId) {
  return {
    character: `char_${charId}`,
    internalId: charId,
    scale: 1.0,
    bones: [{ id: 0, parent: -1, restX: 0, restY: 0 }],
    subactions: {},
    hurtboxes: [],
    actionStateMap: {},
  };
}

describe('HitboxLoader caching idempotence (Property 4)', () => {
  /** @type {HitboxLoader} */
  let loader;
  let fetchCallCount;

  beforeEach(() => {
    loader = new HitboxLoader('hitbox-data');
    fetchCallCount = 0;

    // Mock global fetch — returns unique object per charId
    globalThis.fetch = vi.fn(async (url) => {
      fetchCallCount++;
      // Extract char name from URL to derive a deterministic charId
      const match = url.match(/\/([^/]+)\.json$/);
      const name = match ? match[1] : 'unknown';
      return {
        ok: true,
        status: 200,
        json: async () => makeFakeCharData(name),
      };
    });
  });

  it('load() twice returns the same reference and only fetches once (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 25 }),
        async (charId) => {
          // Reset per-iteration state
          loader = new HitboxLoader('hitbox-data');
          fetchCallCount = 0;
          globalThis.fetch = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => makeFakeCharData(charId),
          }));

          const first = await loader.load(charId);
          const second = await loader.load(charId);

          // Same object reference (cached)
          expect(second).toBe(first);
          // fetch called exactly once
          expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        },
      ),
      { numRuns: 26 }, // cover all 26 valid character IDs
    );
  });

  it('get() returns null before loading', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 25 }),
        (charId) => {
          const fresh = new HitboxLoader('hitbox-data');
          expect(fresh.get(charId)).toBeNull();
        },
      ),
      { numRuns: 26 },
    );
  });

  it('get() returns cached data after loading', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 25 }),
        async (charId) => {
          loader = new HitboxLoader('hitbox-data');
          globalThis.fetch = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => makeFakeCharData(charId),
          }));

          const loaded = await loader.load(charId);
          const cached = loader.get(charId);
          expect(cached).toBe(loaded);
        },
      ),
      { numRuns: 26 },
    );
  });

  it('load() with invalid charId returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 26, max: 1000 }),
        async (charId) => {
          loader = new HitboxLoader('hitbox-data');
          const result = await loader.load(charId);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('preloadAll() loads all specified characters', async () => {
    const ids = [0, 2, 5, 10, 25];
    loader = new HitboxLoader('hitbox-data');
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => makeFakeCharData(0),
    }));

    await loader.preloadAll(ids);

    for (const id of ids) {
      expect(loader.get(id)).not.toBeNull();
    }
    // fetch called once per unique ID
    expect(globalThis.fetch).toHaveBeenCalledTimes(ids.length);
  });
});

/**
 * Tests for cross-platform basePath configurability.
 *
 * **Validates: Requirements 12.1, 12.3**
 *
 * Verifies that HitboxLoader constructs fetch URLs from the configurable
 * basePath, supporting both relative URLs (web) and file:// paths (Electron).
 */
describe('HitboxLoader cross-platform basePath (Requirements 12.1, 12.3)', () => {
  it('uses default basePath "hitbox-data" when none provided', async () => {
    const loader = new HitboxLoader();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => makeFakeCharData(2),
    }));

    await loader.load(2); // fox = index 2

    expect(globalThis.fetch).toHaveBeenCalledWith('hitbox-data/fox.json');
  });

  it('uses custom relative basePath in fetch URL', async () => {
    const loader = new HitboxLoader('assets/hitbox-data');
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => makeFakeCharData(0),
    }));

    await loader.load(0); // captain_falcon = index 0

    expect(globalThis.fetch).toHaveBeenCalledWith('assets/hitbox-data/captain_falcon.json');
  });

  it('uses file:// basePath for Electron filesystem reads', async () => {
    const loader = new HitboxLoader('file:///app/resources/hitbox-data');
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => makeFakeCharData(9),
    }));

    await loader.load(9); // marth = index 9

    expect(globalThis.fetch).toHaveBeenCalledWith('file:///app/resources/hitbox-data/marth.json');
  });

  it('uses absolute HTTP URL basePath', async () => {
    const loader = new HitboxLoader('https://cdn.example.com/hitbox-data');
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => makeFakeCharData(5),
    }));

    await loader.load(5); // bowser = index 5

    expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.example.com/hitbox-data/bowser.json');
  });
});
