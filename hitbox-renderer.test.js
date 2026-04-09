import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import HitboxRenderer from './hitbox-renderer.js';

/** Minimal charData fixture */
function makeCharData(overrides = {}) {
    return {
        scale: 1,
        subactions: {
            '44': {
                name: 'Attack11',
                totalFrames: 30,
                boneFrames: {},
                hitboxes: [
                    {
                        id: 0, bone: 3, x: 0, y: 1, z: 2, size: 3,
                        damage: 7, angle: 80, kbg: 100, bkb: 0,
                        setKb: 0, element: 0, startFrame: 2, endFrame: 5,
                    },
                    {
                        id: 1, bone: 3, x: 0, y: 0, z: 4, size: 2,
                        damage: 5, angle: 60, kbg: 80, bkb: 10,
                        setKb: 0, element: 0, startFrame: 3, endFrame: 6,
                    },
                ],
            },
        },
        hurtboxes: [
            { bone: 0, x: 0, y: 0, z: 0, sizeX: 2, sizeY: 3, zone: 'mid' },
        ],
        ...overrides,
    };
}

function makeBonePositions() {
    return new Map([[3, { x: 0, y: 5 }], [0, { x: 0, y: 0 }]]);
}

describe('HitboxRenderer', () => {
    describe('getHitboxAtPoint', () => {
        it('returns hitbox info when point is inside the circle', () => {
            const charData = makeCharData();
            const bones = makeBonePositions();
            // Hitbox 0: bone(0,5) + offset z=2,y=1 → world (0+2*1, 0+6) = (2, 6), radius=3
            const result = HitboxRenderer.getHitboxAtPoint(
                charData, 44, 3, bones, 0, 0, 1, 2, 6
            );
            expect(result).not.toBeNull();
            expect(result.id).toBe(0);
            expect(result.damage).toBe(7);
            expect(result.angle).toBe(80);
        });

        it('returns null when point is outside all hitbox circles', () => {
            const charData = makeCharData();
            const bones = makeBonePositions();
            const result = HitboxRenderer.getHitboxAtPoint(
                charData, 44, 3, bones, 0, 0, 1, 100, 100
            );
            expect(result).toBeNull();
        });

        it('returns null when frame is outside active range', () => {
            const charData = makeCharData();
            const bones = makeBonePositions();
            // Frame 0 is before startFrame 2
            const result = HitboxRenderer.getHitboxAtPoint(
                charData, 44, 0, bones, 0, 0, 1, 2, 6
            );
            expect(result).toBeNull();
        });

        it('applies facing direction correctly', () => {
            const charData = makeCharData();
            const bones = makeBonePositions();
            // Facing left: worldX = 0 + (0+2)*1*(-1) = -2
            const result = HitboxRenderer.getHitboxAtPoint(
                charData, 44, 3, bones, 0, 0, -1, -2, 6
            );
            expect(result).not.toBeNull();
            expect(result.id).toBe(0);
        });

        it('applies character scale', () => {
            const charData = makeCharData({ scale: 2 });
            const bones = makeBonePositions();
            // With scale 2: worldX = 0 + (0+2)*2*1 = 4, worldY = 0 + (5+1)*2 = 12, radius = 3*2 = 6
            const result = HitboxRenderer.getHitboxAtPoint(
                charData, 44, 3, bones, 0, 0, 1, 4, 12
            );
            expect(result).not.toBeNull();
            expect(result.id).toBe(0);
        });

        it('returns null for unknown subaction', () => {
            const charData = makeCharData();
            const bones = makeBonePositions();
            const result = HitboxRenderer.getHitboxAtPoint(
                charData, 999, 3, bones, 0, 0, 1, 2, 6
            );
            expect(result).toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// Property-Based Tests for HitboxRenderer
// ---------------------------------------------------------------------------

describe('HitboxRenderer property tests', () => {
    /**
     * Property 9: Hitbox active frame filtering
     * For any hitbox with [startFrame, endFrame] and any frame f,
     * getHitboxAtPoint returns non-null at the hitbox center iff
     * startFrame <= f <= endFrame.
     *
     * **Validates: Requirements 7.1**
     */
    it('Property 9: hitbox rendered iff startFrame <= frame <= endFrame', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),  // startFrame
                fc.integer({ min: 0, max: 50 }),  // endFrame offset (added to startFrame)
                fc.integer({ min: 0, max: 100 }), // test frame
                (startFrame, endOffset, frame) => {
                    const endFrame = startFrame + endOffset;
                    const totalFrames = endFrame + 10;

                    const boneX = 0;
                    const boneY = 5;
                    const offsetZ = 2;
                    const offsetY = 1;
                    const size = 3;
                    const charX = 0;
                    const charY = 0;
                    const facing = 1;
                    const scale = 1;

                    const charData = {
                        scale,
                        subactions: {
                            '1': {
                                name: 'Test',
                                totalFrames,
                                boneFrames: {},
                                hitboxes: [{
                                    id: 0, bone: 0, x: 0, y: offsetY, z: offsetZ, size,
                                    damage: 10, angle: 45, kbg: 100, bkb: 0,
                                    setKb: 0, element: 0, startFrame, endFrame,
                                }],
                            },
                        },
                    };

                    const bonePositions = new Map([[0, { x: boneX, y: boneY }]]);

                    // Compute the exact center of the hitbox
                    const worldX = charX + (boneX + offsetZ) * scale * facing;
                    const worldY = charY + (boneY + offsetY) * scale;

                    const result = HitboxRenderer.getHitboxAtPoint(
                        charData, 1, frame, bonePositions,
                        charX, charY, facing, worldX, worldY
                    );

                    const shouldBeActive = frame >= startFrame && frame <= endFrame;

                    if (shouldBeActive) {
                        expect(result).not.toBeNull();
                        expect(result.id).toBe(0);
                    } else {
                        expect(result).toBeNull();
                    }
                }
            ),
            { numRuns: 300 }
        );
    });

    /**
     * Property 10: Hitbox world position computation
     * For any hitbox with bone position (bx, by), offset (ox, oy, oz),
     * charPos (cx, cy), facing, scale:
     *   worldX = cx + (bx + oz) * scale * facing
     *   worldY = cy + (by + oy) * scale
     *   radius = size * scale
     * getHitboxAtPoint at (worldX, worldY) returns the hitbox.
     *
     * **Validates: Requirements 7.3, 7.4, 7.5, 8.1, 8.4**
     */
    it('Property 10: world position matches formula charX + (bone.x + offset.z) * scale * facing', () => {
        const coordArb = fc.double({ min: -200, max: 200, noNaN: true, noDefaultInfinity: true });
        const posScaleArb = fc.double({ min: 0.1, max: 5, noNaN: true, noDefaultInfinity: true });
        const facingArb = fc.constantFrom(1, -1);

        fc.assert(
            fc.property(
                coordArb, coordArb, // boneX, boneY
                coordArb, coordArb, coordArb, // offsetX, offsetY, offsetZ
                coordArb, coordArb, // charX, charY
                facingArb,
                posScaleArb,
                posScaleArb, // size
                (boneX, boneY, offsetX, offsetY, offsetZ, charX, charY, facing, scale, size) => {
                    const charData = {
                        scale,
                        subactions: {
                            '1': {
                                name: 'Test',
                                totalFrames: 10,
                                boneFrames: {},
                                hitboxes: [{
                                    id: 0, bone: 0, x: offsetX, y: offsetY, z: offsetZ, size,
                                    damage: 10, angle: 45, kbg: 100, bkb: 0,
                                    setKb: 0, element: 0, startFrame: 0, endFrame: 9,
                                }],
                            },
                        },
                    };

                    const bonePositions = new Map([[0, { x: boneX, y: boneY }]]);

                    // Expected world position per the design formula
                    const expectedWorldX = charX + (boneX + offsetZ) * scale * facing;
                    const expectedWorldY = charY + (boneY + offsetY) * scale;

                    // Query at the exact expected center — should find the hitbox
                    const result = HitboxRenderer.getHitboxAtPoint(
                        charData, 1, 0, bonePositions,
                        charX, charY, facing, expectedWorldX, expectedWorldY
                    );

                    expect(result).not.toBeNull();
                    expect(result.id).toBe(0);
                }
            ),
            { numRuns: 300 }
        );
    });

    /**
     * Property 11: Hit-test point-in-circle correctness
     * For any active hitbox circle at (cx, cy) with radius r, and test
     * point (px, py): getHitboxAtPoint returns hitbox iff
     * (px - cx)² + (py - cy)² <= r².
     *
     * **Validates: Requirements 9.1, 9.2**
     */
    it('Property 11: getHitboxAtPoint returns hitbox iff point is within circle radius', () => {
        const coordArb = fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true });
        const sizeArb = fc.double({ min: 0.5, max: 20, noNaN: true, noDefaultInfinity: true });

        fc.assert(
            fc.property(
                coordArb, coordArb, // boneX, boneY
                sizeArb,            // hitbox size
                coordArb, coordArb, // test point px, py (in game coords)
                (boneX, boneY, size, px, py) => {
                    // Use simple setup: charX=0, charY=0, facing=1, scale=1,
                    // offset x=0, y=0, z=0 so the hitbox center = bone position
                    const charX = 0;
                    const charY = 0;
                    const facing = 1;
                    const scale = 1;

                    const charData = {
                        scale,
                        subactions: {
                            '1': {
                                name: 'Test',
                                totalFrames: 10,
                                boneFrames: {},
                                hitboxes: [{
                                    id: 0, bone: 0, x: 0, y: 0, z: 0, size,
                                    damage: 10, angle: 45, kbg: 100, bkb: 0,
                                    setKb: 0, element: 0, startFrame: 0, endFrame: 9,
                                }],
                            },
                        },
                    };

                    const bonePositions = new Map([[0, { x: boneX, y: boneY }]]);

                    // The hitbox center in world coords (with zero offsets, scale=1, facing=1)
                    const cx = charX + boneX * scale * facing;
                    const cy = charY + boneY * scale;
                    const radius = size * scale;

                    const result = HitboxRenderer.getHitboxAtPoint(
                        charData, 1, 0, bonePositions,
                        charX, charY, facing, px, py
                    );

                    const distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
                    const isInside = distSq <= radius * radius;

                    if (isInside) {
                        expect(result).not.toBeNull();
                        expect(result.id).toBe(0);
                    } else {
                        expect(result).toBeNull();
                    }
                }
            ),
            { numRuns: 300 }
        );
    });
});
