/**
 * HitboxRenderer - Draws hitbox circles and hurtbox outlines on the
 * replay viewer canvas. Provides hit-testing for hover tooltips.
 */

/** Fill colors per hitbox ID (semi-transparent) */
const HITBOX_FILL_COLORS = [
    'rgba(255,0,0,0.4)',     // ID 0: red
    'rgba(255,165,0,0.4)',   // ID 1: orange
    'rgba(255,255,0,0.4)',   // ID 2: yellow
    'rgba(0,255,0,0.4)',     // ID 3: green
];

/** Stroke colors per hitbox ID (full opacity) */
const HITBOX_STROKE_COLORS = [
    'rgba(255,0,0,1)',
    'rgba(255,165,0,1)',
    'rgba(255,255,0,1)',
    'rgba(0,255,0,1)',
];

/** Hurtbox outline colors */
const HURTBOX_VULNERABLE_COLOR = 'rgba(255,255,0,0.6)';
const HURTBOX_INVINCIBLE_COLOR = 'rgba(0,100,255,0.6)';

/**
 * Resolve a hitbox's world position given bone positions, character
 * position, facing direction, and scale.
 *
 * @param {object} hitbox - Hitbox data from character JSON
 * @param {Map<number,{x:number,y:number}>} bonePositions - Resolved bone positions
 * @param {number} charX - Character world X
 * @param {number} charY - Character world Y
 * @param {number} facing - 1 (right) or -1 (left)
 * @param {number} scale - Character scale factor
 * @returns {{worldX:number, worldY:number, radius:number}}
 */
function resolveHitboxWorld(hitbox, bonePositions, charX, charY, facing, scale) {
    const bone = bonePositions.get(hitbox.bone) ?? { x: 0, y: 0, zDirX: 1, zDirY: 0 };
    // Use bone's Z-axis direction to rotate the hitbox offset
    const zdx = bone.zDirX ?? 1;
    const zdy = bone.zDirY ?? 0;
    // Z offset goes along bone's forward axis, Y offset perpendicular
    const localX = (bone.x + hitbox.z * zdx + hitbox.y * (-zdy)) * scale;
    const localY = (bone.y + hitbox.z * zdy + hitbox.y * zdx) * scale;
    const worldX = charX + localX * facing;
    const worldY = charY + localY;
    const radius = hitbox.size * scale;
    return { worldX, worldY, radius };
}

/**
 * Get active hitboxes for a given subaction and frame.
 *
 * @param {object} charData - Parsed character JSON
 * @param {number|string} subactionId - Subaction ID
 * @param {number} animFrame - Current animation frame
 * @returns {object[]} Array of active hitbox objects
 */
function getActiveHitboxes(charData, subactionId, animFrame) {
    const subaction = charData.subactions?.[String(subactionId)];
    if (!subaction?.hitboxes) return [];
    return subaction.hitboxes.filter(
        hb => animFrame >= hb.startFrame && animFrame <= hb.endFrame
    );
}

/**
 * Draw active hitbox circles for the current frame.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} charData - Parsed character JSON
 * @param {number|string} subactionId - Subaction ID
 * @param {number} animFrame - Current animation frame
 * @param {Map<number,{x:number,y:number}>} bonePositions - Resolved bone positions
 * @param {number} charX - Character world X position
 * @param {number} charY - Character world Y position
 * @param {number} facing - 1 (right) or -1 (left)
 * @param {number} canvasScale - Canvas scale factor
 * @param {function} toCanvasX - Converts game X → canvas X
 * @param {function} toCanvasY - Converts game Y → canvas Y
 */
function renderHitboxes(ctx, charData, subactionId, animFrame, bonePositions,
                        charX, charY, facing, canvasScale, toCanvasX, toCanvasY) {
    const scale = charData.scale ?? 1;
    const activeHitboxes = getActiveHitboxes(charData, subactionId, animFrame);
    if (activeHitboxes.length === 0) return;

    ctx.save();
    for (const hitbox of activeHitboxes) {
        const { worldX, worldY, radius } = resolveHitboxWorld(
            hitbox, bonePositions, charX, charY, facing, scale
        );

        const cx = toCanvasX(worldX);
        const cy = toCanvasY(worldY);
        const cr = radius * canvasScale;

        const colorIdx = Math.min(hitbox.id, HITBOX_FILL_COLORS.length - 1);

        // Filled circle
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = HITBOX_FILL_COLORS[colorIdx];
        ctx.fill();

        // Stroke outline
        ctx.strokeStyle = HITBOX_STROKE_COLORS[colorIdx];
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * Draw hurtbox outlines at bone positions.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} charData - Parsed character JSON
 * @param {Map<number,{x:number,y:number}>} bonePositions - Resolved bone positions
 * @param {number} charX - Character world X position
 * @param {number} charY - Character world Y position
 * @param {number} facing - 1 (right) or -1 (left)
 * @param {number} canvasScale - Canvas scale factor
 * @param {function} toCanvasX - Converts game X → canvas X
 * @param {function} toCanvasY - Converts game Y → canvas Y
 * @param {number} hurtboxState - 0 = vulnerable, non-zero = invincible/intangible
 */
function renderHurtboxes(ctx, charData, bonePositions, charX, charY, facing,
                         canvasScale, toCanvasX, toCanvasY, hurtboxState) {
    if (!charData.hurtboxes) return;
    const scale = charData.scale ?? 1;

    ctx.save();
    const color = hurtboxState === 0 ? HURTBOX_VULNERABLE_COLOR : HURTBOX_INVINCIBLE_COLOR;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    for (const hurtbox of charData.hurtboxes) {
        const bone = bonePositions.get(hurtbox.bone) ?? { x: 0, y: 0, zDirX: 1, zDirY: 0 };
        const zdx = bone.zDirX ?? 1;
        const zdy = bone.zDirY ?? 0;
        const localX = (bone.x + hurtbox.z * zdx + hurtbox.y * (-zdy)) * scale;
        const localY = (bone.y + hurtbox.z * zdy + hurtbox.y * zdx) * scale;
        const worldX = charX + localX * facing;
        const worldY = charY + localY;
        const radius = hurtbox.sizeX * scale;

        const cx = toCanvasX(worldX);
        const cy = toCanvasY(worldY);
        const cr = radius * canvasScale;

        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * Point-in-circle hit test for hover tooltip.
 * Returns the first active hitbox whose circle contains the given game-space point.
 *
 * @param {object} charData - Parsed character JSON
 * @param {number|string} subactionId - Subaction ID
 * @param {number} animFrame - Current animation frame
 * @param {Map<number,{x:number,y:number}>} bonePositions - Resolved bone positions
 * @param {number} charX - Character world X position
 * @param {number} charY - Character world Y position
 * @param {number} facing - 1 (right) or -1 (left)
 * @param {number} gameX - Test point X in game coordinates
 * @param {number} gameY - Test point Y in game coordinates
 * @returns {{damage:number, angle:number, kbg:number, bkb:number, setKb:number, element:number, id:number}|null}
 */
function getHitboxAtPoint(charData, subactionId, animFrame, bonePositions,
                          charX, charY, facing, gameX, gameY) {
    const scale = charData.scale ?? 1;
    const activeHitboxes = getActiveHitboxes(charData, subactionId, animFrame);

    for (const hitbox of activeHitboxes) {
        const { worldX, worldY, radius } = resolveHitboxWorld(
            hitbox, bonePositions, charX, charY, facing, scale
        );

        const dx = gameX - worldX;
        const dy = gameY - worldY;
        if (dx * dx + dy * dy <= radius * radius) {
            return {
                id: hitbox.id,
                damage: hitbox.damage,
                angle: hitbox.angle,
                kbg: hitbox.kbg,
                bkb: hitbox.bkb,
                setKb: hitbox.setKb,
                element: hitbox.element,
            };
        }
    }

    return null;
}

const HitboxRenderer = { renderHitboxes, renderHurtboxes, getHitboxAtPoint };
export default HitboxRenderer;
