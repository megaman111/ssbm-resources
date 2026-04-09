/**
 * HitboxRenderer - Draws hitbox circles and hurtbox outlines on the
 * replay viewer canvas. Provides hit-testing for hover tooltips.
 */

// Trail buffer: stores last N frames of hitbox world positions per player
const _trailBuffer = new Map(); // key: "playerKey_hitboxId" -> [{worldX, worldY, radius, colorIdx}]
const TRAIL_LENGTH = 4;
const TRAIL_OPACITIES = [0.15, 0.10, 0.07, 0.04];

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
    // Rotate hitbox offset by bone's local Z-axis direction
    const zdx = bone.zDirX ?? 1;
    const zdy = bone.zDirY ?? 0;
    // Normalize direction vector (may have scale baked in)
    const len = Math.sqrt(zdx * zdx + zdy * zdy) || 1;
    const ndx = zdx / len;
    const ndy = zdy / len;
    // Z offset along bone's forward, Y offset perpendicular (rotated 90° CCW)
    const offX = hitbox.z * ndx + hitbox.y * (-ndy);
    const offY = hitbox.z * ndy + hitbox.y * ndx;
    // Bone position is already in character-local world space (Y=0 at feet)
    // The SVG silhouette is centered at gameY (body center ≈ 3.5 units above feet)
    // so we subtract the offset to align hitboxes with the silhouette
    const SILHOUETTE_Y_OFFSET = 3.5;
    const localX = (bone.x + offX) * scale;
    const localY = (bone.y + offY - SILHOUETTE_Y_OFFSET) * scale;
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
 * Draw active hitbox circles for the current frame, with optional fading trail.
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
 * @param {string} [playerKey] - Unique key per player for trail tracking (e.g. player index)
 */
function renderHitboxes(ctx, charData, subactionId, animFrame, bonePositions,
                        charX, charY, facing, canvasScale, toCanvasX, toCanvasY,
                        playerKey) {
    const scale = charData.scale ?? 1;
    const activeHitboxes = getActiveHitboxes(charData, subactionId, animFrame);

    // When no hitboxes are active, clear trail entries for this player so
    // trails don't persist across non-attack frames
    if (activeHitboxes.length === 0) {
        if (playerKey != null) {
            for (const [key] of _trailBuffer) {
                if (key.startsWith(playerKey + '_')) _trailBuffer.delete(key);
            }
        }
        return;
    }

    ctx.save();
    for (const hitbox of activeHitboxes) {
        const { worldX, worldY, radius } = resolveHitboxWorld(
            hitbox, bonePositions, charX, charY, facing, scale
        );
        const colorIdx = Math.min(hitbox.id, HITBOX_FILL_COLORS.length - 1);

        // --- Trail: store position and draw previous positions ---
        if (playerKey != null) {
            const trailKey = playerKey + '_' + hitbox.id;
            if (!_trailBuffer.has(trailKey)) _trailBuffer.set(trailKey, []);
            const buf = _trailBuffer.get(trailKey);

            // Draw trail circles (oldest first = most transparent)
            renderHitboxTrail(ctx, buf, canvasScale, toCanvasX, toCanvasY);

            // Push current position into buffer
            buf.push({ worldX, worldY, radius, colorIdx });
            if (buf.length > TRAIL_LENGTH) buf.shift();
        }

        // --- Draw current-frame hitbox on top ---
        const cx = toCanvasX(worldX);
        const cy = toCanvasY(worldY);
        const cr = radius * canvasScale;

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
 * Draw faded previous-frame hitbox positions from the trail buffer.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{worldX:number, worldY:number, radius:number, colorIdx:number}>} trailEntries
 * @param {number} canvasScale
 * @param {function} toCanvasX
 * @param {function} toCanvasY
 */
function renderHitboxTrail(ctx, trailEntries, canvasScale, toCanvasX, toCanvasY) {
    if (!trailEntries.length) return;
    // Draw oldest first (most transparent) → newest last (least transparent)
    // Opacity index: oldest entry gets the highest index (most transparent)
    const count = trailEntries.length;
    for (let i = 0; i < count; i++) {
        const entry = trailEntries[i];
        // Oldest entry (i=0) should be most transparent
        // opacityIdx: count-1 for i=0 (oldest), 0 for i=count-1 (newest)
        const opacityIdx = count - 1 - i;
        const opacity = TRAIL_OPACITIES[Math.min(opacityIdx, TRAIL_OPACITIES.length - 1)];

        const cx = toCanvasX(entry.worldX);
        const cy = toCanvasY(entry.worldY);
        const cr = entry.radius * canvasScale;
        const colorIdx = entry.colorIdx;

        // Extract RGB from stroke color and draw with trail opacity
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = HITBOX_STROKE_COLORS[colorIdx].replace(/[\d.]+\)$/, opacity + ')');
        ctx.fill();
    }
}

/**
 * Clear the trail buffer. Call when seeking or loading a new replay.
 */
function clearTrail() {
    _trailBuffer.clear();
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
        const len = Math.sqrt(zdx * zdx + zdy * zdy) || 1;
        const ndx = zdx / len;
        const ndy = zdy / len;
        const offX = hurtbox.z * ndx + hurtbox.y * (-ndy);
        const offY = hurtbox.z * ndy + hurtbox.y * ndx;
        const localX = (bone.x + offX) * scale;
        const localY = (bone.y + offY - 3.5) * scale;
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

const HitboxRenderer = { renderHitboxes, renderHurtboxes, getHitboxAtPoint, clearTrail };
export default HitboxRenderer;
