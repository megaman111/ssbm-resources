/**
 * IKneeData Calculator Module — Melee frame data computation engine
 * Accurate physics ported from schmooblidon's IKneeData (open source).
 * Source: https://github.com/schmooblidon/schmooblidon.github.io
 *
 * Pure functions, no DOM dependencies. Reuses FightCore for move data.
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

// Internal char ID -> IKneeData character key mapping
const CHAR_KEY = {
    0: 'Falcon', 1: 'DK', 2: 'Fox', 3: 'MrG&W',
    4: 'Kirby', 5: 'Bowser', 6: 'Link', 7: 'Luigi', 8: 'Mario',
    9: 'Marth', 10: 'Mewtwo', 11: 'Ness', 12: 'Peach', 13: 'Pika',
    14: 'Popo', 15: 'Puff', 16: 'Samus', 17: 'Yoshi',
    18: 'Zelda', 19: 'Sheik', 20: 'Falco', 21: 'Y.Link',
    22: 'Doc', 23: 'Roy', 24: 'Pichu', 25: 'Ganon',
};

// ===== Character physics from IKneeData's charAttributes.js (exact values) =====
// Keys: weight (NTSC), gravity, terminalVelocity, traction, airFriction, driftAcc, driftMax
export const CHAR_PHYSICS = {
    0:  { weight: 104, gravity: 0.13,  terminalVelocity: 2.9,  traction: 0.08,  airFriction: 0.01,  driftAcc: 0.06,  driftMax: 1.12 },
    1:  { weight: 114, gravity: 0.10,  terminalVelocity: 2.4,  traction: 0.08,  airFriction: 0.02,  driftAcc: 0.04,  driftMax: 1.0  },
    2:  { weight: 75,  gravity: 0.23,  terminalVelocity: 2.8,  traction: 0.08,  airFriction: 0.02,  driftAcc: 0.08,  driftMax: 0.83 },
    3:  { weight: 60,  gravity: 0.095, terminalVelocity: 1.7,  traction: 0.06,  airFriction: 0.016, driftAcc: 0.05,  driftMax: 1.0  },
    4:  { weight: 70,  gravity: 0.08,  terminalVelocity: 1.6,  traction: 0.08,  airFriction: 0.02,  driftAcc: 0.06,  driftMax: 0.78 },
    5:  { weight: 117, gravity: 0.13,  terminalVelocity: 1.9,  traction: 0.06,  airFriction: 0.01,  driftAcc: 0.05,  driftMax: 0.8  },
    6:  { weight: 104, gravity: 0.11,  terminalVelocity: 2.13, traction: 0.10,  airFriction: 0.005, driftAcc: 0.06,  driftMax: 1.0  },
    7:  { weight: 100, gravity: 0.069, terminalVelocity: 1.6,  traction: 0.025, airFriction: 0.01,  driftAcc: 0.04,  driftMax: 0.68 },
    8:  { weight: 100, gravity: 0.095, terminalVelocity: 1.7,  traction: 0.06,  airFriction: 0.016, driftAcc: 0.045, driftMax: 0.86 },
    9:  { weight: 87,  gravity: 0.085, terminalVelocity: 2.2,  traction: 0.06,  airFriction: 0.005, driftAcc: 0.05,  driftMax: 0.9  },
    10: { weight: 85,  gravity: 0.082, terminalVelocity: 1.5,  traction: 0.04,  airFriction: 0.016, driftAcc: 0.05,  driftMax: 1.2  },
    11: { weight: 94,  gravity: 0.09,  terminalVelocity: 1.83, traction: 0.06,  airFriction: 0.03,  driftAcc: 0.06,  driftMax: 0.93 },
    12: { weight: 90,  gravity: 0.08,  terminalVelocity: 1.5,  traction: 0.10,  airFriction: 0.005, driftAcc: 0.07,  driftMax: 1.1  },
    13: { weight: 80,  gravity: 0.11,  terminalVelocity: 1.9,  traction: 0.09,  airFriction: 0.01,  driftAcc: 0.05,  driftMax: 0.85 },
    14: { weight: 88,  gravity: 0.10,  terminalVelocity: 1.6,  traction: 0.035, airFriction: 0.02,  driftAcc: 0.047, driftMax: 0.7  },
    15: { weight: 60,  gravity: 0.064, terminalVelocity: 1.3,  traction: 0.09,  airFriction: 0.05,  driftAcc: 0.28,  driftMax: 1.35 },
    16: { weight: 110, gravity: 0.066, terminalVelocity: 1.4,  traction: 0.06,  airFriction: 0.01,  driftAcc: 0.0325,driftMax: 0.89 },
    17: { weight: 108, gravity: 0.093, terminalVelocity: 1.93, traction: 0.06,  airFriction: 0.013, driftAcc: 0.048, driftMax: 1.2  },
    18: { weight: 90,  gravity: 0.073, terminalVelocity: 1.4,  traction: 0.10,  airFriction: 0.005, driftAcc: 0.048, driftMax: 0.95 },
    19: { weight: 90,  gravity: 0.12,  terminalVelocity: 2.13, traction: 0.08,  airFriction: 0.04,  driftAcc: 0.06,  driftMax: 0.8  },
    20: { weight: 80,  gravity: 0.17,  terminalVelocity: 3.1,  traction: 0.08,  airFriction: 0.02,  driftAcc: 0.07,  driftMax: 0.83 },
    21: { weight: 85,  gravity: 0.11,  terminalVelocity: 2.13, traction: 0.08,  airFriction: 0.005, driftAcc: 0.06,  driftMax: 1.0  },
    22: { weight: 100, gravity: 0.095, terminalVelocity: 1.7,  traction: 0.06,  airFriction: 0.016, driftAcc: 0.044, driftMax: 0.9  },
    23: { weight: 85,  gravity: 0.114, terminalVelocity: 2.4,  traction: 0.06,  airFriction: 0.005, driftAcc: 0.05,  driftMax: 0.9  },
    24: { weight: 55,  gravity: 0.11,  terminalVelocity: 1.9,  traction: 0.10,  airFriction: 0.01,  driftAcc: 0.05,  driftMax: 0.85 },
    25: { weight: 109, gravity: 0.13,  terminalVelocity: 2.0,  traction: 0.07,  airFriction: 0.02,  driftAcc: 0.06,  driftMax: 0.78 },
};

// ===== Stage data: blast zones and edge position =====
export const STAGES = {
    battlefield: {
        name: 'Battlefield',
        blastZones: { left: -224, right: 224, top: 200, bottom: -108.8 },
        edge: 71.3, groundY: 0,
        platforms: [
            { y: 27.2, left: -57.6, right: 57.6 },
            { y: 18.4, left: -57.6, right: -20 },
            { y: 18.4, left: 20, right: 57.6 },
        ],
    },
    final_destination: {
        name: 'Final Destination',
        blastZones: { left: -246, right: 246, top: 188, bottom: -140 },
        edge: 88.47, groundY: 0, platforms: [],
    },
    dreamland: {
        name: 'Dreamland',
        blastZones: { left: -255, right: 255, top: 250, bottom: -123 },
        edge: 80.18, groundY: 0,
        platforms: [
            { y: 30.14, left: -61.39, right: 61.39 },
            { y: 25.06, left: -77.27, right: -51.43 },
            { y: 25.06, left: 51.43, right: 77.27 },
        ],
    },
    fountain_of_dreams: {
        name: 'Fountain of Dreams',
        blastZones: { left: -198.75, right: 198.75, top: 202.5, bottom: -146.25 },
        edge: 66.26, groundY: 0,
        platforms: [
            { y: 42.75, left: -14.25, right: 14.25 },
            { y: 27.38, left: -51.13, right: -31.73 },
            { y: 27.38, left: 31.73, right: 51.13 },
        ],
    },
    yoshis_story: {
        name: "Yoshi's Story",
        blastZones: { left: -175.7, right: 173.6, top: 168, bottom: -91 },
        edge: 58.91, groundY: 0,
        platforms: [
            { y: 42, left: -15.75, right: 15.75 },
            { y: 23.45, left: -59.5, right: -28 },
            { y: 23.45, left: 28, right: 59.5 },
        ],
    },
    pokemon_stadium: {
        name: 'Pokemon Stadium',
        blastZones: { left: -230, right: 230, top: 180, bottom: -111 },
        edge: 90.66, groundY: 0,
        platforms: [
            { y: 25, left: -25, right: 25 },
            { y: 25, left: -25, right: 25 },
        ],
    },
};

// ===== Constants =====
const DEG2RAD = Math.PI / 180;
const STALE_MULTIPLIERS = [0.09, 0.08545, 0.07635, 0.0679, 0.0588, 0.04900, 0.03969, 0.02979, 0.01980];

/**
 * Apply stale move negation to damage.
 */
export function applyStaleness(baseDamage, stalenessQueue = []) {
    if (!stalenessQueue.length) return baseDamage;
    let reduction = 0;
    for (const pos of stalenessQueue) {
        if (pos >= 0 && pos < STALE_MULTIPLIERS.length) reduction += STALE_MULTIPLIERS[pos];
    }
    return baseDamage * (1 - reduction);
}

/**
 * Calculate knockback magnitude — exact IKneeData formula.
 * Uses separate staled/unstaled damage like the real game.
 */
export function calcKnockback({
    damage, percent, weight, kbg, bkb, setKb = 0,
    crouchCancel = false, chargeInterrupt = false, vcancel = false,
    metal = false, ice = false, nana = false, yoshiDJArmor = false,
    stalenessQueue = [], isThrow = false,
}) {
    const damageUnstaled = damage;
    const damageStaled = applyStaleness(damage, stalenessQueue);

    // Throws use weight 100
    const w = isThrow ? 100 : weight;

    let kb;
    if (setKb > 0) {
        kb = ((((setKb * 10 / 20) + 1) * 1.4 * (200 / (w + 100)) + 18) * (kbg / 100)) + bkb;
    } else {
        // IKneeData exact formula
        kb = ((0.01 * kbg) * ((1.4 * (((0.05 * (damageUnstaled * (damageStaled + Math.floor(percent)))) + (damageStaled + Math.floor(percent)) * 0.1) * (2.0 - (2.0 * (w * 0.01)) / (1.0 + (w * 0.01))))) + 18) + bkb);
    }

    if (crouchCancel) kb *= 0.667;
    if (chargeInterrupt) kb *= 1.2;
    if (vcancel) kb *= 0.95;
    if (ice) kb *= 0.25;
    if (yoshiDJArmor) kb = Math.max(0, kb - 120);
    if (metal) kb = Math.max(0, kb - 30);
    if (nana) kb = Math.max(0, kb - 5);

    return Math.min(2500, kb);
}

/**
 * Resolve Sakurai angle (361) — IKneeData uses 44° (not 45°), threshold 32.1.
 * Also handles reverse hits.
 */
export function resolveSakuraiAngle(angle, kb, grounded, reverse = false) {
    if (angle === 361) {
        if (kb < 32.1 && grounded) {
            return reverse ? 180 : 0;
        }
        return reverse ? 136 : 44;
    }
    if (reverse) {
        let a = 180 - angle;
        if (a < 0) a += 360;
        return a;
    }
    return angle;
}

/**
 * Apply DI to launch angle — exact IKneeData formula.
 * DI uses perpendicular distance formula: p = sin(rAngle) * magnitude
 * Angle offset = min(p² * 18, 18), direction based on sign of rAngle.
 */
export function applyDI(launchAngle, diX, diY) {
    // No DI if both axes zero or null
    if (diX == null && diY == null) {
        return { baseAngle: launchAngle, diAngle: null, diModifiedAngle: launchAngle };
    }
    const dx = diX ?? 0;
    const dy = diY ?? 0;

    // Deadzone
    const x = Math.abs(dx) < 0.2875 ? 0 : dx;
    const y = Math.abs(dy) < 0.2875 ? 0 : dy;

    if (x === 0 && y === 0) {
        return { baseAngle: launchAngle, diAngle: null, diModifiedAngle: launchAngle };
    }

    // Calculate DI stick angle
    let diAngle;
    if (x === 0 && y < 0) diAngle = 270;
    else if (x === 0 && y > 0) diAngle = 90;
    else {
        diAngle = Math.atan(y / x) * (180 / Math.PI);
        if (x < 0) diAngle += 180;
        else if (y < 0) diAngle += 360;
    }

    // Relative angle between launch and DI
    let rAngle = launchAngle - diAngle;
    if (rAngle > 180) rAngle -= 360;

    // Perpendicular distance
    const magnitude = Math.sqrt(x * x + y * y);
    const pDistance = Math.sin(rAngle * DEG2RAD) * magnitude;

    // Angle offset: p² * 18, capped at 18
    let angleOffset = pDistance * pDistance * 18;
    if (angleOffset > 18) angleOffset = 18;
    if (rAngle < 0 && rAngle > -180) angleOffset *= -1;

    let modified = launchAngle - angleOffset;
    if (modified < 0.01) modified = 0;

    return {
        baseAngle: launchAngle,
        diAngle,
        diModifiedAngle: Math.round(modified * 100000) / 100000,
    };
}

/**
 * Convenience wrapper: apply DI from a single angle (degrees) instead of x/y.
 * Converts angle to unit circle x/y components.
 */
export function applyDIFromAngle(launchAngle, diAngleDeg) {
    if (diAngleDeg == null || isNaN(diAngleDeg)) {
        return applyDI(launchAngle, null, null);
    }
    const rad = diAngleDeg * DEG2RAD;
    return applyDI(launchAngle, Math.cos(rad), Math.sin(rad));
}

/**
 * Calculate hitstun frames. Melee: floor(KB * 0.4)
 */
export function calcHitstun(kb) {
    return {
        hitstun: Math.floor(kb * 0.4),
        tumble: kb >= 80,
    };
}

/**
 * Calculate hitlag frames. floor(damage/3 + 3), electric *= 1.5, clamped [1, 20]
 */
export function calcHitlag(damage, electric = false) {
    let hitlag = Math.floor(damage / 3 + 3);
    if (electric) hitlag = Math.floor(hitlag * 1.5);
    return Math.max(1, Math.min(hitlag, 20));
}

/**
 * Calculate SDI/ASDI positional shift.
 * SDI: 6 units * stick, ASDI: 3 units * stick (half of SDI).
 * Deadzone: magnitude < 0.7 for SDI, < 0.2875 per axis.
 */
export function calcSDI(x, y, type = 's', grounded = false, kb = 0, trajectory = 0) {
    let sx = Math.abs(x) < 0.2875 ? 0 : x;
    let sy = Math.abs(y) < 0.2875 ? 0 : y;

    if ((sx * sx + sy * sy) < (0.7 * 0.7)) {
        return [0, 0];
    }

    let xDist = 6.0 * sx;
    let yDist = 6.0 * sy;

    if (type === 'a') {
        xDist *= 0.5;
        yDist *= 0.5;
    } else if (grounded && yDist < 0) {
        yDist = 0;
    }

    // Grounded low-KB: no vertical SDI
    if (grounded && ((kb < 80 && (trajectory === 0 || trajectory === 180)) || (kb < 32.1 && trajectory === 361))) {
        yDist = 0;
    }

    return [xDist, yDist];
}

/**
 * Simulate trajectory frame-by-frame — exact IKneeData physics.
 *
 * Key differences from naive implementation:
 * - Knockback decay is split into h/v components: 0.051*cos(angle) and 0.051*sin(angle)
 * - H and V knockback velocities decay independently toward zero
 * - Gravity accumulates until terminal velocity frame, then a remainder frame, then stops
 * - Ground-down hits (angle > 180, grounded) use traction for horizontal decay
 * - Ground-down "Fly" type multiplies vertical velocity by 0.8
 * - Low-KB grounded hits (angle 0/180, KB < 80) use traction decay, no vertical movement
 */
export function simulateTrajectory({
    kb, angle, startX, startY, charPhysics, blastZones,
    grounded = false, trajectory = null, // original trajectory before DI (for ground-down detection)
    sdiVector = [0, 0], asdiVector = [0, 0],
    maxFrames = 600, isThrow = false, releasePoint = null,
}) {
    const { gravity, terminalVelocity, traction } = charPhysics;
    const resolvedTrajectory = trajectory ?? angle;

    // Detect ground-down hit
    let groundDownHit = false;
    let groundDownType = null;
    if ((resolvedTrajectory > 180 && resolvedTrajectory !== 361) && grounded) {
        groundDownType = kb >= 80 ? 'Fly' : 'Stay';
        groundDownHit = true;
    }

    // Detect low-KB grounded hit (Sakurai 0/180)
    let reduceByTraction = false;
    if (grounded && (resolvedTrajectory === 0 || resolvedTrajectory === 180) && kb < 80) {
        reduceByTraction = true;
    }
    if (groundDownHit && groundDownType === 'Stay') {
        reduceByTraction = true;
    }

    // Initial velocities
    const initSpeed = kb * 0.03;
    let horVelKB = Math.round(initSpeed * Math.cos(angle * DEG2RAD) * 100000) / 100000;
    let verVelKB = Math.round(initSpeed * Math.sin(angle * DEG2RAD) * 100000) / 100000;

    // Ground-down adjustments
    if (reduceByTraction) verVelKB = 0;
    if (grounded && (resolvedTrajectory === 0 || resolvedTrajectory === 180) && kb < 80) verVelKB = 0;
    if (groundDownHit && groundDownType === 'Fly') {
        verVelKB = Math.abs(verVelKB) * 0.8;
    }
    if (groundDownHit && groundDownType === 'Stay') {
        verVelKB = 0;
    }

    // Decay rates (split h/v from IKneeData)
    const hDecay = Math.round(0.051 * Math.cos(angle * DEG2RAD) * 100000) / 100000;
    const vDecay = Math.round(0.051 * Math.sin(angle * DEG2RAD) * 100000) / 100000;

    // Gravity frames
    const gravityFrames = Math.floor(terminalVelocity / gravity);
    const lastGravityFrame = terminalVelocity % gravity;

    const hitstun = Math.floor(kb * 0.4);

    // Starting position
    let x = isThrow && releasePoint ? releasePoint[0] : startX;
    let y = isThrow && releasePoint ? releasePoint[1] : startY;
    let verVelChar = 0;

    const frames = [{ x, y }];
    let killed = false;
    let killFrame = null;
    let killZone = null;

    // Simulate through hitstun + post-hitstun decay
    const totalFrames = Math.min(maxFrames, hitstun + 200);

    for (let i = 0; i < totalFrames; i++) {
        // Decay knockback velocities
        if (reduceByTraction) {
            // Traction-based horizontal decay
            if (horVelKB > 0) {
                horVelKB -= traction;
                if (horVelKB < 0) horVelKB = 0;
            } else if (horVelKB < 0) {
                horVelKB += traction;
                if (horVelKB > 0) horVelKB = 0;
            }
        } else {
            // Normal KB decay (toward zero)
            if (horVelKB > 0) {
                horVelKB -= hDecay;
                if (horVelKB < 0) horVelKB = 0;
            } else if (horVelKB < 0) {
                horVelKB -= hDecay; // hDecay has sign from cos
                if (horVelKB > 0) horVelKB = 0;
            }

            if (verVelKB > 0) {
                verVelKB -= vDecay;
                if (verVelKB < 0) verVelKB = 0;
            } else if (verVelKB < 0) {
                verVelKB -= vDecay;
                if (verVelKB > 0) verVelKB = 0;
            }

            // Gravity accumulation (only for non-traction hits)
            if (i < gravityFrames) {
                verVelChar -= gravity;
            } else if (i === gravityFrames) {
                verVelChar -= lastGravityFrame;
            }
        }

        x += horVelKB;
        y += verVelChar + verVelKB;

        // Apply SDI/ASDI on first frame
        if (i === 0 && !isThrow) {
            x += sdiVector[0] + asdiVector[0];
            y += sdiVector[1] + asdiVector[1];
        } else if (i === 0 && isThrow) {
            x += asdiVector[0];
            y += asdiVector[1];
        }

        frames.push({
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
        });

        // Blast zone checks
        if (blastZones) {
            if (x <= blastZones.left)  { killed = true; killFrame = i + 1; killZone = 'left'; break; }
            if (x >= blastZones.right) { killed = true; killFrame = i + 1; killZone = 'right'; break; }
            if (y >= blastZones.top)   { killed = true; killFrame = i + 1; killZone = 'top'; break; }
            if (y <= blastZones.bottom){ killed = true; killFrame = i + 1; killZone = 'bottom'; break; }
        }

        // Stop if KB is done and character is grounded
        if (Math.abs(horVelKB) < 0.001 && Math.abs(verVelKB) < 0.001 && y <= 0) {
            y = 0;
            break;
        }
    }

    return {
        frames,
        killed,
        killFrame,
        killZone,
        finalX: Math.round(x * 100) / 100,
        finalY: Math.round(y * 100) / 100,
    };
}

/**
 * Find kill percent via binary search.
 */
export function findKillPercent({
    damage, kbg, bkb, setKb = 0, angle, defenderCharId, stageKey,
    startX = 0, startY = 0, diAngle = null, crouchCancel = false,
    reverse = false, stalenessQueue = [],
}) {
    const physics = CHAR_PHYSICS[defenderCharId];
    const stage = STAGES[stageKey];
    if (!physics || !stage) return { killPercent: null, noDI: null, survivalDI: null };

    const grounded = startY <= 0;

    const doesKill = (percent, diDeg) => {
        const kb = calcKnockback({
            damage, percent, weight: physics.weight, kbg, bkb, setKb,
            crouchCancel, stalenessQueue,
        });
        const resolvedAngle = resolveSakuraiAngle(angle, kb, grounded, reverse);

        let finalAngle;
        if (diDeg != null) {
            const diResult = applyDIFromAngle(resolvedAngle, diDeg);
            finalAngle = diResult.diModifiedAngle;
        } else {
            finalAngle = resolvedAngle;
        }

        const result = simulateTrajectory({
            kb, angle: finalAngle, startX, startY,
            charPhysics: physics, blastZones: stage.blastZones,
            grounded, trajectory: resolvedAngle,
        });
        return result.killed;
    };

    const binarySearch = (di) => {
        if (!doesKill(999, di)) return null;
        if (doesKill(0, di)) return 0;
        let lo = 0, hi = 999;
        while (hi - lo > 1) {
            const mid = Math.floor((lo + hi) / 2);
            if (doesKill(mid, di)) hi = mid;
            else lo = mid;
        }
        return doesKill(hi, di) ? hi : null;
    };

    if (diAngle != null) {
        return { killPercent: binarySearch(diAngle), noDI: null, survivalDI: null };
    }

    const noDI = binarySearch(null);

    // Optimal survival DI: try perpendicular to launch in both directions
    const testKb = calcKnockback({ damage, percent: 80, weight: physics.weight, kbg, bkb, setKb, crouchCancel });
    const testAngle = resolveSakuraiAngle(angle, testKb, grounded, reverse);
    const diUp = binarySearch(testAngle + 90);
    const diDown = binarySearch(testAngle - 90);

    let survivalDI;
    if (diUp == null && diDown == null) survivalDI = null;
    else if (diUp == null) survivalDI = diUp;
    else if (diDown == null) survivalDI = diDown;
    else survivalDI = Math.max(diUp, diDown);

    return { killPercent: noDI, noDI, survivalDI };
}

/**
 * Calculate shield stun. Melee: floor((damage + 4.45) / 2.235)
 */
export function calcShieldStun(damage) {
    return Math.floor((damage + 4.45) / 2.235);
}

/**
 * Calculate shield advantage.
 */
export function calcShieldAdvantage(shieldStun, endlag) {
    const advantage = shieldStun - endlag;
    return { advantage, safe: advantage >= 0 };
}

/**
 * Assess combo viability.
 */
export function assessCombo(hitstun, attackerEndlag) {
    const frameAdvantage = hitstun - attackerEndlag;
    return { frameAdvantage, isCombo: frameAdvantage > 0 };
}

/**
 * Full calculation: given move data and context, compute everything.
 */
export function fullCalc(params) {
    const {
        damage, angle, kbg, bkb, setKb = 0,
        percent, defenderCharId,
        stageKey = 'final_destination',
        startX = 0, startY = 0,
        diAngle = null,
        crouchCancel = false,
        chargeInterrupt = false,
        vcancel = false,
        metal = false,
        ice = false,
        nana = false,
        yoshiDJArmor = false,
        stalenessQueue = [],
        attackerEndlag = null,
        reverse = false,
        isThrow = false,
    } = params;

    const physics = CHAR_PHYSICS[defenderCharId];
    if (!physics) return null;

    const grounded = startY <= 0;

    const kb = calcKnockback({
        damage, percent, weight: physics.weight, kbg, bkb, setKb,
        crouchCancel, chargeInterrupt, vcancel, metal, ice, nana, yoshiDJArmor,
        stalenessQueue, isThrow,
    });

    const resolvedAngle = resolveSakuraiAngle(angle, kb, grounded, reverse);

    let di;
    if (diAngle != null) {
        di = applyDIFromAngle(resolvedAngle, diAngle);
    } else {
        di = { baseAngle: resolvedAngle, diAngle: null, diModifiedAngle: resolvedAngle };
    }

    const { hitstun, tumble } = calcHitstun(kb);
    const hitlag = calcHitlag(damage);
    const shieldStun = calcShieldStun(damage);

    const stage = STAGES[stageKey];
    let trajectory = null;
    if (stage) {
        trajectory = simulateTrajectory({
            kb,
            angle: di.diModifiedAngle,
            startX, startY,
            charPhysics: physics,
            blastZones: stage.blastZones,
            grounded,
            trajectory: resolvedAngle,
            isThrow,
        });
    }

    let shieldAdvantage = null;
    let combo = null;
    if (attackerEndlag != null) {
        shieldAdvantage = calcShieldAdvantage(shieldStun, attackerEndlag);
        combo = assessCombo(hitstun, attackerEndlag);
    }

    return {
        knockback: Math.round(kb * 100) / 100,
        hitstun,
        tumble,
        hitlag,
        launchSpeed: Math.round(kb * 0.03 * 1000) / 1000,
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
 */
export async function calcFromReplay(frameData) {
    const { attackerCharId, actionState, defenderCharId, defenderPercent, stageKey = 'final_destination', startX = 0, startY = 0 } = frameData;

    await fc.getMoves(attackerCharId);
    const moveData = fc.getFrameDataForAction(attackerCharId, actionState);
    if (!moveData || !moveData.hits || !moveData.hits.length) return null;

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
        startX, startY,
    });

    return {
        moveName: moveData.name,
        normalizedName: moveData.normalizedName,
        hitbox: bestHb,
        ...result,
    };
}
