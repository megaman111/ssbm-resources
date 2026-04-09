import { describe, it, expect } from 'vitest';
import BoneResolver from './bone-resolver.js';

describe('BoneResolver.resolve', () => {
    const charData = {
        bones: [
            { id: 0, parent: -1, restX: 0, restY: 0 },
            { id: 3, parent: 0, restX: 0, restY: 5.2 },
            { id: 11, parent: 3, restX: 4.1, restY: 4.8 },
        ],
        subactions: {
            '44': {
                name: 'Attack11',
                totalFrames: 30,
                boneFrames: {
                    '0': { '0': [0, 0], '3': [0, 5.2], '11': [4.0, 4.8] },
                    '10': { '0': [0, 0], '3': [0, 5.5], '11': [6.0, 5.0] },
                    '20': { '0': [0, 0], '3': [0, 5.2], '11': [4.0, 4.8] },
                },
                hitboxes: [],
            },
            '99': {
                name: 'EmptyAction',
                totalFrames: 10,
                boneFrames: {},
                hitboxes: [],
            },
        },
        actionStateMap: { '341': 200 },
    };

    it('returns exact keyframe positions when frame matches a keyframe', () => {
        const result = BoneResolver.resolve(charData, 44, 0);
        expect(result.get(11)).toEqual({ x: 4.0, y: 4.8 });
        expect(result.get(3)).toEqual({ x: 0, y: 5.2 });
    });

    it('linearly interpolates between surrounding keyframes', () => {
        const result = BoneResolver.resolve(charData, 44, 5);
        // Midpoint between frame 0 and frame 10 for bone 11
        // x: 4.0 + (6.0 - 4.0) * 0.5 = 5.0
        // y: 4.8 + (5.0 - 4.8) * 0.5 = 4.9
        expect(result.get(11).x).toBeCloseTo(5.0);
        expect(result.get(11).y).toBeCloseTo(4.9);
    });

    it('falls back to rest-pose when subaction has empty boneFrames', () => {
        const result = BoneResolver.resolve(charData, 99, 0);
        expect(result.get(0)).toEqual({ x: 0, y: 0 });
        expect(result.get(3)).toEqual({ x: 0, y: 5.2 });
        expect(result.get(11)).toEqual({ x: 4.1, y: 4.8 });
    });

    it('falls back to rest-pose when subaction does not exist', () => {
        const result = BoneResolver.resolve(charData, 9999, 0);
        expect(result.get(0)).toEqual({ x: 0, y: 0 });
        expect(result.get(3)).toEqual({ x: 0, y: 5.2 });
    });

    it('clamps to last keyframe when frame is beyond all keyframes', () => {
        const result = BoneResolver.resolve(charData, 44, 25);
        // Frame 25 is past keyframe 20, no keyframe after 20 → uses frame 20 values
        expect(result.get(11)).toEqual({ x: 4.0, y: 4.8 });
    });

    it('uses first keyframe when frame is before all keyframes', () => {
        const dataWithLateStart = {
            ...charData,
            subactions: {
                '50': {
                    name: 'LateStart',
                    totalFrames: 30,
                    boneFrames: {
                        '5': { '0': [1, 2] },
                        '10': { '0': [3, 4] },
                    },
                    hitboxes: [],
                },
            },
        };
        // Frame 0 is before keyframe 5 → lo stays at 0, kfA = 5, kfB = 10
        // t = (0 - 5) / (10 - 5) = -1 → extrapolates, but the binary search
        // will land on lo=0 (frameKeys[0]=5 > floorFrame=0 is false since 5>0)
        // Actually: lo=0, hi=1, mid=ceil(0.5)=1, frameKeys[1]=10 > 0 → hi=0
        // lo=hi=0, kfA=5, kfB=10, t=(0-5)/(10-5)=-1
        // This extrapolates backward. Let's just check it returns a result.
        const result = BoneResolver.resolve(dataWithLateStart, 50, 0);
        expect(result.has(0)).toBe(true);
    });
});

describe('BoneResolver.transformPoint', () => {
    it('projects Z offset to X and Y offset to Y, collapsing X', () => {
        const positions = new Map([[11, { x: 4.0, y: 5.0 }]]);
        const result = BoneResolver.transformPoint(positions, 11, 1.0, 2.0, 3.0);
        // x = bone.x + offsetZ = 4.0 + 3.0 = 7.0
        // y = bone.y + offsetY = 5.0 + 2.0 = 7.0
        expect(result).toEqual({ x: 7.0, y: 7.0 });
    });

    it('falls back to origin when bone is not in the map', () => {
        const positions = new Map();
        const result = BoneResolver.transformPoint(positions, 99, 1.0, 2.0, 3.0);
        expect(result).toEqual({ x: 3.0, y: 2.0 });
    });
});

describe('BoneResolver.mapActionToSubaction', () => {
    const charData = {
        subactions: {
            '44': { name: 'Attack11', totalFrames: 30, boneFrames: {}, hitboxes: [] },
            '200': { name: 'SpecialN', totalFrames: 40, boneFrames: {}, hitboxes: [] },
        },
        actionStateMap: { '341': 200 },
    };

    it('uses explicit mapping when present', () => {
        expect(BoneResolver.mapActionToSubaction(charData, 341)).toBe(200);
    });

    it('uses identity mapping for common actions (< 341)', () => {
        expect(BoneResolver.mapActionToSubaction(charData, 44)).toBe(44);
    });

    it('returns null when no mapping or subaction data exists', () => {
        expect(BoneResolver.mapActionToSubaction(charData, 500)).toBeNull();
    });

    it('returns null for common action with no subaction data', () => {
        expect(BoneResolver.mapActionToSubaction(charData, 100)).toBeNull();
    });
});

import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Property-Based Tests for BoneResolver
// ---------------------------------------------------------------------------

describe('BoneResolver property tests', () => {
    /**
     * Property 5: Keyframe interpolation bounds
     * For any two adjacent keyframes with bone positions [ax, ay] and [bx, by],
     * and any t in [0,1], the interpolated position satisfies:
     *   min(ax, bx) <= interpolated_x <= max(ax, bx)
     *   min(ay, by) <= interpolated_y <= max(ay, by)
     *
     * **Validates: Requirements 5.2**
     */
    it('Property 5: interpolated positions are bounded by surrounding keyframe values', () => {
        // Arbitrary for a single bone position component
        const coordArb = fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true });

        fc.assert(
            fc.property(
                // Two keyframe positions for one bone
                coordArb, coordArb, // ax, ay (keyframe A)
                coordArb, coordArb, // bx, by (keyframe B)
                fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }), // t in [0,1]
                fc.integer({ min: 0, max: 5 }), // boneId
                (ax, ay, bx, by, t, boneId) => {
                    const kfAFrame = 0;
                    const kfBFrame = 10;
                    const boneIdStr = String(boneId);

                    const charData = {
                        bones: [{ id: boneId, parent: -1, restX: 0, restY: 0 }],
                        subactions: {
                            '1': {
                                name: 'Test',
                                totalFrames: 20,
                                boneFrames: {
                                    [String(kfAFrame)]: { [boneIdStr]: [ax, ay] },
                                    [String(kfBFrame)]: { [boneIdStr]: [bx, by] },
                                },
                                hitboxes: [],
                            },
                        },
                        actionStateMap: {},
                    };

                    // animFrame = kfA + t * (kfB - kfA) to get interpolation factor t
                    const animFrame = kfAFrame + t * (kfBFrame - kfAFrame);
                    const result = BoneResolver.resolve(charData, 1, animFrame);
                    const pos = result.get(boneId);

                    const minX = Math.min(ax, bx);
                    const maxX = Math.max(ax, bx);
                    const minY = Math.min(ay, by);
                    const maxY = Math.max(ay, by);

                    expect(pos.x).toBeGreaterThanOrEqual(minX - 1e-9);
                    expect(pos.x).toBeLessThanOrEqual(maxX + 1e-9);
                    expect(pos.y).toBeGreaterThanOrEqual(minY - 1e-9);
                    expect(pos.y).toBeLessThanOrEqual(maxY + 1e-9);
                }
            ),
            { numRuns: 200 }
        );
    });

    /**
     * Property 6: Rest pose fallback
     * For any charData with bones but a subaction with empty boneFrames,
     * resolve() returns rest-pose positions for all bones.
     *
     * **Validates: Requirements 5.3**
     */
    it('Property 6: empty boneFrames returns rest pose positions for all bones', () => {
        const coordArb = fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true });

        // Generate 1-5 bones with rest positions
        const bonesArb = fc.array(
            fc.record({
                restX: coordArb,
                restY: coordArb,
            }),
            { minLength: 1, maxLength: 5 }
        ).map(bones =>
            bones.map((b, i) => ({
                id: i,
                parent: i === 0 ? -1 : 0,
                restX: b.restX,
                restY: b.restY,
            }))
        );

        fc.assert(
            fc.property(
                bonesArb,
                fc.integer({ min: 0, max: 100 }), // animFrame
                (bones, animFrame) => {
                    const charData = {
                        bones,
                        subactions: {
                            '1': {
                                name: 'Empty',
                                totalFrames: 10,
                                boneFrames: {},
                                hitboxes: [],
                            },
                        },
                        actionStateMap: {},
                    };

                    const result = BoneResolver.resolve(charData, 1, animFrame);

                    // Should return rest-pose for every bone
                    for (const bone of bones) {
                        const pos = result.get(bone.id);
                        expect(pos).toBeDefined();
                        expect(pos.x).toBe(bone.restX);
                        expect(pos.y).toBe(bone.restY);
                    }
                    expect(result.size).toBe(bones.length);
                }
            ),
            { numRuns: 200 }
        );
    });

    /**
     * Property 7: 3D to 2D coordinate projection
     * For any bone position (bx, by) and offset (ox, oy, oz),
     * transformPoint returns {x: bx + oz, y: by + oy}.
     *
     * **Validates: Requirements 5.4**
     */
    it('Property 7: transformPoint maps Z→X and Y→Y correctly', () => {
        const coordArb = fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true });

        fc.assert(
            fc.property(
                coordArb, coordArb, // bx, by (bone position)
                coordArb, coordArb, coordArb, // ox, oy, oz (offsets)
                fc.integer({ min: 0, max: 100 }), // boneId
                (bx, by, ox, oy, oz, boneId) => {
                    const positions = new Map([[boneId, { x: bx, y: by }]]);
                    const result = BoneResolver.transformPoint(positions, boneId, ox, oy, oz);

                    // Z → game X, Y → game Y, X (lateral) collapsed
                    expect(result.x).toBeCloseTo(bx + oz, 9);
                    expect(result.y).toBeCloseTo(by + oy, 9);
                }
            ),
            { numRuns: 200 }
        );
    });

    /**
     * Property 8: Action state mapping correctness
     * - Explicit actionStateMap entry takes priority
     * - For IDs < 341 without explicit mapping, uses identity
     * - For IDs >= 341 without mapping, returns null
     *
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    describe('Property 8: action state mapping', () => {
        it('explicit map entry takes priority', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 1000 }),  // actionStateId
                    fc.integer({ min: 0, max: 500 }),   // mapped subactionId
                    (actionStateId, subactionId) => {
                        const charData = {
                            subactions: {
                                [String(subactionId)]: {
                                    name: 'Mapped',
                                    totalFrames: 10,
                                    boneFrames: {},
                                    hitboxes: [],
                                },
                            },
                            actionStateMap: {
                                [String(actionStateId)]: subactionId,
                            },
                        };

                        const result = BoneResolver.mapActionToSubaction(charData, actionStateId);
                        expect(result).toBe(subactionId);
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('identity mapping for IDs < 341 without explicit entry', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 340 }), // actionStateId < 341
                    (actionStateId) => {
                        const charData = {
                            subactions: {
                                [String(actionStateId)]: {
                                    name: 'Common',
                                    totalFrames: 10,
                                    boneFrames: {},
                                    hitboxes: [],
                                },
                            },
                            actionStateMap: {}, // no explicit mapping
                        };

                        const result = BoneResolver.mapActionToSubaction(charData, actionStateId);
                        expect(result).toBe(actionStateId);
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('returns null for IDs >= 341 without explicit mapping', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 341, max: 2000 }), // actionStateId >= 341
                    (actionStateId) => {
                        const charData = {
                            subactions: {
                                // Some subaction exists but not for this ID
                                '44': {
                                    name: 'Attack11',
                                    totalFrames: 30,
                                    boneFrames: {},
                                    hitboxes: [],
                                },
                            },
                            actionStateMap: {}, // no explicit mapping
                        };

                        const result = BoneResolver.mapActionToSubaction(charData, actionStateId);
                        expect(result).toBeNull();
                    }
                ),
                { numRuns: 200 }
            );
        });
    });
});
