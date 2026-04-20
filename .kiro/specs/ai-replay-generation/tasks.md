# Implementation Plan: AI Replay Generation (Prompt → Practice Scenarios)

## Overview

Build the AI-powered practice scenario generator in phases: (1) labeling tool + action dataset foundation, (2) replay compiler + SLP/GCI writers, (3) sequence validator + LLM prompt layer, (4) token monetization + generation API. The labeling tool and dataset are built first since the entire system depends on having labeled action data. Fox is the first character.

## Tasks

- [x] 1. Action Dataset schema, loader, and validation
  - [x] 1.1 Create `action-dataset/` directory and Fox seed data file (`action-dataset/fox.json`)
    - Define the JSON schema structure with character, actions map, variants, inputs, timing
    - Seed with core movement actions: idle, walk, dash, jump, shorthop
    - Include at least one aerial (shorthop_nair) and one tech skill (wavedash_forward) with full input sequences
    - _Requirements: 2.7, 1.1_

  - [x] 1.2 Implement `action-dataset.js` — ActionDataset class
    - Implement `load(character)` to read and parse `action-dataset/{character}.json`
    - Implement in-memory caching so subsequent loads skip file reads
    - Return null and log warning when character file not found
    - Implement `getAction(character, actionName, context)` with context-dependent variant resolution
    - Implement closest-variant fallback with mismatch warning when no exact context match
    - Implement `listActions(character)` returning all action names
    - Implement `getFrameTiming(character, actionName)` merging hitbox-data timing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.3 Implement Action_Entry validation in ActionDataset
    - Validate monotonically increasing frame values in inputs arrays
    - Validate stick.x, stick.y in [-1.0, 1.0] and trigger in [0.0, 1.0]
    - Validate buttons against allowed Melee button names
    - Validate totalFrames >= last input frame, actionStateId is non-negative integer
    - Validate core movement actions present per character file
    - Return descriptive errors identifying failing field and constraint
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 1.4 Write property test: Action Entry Validation Correctness (Property 2)
    - **Property 2: Action Entry Validation Correctness**
    - Generate arbitrary Action_Entry objects; validator accepts iff all constraints hold
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8**

  - [ ]* 1.5 Write property test: Action Entry Serialization Round-Trip (Property 1)
    - **Property 1: Action Entry Serialization Round-Trip**
    - Serialize valid Action_Entry to JSON, deserialize back, assert equivalence
    - **Validates: Requirements 14.1, 14.2, 14.3**

  - [ ]* 1.6 Write property test: Context-Dependent Variant Resolution (Property 5)
    - **Property 5: Context-Dependent Variant Resolution**
    - For actions with multiple variants, getAction returns the variant matching the provided context
    - **Validates: Requirement 1.4**

- [x] 2. Checkpoint — Action Dataset foundation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Labeling Tool for dataset building
  - [x] 3.1 Implement `labeling-tool.js` — LabelingTool class
    - Implement `detectSegments(slpData)` using slippi-js to parse replays and detect action state transitions
    - Merge consecutive frames with the same action state ID into single segments
    - Extract per-segment controller inputs normalized to frame 0 = segment start
    - Produce ActionSegment array with playerIndex, startFrame, endFrame, actionStateId, inputs
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 3.2 Implement auto-labeling and human label application
    - Implement `autoLabel(segment)` mapping action state IDs to known action names with confidence scores
    - Return null when action state ID has no known mapping
    - Confidence scores in [0.0, 1.0]
    - Implement `labelSegment(segment, actionName, context)` to normalize inputs (adjust for facing direction) and produce Action_Entry
    - Implement `extractInputs(parsedReplay, playerIndex, startFrame, endFrame)` helper
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 3.3 Write property test: Segment Detection Merges Consecutive Same-State Frames (Property 10)
    - **Property 10: Segment Detection Merges Consecutive Same-State Frames**
    - No two adjacent segments share the same action state ID for the same player; inputs start from frame 0
    - **Validates: Requirements 9.2, 9.3, 9.4**

  - [ ]* 3.4 Write property test: Auto-Label Confidence Range (Property 11)
    - **Property 11: Auto-Label Confidence Range**
    - All non-null auto-label results have confidence in [0.0, 1.0]
    - **Validates: Requirement 10.2**

- [x] 4. LLM Function Schema Generation
  - [x] 4.1 Implement `generateFunctionSchema(characters)` in ActionDataset
    - Generate LLM function-calling schema where each action becomes a callable function
    - Include parameter types, descriptions, valid ranges for direction, lCancel, diAngle, target
    - Include only actions for the specified characters
    - Serialize to JSON compatible with target LLM API format
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.2 Write property test: Function Schema Contains Exactly Available Actions (Property 4)
    - **Property 4: Function Schema Contains Exactly Available Actions**
    - Schema contains exactly the union of actions for loaded characters, no extras
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [ ] 5. Checkpoint — Dataset tooling complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5.5. Manual dataset labeling (USER + AI collaborative)
  - This is the bulk data creation phase. The labeling tool (task 3) must be built first. The user provides .slp replays and uses the labeling tool to tag action segments. AI assists with auto-labeling and validation. This is the longest task and the foundation everything else depends on.
  - STOP HERE after building the labeling tool — the user participates in labeling from this point forward.

  - [ ] 5.5.1 Fox core movement dataset
    - **Note**: Single-state actions (idle, walk, dash, run, crouch, jumpsquat, fall, landing) are already captured by the auto-scanner in `action-dataset/fox.json`. Do NOT re-label these manually — they're noise. Focus exclusively on **compound actions** that span multiple states and require precise input timing.
    - **What to label** — use range selection (shift+click) to couple the relevant states:
    - **Wavedash variants** (KneeBend → LandingFallSpecial):
      - `wavedash_forward` — airdodge angle ~17° forward
      - `wavedash_back` — airdodge angle ~17° backward
      - `wavedash_inplace` — airdodge straight down
      - `wavedash_forward_from_dash` — wavedash out of initial dash
      - `wavedash_back_from_dash` — wavedash back out of dash
    - **Waveland variants** (JumpF/JumpAerialF → LandingFallSpecial):
      - `waveland_forward` — land on platform with forward angle
      - `waveland_back` — land on platform with backward angle
      - `waveland_inplace` — land straight down
    - **Dash dance variants** (Dash → Dash alternating):
      - `dash_dance_tight` — 2-4 frame dashes, minimal distance
      - `dash_dance_medium` — 6-8 frame dashes
      - `dash_dance_wide` — 10-15 frame dashes, max distance
    - **Fox trot** (Dash → initial dash again before run):
      - `fox_trot` — repeated initial dashes in same direction
    - **Smash turn / pivot** (Dash → Turn):
      - `smash_turn` — flick stick behind during initial dash to turn
      - `pivot_fsmash` — smash turn into fsmash
      - `pivot_grab` — smash turn into grab
    - **Platform movement**:
      - `platform_drop` — hold down through platform (Squat → Pass)
      - `shield_drop` — shield drop through platform (Guard → SquatRv → Pass)
      - `platform_drop_aerial` — drop through platform into aerial
    - **Shield drop** (Guard → SquatRv):
      - `shield_drop_nair` — shield drop into nair
      - `shield_drop_bair` — shield drop into bair
    - Target: ~30-40 labeled compound movement entries

  - [ ] 5.5.2 Fox aerial dataset
    - **Note**: Single aerial states (nair, fair, bair, uair, dair) are auto-scanned. Label the **compound sequences** — the jump + aerial + landing combination that defines a real technique.
    - **SHFFL (Short Hop Fast Fall L-cancel)** — KneeBend → JumpF → AttackAirX → LandingAirX:
      - `shorthop_nair_lcanceled` — shorthop nair with L-cancel
      - `shorthop_fair_lcanceled` — shorthop fair with L-cancel
      - `shorthop_bair_lcanceled` — shorthop bair with L-cancel
      - `shorthop_dair_lcanceled` — shorthop drill with L-cancel
      - `shorthop_uair` — shorthop uair (usually no L-cancel needed)
    - **Drift variants** (same states, different stick X during aerial):
      - `shorthop_nair_drift_forward` — nair with forward drift
      - `shorthop_nair_drift_back` — nair with backward drift (fadeback)
      - `shorthop_bair_drift_back` — bair retreating
      - `shorthop_bair_drift_forward` — bair approaching (cross-up)
    - **Fullhop aerials** — KneeBend → JumpF (held) → AttackAirX:
      - `fullhop_nair`, `fullhop_fair`, `fullhop_bair`, `fullhop_uair`, `fullhop_dair`
    - **Double jump aerials** — KneeBend → JumpF → JumpAerialF → AttackAirX:
      - `double_jump_uair`, `double_jump_nair`, `double_jump_bair`
    - **Aerial sequences** (multi-hit combos):
      - `drill_shine` — dair → shine (KneeBend → JumpF → AttackAirLw → SpecialLwStart)
      - `drill_grab` — dair → grab on landing
      - `nair_shine` — nair → shine on landing
    - Target: ~30-50 labeled compound aerial entries

  - [ ] 5.5.3 Fox grabs, throws, and ground attacks dataset
    - **Grabs:**
      - standing grab, dash grab, JC grab (jump cancel grab from dash)
      - pivot grab, boost grab (dash → grab with momentum)
      - shield grab (grab out of shield)
    - **Throws:**
      - up throw, down throw, forward throw, back throw
      - up throw → up air (the bread and butter), up throw → bair
      - down throw → tech chase setup
      - forward throw → edgeguard setup
    - **Tilts:**
      - ftilt (forward tilt), utilt (up tilt), dtilt (down tilt)
      - angled ftilt (up angle, down angle)
      - JC utilt (jump cancel up tilt from dash — rare but exists)
    - **Smash attacks:**
      - fsmash (forward smash), usmash (up smash), dsmash (down smash)
      - JC usmash (jump cancel up smash from dash — very common Fox tech)
      - pivot fsmash, charged fsmash, angled fsmash
      - small step fsmash (tiny dash → fsmash for extra range)
    - **Jabs:**
      - jab 1, jab 2, jab 3 (rapid jab / gentleman)
      - jab 1 → grab (jab reset into grab), jab 1 → uptilt, jab 1 → shine
      - jab reset (single jab on missed tech opponent to force getup)
    - **Dash attack:**
      - dash attack (from dash/run)
    - Target: ~50-70 labeled entries

  - [ ] 5.5.4 Fox specials dataset
    - **Note**: Individual shine/laser/firefox states are auto-scanned. Label the compound techniques.
    - **Shine sequences** (SpecialLwStart → jump cancel → next action):
      - `waveshine_forward` — shine → jump cancel → wavedash forward
      - `waveshine_back` — shine → jump cancel → wavedash back
      - `multishine` — shine → jump cancel → shine → jump cancel (repeated)
      - `shine_grab` — shine → jump cancel → grab
      - `shine_nair` — shine → jump cancel → shorthop nair
      - `shine_bair` — shine → jump cancel → shorthop bair
      - `shine_usmash` — shine → JC upsmash
      - `shine_oos` — shine out of shield (Guard → SpecialLwStart)
    - **Laser sequences** (KneeBend → JumpF → SpecialNStart → SpecialNLoop):
      - `shorthop_laser` — single laser from shorthop
      - `shorthop_double_laser` — two lasers from shorthop (Falco-specific timing)
      - `fullhop_laser` — laser from fullhop
    - **Firefox** (SpecialHiHold → SpecialHi → SpecialHiFall):
      - `firefox_high` — straight up angle
      - `firefox_diagonal_forward` — ~45° forward
      - `firefox_horizontal` — horizontal
      - `firefox_to_ledge` — angled to grab ledge
    - Target: ~20-30 labeled compound special entries

  - [ ] 5.5.5 Fox defensive options dataset
    - **Shield:**
      - full shield (hard press), light shield (partial trigger press)
      - angled shield (tilt stick while shielding), shield DI (shift shield position)
      - shield stop (dash → shield for positioning)
      - dashing shield (shield during dash)
    - **Out of shield (OOS) options:**
      - shine OOS (frame 1), nair OOS (frame 6), bair OOS (frame 6), uair OOS
      - upsmash OOS (JC upsmash), grab OOS (frame 7)
      - roll OOS (left/right), spotdodge OOS
      - wavedash OOS (jump → airdodge from shield)
      - shield drop → aerial (from platform)
      - buffer roll (hold direction during shieldstun)
    - **Spotdodge:**
      - spotdodge (in place invincibility)
      - spotdodge → shine, spotdodge → grab, spotdodge → usmash
    - **Roll:**
      - roll forward, roll backward
      - roll from ledge (ledge roll)
    - **Airdodge:**
      - airdodge angles (all directions — 16+ angles)
      - airdodge to ledge, airdodge to stage
      - airdodge in place (neutral airdodge)
    - **Teching:**
      - tech in place, tech roll left, tech roll right
      - missed tech (no tech → lie on ground)
      - missed tech → getup attack, missed tech → getup stand, missed tech → getup roll
      - wall tech, wall tech jump, ceiling tech
      - ledge tech (tech against stage wall when hit near ledge)
      - Amsah tech (ASDI down + tech to survive at high percent)
    - **DI (Directional Influence):**
      - survival DI (DI away from blast zone)
      - combo DI (DI to escape combos — varies by move/angle)
      - slight DI (small DI input for subtle trajectory change)
      - no DI (neutral stick — sometimes intentional)
      - SDI (smash DI — wiggle stick during hitlag for position shift)
      - ASDI (automatic SDI — hold direction during hitlag)
      - ASDI down (hold down to collide with ground and avoid followups)
    - **Crouch cancel (CC):**
      - crouch cancel → shine, crouch cancel → grab, crouch cancel → dtilt, crouch cancel → dsmash
      - ASDI down (similar effect to CC but from standing via c-stick)
    - **Powershield:**
      - powershield (release shield within 2 frames of hit)
      - powershield → grab, powershield → shine, powershield → aerial
      - powershield projectile (reflects projectile)
    - **V-cancel:**
      - V-cancel (press Z within 1 frame of being hit while airborne — halves knockback)
    - Target: ~80-100 labeled entries

  - [ ] 5.5.6 Fox ledge options and recovery dataset
    - **Grabbing ledge:**
      - grab ledge from below (up-B sweet spot), grab ledge from above (run off → fastfall → grab)
      - grab ledge from Firefox, grab ledge from side-B
      - grab ledge from walljump
      - refresh invincibility (drop from ledge → regrab)
    - **From ledge (with invincibility):**
      - ledgedash (drop → double jump → airdodge onto stage — Fox's best ledge option)
      - haxdash (frame-perfect ledgedash variant)
      - tournament winner (ledge jump → immediate aerial)
      - ledge hop aerial (ledge jump → nair/bair/fair/dair)
      - ledge hop laser (ledge jump → laser)
      - ledge jump → waveland onto stage
    - **From ledge (standard options):**
      - normal getup (climb up), ledge roll, ledge attack (getup attack)
      - ledge jump (neutral jump from ledge)
      - drop from ledge → double jump, drop from ledge → aerial
      - drop from ledge → Firefox/side-B back to ledge (ledge stall)
    - **Ledge stalling:**
      - Firefox stall (up-B to ledge repeatedly)
      - Fox Illusion stall (side-B to ledge)
      - shine stall → firestall (shine turnaround → up-B to regrab)
      - invincible ledge hop stall
    - **Recovery mixups:**
      - Firefox angle mixups (high, low, horizontal, to stage, to ledge)
      - side-B to ledge vs side-B to stage
      - double jump → airdodge to ledge
      - walljump → aerial, walljump → up-B
      - drift mixups (DI toward/away from stage during knockback)
    - Target: ~40-60 labeled entries

  - [ ] 5.5.7 Fox edgeguarding dataset
    - **Edgeguard positions:**
      - standing at ledge, crouching at ledge, shielding at ledge
      - run off stage → aerial (bair, nair, dair, fair)
      - run off stage → shine spike
      - ledge hop → aerial (bair, nair)
    - **Edgeguard tools:**
      - shine spike (aerial shine offstage), repeated shine spike
      - bair edgeguard (run off → bair), nair edgeguard
      - dair edgeguard (drill spike), fair edgeguard
      - up tilt at ledge (anti-air recovery)
      - fsmash at ledge (2-frame punish on ledge grab)
      - grab at ledge → back throw (for re-edgeguard)
      - laser edgeguard (shoot laser at recovering opponent)
    - **Covering recovery options:**
      - cover high recovery (jump → aerial), cover low recovery (run off → aerial)
      - cover ledge snap (dtilt/fsmash at ledge), cover stage land (dash attack/grab)
      - react to airdodge (wait → punish landing)
    - Target: ~30-50 labeled entries

  - [ ] 5.5.8 Fox combo routes and sequences dataset
    - **Bread and butter combos:**
      - up throw → up air (the classic, percent-dependent)
      - up throw → up air → up air (low percent)
      - up throw → bair (kill confirm at high percent)
      - shine → waveshine → grab, shine → waveshine → usmash
      - drill → shine → waveshine → grab
      - nair → shine → grab, nair → uptilt → uair
    - **Tech chase sequences:**
      - react to tech in place → grab/shine, react to tech roll → dash → grab
      - react to missed tech → jab reset → grab
      - react to missed tech → charged fsmash/dsmash
      - regrab → rethrow (repeated tech chase)
    - **Platform combos:**
      - up throw → waveland onto platform → tech chase
      - up air → waveland onto platform → up air
      - up smash → waveland onto platform → follow up
    - **Kill confirms:**
      - up throw → up air (kill percent), up throw → bair (kill percent)
      - up smash (raw kill move)
      - shine → bair (offstage kill)
      - drill → shine → bair (offstage)
    - **Chaingrab (FD):**
      - grab → up throw → regrab (weight/percent dependent)
      - grab → down throw → regrab (spacies)
    - Target: ~40-60 labeled entries

  - [ ] 5.5.9 Universal actions (shared across all characters)
    - **These actions have identical or near-identical inputs for every character:**
      - idle, walk, dash, run, crouch, jumpsquat, shorthop, fullhop, double jump, fastfall
      - shield, light shield, spotdodge, roll forward, roll backward
      - airdodge (all angles), tech in place, tech roll left, tech roll right
      - missed tech getup options (stand, roll, attack)
      - ledge getup, ledge roll, ledge attack, ledge jump
      - grab, dash grab, all 4 throws
      - DI directions, SDI, ASDI down
    - **Character-variable but same input pattern:**
      - wavedash (same input, different slide distance per character)
      - L-cancel (same input, different landing lag per aerial per character)
      - dash dance (same input, different dash length per character)
    - Label these once and mark as "universal" — only re-label per character where timing differs significantly
    - Target: ~30-40 universal entries that apply to all characters

  - [ ] 5.5.10 Expand to Falco
    - All Fox entries carry over for shared actions
    - **Falco-specific:**
      - short hop laser (higher arc than Fox), full hop laser, double laser
      - dair (spike) → shine, dair → grab, dair pillar combos (dair → shine → dair → shine)
      - shine → dair (pillar), shine → bair, shine → grab
      - laser heights (short hop vs full hop vs platform laser)
      - phantasm (side-B) shortened, phantasm to ledge
      - firebird (up-B) angles, shortened firebird
      - laser pressure (approaching laser → aerial/grab)
      - shield pressure (dair → shine → dair on shield)
    - Target: ~60-80 new Falco-specific entries

  - [ ] 5.5.11 Expand to Marth
    - **Marth-specific:**
      - tipper vs sourspot spacing (fair, fsmash, dtilt — same move, different spacing)
      - dash dance grab (Marth's primary neutral tool)
      - dtilt (down tilt) spacing and follow-ups
      - fair chains (fair → fair → fair — the Ken combo setup)
      - Ken combo (fair → dair spike offstage)
      - reverse Ken combo, space animal slayer
      - chaingrab (uthrow → regrab, percent/weight dependent)
      - pivot fsmash (turnaround fsmash from dash)
      - dolphin slash (up-B) edgeguard, dolphin slash OOS
      - dancing blade (side-B) variants (up/down/neutral paths)
      - counter (down-B)
      - shield breaker (neutral-B) charged/uncharged
      - ledge dash (Marth has different timing than Fox)
      - fair edgeguard, dair edgeguard (spike), dtilt edgeguard at ledge
    - Target: ~60-80 new Marth-specific entries

  - [ ] 5.5.12 Expand to Sheik
    - **Sheik-specific:**
      - needle charge, needle throw (grounded, aerial, short hop needle)
      - needle cancel (jump cancel needle charge)
      - boost grab (dash → JC grab with extra range)
      - chain (side-B — rarely used competitively)
      - vanish (up-B) angles, vanish to ledge, vanish through stage
      - transform to Zelda (down-B — niche)
      - ftilt (Sheik's primary neutral poke), ftilt → ftilt
      - fair (forward air — Sheik's main aerial)
      - tech chase (react to tech → regrab — Sheik's core punish)
      - down throw → tech chase, down throw → fair
      - up throw → up air (at kill percent)
      - platform needle (needle from platform)
      - bair edgeguard, fair edgeguard, needle edgeguard
    - Target: ~50-70 new Sheik-specific entries

  - [ ] 5.5.13 Expand to Captain Falcon
    - **Falcon-specific:**
      - knee (forward air sweetspot — the Knee of Justice)
      - stomp (down air spike)
      - gentleman (jab 1 → jab 2 → jab 3 single hit — not rapid jab)
      - raptor boost (side-B), raptor boost aerial
      - falcon kick (down-B) grounded, falcon kick aerial
      - falcon dive (up-B) to ledge, falcon dive on stage
      - up air (Falcon's primary juggle tool)
      - nair (Falcon's combo starter)
      - dash dance grab (Falcon's huge dash dance)
      - tech chase (react → regrab, Falcon's core punish on FD)
      - up throw → knee (kill confirm at high percent)
      - down throw → tech chase
      - stomp → knee, nair → knee
      - moonwalk (Falcon has one of the best moonwalks)
      - sacred combo (dair → dair → knee offstage)
      - ledgedash (Falcon has a good ledgedash)
    - Target: ~50-70 new Falcon-specific entries

  - [ ] 5.5.14 Expand to Peach, Puff, ICs, Pikachu, Yoshi, Luigi, Ganondorf, Samus, Doc, Link, Young Link
    - **Peach-specific:** float, float cancel aerials, turnip pull, turnip throw, bomber (side-B), parasol (up-B), down smash, float heights (low/mid/high)
    - **Puff-specific:** rest (down-B), rising pound (side-B), sing (up-B), 5 aerial jumps, bair wall, up throw → rest, ledge cancel bair
    - **ICs-specific:** wobble, desyncs (all types), handoff, blizzard, belay (up-B), ICs chaingrab
    - **Pikachu-specific:** quick attack angles (up-B), thunder (down-B), up air chains, tail spike
    - **Yoshi-specific:** double jump armor, parry (shield → release frame 1), egg throw angles, platform cancel
    - **Luigi-specific:** wavedash (longest in game), misfire (side-B), shoryuken (up-B sweetspot), down smash
    - **Ganondorf-specific:** stomp, wizard's foot, flame choke, gerudo dragon, up air, fair (similar to Falcon but slower)
    - **Samus-specific:** charge shot, missile (homing/super), bomb jump, grapple beam, super wavedash, extended grapple
    - **Doc-specific:** pill, cape, up-B cancel, down smash
    - **Link/YL-specific:** bomb recovery, boomerang, hookshot/grapple, bomb pull
    - Lower priority — expand incrementally as demand requires
    - Target: ~30-50 new entries per character

  - [ ] 5.5.15 Dataset quality review and gap analysis
    - Run validation on entire dataset (task 1.3 validator)
    - Identify missing actions: cross-reference FightCore move list against dataset coverage per character
    - Identify missing contexts: ensure left/right facing, grounded/airborne, from-shield, from-ledge variants exist
    - Cross-reference with hitbox-data frame timings to verify totalFrames and timing fields are accurate
    - Verify L-cancel frame windows match known data (7 frame window before landing)
    - Verify wavedash angles produce correct slide distances per character
    - Test: load labeled entries back through the labeling tool to verify inputs reproduce the expected action state
    - Fix any entries where inputs don't produce the expected action state in-game

- [ ] 6. Sequence Validator
  - [ ] 6.1 Implement `sequence-validator.js` — SequenceValidator class
    - Implement `validate(actions, characters)` checking full sequence validity
    - Implement `canPerformAction(character, actionName, state)` checking grounded/airborne prerequisites
    - Implement `checkTransition(prev, next, state)` verifying frame gaps and IASA cancels
    - Reject actions during hitstun, wrong ground/air state, or before actionable frame
    - Return error array with action index, name, and human-readable reason on failure
    - Return valid result on success
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.2 Write property test: Sequence Validation Rejects State-Incompatible Actions (Property 6)
    - **Property 6: Sequence Validation Rejects State-Incompatible Actions**
    - Actions requiring grounded state while airborne (or vice versa) or starting before actionable frame are rejected with identifying error
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 7. Replay Compiler
  - [ ] 7.1 Implement `replay-compiler.js` — ReplayCompiler class core
    - Implement constructor accepting ActionDataset, stage, and character config
    - Implement `getCharacterState(playerIndex)` returning full CharacterState
    - Implement `advanceFrame(inputs)` stepping simulation one frame with controller inputs
    - Initialize characters at stage spawn positions
    - Track position, velocity, facing, percent, actionState, actionFrame, actionableFrame per character
    - _Requirements: 6.1, 6.2, 6.6_

  - [ ] 7.2 Implement `compile(actions)` and hit resolution
    - Implement `compile(actions)` looping through validated action sequence, resolving inputs from ActionDataset, advancing frames
    - Implement `resolveHit(attackerIdx, defenderIdx, hitbox)` using IKneeData knockback formula
    - Apply knockback vector and hitstun to defender's CharacterState on hit
    - Produce complete CompilationResult with per-frame per-player inputs and states
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 7.3 Write property test: Compilation Produces Complete Frame Data (Property 7)
    - **Property 7: Compilation Produces Complete Frame Data**
    - Every frame has Controller_Input and Character_State per player with valid fields
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 7.4 Write property test: Compiled Inputs Match Dataset (Property 8)
    - **Property 8: Compiled Inputs Match Dataset**
    - Controller inputs at startFrame + input.frame match the ActionDataset variant values
    - **Validates: Requirement 6.3**

  - [ ]* 7.5 Write property test: Hit Resolution Applies Correct Knockback (Property 9)
    - **Property 9: Hit Resolution Applies Correct Knockback**
    - Defender velocity and hitstun match IKneeData computation on hit
    - **Validates: Requirements 6.4, 6.5**

- [ ] 8. Checkpoint — Compiler and validator complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. SLP Binary Writer
  - [ ] 9.1 Implement `slp-writer.js` — SlpWriter class
    - Implement `write(compilation, metadata)` producing complete .slp binary in UBJSON event stream format
    - Implement `writeGameStart(metadata)` with stage ID, character IDs, player ports, Slippi version
    - Implement `writePreFrame(frameIndex, playerIndex, input)` with joystick, c-stick, trigger, button bitfields
    - Implement `writePostFrame(frameIndex, playerIndex, state)` with actionStateId, position, facing, percent, shield, stocks, lCancel
    - Implement `writeGameEnd(endMethod)` with end method code
    - Target Slippi v3.x format, ensure output loadable by Slippi Desktop, slippilab, and project viewer
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 9.2 Implement `writeGci(slpData, targetFrame, playerIndex)` for GCI savestate conversion
    - Use `@gcpreston/tm_replay_wasm` to convert .slp binary to UnclePunch Training Mode .gci savestate
    - Center savestate around specified target frame
    - Return error with reason on conversion failure, provide .slp as fallback
    - Ensure .gci is loadable in Training Mode Community Edition on console and Dolphin
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 9.3 Write property test: SLP Binary Round-Trip (Property 3)
    - **Property 3: SLP Binary Round-Trip**
    - Write .slp via SlpWriter, parse with slippi-js; game start metadata, pre-frame inputs, and post-frame state match originals
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 15.1, 15.2, 15.3**

- [ ] 10. LLM Prompt Layer
  - [ ] 10.1 Implement `llm-prompt-layer.js` — LLM Prompt Layer
    - Implement prompt construction: include character list, stage, available actions in system prompt
    - Send natural language prompt + action function schema to LLM API
    - Parse LLM response into ordered array of Compiled_Action objects
    - Reject and retry with corrective prompt when LLM returns unknown action names
    - Retry up to 2 additional times on parse failure before returning error
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 10.2 Write property test: LLM Response Parsing (Property 14)
    - **Property 14: LLM Response Parsing**
    - Valid LLM response JSON with action function calls parses into equivalent Compiled_Action array
    - **Validates: Requirement 4.2**

- [ ] 11. Checkpoint — Core pipeline complete (dataset → compiler → SLP/GCI → LLM)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Token Manager and Monetization
  - [ ] 12.1 Implement `token-manager.js` — TokenManager class
    - Implement `estimateCost(request)` computing cost from Pricing_Tier and interaction multiplier
    - Implement `getPricingTier(request)` classifying by action count, character count, duration thresholds
    - Implement `checkBalance(userId, requiredTokens)` checking sufficient balance
    - Implement `deductTokens(userId, tokens, reason)` with transaction logging
    - Reject requests with insufficient balance, returning current balance and required amount
    - Free tier: 0 tokens, up to 3 actions, 1 character, 180 frames
    - Cost formula: ceil(baseCost * (1 + hitInteractions * 0.1))
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 12.2 Write property test: Pricing Tier Classification and Cost Calculation (Property 12)
    - **Property 12: Pricing Tier Classification and Cost Calculation**
    - Correct tier assigned by thresholds; cost = ceil(baseCost * (1 + hitInteractions * 0.1))
    - **Validates: Requirements 11.1, 11.2, 11.3**

  - [ ]* 12.3 Write property test: Token Balance Enforcement (Property 13)
    - **Property 13: Token Balance Enforcement**
    - Request allowed iff balance >= cost; post-deduction balance = original - cost
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [ ] 13. Generation API — Wire everything together
  - [ ] 13.1 Implement `generation-api.js` — Netlify Function endpoint
    - Handle POST with prompt, characters, stage
    - Orchestrate full pipeline: cost estimation → token deduction → LLM translation → validation → compilation → SLP writing → GCI conversion
    - Return both .slp and .gci binaries in response
    - Return error response identifying failing stage with human-readable message on any pipeline failure
    - Enforce Pricing_Tier limits before invoking LLM
    - Allow free tier without authentication
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 14. Final checkpoint — Full pipeline integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The labeling tool (task 3) is built early because the manually curated dataset is the foundation everything else depends on
- Fox is the first character to build the dataset for — most common, most data available
- Each task references specific requirements for traceability
- Property tests validate the 14 correctness properties defined in the design document
- The existing project infrastructure (hitbox-data, IKneeData, slippi-js, tm_replay_wasm) is leveraged throughout
