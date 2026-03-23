/**
 * IKneeData Calculator Module — Melee frame data computation engine
 * Pure functions, no DOM dependencies. Reuses FightCore for move data.
 *
 * Sources:
 *   - Knockback formula: https://www.ssbwiki.com/Knockback
 *   - Stage data: libmelee (https://libmelee.readthedocs.io/en/latest/stages.html)
 *   - Character physics: ssbwiki.com (Gravity, Falling_speed pages)
 */
import { FightCore } from './fightcore.js';

// ===== Shared FightCore instance =====
const fc = new FightCore();
export { fc };

// ===== Character display names (same IDs as fightcore.js) =====
export const CHAR_NAMES = {
    0: 'Captain Falcon', 1: 'Donkey Kong', 2: 'Fox', 3: 'Mr. Game & Watch',
    4: 'Kirby', 5: 'Bowser', 6: 'Link', 7: 'Luigi', 8: 'Mario',
    9: 'Marth', 10: 'Mewtwo', 11: 'Ness', 12: 'Peach', 13: 'Pikachu',
    14: 'Ice Climbers', 15: 'Jigglypuff', 16: 'Samus', 17: 'Yoshi',
    18: 'Zelda', 19: 'Sheik', 20: 'Falco', 21: 'Young Link',
    22: 'Dr. Mario', 23: 'Roy', 24: 'Pichu', 25: 'Ganondorf',
};

// ===== Character physics: weight, gravity, fallSpeed, maxFallSpeed, airFriction =====
// Weight from fightcore.js CHAR_WEIGHTS, gravity/fallSpeed from ssbwiki Melee tables
export const CHAR_PHYSICS = {
    //          weight  gravity  fallSpeed  fastFallSpeed
    0:  { weight: 104, gravity: 0.13,  fallSpeed: 2.9,  fastFallSpeed: 3.5  }, // Captain Falcon
    1:  { weight: 114, gravity: 0.10,  fallSpeed: 2.4,  fastFallSpeed: 3.2  }, // Donkey Kong
    2:  { weight: 75,  gravity: 0.23,  fallSpeed: 2.8,  fastFallSpeed: 3.4  }, // Fox
    3:  { weight: 60,  gravity: 0.095, fallSpeed: 1.7,  fastFallSpeed: 2.5  }, // Mr. Game & Watch
    4:  { weight: 70,  gravity: 0.08,  fallSpeed: 1.6,  fastFallSpeed: 2.5  }, // Kirby
    5:  { weight: 117, gravity: 0.13,  fallSpeed: 1.9,  fastFallSpeed: 2.7  }, // Bowser
    6:  { weight: 104, gravity: 0.11,  fallSpeed: 2.13, fastFallSpeed: 3.0  }, // Link
    7:  { weight: 100, gravity: 0.069, fallSpeed: 1.6,  fastFallSpeed: 2.4  }, // Luigi
    8:  { weight: 100, gravity: 0.095, fallSpeed: 1.7,  fastFallSpeed: 2.5  }, // Mario
    9:  { weight: 87,  gravity: 0.085, fallSpeed: 2.2,  fastFallSpeed: 2.9  }, // Marth
    10: { weight: 85,  gravity: 0.082, fallSpeed: 1.5,  fastFallSpeed: 2.3  }, // Mewtwo
    11: { weight: 94,  gravity: 0.09,  fallSpeed: 1.83, fastFallSpeed: 2.6  }, // Ness
    12: { weight: 90,  gravity: 0.08,  fallSpeed: 1.5,  fastFallSpeed: 2.3  }, // Peach
    13: { weight: 80,  gravity: 0.11,  fallSpeed: 1.9,  fastFallSpeed: 2.7  }, // Pikachu
    14: { weight: 88,  gravity: 0.10,  fallSpeed: 1.6,  fastFallSpeed: 2.4  }, // Ice Climbers
    15: { weight: 60,  gravity: 0.064, fallSpeed: 1.3,  fastFallSpeed: 2.0  }, // Jigglypuff
    16: { weight: 110, gravity: 0.066, fallSpeed: 1.4,  fastFallSpeed: 2.2  }, // Samus
    17: { weight: 108, gravity: 0.093, fallSpeed: 1.93, fastFallSpeed: 2.8  }, // Yoshi
    18: { weight: 90,  gravity: 0.073, fallSpeed: 1.4,  fastFallSpeed: 2.2  }, // Zelda
    19: { weight: 90,  gravity: 0.12,  fallSpeed: 2.13, fastFallSpeed: 2.9  }, // Sheik
    20: { weight: 80,  gravity: 0.17,  fallSpeed: 3.1,  fastFallSpeed: 3.7  }, // Falco
    21: { weight: 85,  gravity: 0.11,  fallSpeed: 2.13, fastFallSpeed: 3.0  }, // Young Link
    22: { weight: 100, gravity: 0.095, fallSpeed: 1.7,  fastFallSpeed: 2.5  }, // Dr. Mario
    23: { weight: 85,  gravity: 0.114, fallSpeed: 2.4,  fastFallSpeed: 3.2  }, // Roy
    24: { weight: 55,  gravity: 0.11,  fallSpeed: 1.9,  fastFallSpeed: 2.7  }, // Pichu
    25: { weight: 109, gravity: 0.13,  fallSpeed: 2.0,  fastFallSpeed: 2.9  }, // Ganondorf
};

// ===== Stage data: blast zones (left, right, top, bottom) and edge position =====
// From libmelee BLASTZONES and EDGE_POSITION
export const STAGES = {
    battlefield: {
        name: 'Battlefield',
        blastZones: { left: -224, right: 224, top: 200, bottom: -108.8 },
        edge: 71.3,
        groundY: 0,
        platforms: [
            { y: 27.2, left: -57.6, right: 57.6 },   // top
            { y: 18.4, left: -57.6, right: -20 },     // left
            { y: 18.4, left: 20, right: 57.6 },       // right
        ],
    },
    final_destination: {
        name: 'Final Destination',
        blastZones: { left: -246, right: 246, top: 188, bottom: -140 },
        edge: 88.47,
        groundY: 0,
        platforms: [],
    },
    dreamland: {
        name: 'Dreamland',
        blastZones: { left: -255, right: 255, top: 250, bottom: -123 },
        edge: 80.18,
        groundY: 0,
        platforms: [
            { y: 30.14, left: -61.39, right: 61.39 }, // top
            { y: 25.06, left: -77.27, right: -51.43 },// left
            { y: 25.06, left: 51.43, right: 77.27 },  // right
        ],
    },
    fountain_of_dreams: {
        name: 'Fountain of Dreams',
        blastZones: { left: -198.75, right: 198.75, top: 202.5, bottom: -146.25 },
        edge: 66.26,
        groundY: 0,
        platforms: [
            { y: 42.75, left: -14.25, right: 14.25 }, // top
            { y: 27.38, left: -51.13, right: -31.73 },// left (moves)
            { y: 27.38, left: 31.73, right: 51.13 },  // right (moves)
        ],
    },
    yoshis_story: {
        name: "Yoshi's Story",
        blastZones: { left: -175.7, right: 173.6, top: 168, bottom: -91 },
        edge: 58.91,
        groundY: 0,
        platforms: [
            { y: 42, left: -15.75, right: 15.75 },    // top
            { y: 23.45, left: -59.5, right: -28 },    // left
            { y: 23.45, left: 28, right: 59.5 },      // right
        ],
    },
    pokemon_stadium: {
        name: 'Pokemon Stadium',
        blastZones: { left: -230, right: 230, top: 180, bottom: -111 },
        edge: 90.66,
        groundY: 0,
        platforms: [
            { y: 25, left: -25, right: 25 },          // left
            { y: 25, left: -25, right: 25 },          // right (transforms)
        ],
    },
};

// ===== Stale Move Negation multipliers =====
// Queue of 9 entries; each entry reduces damage by this amount
const STALE_MULTIPLIERS = [0.09, 0.08545, 0.07635, 0.0679, 0.0588, 0.04900, 0.03969, 0.02979, 0.01980];

/**
 * Apply stale move negation to damage.
 * @param {number} baseDamage - Fresh move damage
 * @param {number[]} stalenessQueue - Array of queue positions (0-8) where this move appears
 * @returns {number} Staled damage
 */
export function applyStaleness(baseDamage, stalenessQueue = []) {
    if (!stalenessQueue.length) return baseDamage;
    let reduction = 0;
    for (const pos of stalenessQueue) {
        if (pos >= 0 && pos < STALE_MULTIPLIERS.length) {
            reduction += STALE_MULTIPLIERS[pos];
        }
    }
    return baseDamage * (1 - reduction);
}

/**
 * Resolve Sakurai angle (361) to actual angle.
 * In Melee: if KB < 32 and grounded, angle = 0. Otherwise angle = 45.
 * @param {number} angle - Move angle
 * @param {number} kb - Knockback magnitude
 * @param {boolean} grounded - Whether defender is grounded
 * @returns {number} Resolved angle in degrees
 */
export function resolveSakuraiAngle(angle, kb, grounded) {
    if (angle !== 361) return angle;
    if (grounded && kb < 32) return 0;
    return 45;
}

/**
 * Calculate knockback magnitude.
 * Melee formula: ((((((p/10 + p*d/20) * 200/(w+100) * 1.4) + 18) * KBG/100) + BKB) * ratio
 * For set KB: d term becomes (1 + 10*setKB/20), p = 10
 *
 * @param {object} params
 * @param {number} params.damage - Move damage (before staleness)
 * @param {number} params.percent - Defender percent before hit
 * @param {number} params.weight - Defender weight
 * @param {number} params.kbg - Knockback growth
 * @param {number} params.bkb - Base knockback
 * @param {number} params.setKb - Set knockback (0 if none)
 * @param {boolean} [params.crouchCancel=false] - CC active
 * @param {number} [params.chargeMultiplier=1.0] - Smash charge multiplier (up to 1.3671)
 * @param {number[]} [params.stalenessQueue=[]] - Staleness queue positions
 * @returns {number} Knockback magnitude
 */
export function calcKnockback({ damage, percent, weight, kbg, bkb, setKb = 0, crouchCancel = false, chargeMultiplier = 1.0, stalenessQueue = [] }) {
    let d = damage * chargeMultiplier;
    // Staleness affects damage for KB calculation in Melee (except for set KB)
    // In Melee, staleness does NOT affect the 'd' in the KB formula for non-projectiles
    // but DOES affect the percent accumulation. For simplicity, we apply it to damage.
    const staledDamage = applyStaleness(d, stalenessQueue);

    let kb;
    if (setKb > 0) {
        // Set knockback: p is always 10, damage term replaced
        const p = 10 + staledDamage;
        kb = (((((1 + (10 * setKb / 20)) * (200 / (weight + 100)) * 1.4) + 18) * (kbg / 100)) + bkb);
    } else {
        const p = percent + staledDamage;
        kb = ((((((p / 10) + (p * staledDamage / 20)) * (200 / (weight + 100)) * 1.4) + 18) * (kbg / 100)) + bkb);
    }

    // CC multiplier
    if (crouchCancel) kb *= (2 / 3);

    return Math.round(kb * 100) / 100;
}

/**
 * Calculate hitstun frames.
 * Melee: floor(KB * 0.4)
 * @param {number} kb - Knockback magnitude
 * @returns {{ hitstun: number, tumble: boolean }}
 */
export function calcHistun(kb) {
    return {
        hitstun: Math.floor(kb * 0.4),
        tumble: kb >= 80,
    };
}

/**
 * Calculate hitlag frames.
 * Melee: floor((damage/3 + 3) * electricMult) clamped to [1, 20] (before crouch cancel)
 * Electric moves multiply by 1.5
 * @param {number} damage - Move damage
 * @param {boolean} [electric=false] - Electric element
 * @returns {number} Hitlag frames
 */
export function calcHitlag(damage, electric = false) {
    let hitlag = Math.floor(damage / 3 + 3);
    if (electric) hitlag = Math.floor(hitlag * 1.5);
    return Math.max(1, Math.min(hitlag, 20));
}

/**
 * Apply DI to launch angle.
 * Melee DI: the angle is shifted by up to ~18 degrees perpendicular to the launch direction.
 * DI influence = sin(angle between DI stick and launch angle) * 18 degrees (approx)
 *
 * @param {number} launchAngle - Base launch angle in degrees
 * @param {number} diAngle - DI stick angle in degrees (NaN or null for no DI)
 * @returns {{ baseAngle: number, diAngle: number, diModifiedAngle: number }}
 */
export function applyDI(launchAngle, diAngle) {
    if (diAngle == null || isNaN(diAngle)) {
        return { baseAngle: launchAngle, diAngle: null, diModifiedAngle: launchAngle };
    }
    const launchRad = launchAngle * Math.PI / 180;
    const diRad = diAngle * Math.PI / 180;
    // Angle between DI and launch direction
    const diff = diRad - launchRad;
    // Perpendicular component determines influence magnitude
    const influence = Math.sin(diff);
    // Max DI shift is ~18 degrees in Melee
    const maxShift = 18;
    const shift = influence * maxShift;
    const modified = launchAngle + shift;
    return {
        baseAngle: launchAngle,
        diAngle: diAngle,
        diModifiedAngle: Math.round(modified * 100) / 100,
    };
}

/**
 * Convert knockback magnitude to launch speed.
 * Melee: launchSpeed = KB * 0.03
 * @param {number} kb - Knockback magnitude
 * @returns {number} Launch speed in units/frame
 */
export function kbToLaunchSpeed(kb) {
    return kb * 0.03;
}

/**
 * Simulate trajectory frame-by-frame.
 * In Melee, after launch:
 *   - Launch speed decays by 0.051 per frame
 *   - Gravity pulls character down (adds to vertical velocity each frame)
 *   - Fall speed is capped at character's max fall speed
 *   - Air friction is NOT applied during knockback decay (disabled during hitstun in Melee)
 *
 * @param {object} params
 * @param {number} params.launchSpeed - Initial launch speed (KB * 0.03)
 * @param {number} params.angle - Launch angle in degrees
 * @param {number} params.startX - Starting X position
 * @param {number} params.startY - Starting Y position
 * @param {object} params.charPhysics - Character physics { gravity, fallSpeed }
 * @param {object} params.blastZones - { left, right, top, bottom }
 * @param {number} [params.maxFrames=600] - Max frames to simulate
 * @returns {{ frames: Array<{x,y}>, killed: boolean, killFrame: number|null, killZone: string|null, finalX: number, finalY: number }}
 */
export function simulateTrajectory({ launchSpeed, angle, startX, startY, charPhysics, blastZones, maxFrames = 600 }) {
    const angleRad = angle * Math.PI / 180;
    const decay = 0.051;
    const { gravity, fallSpeed } = charPhysics;

    let x = startX;
    let y = startY;
    let killed = false;
    let killFrame = null;
    let killZone = null;

    // In Melee, knockback works as follows:
    // - Total launch speed decays by 0.051 per frame
    // - The x and y components are derived from the decaying speed + angle
    // - Gravity accumulates separately on the y axis
    // - Fall speed caps the downward velocity
    let kbSpeed = launchSpeed;
    let gravityAccum = 0; // accumulated gravity pull
    const frames2 = [{ x, y }];

    for (let f = 1; f <= maxFrames; f++) {
        kbSpeed = Math.max(0, kbSpeed - decay);

        // KB velocity components (from decaying magnitude along original angle)
        const kbVx = kbSpeed * Math.cos(angleRad);
        const kbVy = kbSpeed * Math.sin(angleRad);

        // Gravity accumulates independently
        gravityAccum += gravity;

        // Actual y velocity = KB component - accumulated gravity, capped at fall speed
        let actualVy = kbVy - gravityAccum;
        if (actualVy < -fallSpeed) actualVy = -fallSpeed;

        x += kbVx;
        y += actualVy;

        frames2.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });

        // Check blast zones
        if (x <= blastZones.left) { killed = true; killFrame = f; killZone = 'left'; break; }
        if (x >= blastZones.right) { killed = true; killFrame = f; killZone = 'right'; break; }
        if (y >= blastZones.top) { killed = true; killFrame = f; killZone = 'top'; break; }
        if (y <= blastZones.bottom) { killed = true; killFrame = f; killZone = 'bottom'; break; }

        // If KB is done and character is at/below ground, stop
        if (kbSpeed <= 0 && y <= 0) { y = 0; break; }
    }

    return {
        frames: frames2,
        killed,
        killFrame,
        killZone,
        finalX: Math.round(x * 100) / 100,
        finalY: Math.round(y * 100) / 100,
    };
}

/**
 * Find kill percent via binary search.
 * @param {object} params
 * @param {number} params.damage - Move damage
 * @param {number} params.kbg - Knockback growth
 * @param {number} params.bkb - Base knockback
 * @param {number} params.setKb - Set knockback
 * @param {number} params.angle - Move angle
 * @param {number} params.defenderCharId - Defender character ID
 * @param {string} params.stageKey - Stage key from STAGES
 * @param {number} [params.startX=0] - Starting X position
 * @param {number} [params.startY=0] - Starting Y position
 * @param {number|null} [params.diAngle=null] - DI angle (null for no DI)
 * @param {boolean} [params.crouchCancel=false]
 * @returns {{ killPercent: number|null, noDI: number|null, survivalDI: number|null }}
 */
export function findKillPercent({ damage, kbg, bkb, setKb = 0, angle, defenderCharId, stageKey, startX = 0, startY = 0, diAngle = null, crouchCancel = false }) {
    const physics = CHAR_PHYSICS[defenderCharId];
    const stage = STAGES[stageKey];
    if (!physics || !stage) return { killPercent: null, noDI: null, survivalDI: null };

    const doesKill = (percent, di) => {
        const kb = calcKnockback({ damage, percent, weight: physics.weight, kbg, bkb, setKb, crouchCancel });
        let resolvedAngle = resolveSakuraiAngle(angle, kb, startY <= 0);
        if (di != null) {
            resolvedAngle = applyDI(resolvedAngle, di).diModifiedAngle;
        }
        const speed = kbToLaunchSpeed(kb);
        const result = simulateTrajectory({
            launchSpeed: speed,
            angle: resolvedAngle,
            startX, startY,
            charPhysics: physics,
            blastZones: stage.blastZones,
        });
        return result.killed;
    };

    const binarySearch = (di) => {
        // Check if it kills at 999
        if (!doesKill(999, di)) return null;
        // Check if it kills at 0
        if (doesKill(0, di)) return 0;
        let lo = 0, hi = 999;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (doesKill(mid, di)) hi = mid;
            else lo = mid + 1;
        }
        // Verify: binary search found the boundary, but let's double check
        // lo should be the first percent that kills
        if (doesKill(lo, di)) return lo;
        return null;
    };

    if (diAngle != null) {
        return { killPercent: binarySearch(diAngle), noDI: null, survivalDI: null };
    }

    // No DI specified: compute both no-DI and optimal survival DI
    const noDI = binarySearch(null);

    // Optimal survival DI: DI perpendicular to launch, away from nearest blast zone
    // For horizontal launches, DI up. For vertical, DI toward center.
    // Simplified: try DI at launch angle + 90 and launch angle - 90, pick the one that survives longer
    const testAngle = resolveSakuraiAngle(angle, 100, startY <= 0);
    const diUp = binarySearch(testAngle + 90);
    const diDown = binarySearch(testAngle - 90);
    let survivalDI;
    if (diUp == null && diDown == null) survivalDI = null;
    else if (diUp == null) survivalDI = diUp; // null means doesn't kill = best survival
    else if (diDown == null) survivalDI = diDown;
    else survivalDI = Math.max(diUp, diDown);

    return { killPercent: noDI, noDI, survivalDI };
}

/**
 * Calculate shield stun.
 * Melee: floor((damage + 4.45) / 2.235)
 * @param {number} damage - Move damage
 * @returns {number} Shield stun frames
 */
export function calcShieldStun(damage) {
    return Math.floor((damage + 4.45) / 2.235);
}

/**
 * Calculate shield advantage.
 * @param {number} shieldStun - Shield stun frames
 * @param {number} endlag - Attacker's remaining endlag after hit connects
 * @returns {{ advantage: number, safe: boolean }}
 */
export function calcShieldAdvantage(shieldStun, endlag) {
    const advantage = shieldStun - endlag;
    return { advantage, safe: advantage >= 0 };
}

/**
 * Assess combo viability.
 * @param {number} hitstun - Defender hitstun frames
 * @param {number} attackerEndlag - Attacker endlag frames remaining
 * @returns {{ frameAdvantage: number, isCombo: boolean }}
 */
export function assessCombo(hitstun, attackerEndlag) {
    const frameAdvantage = hitstun - attackerEndlag;
    return { frameAdvantage, isCombo: frameAdvantage > 0 };
}

/**
 * Full calculation: given move data and context, compute everything.
 * @param {object} params
 * @param {number} params.damage
 * @param {number} params.angle
 * @param {number} params.kbg
 * @param {number} params.bkb
 * @param {number} [params.setKb=0]
 * @param {number} params.percent - Defender percent
 * @param {number} params.defenderCharId
 * @param {string} [params.stageKey='final_destination']
 * @param {number} [params.startX=0]
 * @param {number} [params.startY=0]
 * @param {number|null} [params.diAngle=null]
 * @param {boolean} [params.crouchCancel=false]
 * @param {number} [params.chargeMultiplier=1.0]
 * @param {number[]} [params.stalenessQueue=[]]
 * @param {number|null} [params.attackerEndlag=null]
 * @returns {object} Full calculation results
 */
export function fullCalc(params) {
    const {
        damage, angle, kbg, bkb, setKb = 0,
        percent, defenderCharId,
        stageKey = 'final_destination',
        startX = 0, startY = 0,
        diAngle = null,
        crouchCancel = false,
        chargeMultiplier = 1.0,
        stalenessQueue = [],
        attackerEndlag = null,
    } = params;

    const physics = CHAR_PHYSICS[defenderCharId];
    if (!physics) return null;

    const kb = calcKnockback({ damage, percent, weight: physics.weight, kbg, bkb, setKb, crouchCancel, chargeMultiplier, stalenessQueue });
    const resolvedAngle = resolveSakuraiAngle(angle, kb, startY <= 0);
    const di = applyDI(resolvedAngle, diAngle);
    const { hitstun, tumble } = calcHistun(kb);
    const hitlag = calcHitlag(damage);
    const launchSpeed = kbToLaunchSpeed(kb);
    const shieldStun = calcShieldStun(damage * chargeMultiplier);

    const stage = STAGES[stageKey];
    let trajectory = null;
    if (stage) {
        trajectory = simulateTrajectory({
            launchSpeed,
            angle: di.diModifiedAngle,
            startX, startY,
            charPhysics: physics,
            blastZones: stage.blastZones,
        });
    }

    let shieldAdvantage = null;
    let combo = null;
    if (attackerEndlag != null) {
        shieldAdvantage = calcShieldAdvantage(shieldStun, attackerEndlag);
        combo = assessCombo(hitstun, attackerEndlag);
    }

    return {
        knockback: kb,
        hitstun,
        tumble,
        hitlag,
        launchSpeed: Math.round(launchSpeed * 1000) / 1000,
        launchAngle: di,
        shieldStun,
        shieldAdvantage,
        combo,
        trajectory,
        defenderWeight: physics.weight,
    };
}

/**
 * Replay viewer integration: auto-populate from frame data.
 * @param {object} frameData
 * @param {number} frameData.attackerCharId
 * @param {string} frameData.actionState - Action state name
 * @param {number} frameData.defenderCharId
 * @param {number} frameData.defenderPercent
 * @param {string} [frameData.stageKey='final_destination']
 * @param {number} [frameData.startX=0]
 * @param {number} [frameData.startY=0]
 * @returns {Promise<object|null>} Calculation results or null if move not found
 */
export async function calcFromReplay(frameData) {
    const { attackerCharId, actionState, defenderCharId, defenderPercent, stageKey = 'final_destination', startX = 0, startY = 0 } = frameData;

    await fc.getMoves(attackerCharId);
    const moveData = fc.getFrameDataForAction(attackerCharId, actionState);
    if (!moveData || !moveData.hits || !moveData.hits.length) return null;

    // Use the strongest hitbox from the first hit
    const hit = moveData.hits[0];
    if (!hit.hitboxes || !hit.hitboxes.length) return null;
    let bestHb = null;
    for (const hb of hit.hitboxes) {
        if (hb.damage > 0 && (!bestHb || hb.damage > bestHb.damage)) bestHb = hb;
    }
    if (!bestHb) return null;

    const result = fullCalc({
        damage: bestHb.damage,
        angle: bestHb.angle,
        kbg: bestHb.knockbackGrowth,
        bkb: bestHb.baseKnockback,
        setKb: bestHb.setKnockback || 0,
        percent: defenderPercent,
        defenderCharId,
        stageKey,
        startX,
        startY,
    });

    return {
        moveName: moveData.name,
        normalizedName: moveData.normalizedName,
        hitbox: bestHb,
        ...result,
    };
}
