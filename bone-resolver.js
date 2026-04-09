/**
 * BoneResolver - Resolves bone-relative positions to world coordinates
 * using pre-computed bone transforms from character JSON data.
 */

/**
 * Look up pre-computed bone positions for a subaction + frame.
 * Sparse keyframes are linearly interpolated. Falls back to rest-pose
 * positions when the subaction has no bone frame data.
 *
 * @param {object} charData - Parsed character JSON data
 * @param {number} subactionId - Subaction ID
 * @param {number} animFrame - Animation frame (may be fractional)
 * @returns {Map<number, {x: number, y: number}>} Bone positions in character-local game units
 */
function resolve(charData, subactionId, animFrame) {
    const subaction = charData.subactions?.[String(subactionId)];
    const boneFrames = subaction?.boneFrames;

    // If no bone frame data exists, fall back to rest-pose positions
    if (!boneFrames || Object.keys(boneFrames).length === 0) {
        return restPose(charData);
    }

    const frameKeys = Object.keys(boneFrames).map(Number).sort((a, b) => a - b);

    // Find surrounding keyframes via binary search
    const floorFrame = Math.floor(animFrame);
    let lo = 0;
    let hi = frameKeys.length - 1;

    // Binary search: find the largest keyframe <= floorFrame
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (frameKeys[mid] <= floorFrame) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }

    const kfA = frameKeys[lo];
    const kfB = (lo + 1 < frameKeys.length) ? frameKeys[lo + 1] : kfA;

    // Interpolation factor
    const t = (kfA === kfB) ? 0 : (animFrame - kfA) / (kfB - kfA);

    const posA = boneFrames[String(kfA)];
    const posB = boneFrames[String(kfB)];

    const result = new Map();
    const allBones = new Set([...Object.keys(posA), ...Object.keys(posB)]);

    for (const boneIdStr of allBones) {
        const a = posA[boneIdStr] ?? posB[boneIdStr];
        const b = posB[boneIdStr] ?? posA[boneIdStr];
        const hasDir = a.length >= 4 && b.length >= 4;
        result.set(Number(boneIdStr), {
            x: a[0] + (b[0] - a[0]) * t,
            y: a[1] + (b[1] - a[1]) * t,
            zDirX: hasDir ? a[2] + (b[2] - a[2]) * t : 1,
            zDirY: hasDir ? a[3] + (b[3] - a[3]) * t : 0,
        });
    }

    return result;
}

/**
 * Build a rest-pose position map from the character's bone tree.
 * Used as fallback when a subaction has no bone frame data.
 *
 * @param {object} charData - Parsed character JSON data
 * @returns {Map<number, {x: number, y: number}>}
 */
function restPose(charData) {
    const result = new Map();
    if (!charData.bones) return result;
    for (const bone of charData.bones) {
        result.set(bone.id, { x: bone.restX, y: bone.restY, zDirX: 1, zDirY: 0 });
    }
    return result;
}

/**
 * Project a 3D bone-local offset to 2D game coordinates.
 * Melee coordinate mapping: Z → game X (forward), Y → game Y (vertical),
 * X (lateral) is collapsed in the 2D side-view projection.
 *
 * @param {Map<number, {x: number, y: number}>} bonePositions - Resolved bone positions
 * @param {number} boneId - Bone to offset from
 * @param {number} offsetX - Lateral offset (collapsed in 2D)
 * @param {number} offsetY - Vertical offset → game Y
 * @param {number} offsetZ - Forward offset → game X
 * @returns {{x: number, y: number}} Projected 2D position in character-local game units
 */
function transformPoint(bonePositions, boneId, offsetX, offsetY, offsetZ) {
    const bone = bonePositions.get(boneId) ?? { x: 0, y: 0, zDirX: 1, zDirY: 0 };
    // The bone's local Z-axis direction (projected to 2D) tells us which
    // way "forward along the bone" points. We rotate the hitbox Z offset
    // by this direction, and the Y offset perpendicular to it.
    const zdx = bone.zDirX ?? 1;
    const zdy = bone.zDirY ?? 0;
    // Perpendicular to Z-axis in 2D (rotated 90° CCW): (-zdy, zdx)
    return {
        x: bone.x + offsetZ * zdx + offsetY * (-zdy),
        y: bone.y + offsetZ * zdy + offsetY * zdx,
    };
}

/**
 * Map a .slp actionStateId to the DAT file's subaction index.
 * Checks explicit mapping first, then identity for common actions (< 341),
 * then returns null if no hitbox data exists.
 *
 * @param {object} charData - Parsed character JSON data
 * @param {number} actionStateId - Action state ID from .slp post-frame data
 * @returns {number|null} Subaction ID, or null if no hitbox data
 */
function mapActionToSubaction(charData, actionStateId) {
    // Check explicit mapping table first
    if (charData.actionStateMap?.[String(actionStateId)] !== undefined) {
        const subId = charData.actionStateMap[String(actionStateId)];
        if (charData.subactions?.[String(subId)]) return subId;
    }

    // For common actions (< 341), actionStateId === subactionId
    if (actionStateId < 341) {
        if (charData.subactions?.[String(actionStateId)]) return actionStateId;
    }

    return null;
}

const BoneResolver = { resolve, transformPoint, mapActionToSubaction };
export default BoneResolver;
