/**
 * HitboxLoader - Loads and caches per-character hitbox JSON data.
 * Maps Slippi character IDs (0-25) to hitbox-data/{charName}.json files.
 *
 * Cross-platform compatibility:
 * - Web (GitHub Pages): basePath is a relative URL (e.g. 'hitbox-data'), fetched via HTTP.
 * - Electron: basePath can be a file:// URL (e.g. 'file:///path/to/hitbox-data') since
 *   Electron supports the standard fetch() API for both HTTP and file:// protocols.
 * - The load/get/preloadAll interface is platform-agnostic — no platform-specific code needed.
 */

const CHARACTER_NAMES = [
    'captain_falcon', 'donkey_kong', 'fox', 'game_and_watch',
    'kirby', 'bowser', 'link', 'luigi', 'mario', 'marth',
    'mewtwo', 'ness', 'peach', 'pikachu', 'ice_climbers',
    'jigglypuff', 'samus', 'yoshi', 'zelda', 'sheik',
    'falco', 'young_link', 'dr_mario', 'roy', 'pichu', 'ganondorf'
];

export default class HitboxLoader {
    /**
     * @param {string} basePath - Directory containing character JSON files
     */
    constructor(basePath = 'hitbox-data') {
        this.basePath = basePath;
        /** @type {Map<number, object|null>} */
        this._cache = new Map();
        /** @type {Map<number, Promise<object|null>>} */
        this._pending = new Map();
    }

    /**
     * Fetch and cache hitbox data for a character.
     * Returns cached data on subsequent calls without a second fetch.
     * @param {number} charId - Character ID (0-25)
     * @returns {Promise<object|null>} Parsed character hitbox data, or null on failure
     */
    async load(charId) {
        if (this._cache.has(charId)) {
            return this._cache.get(charId);
        }

        if (this._pending.has(charId)) {
            return this._pending.get(charId);
        }

        const charName = CHARACTER_NAMES[charId];
        if (charName === undefined) {
            console.warn(`[HitboxLoader] Unknown character ID: ${charId}`);
            this._cache.set(charId, null);
            return null;
        }

        const url = `${this.basePath}/${charName}.json`;
        const promise = this._fetch(charId, url);
        this._pending.set(charId, promise);

        const result = await promise;
        this._pending.delete(charId);
        return result;
    }

    /**
     * Synchronous cache lookup. Returns null if not yet loaded.
     * @param {number} charId - Character ID (0-25)
     * @returns {object|null}
     */
    get(charId) {
        return this._cache.get(charId) ?? null;
    }

    /**
     * Preload hitbox data for multiple characters in parallel.
     * @param {number[]} charIds - Array of character IDs to preload
     * @returns {Promise<void>}
     */
    async preloadAll(charIds) {
        const unique = [...new Set(charIds)];
        await Promise.all(unique.map(id => this.load(id)));
    }

    /**
     * Internal fetch + parse with error handling.
     * @param {number} charId
     * @param {string} url
     * @returns {Promise<object|null>}
     */
    async _fetch(charId, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`[HitboxLoader] No hitbox data for character ${charId} (${CHARACTER_NAMES[charId]})`);
                } else {
                    console.warn(`[HitboxLoader] HTTP ${response.status} loading ${url}`);
                }
                this._cache.set(charId, null);
                return null;
            }
            const data = await response.json();
            this._cache.set(charId, data);
            return data;
        } catch (err) {
            console.error(`[HitboxLoader] Failed to load/parse ${url}:`, err);
            this._cache.set(charId, null);
            return null;
        }
    }
}
