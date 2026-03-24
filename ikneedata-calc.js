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

// ===== Stage data: blast zones, edges, and platforms from IKneeData source =====
// Blast zones from calculatorresize.js: bz[id] = [top, right, bottom, left]
// Surfaces from calculator.js: surfaces[id] = [[[leftX,leftY],[rightX,rightY]], ...]
// Polygon body shapes from slippi-visualiser vs-stages (Y negated: visualiser uses -Y for below ground)
export const STAGES = {
    battlefield: {
        name: 'Battlefield',
        blastZones: { left: -224, right: 224, top: 200, bottom: -108.8 },
        edge: 68.4, groundY: 0,
        platforms: [
            { y: 27.2, left: -57.6, right: -20 },
            { y: 27.2, left: 20, right: 57.6 },
            { y: 54.4, left: -18.8, right: 18.8 },
        ],
        polygon: [
            [-68.4,0],[68.4,0],[65,-6],[36,-19],[39,-21],[33,-25],[30,-29],[29,-35],
            [10,-40],[10,-30],[-10,-30],[-10,-40],[-29,-35],[-30,-29],[-33,-25],[-39,-21],
            [-36,-19],[-65,-6],
        ],
    },
    final_destination: {
        name: 'Final Destination',
        blastZones: { left: -246, right: 246, top: 188, bottom: -140 },
        edge: 85.5657, groundY: 0, platforms: [],
        polygon: [
            [-85.6,0],[85.6,0],[85.6,-10],[65,-20],[65,-30],[60,-47],[50,-55],[45,-56],
            [-45,-56],[-50,-55],[-60,-47],[-65,-30],[-65,-20],[-85.6,-10],
        ],
    },
    dreamland: {
        name: 'Dreamland',
        blastZones: { left: -255, right: 255, top: 250, bottom: -123 },
        edge: 77.2713, groundY: 0,
        platforms: [
            { y: 30.1422, left: -61.3929, right: -31.7254 },
            { y: 30.2426, left: 31.7036, right: 63.0745 },
            { y: 51.4254, left: -19.0181, right: 19.0171 },
        ],
        polygon: [
            [-77.25,0],[77.25,0],[76.5,-11],[65.75,-36],[-65.75,-36],[-76.5,-11],
        ],
    },
    fountain_of_dreams: {
        name: 'Fountain of Dreams',
        blastZones: { left: -198.75, right: 198.75, top: 202.5, bottom: -146.25 },
        edge: 63.34755, groundY: 0,
        platforms: [
            { y: 42.75, left: -14.25, right: 14.25 },
            { y: 22.125, left: 21, right: 49.5, movable: true, label: 'Right', defaultY: 22.125 },
            { y: 16.125, left: -49.5, right: -21, movable: true, label: 'Left', defaultY: 16.125 },
        ],
        polygon: [
            [-63.35,0.62],[-53.5,0.62],[-51.25,0],[51.25,0],[53.5,0.62],[63.35,0.62],
            [63.35,-4.5],[59.33,-15],[56.9,-19.5],[55,-27],[52,-32],[48,-38],[41,-42],
            [19,-49.5],[13,-54.5],[10,-62],[8.8,-72],[8.8,-100],[-8.8,-100],
            [-8.8,-72],[-10,-62],[-13,-54.5],[-19,-49.5],[-41,-42],[-48,-38],[-52,-32],
            [-55,-27],[-56.9,-19.5],[-59.33,-15],[-63.35,-4.5],
        ],
    },
    yoshis_story: {
        name: "Yoshi's Story",
        blastZones: { left: -175.7, right: 173.6, top: 168, bottom: -91 },
        edge: 56, groundY: 0,
        platforms: [
            { y: 23.45, left: -59.5, right: -28 },
            { y: 23.45, left: 28, right: 59.5 },
            { y: 42, left: -15.75, right: 15.75 },
        ],
        polygon: [
            [-56,-3.5],[-39,0],[39,0],[56,-3.5],[56,-7],[55,-8],[54,-11],[53,-12],[53,-27],
            [54,-28],[54,-30],[53,-31],[53,-46],[54,-47],[54,-100],[-54,-100],[-54,-47],
            [-53,-46],[-53,-31],[-54,-30],[-54,-28],[-53,-27],[-53,-12],[-54,-11],[-55,-8],
            [-56,-7],
        ],
    },
    pokemon_stadium: {
        name: 'Pokemon Stadium',
        blastZones: { left: -230, right: 230, top: 180, bottom: -111 },
        edge: 87.75, groundY: 0,
        platforms: [
            { y: 25, left: -55, right: -25 },
            { y: 25, left: 25, right: 55 },
        ],
        polygon: [
            [-87.75,0],[87.75,0],[87.75,-4],[73.75,-15],[73.75,-17.75],[60,-17.75],[60,-38],
            [15,-60],[15,-112],[-15,-112],[-15,-60],[-60,-38],[-60,-17.75],[-73.75,-17.75],
            [-73.75,-15],[-87.75,-4],
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
    stalenessQueue = [], isThrow = false, grabDamageMult = 1,
}) {
    const damageUnstaled = damage;
    const damageStaled = applyStaleness(damage, stalenessQueue) * grabDamageMult;

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
    grounded = false, trajectory = null,
    sdiVector = [0, 0], asdiVector = [0, 0],
    maxFrames = 600, isThrow = false, releasePoint = null,
    icg = false, fadeIn = true, doubleJump = false, meteorCancelled = false,
}) {
    const { gravity, terminalVelocity, traction, driftAcc, driftMax, airFriction } = charPhysics;
    const resolvedTrajectory = trajectory ?? angle;

    // Detect ground-down hit (IKneeData: checked inside getKnockback using original trajectory)
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

    // Initial velocities — computed from DI-modified angle
    const initSpeed = kb * 0.03;
    let horVelKB = Math.round(initSpeed * Math.cos(angle * DEG2RAD) * 100000) / 100000;
    let verVelKB = Math.round(initSpeed * Math.sin(angle * DEG2RAD) * 100000) / 100000;

    // ICG: zero out vertical KB velocity
    if (icg) verVelKB = 0;

    // Low-KB grounded: zero vertical (IKneeData: getVerticalVelocity)
    if (grounded && (resolvedTrajectory === 0 || resolvedTrajectory === 180) && kb < 80) {
        verVelKB = 0;
    }

    // Ground-down Fly: multiply vertical by 0.8 and make absolute (IKneeData: getVerticalVelocity)
    if (groundDownHit && groundDownType === 'Fly') {
        verVelKB = Math.abs(verVelKB) * 0.8;
    }

    // IKneeData: angle = getNewAngle(horizontalVelocity, verticalVelocity)
    // Recalculate angle from actual velocity components (matters for ground-bounce)
    let effectiveAngle = angle;
    if (Math.abs(horVelKB) > 0.00001 || Math.abs(verVelKB) > 0.00001) {
        let a = Math.atan(Math.abs(verVelKB) / Math.abs(horVelKB)) * (180 / Math.PI);
        if (verVelKB < 0) {
            a = horVelKB >= 0 ? 360 - a : 180 + a;
        } else if (horVelKB < 0) {
            a = 180 - a;
        }
        effectiveAngle = a;
    }

    // Decay rates from the recalculated angle (IKneeData: getHorizontalDecay/getVerticalDecay use angle after getNewAngle)
    let hDecay = Math.round(0.051 * Math.cos(effectiveAngle * DEG2RAD) * 100000) / 100000;
    let vDecay = Math.round(0.051 * Math.sin(effectiveAngle * DEG2RAD) * 100000) / 100000;

    // Ground-down adjustments applied in knockbackTravel setup
    if (groundDownHit) {
        if (groundDownType === 'Stay') {
            verVelKB = 0;
        } else {
            // Fly: verVelKB already abs'd and 0.8'd above; make vDecay absolute too
            verVelKB = Math.abs(verVelKB);
            vDecay = Math.abs(vDecay);
        }
    }

    // Gravity frames
    const gravityFrames = Math.floor(terminalVelocity / gravity);
    const lastGravityFrame = terminalVelocity % gravity;

    let hitstun = Math.floor(kb * 0.4);

    // Meteor cancel: limit hitstun to 8 (IKneeData: done in knockbackTravel setup)
    if (resolvedTrajectory >= 260 && resolvedTrajectory <= 280 && meteorCancelled && !icg) {
        hitstun = 8;
    }

    // Starting position
    let x = isThrow && releasePoint ? releasePoint[0] : startX;
    let y = isThrow && releasePoint ? releasePoint[1] : startY;
    let verVelChar = 0;
    let horVelChar = 0;

    const frames = [{ x, y }];
    let killed = false;
    let killFrame = null;
    let killZone = null;
    let stayGrounded = false;

    // Helper: check blast zones
    const checkKill = (frameNum) => {
        if (!blastZones) return false;
        if (x <= blastZones.left)  { killed = true; killFrame = frameNum; killZone = 'left'; return true; }
        if (x >= blastZones.right) { killed = true; killFrame = frameNum; killZone = 'right'; return true; }
        if (y >= blastZones.top)   { killed = true; killFrame = frameNum; killZone = 'top'; return true; }
        if (y <= blastZones.bottom){ killed = true; killFrame = frameNum; killZone = 'bottom'; return true; }
        return false;
    };

    // ===== PHASE 1: Hitstun frames (exact IKneeData hitstun loop) =====
    let i = 0;
    for (i = 0; i < hitstun; i++) {
        // Decay KB velocities
        if (reduceByTraction) {
            if (horVelKB > 0) { horVelKB -= traction; if (horVelKB < 0) horVelKB = 0; }
            else if (horVelKB < 0) { horVelKB += traction; if (horVelKB > 0) horVelKB = 0; }
        } else {
            if (horVelKB > 0) { horVelKB -= hDecay; if (horVelKB < 0) horVelKB = 0; }
            else if (horVelKB < 0) { horVelKB -= hDecay; if (horVelKB > 0) horVelKB = 0; }

            if (verVelKB > 0) { verVelKB -= vDecay; if (verVelKB < 0) verVelKB = 0; }
            else if (verVelKB < 0) { verVelKB -= vDecay; if (verVelKB > 0) verVelKB = 0; }

            // Gravity (only for non-traction, during hitstun)
            if (i < gravityFrames) verVelChar -= gravity;
            else if (i === gravityFrames) verVelChar -= lastGravityFrame;
        }

        // Position update
        x += horVelChar + horVelKB;
        y += verVelChar + verVelKB;

        // SDI/ASDI on first frame
        if (i === 0) {
            if (isThrow) {
                x += asdiVector[0];
                y += asdiVector[1];
            } else {
                x += sdiVector[0] + asdiVector[0];
                y += sdiVector[1] + asdiVector[1];
                // Check if ASDI keeps character grounded (stayGrounded)
                if (asdiVector[1] < 0 && grounded && (verVelChar + verVelKB + asdiVector[1] + sdiVector[1] < 0)) {
                    stayGrounded = true;
                    break;
                }
            }
        }

        frames.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
        if (checkKill(i + 1)) break;
    }

    // ===== PHASE 2: Post-hitstun (IKneeData: separate while loop) =====
    let hasDoubleJumped = false;
    let extendedDisplay = 0;
    if (!killed && !stayGrounded) {
        while ((Math.abs(horVelKB) > 0.001 || Math.abs(verVelKB) > 0.001 || (meteorCancelled && extendedDisplay < 25)) && frames.length < maxFrames) {
            // Decay KB velocities
            if (reduceByTraction) {
                if (horVelKB > 0) { horVelKB -= traction; if (horVelKB < 0) horVelKB = 0; }
                else if (horVelKB < 0) { horVelKB += traction; if (horVelKB > 0) horVelKB = 0; }
            } else {
                if (horVelKB > 0) { horVelKB -= hDecay; if (horVelKB < 0) horVelKB = 0; }
                else if (horVelKB < 0) { horVelKB -= hDecay; if (horVelKB > 0) horVelKB = 0; }

                if (verVelKB > 0) { verVelKB -= vDecay; if (verVelKB < 0) verVelKB = 0; }
                else if (verVelKB < 0) { verVelKB -= vDecay; if (verVelKB > 0) verVelKB = 0; }

                // Gravity continues with same i counter
                if (i < gravityFrames) verVelChar -= gravity;
                else if (i === gravityFrames) verVelChar -= lastGravityFrame;

                // Meteor cancel: zero KB after decay
                if (meteorCancelled) {
                    horVelKB = 0;
                    verVelKB = 0;
                    extendedDisplay++;
                }

                // Double jump
                if (doubleJump && !hasDoubleJumped) {
                    // IKneeData uses character-specific djInitY; we approximate
                    verVelChar = charPhysics.djInitY ?? (terminalVelocity * 1.2);
                    if (fadeIn) {
                        horVelChar = x > 0 ? -(charPhysics.djInitX ?? driftMax) : (charPhysics.djInitX ?? driftMax);
                    }
                    hasDoubleJumped = true;
                }

                if (hasDoubleJumped) {
                    verVelChar -= gravity;
                    if (verVelChar < -terminalVelocity) verVelChar = -terminalVelocity;
                }

                // Fade in: drift toward center
                if (fadeIn) {
                    if (x > 0) {
                        if (horVelChar < -driftMax) {
                            horVelChar += airFriction;
                            if (horVelChar > -driftMax) horVelChar = -driftMax;
                        } else {
                            horVelChar -= driftAcc;
                            if (horVelChar < -driftMax) horVelChar = -driftMax;
                        }
                    } else if (x < 0) {
                        if (horVelChar > driftMax) {
                            horVelChar -= airFriction;
                            if (horVelChar < driftMax) horVelChar = driftMax;
                        } else {
                            horVelChar += driftAcc;
                            if (horVelChar > driftMax) horVelChar = driftMax;
                        }
                    }
                }
            }

            i++;
            x += horVelChar + horVelKB;
            y += verVelChar + verVelKB;

            frames.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
            if (checkKill(frames.length)) break;

            // Stop if grounded and no more movement
            if (y <= 0 && Math.abs(horVelKB) < 0.001 && Math.abs(verVelKB) < 0.001) {
                y = 0;
                break;
            }
        }
    }

    return {
        frames,
        killed,
        killFrame,
        killZone,
        finalX: Math.round(x * 100) / 100,
        finalY: Math.round(y * 100) / 100,
        stayGrounded,
    };
}

/**
 * Find kill percent via binary search.
 */
export function findKillPercent({
    damage, kbg, bkb, setKb = 0, angle, defenderCharId, stageKey,
    startX = 0, startY = 0, diAngle = null, crouchCancel = false,
    reverse = false, stalenessQueue = [], chargeFrames = 0,
    grabInterrupt = false, vcancel = false, chargeInterrupt = false,
    metal = false, ice = false, yoshiDJArmor = false,
}) {
    const physics = CHAR_PHYSICS[defenderCharId];
    const stage = STAGES[stageKey];
    if (!physics || !stage) return { killPercent: null, noDI: null, survivalDI: null };

    const grounded = startY <= 0;

    // Apply smash charge to damage
    let effectiveDamage = damage;
    if (chargeFrames > 0) {
        effectiveDamage = damage * (1 + (chargeFrames * (0.3671 / 60)));
    }
    const grabDamageMult = grabInterrupt ? 0.5 : 1;

    const doesKill = (percent, diDeg) => {
        const kb = calcKnockback({
            damage: effectiveDamage, percent, weight: physics.weight, kbg, bkb, setKb,
            crouchCancel, stalenessQueue, vcancel, chargeInterrupt, metal, ice,
            yoshiDJArmor, grabDamageMult,
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
    const testKb = calcKnockback({ damage: effectiveDamage, percent: 80, weight: physics.weight, kbg, bkb, setKb, crouchCancel, grabDamageMult });
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
 * Calculate shield stun. IKneeData formula: floor(floor(staledDmg) * 0.45 + 2) * 200/201)
 * Falls back to approximate if no staled damage provided.
 */
export function calcShieldStun(damage, staledDamage = null) {
    const d = staledDamage != null ? staledDamage : damage;
    return Math.floor((Math.floor(d) * 0.45 + 2) * 200 / 201);
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
        diX = null, diY = null, // raw stick x/y for DI (preferred over diAngle)
        sdi1X = 0, sdi1Y = 0,
        sdi2X = 0, sdi2Y = 0,
        asdiX = 0, asdiY = 0,
        crouchCancel = false,
        chargeInterrupt = false,
        vcancel = false,
        metal = false,
        ice = false,
        nana = false,
        grabInterrupt = false,
        yoshiDJArmor = false,
        stalenessQueue = [],
        chargeFrames = 0,
        attackerEndlag = null,
        reverse = false,
        isThrow = false,
        meteorCancel = false,
        icg = false,
        fadeIn = true,
        doubleJump = false,
    } = params;

    const physics = CHAR_PHYSICS[defenderCharId];
    if (!physics) return null;

    const grounded = startY <= 0;

    // Apply smash charge damage boost: damage *= 1 + (chargeFrames * 0.3671/60)
    let effectiveDamage = damage;
    if (chargeFrames > 0) {
        effectiveDamage = damage * (1 + (chargeFrames * (0.3671 / 60)));
    }

    // Apply grab interrupt: halves staled damage (applied to damage before KB calc)
    // In IKneeData, grabInterrupt halves the staled damage, not the KB
    let grabDamageMult = grabInterrupt ? 0.5 : 1;

    const kb = calcKnockback({
        damage: effectiveDamage, percent, weight: physics.weight, kbg, bkb, setKb,
        crouchCancel, chargeInterrupt, vcancel, metal, ice, nana, yoshiDJArmor,
        stalenessQueue, isThrow, grabDamageMult,
    });

    const resolvedAngle = resolveSakuraiAngle(angle, kb, grounded, reverse);

    // Apply DI: prefer raw x/y stick coords, fall back to angle
    // IKneeData: DI is deadzone'd (ignored) for low-KB grounded hits (traj 0/180, KB < 80)
    let di;
    const diDeadzone = kb < 80 && grounded && (resolvedAngle === 0 || resolvedAngle === 180);
    if (diDeadzone) {
        di = { baseAngle: resolvedAngle, diAngle: null, diModifiedAngle: resolvedAngle };
    } else if (diX != null && diY != null && (Math.abs(diX) > 0.01 || Math.abs(diY) > 0.01)) {
        di = applyDI(resolvedAngle, diX, diY);
    } else if (diAngle != null) {
        di = applyDIFromAngle(resolvedAngle, diAngle);
    } else {
        di = { baseAngle: resolvedAngle, diAngle: null, diModifiedAngle: resolvedAngle };
    }

    let { hitstun, tumble } = calcHitstun(kb);

    // Meteor cancel: limit hitstun to 8 frames for angles 260-280°
    let meteorCancelled = false;
    if (meteorCancel && resolvedAngle >= 260 && resolvedAngle <= 280 && !icg) {
        hitstun = 8;
        meteorCancelled = true;
    }

    const hitlag = calcHitlag(effectiveDamage);
    const staledDmg = applyStaleness(effectiveDamage, stalenessQueue) * grabDamageMult;
    const shieldStun = Math.floor((Math.floor(staledDmg) * 0.45 + 2) * 200 / 201);

    // Calculate SDI/ASDI vectors
    const sdiVec1 = calcSDI(sdi1X, sdi1Y, 's', grounded, kb, resolvedAngle);
    const sdiVec2 = calcSDI(sdi2X, sdi2Y, 's', grounded, kb, resolvedAngle);
    const asdiVec = calcSDI(asdiX, asdiY, 'a', grounded, kb, resolvedAngle);
    // Combined SDI = sdi1 + sdi2, ASDI separate
    const sdiVector = [sdiVec1[0] + sdiVec2[0], sdiVec1[1] + sdiVec2[1]];

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
            sdiVector,
            asdiVector: asdiVec,
            isThrow,
            icg,
            fadeIn,
            doubleJump,
            meteorCancelled,
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
        staledDamage: Math.round(staledDmg * 100) / 100,
        meteorCancelled,
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
