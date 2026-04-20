/**
 * ActionDataset — Loads, validates, and queries per-character action→input datasets.
 * Mirrors the HitboxLoader pattern (cache/pending, load/get/preloadAll).
 */

const VALID_BUTTONS = new Set([
    'A', 'B', 'X', 'Y', 'Z', 'L', 'R', 'START',
    'DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT'
]);

const CORE_ACTIONS = ['idle', 'walk', 'dash', 'jump', 'shorthop'];

/**
 * Validate a single Action_Entry (one action with all its variants).
 * Returns null if valid, or a string describing the first error found.
 */
function validateActionEntry(actionName, entry) {
    if (!entry || typeof entry !== 'object') return `${actionName}: entry is not an object`;
    if (!entry.variants || !Array.isArray(entry.variants) || entry.variants.length === 0) {
        return `${actionName}: missing or empty variants array`;
    }
    for (let vi = 0; vi < entry.variants.length; vi++) {
        const v = entry.variants[vi];
        const prefix = `${actionName}.variants[${vi}]`;
        if (!v.inputs || !Array.isArray(v.inputs) || v.inputs.length === 0) {
            return `${prefix}: missing or empty inputs array`;
        }
        // Monotonically increasing frames
        let prevFrame = -1;
        for (let ii = 0; ii < v.inputs.length; ii++) {
            const inp = v.inputs[ii];
            const ip = `${prefix}.inputs[${ii}]`;
            if (typeof inp.frame !== 'number' || inp.frame < 0) return `${ip}.frame: must be non-negative number`;
            if (inp.frame <= prevFrame) return `${ip}.frame: must be monotonically increasing (got ${inp.frame} after ${prevFrame})`;
            prevFrame = inp.frame;
            // Stick ranges
            if (inp.stick) {
                if (typeof inp.stick.x !== 'number' || inp.stick.x < -1 || inp.stick.x > 1) return `${ip}.stick.x: must be in [-1, 1]`;
                if (typeof inp.stick.y !== 'number' || inp.stick.y < -1 || inp.stick.y > 1) return `${ip}.stick.y: must be in [-1, 1]`;
            }
            // Trigger range
            if (inp.trigger !== undefined && (typeof inp.trigger !== 'number' || inp.trigger < 0 || inp.trigger > 1)) {
                return `${ip}.trigger: must be in [0, 1]`;
            }
            // Buttons
            if (inp.buttons) {
                for (const btn of inp.buttons) {
                    if (!VALID_BUTTONS.has(btn)) return `${ip}.buttons: invalid button "${btn}"`;
                }
            }
        }
        // totalFrames
        if (typeof v.totalFrames !== 'number' || v.totalFrames < 0) return `${prefix}.totalFrames: must be non-negative`;
        if (v.totalFrames < prevFrame) return `${prefix}.totalFrames (${v.totalFrames}) < last input frame (${prevFrame})`;
        // actionStateId
        if (v.actionStateId !== undefined && (typeof v.actionStateId !== 'number' || v.actionStateId < 0 || !Number.isInteger(v.actionStateId))) {
            return `${prefix}.actionStateId: must be non-negative integer`;
        }
    }
    return null;
}

/**
 * Validate an entire character dataset file.
 * Returns array of error strings (empty = valid).
 */
function validateCharacterData(data) {
    const errors = [];
    if (!data || !data.actions || typeof data.actions !== 'object') {
        return ['Missing or invalid "actions" object'];
    }
    // Check core actions
    for (const core of CORE_ACTIONS) {
        if (!data.actions[core]) errors.push(`Missing core action: "${core}"`);
    }
    // Validate each entry
    for (const [name, entry] of Object.entries(data.actions)) {
        const err = validateActionEntry(name, entry);
        if (err) errors.push(err);
    }
    return errors;
}

export default class ActionDataset {
    /**
     * @param {string} basePath - Directory containing character JSON files
     */
    constructor(basePath = 'action-dataset') {
        this.basePath = basePath;
        /** @type {Map<string, object|null>} character name → parsed data */
        this._cache = new Map();
        /** @type {Map<string, Promise<object|null>>} */
        this._pending = new Map();
    }

    /**
     * Load action dataset for a character.
     * @param {string} character - Character name (e.g., "fox", "marth")
     * @returns {Promise<object|null>}
     */
    async load(character) {
        const key = character.toLowerCase();
        if (this._cache.has(key)) return this._cache.get(key);
        if (this._pending.has(key)) return this._pending.get(key);

        const url = `${this.basePath}/${key}.json`;
        const promise = this._fetch(key, url);
        this._pending.set(key, promise);
        const result = await promise;
        this._pending.delete(key);
        return result;
    }

    /** Synchronous cache lookup. */
    get(character) {
        return this._cache.get(character.toLowerCase()) ?? null;
    }

    /** Preload multiple characters in parallel. */
    async preloadAll(characters) {
        await Promise.all([...new Set(characters)].map(c => this.load(c)));
    }

    /**
     * Get the input sequence for a specific action in a given context.
     * @param {string} character
     * @param {string} actionName
     * @param {{ grounded?: boolean, facing?: string, fromState?: string }} context
     * @returns {object|null} The best matching variant, or null
     */
    getAction(character, actionName, context = {}) {
        const data = this.get(character);
        if (!data?.actions?.[actionName]) return null;
        const entry = data.actions[actionName];
        if (!entry.variants?.length) return null;

        // Score each variant by context match
        let best = null;
        let bestScore = -1;
        for (const v of entry.variants) {
            let score = 0;
            const ctx = v.context || {};
            if (context.grounded !== undefined && ctx.grounded === context.grounded) score += 3;
            if (context.facing && ctx.facing === context.facing) score += 2;
            if (context.fromState && ctx.fromState === context.fromState) score += 1;
            if (score > bestScore) { bestScore = score; best = v; }
        }
        if (!best) best = entry.variants[0]; // fallback to first variant
        if (bestScore === 0 && entry.variants.length > 1) {
            console.warn(`[ActionDataset] No exact context match for ${character}/${actionName}, using closest variant`);
        }
        return best;
    }

    /**
     * List all available action names for a character.
     * @param {string} character
     * @returns {string[]}
     */
    listActions(character) {
        const data = this.get(character);
        return data?.actions ? Object.keys(data.actions) : [];
    }

    /**
     * Get frame timing data for an action.
     * @param {string} character
     * @param {string} actionName
     * @returns {object|null}
     */
    getFrameTiming(character, actionName) {
        const data = this.get(character);
        return data?.actions?.[actionName]?.timing ?? null;
    }

    /**
     * Generate LLM function-calling schema from loaded datasets.
     * Each action becomes a callable function with typed parameters.
     * @param {string[]} characters - Characters in the scenario
     * @returns {object[]} Array of function definitions for LLM API
     */
    generateFunctionSchema(characters) {
        const functions = [];
        const seenActions = new Set();

        for (const char of characters) {
            const data = this.get(char);
            if (!data?.actions) continue;

            for (const [actionName, entry] of Object.entries(data.actions)) {
                const key = `${char}_${actionName}`;
                if (seenActions.has(key)) continue;
                seenActions.add(key);

                const params = {
                    type: 'object',
                    properties: {
                        player: { type: 'integer', description: 'Player index (0 or 1)', enum: [0, 1] },
                        startFrame: { type: 'integer', description: 'Absolute frame number to begin this action', minimum: 0 },
                    },
                    required: ['player', 'startFrame'],
                };

                // Add optional params based on category
                if (entry.category === 'aerial') {
                    params.properties.lCancel = { type: 'boolean', description: 'Whether to L-cancel on landing', default: true };
                    params.properties.drift = { type: 'string', enum: ['none', 'forward', 'backward'], description: 'Aerial drift direction', default: 'none' };
                }
                if (entry.category === 'movement') {
                    params.properties.direction = { type: 'string', enum: ['left', 'right'], description: 'Movement direction' };
                }
                if (entry.variants?.some(v => v.context?.facing)) {
                    params.properties.facing = { type: 'string', enum: ['left', 'right'], description: 'Character facing direction' };
                }
                params.properties.target = { type: 'integer', description: 'Target player index for interactions (optional)', enum: [0, 1] };

                const timing = entry.timing || {};
                const desc = `${char}: ${entry.description || actionName}` +
                    (timing.startup != null ? ` (startup: ${timing.startup}f` : '') +
                    (timing.activeFrames ? `, active: ${timing.activeFrames[0]}-${timing.activeFrames[1]}f` : '') +
                    (timing.endlag != null ? `, endlag: ${timing.endlag}f)` : ')');

                functions.push({
                    name: `${char}_${actionName}`,
                    description: desc,
                    parameters: params,
                });
            }
        }
        return functions;
    }

    /**
     * Validate a loaded character dataset.
     * @param {string} character
     * @returns {string[]} Array of error strings (empty = valid)
     */
    validate(character) {
        const data = this.get(character);
        if (!data) return [`Character "${character}" not loaded`];
        return validateCharacterData(data);
    }

    /** @private */
    async _fetch(key, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) console.warn(`[ActionDataset] No dataset for "${key}"`);
                else console.warn(`[ActionDataset] HTTP ${response.status} loading ${url}`);
                this._cache.set(key, null);
                return null;
            }
            const data = await response.json();
            // Validate on load
            const errors = validateCharacterData(data);
            if (errors.length) {
                console.warn(`[ActionDataset] Validation errors for "${key}":`, errors);
            }
            this._cache.set(key, data);
            return data;
        } catch (err) {
            console.error(`[ActionDataset] Failed to load/parse ${url}:`, err);
            this._cache.set(key, null);
            return null;
        }
    }
}

// Export validation helpers for testing
export { validateActionEntry, validateCharacterData, VALID_BUTTONS, CORE_ACTIONS };
