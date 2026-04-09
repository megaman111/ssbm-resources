# Implementation Plan: 3D Model Rendering

## Overview

Add Three.js-powered 3D character model rendering to the Melee replay viewer, overlaying a WebGL canvas on the existing Canvas 2D layer. Implementation follows the existing module patterns (HitboxLoader, BoneResolver, HitboxRenderer) and builds incrementally: model loading → mesh construction → scene management → integration → polish.

## Tasks

- [ ] 1. Create model-loader.js
  - [ ] 1.1 Implement ModelLoader class mirroring HitboxLoader pattern
    - Create `model-loader.js` with the same `CHARACTER_NAMES` array, `_cache`/`_pending` Map pattern, and `load(charId)`/`get(charId)`/`preloadAll(charIds)` interface as `hitbox-loader.js`
    - `load()` fetches `model-data/{character_name}.json`, caches result, returns parsed JSON or null on 404/parse error
    - `get()` returns synchronous cache lookup
    - `preloadAll()` loads multiple characters in parallel via `Promise.all`
    - Add `loadTexture(charId)` that attempts to load `model-data/textures/{character_name}.png` as an `Image`, returns null if not found
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 1.2 Write property test: ModelLoader character ID mapping (Property 5)
    - **Property 5: Character ID to filename mapping consistency**
    - For all valid Slippi character IDs (0–25), verify ModelLoader maps to the same `{character_name}.json` filename as HitboxLoader
    - **Validates: Requirements 3.5**

  - [ ]* 1.3 Write property test: ModelLoader caching idempotence (Property 4)
    - **Property 4: ModelLoader caching idempotence**
    - For any character ID, calling `load()` twice returns the same object reference on the second call
    - Use fast-check to generate random charIds, mock fetch, verify reference equality and single fetch call
    - **Validates: Requirements 3.2**

- [ ] 2. Create mesh-builder.js
  - [ ] 2.1 Implement coordinate swizzle and BufferGeometry construction
    - Create `mesh-builder.js` with `buildCharacterMesh(THREE, modelData, options)` function
    - Implement Melee→Three.js coordinate swizzle: `[mx, my, mz]` → `[mz, my, mx]` for positions and normals
    - Build `BufferGeometry` with position, normal, uv, skinIndex, skinWeight attributes from model JSON
    - Set triangle index buffer from `modelData.indices`
    - _Requirements: 4.1, 4.3, 11.2_

  - [ ] 2.2 Implement skeleton construction and SkinnedMesh assembly
    - Build `THREE.Bone` hierarchy from `modelData.bones` parent references
    - Apply swizzled base transforms to each bone
    - Create `THREE.Skeleton` with swizzled inverse bind matrices
    - Implement `swizzleMatrix()` helper to reorder 4×4 column-major matrix for coordinate system change
    - Assemble `THREE.SkinnedMesh` with geometry + skeleton + material
    - Return `{ mesh, skeleton, boneMap }` object
    - _Requirements: 4.2, 4.4, 4.5_

  - [ ] 2.3 Implement material functions
    - `createToonMaterial(THREE, color, opacity)` — flat/cel-shaded `MeshToonMaterial` with outline effect
    - `createTexturedMaterial(THREE, textureImage, opacity)` — `MeshBasicMaterial` or `MeshStandardMaterial` with texture from Image element
    - `createHitboxSphere(THREE, colorHex, opacity)` — reusable unit sphere with `MeshBasicMaterial`, transparent
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 2.4 Write property test: Coordinate swizzle correctness (Property 2)
    - **Property 2: Coordinate system swizzle correctness**
    - For any random Melee-space vertex `[mx, my, mz]`, verify output Three.js position is `[mz, my, mx]`
    - Same swizzle verified for normals
    - **Validates: Requirements 4.1, 11.2**

  - [ ]* 2.5 Write property test: Mesh construction data integrity (Property 3)
    - **Property 3: Mesh construction data integrity**
    - Generate random model JSON (vertices, normals, uvs, bones, weights, indices, inv_bind_matrices)
    - Verify output SkinnedMesh has matching vertex count, correct buffer attribute values (after swizzle), matching bone count and parent-child relationships
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ] 3. Checkpoint — Model loading and mesh construction
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create scene-manager.js
  - [ ] 4.1 Implement SceneManager initialization and WebGL overlay
    - Create `scene-manager.js` with `SceneManager` class
    - `constructor(overlayCanvas)` stores canvas reference
    - `async init()` lazy-loads Three.js from `https://esm.sh/three@latest`, creates `WebGLRenderer` with `alpha: true, premultipliedAlpha: false`, creates `Scene`, `OrthographicCamera`, directional + ambient lights
    - Return `false` if Three.js import fails or WebGL context unavailable
    - `resize(width, height)` updates renderer size and camera aspect
    - Listen for `webglcontextlost`/`webglcontextrestored` events
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 13.1, 13.7_

  - [ ] 4.2 Implement camera synchronization with 2D viewport
    - `updateCamera(scale, offX, offY, canvasW, canvasH)` derives orthographic frustum from 2D renderer's transform parameters
    - `camera.left = (0 - offX) / scale`, `camera.right = (canvasW - offX) / scale`, `camera.top = -(0 - offY) / scale`, `camera.bottom = -(canvasH - offY) / scale`
    - Camera positioned at `(0, 0, 500)` looking along -Z, near=-1000, far=1000
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 11.1, 11.3_

  - [ ] 4.3 Implement character mesh management and pose updates
    - `setCharacterMesh(playerKey, meshData)` adds SkinnedMesh to scene
    - `updatePose(playerKey, bonePositions, gameX, gameY, facing, charScale)` sets root bone position/scale and updates bone positions from BoneResolver output
    - _Requirements: 6.1, 6.2, 6.5, 6.6_

  - [ ] 4.4 Implement 3D hitbox and hurtbox sphere rendering
    - `updateHitboxSpheres(playerKey, activeHitboxes, bonePositions, charX, charY, facing, charScale)` positions pre-allocated sphere pool using same math as 2D `resolveHitboxWorld()`
    - `updateHurtboxSpheres(playerKey, hurtboxes, bonePositions, charX, charY, facing, charScale, hurtboxState)` positions hurtbox spheres with yellow/blue coloring
    - Color-code hitbox spheres: ID 0→red, 1→orange, 2→yellow, 3→green
    - Hide unused spheres by setting `visible = false`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 4.5 Implement raycasting hit-test and resource disposal
    - `hitTest(mouseX, mouseY)` performs Three.js raycasting against hitbox spheres, returns `{damage, angle, kbg, bkb, id}` or null
    - `render()` calls `renderer.render(scene, camera)` wrapped in try/catch with error counter; auto-fallback to 2D after 5 consecutive errors
    - `clear()` removes all meshes and spheres from scene
    - `dispose()` disposes all geometries, materials, textures
    - _Requirements: 12.1, 12.2, 12.3, 10.3, 13.3, 13.6_

  - [ ]* 4.6 Write property test: Camera projection matches 2D renderer (Property 1)
    - **Property 1: Orthographic camera projection matches 2D renderer**
    - For random game coords (gameX, gameY), scale, offX, offY, canvasW, canvasH: verify the orthographic frustum projects `(gameX, gameY, 0)` to the same pixel as `toCanvasX(gameX)` / `toCanvasY(gameY)`
    - **Validates: Requirements 2.1, 2.2, 11.1, 11.3**

  - [ ]* 4.7 Write property test: Hitbox sphere positioning matches 2D (Property 7)
    - **Property 7: 3D hitbox/hurtbox sphere positioning matches 2D renderer**
    - For random hitbox params (bone, offset, size), bone positions (with zDirX, zDirY), char position, facing, scale: verify 3D sphere world position equals 2D `resolveHitboxWorld()` output
    - **Validates: Requirements 7.2, 7.4, 7.5, 11.4**

  - [ ]* 4.8 Write property test: Skeleton pose application (Property 6)
    - **Property 6: Skeleton pose application**
    - For random bone positions, game position, facing (1 or -1), charScale: verify root bone position is `(gameX, gameY, 0)`, root X scale is `facing * charScale`, each bone positioned at `(pos.x, pos.y, 0)`
    - **Validates: Requirements 6.2, 6.5, 6.6**

  - [ ]* 4.9 Write property test: Hitbox active frame filtering (Property 8)
    - **Property 8: Hitbox active frame filtering**
    - For random hitbox frame ranges [startFrame, endFrame] and animation frame f: verify sphere visible iff `startFrame <= f <= endFrame`
    - **Validates: Requirements 7.7**

- [ ] 5. Checkpoint — Scene manager and 3D rendering pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Integrate into player-notes.html
  - [ ] 6.1 Add render mode toggle and WebGL canvas overlay
    - Add a 2D/3D toggle button to the toolbar in `player-notes.html`
    - Create a WebGL `<canvas>` element positioned absolutely over the existing Canvas 2D with matching dimensions, `z-index: 1`
    - On toggle: initialize SceneManager if needed, show/hide WebGL canvas, hide/show 2D SVG silhouettes
    - Persist render mode preference to `localStorage`
    - Disable toggle and force 2D if WebGL unavailable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 13.4_

  - [ ] 6.2 Wire renderFrame() to 3D rendering pipeline
    - In the existing `renderFrame()` function, when 3D mode is active:
      - Call `sceneManager.updateCamera(scale, offX, offY, W, H)` with current viewport params
      - For each player: load model via ModelLoader, build mesh via MeshBuilder (once), resolve bones via BoneResolver, call `sceneManager.updatePose()`, call `sceneManager.updateHitboxSpheres()` / `updateHurtboxSpheres()`
      - Call `sceneManager.render()`
    - Skip 2D SVG silhouette and 2D hitbox rendering when 3D mode is active
    - Handle per-character fallback: if `modelLoader.get(charId)` is null, render that character with existing 2D path
    - _Requirements: 1.4, 6.1, 6.2, 6.3, 6.4, 8.6, 9.2, 9.3_

  - [ ] 6.3 Wire hitbox tooltip to 3D raycasting
    - On mousemove over the WebGL canvas, call `sceneManager.hitTest(mouseX, mouseY)`
    - Display existing tooltip UI with hitbox properties (damage, angle, kbg, bkb) when a sphere is hit
    - Hide tooltip when mouse moves away from all spheres
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 6.4 Handle resize, replay load/unload, and disposal
    - On window resize: call `sceneManager.resize()` to match new canvas dimensions
    - On replay load: preload models for characters in the replay via `modelLoader.preloadAll()`
    - On replay unload or new replay: call `sceneManager.clear()` and `sceneManager.dispose()`
    - _Requirements: 1.2, 10.3, 13.3_

  - [ ]* 6.5 Write property test: Render mode persistence (Property 9)
    - **Property 9: Render mode preference round-trip**
    - For any render mode value ('2d' or '3d'), persist to localStorage and read back, verify same value returned
    - **Validates: Requirements 8.5**

  - [ ]* 6.6 Write property test: Per-character fallback (Property 10)
    - **Property 10: Per-character fallback when model unavailable**
    - For random mix of available/null model data per character, verify null models use 2D SVG path, others use 3D
    - **Validates: Requirements 9.2**

  - [ ]* 6.7 Write property test: Geometry reuse for duplicate characters (Property 11)
    - **Property 11: Geometry reuse for duplicate characters**
    - For same character ID loaded twice via ModelLoader, verify same cached data reference returned
    - **Validates: Requirements 10.2**

- [ ] 7. Checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Texture extraction enhancement (model extractor)
  - [ ] 8.1 Extend model extractor to decode and output texture PNGs
    - In `model-extractor/src/main.rs`, after extracting model data, decode GX texture data from `fighter_data.model.textures` using `dat_tools` texture decoding
    - Write decoded RGBA data as PNG files to `model-data/textures/{character_name}.png`
    - Optionally add a `textures` array to the model JSON output with file path, width, height, and original format metadata
    - _Requirements: 5.1_

  - [ ] 8.2 Update ModelLoader and MeshBuilder to use textures when available
    - In `model-loader.js`, call `loadTexture(charId)` after loading model JSON
    - In the integration code, pass loaded texture image to `buildCharacterMesh()` via `options.texture`
    - MeshBuilder selects `createTexturedMaterial()` when texture provided, falls back to `createToonMaterial()` when null
    - _Requirements: 5.2, 5.3_

- [ ] 9. Final checkpoint — All features complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Three.js is loaded from `https://esm.sh/three@latest` — no build step needed
- Tests use vitest + fast-check as configured in package.json
- The texture extraction task (8) can be deferred since the toon shader fallback provides a working 3D view without textures
