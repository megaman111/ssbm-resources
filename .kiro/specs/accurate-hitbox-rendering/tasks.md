# Implementation Plan: Accurate Hitbox/Hurtbox Rendering

## Overview

Replace the approximate FightCore-based hitbox visualization with frame-perfect, ISO-extracted hitbox/hurtbox rendering. Phase 1 builds the Python extraction pipeline (DAT → JSON). Phase 2 builds the browser-side rendering modules (HitboxLoader, BoneResolver, HitboxRenderer) and integrates them into the existing replay viewer. All browser code is vanilla JavaScript ES modules, no build step.

## Tasks

- [x] 1. Set up extraction pipeline scaffolding
  - [x] 1.1 Create `hitbox-data/` directory and `extract_hitbox_data.py` entry point
    - CLI argument parsing: `--iso`, `--char`, `--outdir`, `--validate`
    - ISO path validation: exit with error if path doesn't exist
    - ISO version detection: warn if not NTSC v1.02
    - Character DAT file listing and extraction from ISO
    - _Requirements: 1.1, 1.2, 1.3, 3.2, 3.3_

  - [x] 1.2 Integrate meleeDat2Json as the DAT parser
    - Install/vendor `pfirsich/meleeDat2Json` as a Python dependency
    - Parse each character's DAT file into raw JSON (JOBJ tree, subaction events, FIGATREE animations)
    - Handle parse failures: log error, skip character, continue with remaining
    - _Requirements: 1.1, 3.1_

- [x] 2. Implement character data extraction
  - [x] 2.1 Extract bone tree from JOBJ hierarchy
    - Walk the JOBJ (joint object) tree to build bone parent/child relationships
    - Extract rest-pose positions for each bone
    - Ensure tree ordering: parent index < child index for all non-root bones
    - Root bone (index 0) has parent = -1
    - _Requirements: 1.4, 2.1, 2.2_

  - [x] 2.2 Extract hitbox events from subaction commands
    - Parse subaction event lists to find hitbox commands (CreateHitbox, etc.)
    - Extract: bone attachment, offset (x, y, z), size, damage, angle, KBG, BKB, set KB, element
    - Determine active frame ranges (startFrame, endFrame) from timing commands
    - Validate: startFrame <= endFrame, startFrame < totalFrames, size > 0
    - _Requirements: 1.5, 2.5, 2.6, 2.7_

  - [x] 2.3 Extract hurtbox definitions
    - Parse fighter data structures for hurtbox entries
    - Extract: bone attachment, offset, size, zone (high/mid/low)
    - Validate: all bone IDs reference valid bones in the tree
    - _Requirements: 1.6, 2.4_

  - [x] 2.4 Extract animation keyframes and compute bone world transforms
    - Parse FIGATREE animation data for per-bone keyframe tracks
    - Compute world-space bone positions per frame using hierarchical transform composition
    - Store as sparse keyframes (only frames where bones move) to minimize JSON size
    - Only include bones referenced by hitboxes or hurtboxes
    - Validate: all bone frame keys are valid frame numbers within [0, totalFrames)
    - _Requirements: 1.7, 2.8_

  - [x] 2.5 Build action state ID → subaction ID mapping
    - Map .slp external action state IDs to DAT internal subaction indices
    - Handle character-specific special move offsets
    - _Requirements: 1.8_

  - [x] 2.6 Implement JSON output and validation
    - Serialize all extracted data to the output JSON schema (bones, subactions, hurtboxes, actionStateMap)
    - Implement `--validate` mode: check all schema rules (bone ordering, bone references, frame ranges, size positivity)
    - Report all violations with descriptive messages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [ ] 3. Checkpoint — Extraction pipeline
  - Run extraction on the user's ISO for at least Fox and Marth
  - Validate output JSON with `--validate` flag
  - Spot-check known moves (Fox jab, Marth fsmash) against reference data from melee.theshoemaker.de

- [x] 4. Create hitbox-loader.js — browser-side data loading
  - [x] 4.1 Create `hitbox-loader.js` with HitboxLoader class
    - Map character IDs (0-25) to JSON filenames
    - `load(charId)`: fetch `hitbox-data/{charName}.json`, parse, cache, return data or null on failure
    - `get(charId)`: synchronous cache lookup
    - `preloadAll(charIds)`: parallel fetch for all characters in a replay
    - Handle 404 (return null, log warning) and parse errors (return null, log error)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.2 Write property test for HitboxLoader caching
    - **Property 4: Loader caching idempotence** — for any character ID, loading twice returns the same object reference without a second fetch
    - **Validates: Requirement 4.2**

- [x] 5. Create bone-resolver.js — bone position resolution
  - [x] 5.1 Create `bone-resolver.js` with BoneResolver module
    - `resolve(charData, subactionId, animFrame)`: look up pre-computed bone positions from JSON
    - Sparse keyframe interpolation: find surrounding keyframes, linearly interpolate between them
    - Rest-pose fallback: return bone restX/restY when subaction has no bone frame data
    - `transformPoint(bonePositions, boneId, offsetX, offsetY, offsetZ)`: project 3D offset to 2D (Z→X, Y→Y, X collapsed)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.2 Implement action state mapping in bone-resolver.js
    - `mapActionToSubaction(charData, actionStateId)`: check explicit map first, then identity for < 341, then null
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.3 Write property tests for BoneResolver
    - **Property 5: Keyframe interpolation bounds** — interpolated positions are bounded by surrounding keyframe values
    - **Property 6: Rest pose fallback** — empty boneFrames returns rest pose positions
    - **Property 7: 3D to 2D projection** — transformPoint maps Z→X, Y→Y correctly
    - **Property 8: Action state mapping** — explicit map takes priority, identity for < 341, null otherwise
    - **Validates: Requirements 5.2, 5.3, 5.4, 6.1, 6.2, 6.3**

- [x] 6. Create hitbox-renderer.js — canvas rendering
  - [x] 6.1 Create `hitbox-renderer.js` with HitboxRenderer module
    - `renderHitboxes(...)`: filter active hitboxes (startFrame <= frame <= endFrame), resolve world positions, draw colored circles
    - Color-coding: ID 0=red, 1=orange, 2=yellow, 3=green with semi-transparency
    - Position computation: bone position + offset, apply facing direction and scale
    - `renderHurtboxes(...)`: draw hurtbox outlines at bone positions, yellow=vulnerable, blue=invincible
    - `getHitboxAtPoint(...)`: point-in-circle hit test for hover tooltip
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2_

  - [x] 6.2 Write property tests for HitboxRenderer logic
    - **Property 9: Hitbox active frame filtering** — hitbox rendered iff startFrame <= frame <= endFrame
    - **Property 10: Hitbox world position computation** — world position matches the formula: charX + (bone.x + offset.z) * scale * facing
    - **Property 11: Hit-test point-in-circle** — getHitboxAtPoint returns hitbox iff point is within circle radius
    - **Validates: Requirements 7.1, 7.3, 7.4, 7.5, 8.1, 8.4, 9.1, 9.2**

- [ ] 7. Checkpoint — Rendering modules
  - Ensure all property tests pass
  - Manually test each module with mock data in a browser console

- [x] 8. Integrate into replay viewer
  - [x] 8.1 Add hitbox/hurtbox toggle controls to player-notes.html
    - Independent toggle buttons for hitbox display and hurtbox display
    - Keyboard shortcut integration (extend existing 'h' key or add new keys)
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 8.2 Wire HitboxLoader into replay load flow
    - At replay load time, call `hitboxLoader.preloadAll()` for characters in the replay
    - _Requirements: 4.1_

  - [x] 8.3 Wire BoneResolver and HitboxRenderer into renderFrame()
    - Per player per frame: map action state → subaction, resolve bone positions, render hitboxes/hurtboxes
    - Graceful degradation: if charData is null, fall back to existing FightCore approximation
    - If subaction has no data, skip hitbox rendering silently
    - Catch and log any rendering errors without crashing
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 8.4 Add hover tooltip for hitbox properties
    - On mousemove, call getHitboxAtPoint for each player
    - Display tooltip with damage, angle, KBG, BKB
    - Hide tooltip when mouse leaves all hitboxes
    - _Requirements: 9.1, 9.2_

- [ ] 9. Checkpoint — Integration testing
  - Load a Fox vs Marth replay on FD with hitbox rendering enabled
  - Verify hitboxes appear at correct positions during attacks
  - Verify hurtboxes track character pose
  - Verify hover tooltip shows correct data
  - Verify graceful fallback for characters without JSON data
  - Compare against reference screenshots from 20XX debug mode or Rwing

- [ ] 10. Extract all 26 characters and commit JSON files
  - [ ] 10.1 Run full extraction for all 26 characters
    - `python extract_hitbox_data.py --iso <path> --outdir hitbox-data/`
    - Validate all 26 output files with `--validate`
    - _Requirements: 1.1, 2.9_

  - [x] 10.2 Commit hitbox-data/*.json to the repo
    - Add hitbox-data/ to git, ensure ISO path is in .gitignore
    - _Requirements: 12.2_

- [x] 11. Cross-platform compatibility check
  - [x] 11.1 Verify HitboxLoader works with both fetch (web) and filesystem read patterns
    - Ensure the loader interface supports future Electron filesystem reads
    - _Requirements: 12.1, 12.3_

- [ ] 12. Final checkpoint
  - Ensure all tests pass
  - Verify hitbox rendering works for multiple characters across different replays
  - Verify toggle controls work independently
  - Verify graceful degradation when JSON files are missing

## Notes

- Tasks marked with `*` are optional property tests that can be skipped for faster MVP
- Phase 1 (tasks 1-3) is Python-only and runs offline with the user's ISO
- Phase 2 (tasks 4-9) is browser-only vanilla JS
- The extraction script depends on `pfirsich/meleeDat2Json` — this is the critical external dependency
- The user's ISO is at `C:\Users\jojog\Desktop\Emulation\Melee Modding\ISOs\VanillaMelee.iso`
- JSON files are committed to the repo; the ISO is never committed
- The existing FightCore overlay (`fightcore.js`) is kept as a fallback and for CC/ASDI tables — it is not removed
