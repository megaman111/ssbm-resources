/**
 * FightCore - Reusable Melee frame data module
 * Data sources:
 *   - FightCore: https://github.com/FightCore/frame-data
 *   - Hitbox geometry: https://melee.theshoemaker.de (pfirsich's meleeFrameDataExtractor)
 */

// ===== Character name mappings =====
const FC_CHAR_NAMES = {
    0: "captainfalcon", 1: "donkeykong", 2: "fox", 3: "mrgame%26watch",
    4: "kirby", 5: "bowser", 6: "link", 7: "luigi", 8: "mario",
    9: "marth", 10: "mewtwo", 11: "ness", 12: "peach", 13: "pikachu",
    14: "iceclimbers", 15: "jigglypuff", 16: "samus", 17: "yoshi",
    18: "zelda", 19: "sheik", 20: "falco", 21: "younglink",
    22: "drmario", 23: "roy", 24: "pichu", 25: "ganondorf",
};

// theshoemaker.de uses display names with spaces/special chars
const EXTRACTOR_CHAR_NAMES = {
    0: "Captain%20Falcon", 1: "Donkey%20Kong", 2: "Fox",
    3: "Game%20%26%20Watch", 4: "Kirby", 5: "Bowser", 6: "Link",
    7: "Luigi", 8: "Mario", 9: "Marth", 10: "Mewtwo", 11: "Ness",
    12: "Peach", 13: "Pikachu", 14: "Ice%20Climbers", 15: "Jigglypuff",
    16: "Samus", 17: "Yoshi", 18: "Zelda", 19: "Sheik", 20: "Falco",
    21: "Young%20Link", 22: "Dr.%20Mario", 23: "Roy", 24: "Pichu",
    25: "Ganondorf",
};

const CHAR_WEIGHTS = {
    0: 104, 1: 114, 2: 75, 3: 60, 4: 70, 5: 117, 6: 104, 7: 100,
    8: 100, 9: 87, 10: 85, 11: 94, 12: 90, 13: 80, 14: 88, 15: 60,
    16: 110, 17: 108, 18: 90, 19: 90, 20: 80, 21: 85, 22: 100,
    23: 85, 24: 55, 25: 109,
};

// ===== Action state -> FightCore normalized name mapping =====
const ACTION_TO_FC_MOVE = {
    "Attack11": "jab1", "Attack12": "jab2", "Attack13": "jab3",
    "Attack100Start": "rjab", "Attack100Loop": "rjab",
    "Attack100End": "rjab", "AttackDash": "dattack",
    "AttackS3Hi": "ftilt", "AttackS3HiS": "ftilt", "AttackS3S": "ftilt",
    "AttackS3LwS": "ftilt", "AttackS3Lw": "ftilt",
    "AttackHi3": "utilt", "AttackLw3": "dtilt",
    "AttackS4Hi": "fsmash", "AttackS4HiS": "fsmash", "AttackS4S": "fsmash",
    "AttackS4LwS": "fsmash", "AttackS4Lw": "fsmash",
    "AttackHi4": "usmash", "AttackLw4": "dsmash",
    "AttackAirN": "nair", "AttackAirF": "fair", "AttackAirB": "bair",
    "AttackAirHi": "uair", "AttackAirLw": "dair",
    "Catch": "grab", "CatchDash": "dashgrab",
    "ThrowF": "fthrow", "ThrowB": "bthrow",
    "ThrowHi": "uthrow", "ThrowLw": "dthrow",
    "CliffAttackSlow": "ledgeattackslow", "CliffAttackQuick": "ledgeattackfast",
    "DownAttackU": "getupattackback", "DownAttackD": "getupattackstomach",
};

const SPECIAL_TO_FC_MOVE = {
    "SpecialN": "neutralb", "SpecialNStart": "neutralb",
    "SpecialNLoop": "neutralb", "SpecialNEnd": "neutralb",
    "SpecialNCansel": "neutralb", "SpecialNCancel": "neutralb",
    "SpecialAirN": "neutralb", "SpecialAirNStart": "neutralb",
    "SpecialAirNLoop": "neutralb", "SpecialAirNEnd": "neutralb",
    "SpecialS": "sideb", "SpecialSStart": "sideb",
    "SpecialS1": "sideb", "SpecialS2": "sideb", "SpecialSEnd": "sideb",
    "SpecialAirS": "sideb", "SpecialAirSStart": "sideb",
    "SpecialAirS1": "sideb", "SpecialAirS2": "sideb",
    "SpecialAirSEnd": "sideb",
    "SpecialHi": "upb", "SpecialHiStart": "upb", "SpecialHiHold": "upb",
    "SpecialAirHi": "upb", "SpecialAirHiStart": "upb",
    "SpecialLw": "downb", "SpecialLwStart": "downb",
    "SpecialLwLoop": "downb", "SpecialLwHit": "downb",
    "SpecialLwEnd": "downb", "SpecialAirLw": "downb",
    "SpecialAirLwStart": "downb", "SpecialAirLwLoop": "downb",
    "SpecialAirLwHit": "downb", "SpecialAirLwEnd": "downb",
};

const DANCING_BLADE_MAP = {
    "SpecialS1": "sideb1", "SpecialAirS1": "sideb1",
    "SpecialS2Hi": "sideb2up", "SpecialAirS2Hi": "sideb2up",
    "SpecialS2Lw": "sideb2down", "SpecialAirS2Lw": "sideb2down",
    "SpecialS3Hi": "sideb3up", "SpecialAirS3Hi": "sideb3up",
    "SpecialS3S": "sideb3side", "SpecialAirS3S": "sideb3side",
    "SpecialS3Lw": "sideb3down", "SpecialAirS3Lw": "sideb3down",
    "SpecialS4Hi": "sideb4up", "SpecialAirS4Hi": "sideb4up",
    "SpecialS4S": "sideb4side", "SpecialAirS4S": "sideb4side",
    "SpecialS4Lw": "sideb4down", "SpecialAirS4Lw": "sideb4down",
};
// ===== Action state -> Extractor key mapping =====
// The extractor uses keys like "ftilt_h", "ftilt_m", "fsmash_m" etc.
// We map action states to the specific variant key in the extractor JSON.
const ACTION_TO_EXTRACTOR_KEY = {
    "Attack11": "jab1", "Attack12": "jab2", "Attack13": "jab3",
    "Attack100Start": "rapidjabs_start", "Attack100Loop": "rapidjabs_loop",
    "Attack100End": "rapidjabs_end", "AttackDash": "dashattack",
    "AttackS3Hi": "ftilt_h", "AttackS3HiS": "ftilt_mh", "AttackS3S": "ftilt_m",
    "AttackS3LwS": "ftilt_ml", "AttackS3Lw": "ftilt_l",
    "AttackHi3": "utilt", "AttackLw3": "dtilt",
    "AttackS4Hi": "fsmash_h", "AttackS4HiS": "fsmash_mh", "AttackS4S": "fsmash_m",
    "AttackS4LwS": "fsmash_ml", "AttackS4Lw": "fsmash_l",
    "AttackHi4": "usmash", "AttackLw4": "dsmash",
    "AttackAirN": "nair", "AttackAirF": "fair", "AttackAirB": "bair",
    "AttackAirHi": "uair", "AttackAirLw": "dair",
    "Catch": "grab", "CatchDash": "dashgrab", "CatchAttack": "pummel",
    "ThrowF": "fthrow", "ThrowB": "bthrow",
    "ThrowHi": "uthrow", "ThrowLw": "dthrow",
};

// ===== Approximate bone positions (game units, relative to character origin at feet) =====
// Melee skeleton bone IDs -> approximate (x, y) in character-local space
// x is forward (positive = facing direction), y is up
// These are rough averages across the cast for a neutral standing pose
const BONE_POSITIONS = {
    0:  {x: 0, y: 0},       // TransN / root (origin)
    1:  {x: 0, y: 0},       // HipN
    2:  {x: 0, y: 2},       // FitN (waist)
    3:  {x: 0, y: 5},       // XRotN (torso center)
    4:  {x: 0, y: 7},       // YRotN (upper torso)
    5:  {x: 0, y: 9},       // TransN2 (neck area)
    6:  {x: 1, y: 5},       // LShoulderN (left shoulder)
    7:  {x: 2, y: 5},       // LShoulderN2 (left upper arm)
    8:  {x: 0, y: 10},      // HeadN (head)
    9:  {x: -1, y: 5},      // RShoulderN (right shoulder)
    10: {x: -2, y: 5},      // RShoulderN2 (right upper arm)
    11: {x: 3, y: 4.5},     // LHandN (left hand area)
    12: {x: 4, y: 4.5},     // LElbowN (left elbow/forearm)
    13: {x: 5.5, y: 4.5},   // LWristN (left wrist/hand tip)
    14: {x: -3, y: 4.5},    // RHandN
    15: {x: -4, y: 4.5},    // RElbowN
    16: {x: 1, y: 0},       // LLegN (left hip)
    17: {x: 1.5, y: -1},    // LKneeN (left knee)
    18: {x: 2, y: -3},      // LFootN (left foot)
    19: {x: -1, y: 0},      // RLegN (right hip)
    20: {x: -1.5, y: -1},   // RKneeN (right knee)
    21: {x: -2, y: -3},     // RFootN (right foot)
    22: {x: 0, y: 11},      // TopN (top of head)
    23: {x: 0, y: 3},       // WaistN
    24: {x: 3, y: 5},       // LClav (left clavicle)
    25: {x: 6, y: 4},       // LFingerN (left fingertip)
    26: {x: -3, y: 5},      // RClav
    27: {x: -6, y: 4},      // RFingerN
    // Tail/extra bones (Mewtwo, Pikachu, etc.)
    50: {x: -2, y: 3},      // TailN
    51: {x: -3, y: 2},      // Tail2
    52: {x: -4, y: 1.5},    // Tail3
    53: {x: -5, y: 1},      // Tail4
    54: {x: 1, y: 0},       // LToeN
    55: {x: -1, y: 0},      // RToeN
    56: {x: 4, y: 5},       // LThumbN
    57: {x: 0, y: 7},       // ThrowN (throw release point)
    // Sword/weapon bones (Marth, Link, etc.)
    100: {x: 7, y: 5},      // Sword tip area
    101: {x: 8, y: 5},      // Extended weapon
};

// Default bone position for unknown bone IDs
function getBonePos(boneId) {
    return BONE_POSITIONS[boneId] || {x: 0, y: 5};
}

const FC_DATA_BASE = "https://raw.githubusercontent.com/FightCore/frame-data/main/data";
const EXTRACTOR_BASE = "https://melee.theshoemaker.de/framedata-json-fullhitboxes";

export class FightCore {
    constructor() {
        this._cache = new Map();       // FightCore moves cache
        this._loading = new Map();
        this._moveMap = new Map();
        this._extCache = new Map();    // Extractor hitbox data cache
        this._extLoading = new Map();
    }

    // ===== FightCore data (move names, frame data, KB values) =====
    async getMoves(charId) {
        if (this._cache.has(charId)) return this._cache.get(charId);
        if (this._loading.has(charId)) return this._loading.get(charId);
        const folderName = FC_CHAR_NAMES[charId];
        if (!folderName) return [];
        const promise = (async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
                    const resp = await fetch(FC_DATA_BASE + "/" + folderName + "/moves.json");
                    if (resp.status === 429) { console.warn("FightCore: rate limited, retry", attempt + 1); continue; }
                    if (!resp.ok) throw new Error("HTTP " + resp.status);
                    const moves = await resp.json();
                    this._cache.set(charId, moves);
                    const map = new Map();
                    for (const m of moves) {
                        if (m.normalizedName) map.set(m.normalizedName, m);
                    }
                    this._moveMap.set(charId, map);
                    this._loading.delete(charId);
                    return moves;
                } catch (e) {
                    if (attempt === 2) {
                        console.warn("FightCore: failed to load moves for char " + charId, e);
                        this._loading.delete(charId);
                        // Don't cache failures — allow retry on next call
                        return [];
                    }
                }
            }
            this._loading.delete(charId);
            return [];
        })();
        this._loading.set(charId, promise);
        return promise;
    }

    getMove(charId, normalizedName) {
        const map = this._moveMap.get(charId);
        return map ? (map.get(normalizedName) || null) : null;
    }

    getFrameDataForAction(charId, actionName) {
        if (!actionName) return null;
        if (typeof actionName !== 'string') actionName = String(actionName);
        const map = this._moveMap.get(charId);
        if (!map) return null;
        if ((charId === 9 || charId === 23) && DANCING_BLADE_MAP[actionName]) {
            return map.get(DANCING_BLADE_MAP[actionName]) || null;
        }
        let fcName = ACTION_TO_FC_MOVE[actionName];
        if (fcName) return map.get(fcName) || null;
        fcName = SPECIAL_TO_FC_MOVE[actionName];
        if (fcName) return map.get(fcName) || null;
        return map.get(actionName.toLowerCase()) || null;
    }

    // ===== Extractor hitbox geometry data (pfirsich's meleeFrameDataExtractor) =====
    async getExtractorData(charId) {
        if (this._extCache.has(charId)) return this._extCache.get(charId);
        if (this._extLoading.has(charId)) return this._extLoading.get(charId);
        const charName = EXTRACTOR_CHAR_NAMES[charId];
        if (!charName) return null;
        const promise = (async () => {
            try {
                const url = EXTRACTOR_BASE + "/" + charName + ".framedata.json";
                const resp = await fetch(url);
                if (!resp.ok) throw new Error("HTTP " + resp.status);
                const data = await resp.json();
                // Build subactionName -> move data lookup
                const bySubaction = new Map();
                for (const [key, moveData] of Object.entries(data)) {
                    if (!moveData || !moveData.subactionName) continue;
                    // Extract action name from subactionName like "PlyFox5K_Share_ACTION_Attack11_figatree"
                    const m = moveData.subactionName.match(/ACTION_(\w+?)_figatree/);
                    if (m) bySubaction.set(m[1], moveData);
                }
                const result = { moves: data, bySubaction };
                this._extCache.set(charId, result);
                this._extLoading.delete(charId);
                return result;
            } catch (e) {
                console.warn("FightCore: failed to load extractor data for char " + charId, e);
                this._extCache.set(charId, null);
                this._extLoading.delete(charId);
                return null;
            }
        })();
        this._extLoading.set(charId, promise);
        return promise;
    }

    /**
     * Get exact hitbox geometry for a given action state and frame.
     * Returns array of {id, x, y, size, damage, angle, kbGrowth, baseKb, element, bone} or null.
     * x/y are in game units relative to character origin (feet).
     * x is in the facing direction (positive = forward).
     */
    getHitboxesForFrame(charId, actionName, frame) {
        const ext = this._extCache.get(charId);
        if (!ext) return null;

        // Try direct action name lookup via subactionName index
        let moveData = ext.bySubaction.get(actionName);

        // Try the explicit ACTION_TO_EXTRACTOR_KEY mapping
        if (!moveData) {
            const extKey = ACTION_TO_EXTRACTOR_KEY[actionName];
            if (extKey && ext.moves[extKey]) moveData = ext.moves[extKey];
        }

        // For specials, try matching subaction name patterns
        if (!moveData) {
            // Try with "Special" prefix variations
            for (const [subName, data] of ext.bySubaction) {
                if (subName === actionName) { moveData = data; break; }
            }
        }

        if (!moveData || !moveData.hitFrames) return null;

        // Find active hitboxes for this frame
        const results = [];
        for (const hitFrame of moveData.hitFrames) {
            if (frame >= hitFrame.start && frame <= hitFrame.end && hitFrame.hitboxes) {
                for (const hb of hitFrame.hitboxes) {
                    const bone = getBonePos(hb.bone);
                    // For bone 0 (TransN/root), x/y offsets are absolute from character origin
                    // For other bones, add bone position + offset
                    // The extractor's z = forward axis, x = sideways (we project to 2D: z->x, y->y)
                    let hbX, hbY;
                    if (hb.bone === 0) {
                        hbX = hb.x;  // x offset from root (forward/back in facing dir)
                        hbY = hb.y;  // y offset from root (up/down)
                    } else {
                        // bone position + hitbox offset projected to 2D
                        // z = forward along bone, x = perpendicular, y = up
                        hbX = bone.x + hb.z;  // z is along the bone's forward axis
                        hbY = bone.y + hb.y;  // y is vertical offset
                    }
                    results.push({
                        id: hb.id,
                        x: hbX,
                        y: hbY,
                        size: hb.size,
                        damage: hb.damage,
                        angle: hb.angle,
                        kbGrowth: hb.kbGrowth,
                        baseKb: hb.baseKb,
                        element: hb.element,
                        bone: hb.bone,
                    });
                }
            }
        }
        return results.length > 0 ? results : null;
    }

    // ===== CC / ASDI Down percent calculator =====
    async getCCPercents(attackerId, defenderId) {
        const moves = await this.getMoves(attackerId);
        if (!moves.length) return [];
        const defWeight = CHAR_WEIGHTS[defenderId] || 100;
        const results = [];
        // Moves filtered from CC/ASDI panel:
        // - Throws/grabs/pummel: can't CC (you're grabbed)
        // - Ledge attacks: setKB 90 means ASDI down never works, CC is impractical
        // - Getup attacks: BKB 80 means ASDI down never works, CC is impractical
        const NON_CC_MOVES = new Set([
            'fthrow','bthrow','uthrow','dthrow','grab','dashgrab','pummel',
            'ledgeattackslow','ledgeattackfast','edge',
            'getupattackback','getupattackstomach',
            'bgetup','fgetup',
        ]);
        for (const move of moves) {
            if (!move.hits || !move.hits.length) continue;
            if (move.normalizedName && NON_CC_MOVES.has(move.normalizedName)) continue;
            for (let hi = 0; hi < move.hits.length; hi++) {
                const hit = move.hits[hi];
                if (!hit.hitboxes || !hit.hitboxes.length) continue;
                let bestHb = null;
                for (const hb of hit.hitboxes) {
                    if (hb.damage > 0 && (!bestHb || hb.damage > bestHb.damage)) bestHb = hb;
                }
                if (!bestHb) continue;
                // CC/ASDI only works for upward-sending angles (1-179) or Sakurai (361)
                const canCC = (bestHb.angle > 0 && bestHb.angle < 180) || bestHb.angle === 361;
                const ccMax = canCC ? this._calcMaxPercent(bestHb, defWeight, 80, 2 / 3) : -1;
                const asdiMax = canCC ? this._calcMaxPercent(bestHb, defWeight, 80, 1.0) : -1;
                const hitLabel = hit.name && hit.name !== 'unknown'
                    ? hit.name
                    : (move.hits.length > 1 ? `Hit ${hi + 1}` : 'unknown');
                results.push({
                    moveName: move.name,
                    normalizedName: move.normalizedName,
                    hitName: hitLabel,
                    hitIndex: hi,
                    damage: bestHb.damage,
                    angle: bestHb.angle,
                    knockbackGrowth: bestHb.knockbackGrowth,
                    baseKnockback: bestHb.baseKnockback,
                    setKnockback: bestHb.setKnockback,
                    ccMaxPercent: ccMax,
                    asdiMaxPercent: asdiMax,
                });
            }
        }
        const deduped = new Map();
        for (const r of results) {
            const key = r.moveName + "|" + r.hitName + "|" + r.hitIndex;
            if (!deduped.has(key) || r.ccMaxPercent < deduped.get(key).ccMaxPercent) {
                deduped.set(key, r);
            }
        }
        return [...deduped.values()];
    }

    _calcMaxPercent(hb, weight, kbThreshold, ccMult) {
        const { damage, knockbackGrowth, baseKnockback, setKnockback } = hb;
        if (setKnockback > 0) {
            const kb = (((((1 + (10 * setKnockback / 20)) * (200 / (weight + 100)) * 1.4) + 18) * (knockbackGrowth / 100)) + baseKnockback) * ccMult;
            return kb < kbThreshold ? 999 : -1;
        }
        if (knockbackGrowth === 0 && baseKnockback === 0) return 999;
        const kb0 = this._calcKB(damage, 0, weight, knockbackGrowth, baseKnockback, ccMult);
        if (kb0 >= kbThreshold) return -1;
        const kb999 = this._calcKB(damage, 999, weight, knockbackGrowth, baseKnockback, ccMult);
        if (kb999 < kbThreshold) return 999;
        let lo = 0, hi = 999;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            const kb = this._calcKB(damage, mid, weight, knockbackGrowth, baseKnockback, ccMult);
            if (kb < kbThreshold) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    _calcKB(damage, percent, weight, kbg, bkb, ccMult) {
        const p = percent + damage;
        // Correct Melee KB formula: BKB is added AFTER KBG scaling, CC mult applies to total
        return ((((((p / 10) + (p * damage / 20)) * (200 / (weight + 100)) * 1.4) + 18) * (kbg / 100)) + bkb) * ccMult;
    }
}
