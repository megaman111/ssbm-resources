# Megaman's SSBM Resources — TODO / Feature Roadmap

---

## Active Specs & Execution Order

| # | Spec | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 1 | **3D Model Rendering** | Tasks ready | 🔴 Next | Replace SVG silhouettes with Three.js 3D models + hitbox spheres. Models extracted. `.kiro/specs/3d-model-rendering/` |
| 2 | **Accurate Hitbox Rendering** | Phase 1+2 done, Phase 3 = spec #1 | 🟡 Blocked by #1 | 2D hitbox system works (trails, tooltips, data). Alignment needs 3D rendering to fix. `.kiro/specs/accurate-hitbox-rendering/` |
| 3 | **Modular Matchup Pages** | Spec complete (req + design + tasks) | 🟢 Ready | Convert hardcoded HTML matchup pages to JSON-driven modular blocks. `.kiro/specs/modular-matchup-pages/` |
| 4 | **IKneeData Calculator** | ✅ Done | 🟢 Low | Calculator works on site. Spec can be archived. `.kiro/specs/ikneedata-calculator/` |
| 5 | **Live USB Slippi Mirroring** | Needs spec | 🟡 Research | Stream live Melee gameplay to the web viewer via USB Slippi mirroring. Needs spec. |
| 6 | **AI Replay Generation (Prompt→Replay)** | Needs spec | 🟡 Research | Describe a scenario in natural language → generate a playable .slp replay. Needs manual input dataset + LLM integration. Monetizable. |

### Recommended execution order:
1. **3D Model Rendering** — biggest impact, fixes hitbox alignment, makes the viewer look like Rwing
2. **Modular Matchup Pages** — independent of #1, can be done in parallel or after
3. **IKneeData Calculator** — ✅ done, working on site
4. **Accurate Hitbox Rendering** remaining tasks — auto-resolved by #1 (3D rendering eliminates 2D projection issues)
5. **Live USB Slippi Mirroring** — needs a full spec first (research Slippi console mirroring protocol, WebUSB/WebSerial feasibility, relay server design)
6. **AI Replay Generation** — long-term moonshot, needs manual input dataset first, then LLM fine-tuning/prompting layer

---

## Replay Viewer Module (slippilab parity + beyond)

### Rendering Accuracy
- [x] Character silhouette rendering from animation zips
- [x] ACTION_NAMES array (341 entries, matches slippilab)
- [x] COMMON_ANIM_MAP + CHAR_ANIM_EXTRA (all 26 characters)
- [x] CHAR_SPECIALS (all 26 characters)
- [x] Animation resolution order (animationMap → specialsMap → raw actionName)
- [x] Shield rendering (GuardOn/Guard/GuardReflect/GuardDamage)
- [x] Shield offset per character
- [x] Shield stick tilting
- [x] Fox/Falco shine hexagon
- [x] Character scale values (all 26 characters)
- [x] Zoom/pan controls (mouse wheel + drag)
- [x] Randall (Yoshi's Story moving platform)
- [x] **Facing direction fix** — `actionFollowsFacingDirection()`: Jump/UpB animations use current facing, all others use start-of-action facing to prevent mid-animation flips
- [x] **DamageFlyRoll rotation** — tumble animation rotates based on velocity direction
- [x] **Spacie UpB rotation** — Fox/Falco fire rotates based on joystick angle at start of action
- [x] **L-cancel indicator** — red outline for missed L-cancels (lCancelStatus === 2)
- [x] **Invulnerability/intangibility indicator** — blue outline when hurtboxCollisionState !== 0 (vulnerable)
- [x] **GuardDamage trigger fix** — during shieldstun, read trigger from start-of-action frame instead of current frame
- [x] **Shield size formula** — use slippilab's triggerStrengthMultiplier formula: `(1 - 0.5*(trigger-0.3)/0.7)` then `(hp * multiplier / 60) * 0.85 + 0.15`
- [x] **Shield: exclude GuardOff** — slippilab only shows shield for GuardOn/Guard/GuardReflect/GuardDamage (not GuardOff)

### Projectile/Item Rendering
- [x] Fox laser (3 hitbox circles + line, rotates with velocity)
- [x] Falco laser (4 hitbox circles + line, rotates with velocity)
- [x] Sheik needles (circle)
- [x] Turnip (circle)
- [x] Yoshi egg thrown (circle)
- [x] Mario fireball (circle)
- [x] Luigi fireball (circle)
- [x] Samus missile (circle, homing vs smash size)
- [x] Samus bomb (circle, explosion state)
- [x] Samus chargeshot (circle, size by charge level)
- [x] Shy Guy / Fly Guy on Yoshi's Story (circle)

### Camera
- [x] **Dynamic camera** — smooth follow camera that tracks players, auto-zoom based on player distance (slippilab Camera.tsx)
- [x] Toggle between fixed view and dynamic camera

### Stage Features
- [x] **Fountain of Dreams moving platforms** — use `stageEvents` from frame data (fodLeftPlatformHeight/fodRightPlatformHeight, replay format >= 3.18.0.0)
- [ ] Whispy wind indicator (Dream Land)
- [ ] Pokemon Stadium transformations indicator

### Controller & State Display
- [x] **Controller visualization** — SVG GameCube controller per player showing all inputs (sticks, buttons  triggers, d-pad) in real-time
- [x] **Player state info** — character name, animation state name, frame counter, hitlag/hitstun/invulnerability indicators
- [x] **Download savestate button** — generates .gci savestate file (300 frames) using `@gcpreston/tm_replay_wasm`, loadable in Training Mode Community Edition
- [x] **Hide savestate for doubles** — savestate button hidden when replay has >2 players (doubles .gci not supported yet)
- [x] **SLP Enforcer integration** — per-player button runs altf4's libenforcer WASM to detect controller rule violations (Box: travel time, c-stick, crouch uptilt, SDI, input fuzzing; Analog: goomwave, uptilt rounding)

### DI / Trajectory
- [ ] **DI line visualizer** — show the DI input direction as a line from the character when in hitstun/knockback, indicating where the player is holding to influence their trajectory

### UI/Controls
- [x] **Debug mode** — show action state ID, frame counter, position, animation name per player (toggle with 'd' key)
- [x] **Fullscreen mode** (toggle with 'f' key)
- [x] **Keyboard shortcuts** — j/k/l for seek, number keys for percentage jump
- [x] **Toggleable grid overlay** — Slippi Lab style coordinate grid with adaptive spacing, origin axes, and labels (toggle with 'g' key)
- [x] **Toggleable hitbox data overlay** — shows FightCore frame data (move name, active frames, damage, angle, KBG/BKB) per player during attacks (toggle with 'h' key)
- [x] **Timer display** — Melee-accurate timer with hundredths conversion (slippilab lookup table), shown on canvas and in HUD
- [ ] **Highlight navigation** — jump between notable moments (kills, combos, etc.) with prev/next hotkeys using clips panel data
- [ ] **Kill zone overlay** — colored regions on canvas showing where a move at current % would kill, based on blast zone distances
- [ ] **Reaction point preview** — toggle button that shows a ghost/preview of the game state 15 frames ahead (human reaction time), so you can see where you could have set your reaction point. Similar to the rewinding feature concept — helps identify "what could I have reacted to here?" moments during VOD review.
- [x] **Practice plan generator** — auto-summarize habits from clips data (missed L-cancels, shield options, ledge habits) into a "here's what to work on" report, includes edgeguard analysis and opponent recovery pattern tracking might be hard to implement

### FightCore Integration
- [x] **FightCore module** (`fightcore.js`) — reusable ES module that loads/caches character move data from FightCore GitHub repo, calculates CC and ASDI Down max percents using Melee knockback formula
- [x] **CC / ASDI Down quick-reference panel** — collapsible panel in replay viewer showing crouch cancel and ASDI down max percents for every attacker→defender matchup in the current replay

### Clips Panel
- [x] **Clips panel** — collapsible sections for Kill Combos, Grabs, Edgeguards, Crouch Cancels, Missed L-Cancels, Shield Options, Ledge Options

### Modularity
- [ ] Extract replay viewer into standalone reusable module (embeddable on any page)
- [ ] Concept-to-replay linking — click a concept and it opens the replay viewer at a specific moment
- [ ] Doubles support (4 players)
- [x] **Stick map overlay** — persistent container outside controller panel, updates with frame data

### FightCore Data Module (Reusable)
- [x] `fightcore.js` — standalone ES module, importable from any page
- [x] Loads per-character move data from FightCore GitHub (cached)
- [x] CC / ASDI Down percent calculator (Melee knockback formula)
- [x] Action state → move name mapping for real-time frame data lookup
- [x] Integrate into matchup pages for per-matchup CC/ASDI reference tables (`cc-table-builder.js` shared module, all 15 matchup pages)
- [ ] Integrate into Way of Fox for character-specific frame data quick reference
- [ ] Add kill percent calculations — per move, per stage, based on blast zone distances

### FightCore Inline Frame Data Module (New)
The goal is to make move names in matchup page text and player notes interactive — when a move name appears in a box (e.g. "nair", "up smash", "down tilt"), it becomes a clickable link that shows a popup/tooltip with:
- Hitbox visualization (from the ISO-extracted hitbox data when available, or FightCore approximation)
- Frame data: startup, active frames, total frames, IASA, landing lag
- Damage, angle, KBG, BKB per hitbox
- CC and ASDI Down max percents for the current matchup context

Implementation approach:
- [ ] Build a `move-linker.js` module that scans text content for known move names and wraps them in clickable spans
- [ ] Move name dictionary: map common terms ("nair", "up smash", "shine", "drill", "fair", etc.) to FightCore move IDs per character
- [ ] On click/hover: show a popup card with the move's frame data + a mini hitbox visualization
- [ ] Context-aware: when on a matchup page (e.g. Fox vs Marth), the popup shows data for the relevant character
- [ ] Taggable: allow manually tagging a word as a move reference in the matchup page editor (for ambiguous terms)
- [ ] Works in both matchup page sections and player notes
- [ ] When ISO-extracted hitbox data is available, show accurate hitbox circles in the popup; otherwise fall back to FightCore data
- [ ] Integrate with the modular matchup pages system — move links are auto-detected in text blocks during rendering

### IKneeData Calculator Module
- [x] Melee frame data calculator (like IKneeData)
- [x] Knockback calculator
- [x] Combo/DI calculator
- [ ] Hitbox visualization
- [x] Embeddable as a module on any page
- [x] **FoD platform sliders** — two range sliders for Fountain of Dreams side platforms (left/right), adjustable height 7.5–27.375, updates stage rendering and trajectory calculations in real-time. `populateFromReplay()` accepts `fodLeftY`/`fodRightY` for replay viewer integration.
- [x] Replay viewer integration — pause on a frame and auto-populate the calculator with that frame's data
- [ ] **Fix calculator not loading the right frame data on hit** — calculator overlay opens but doesn't always populate with the correct move/hitbox when pausing on a hit frame. Needs debugging of `detectHitOnFrame` → `updateCalcFromFrame` → `populateFromReplay` pipeline.

### VOD Linking Module
- [x] Link VODs (YouTube/Twitch timestamps) to notes
- [x] Embedded VOD player with timestamp jumping (full-modal YouTube/Twitch iframe)
- [ ] **Fix VOD attach not saving** — attaching a VOD link via the note card button may not persist correctly; needs debugging of `videoUrl` field save/export flow
- [ ] Cross-reference VODs with .slp replays
- [ ] Side-by-side VOD + replay viewer — sync stream footage with input data

### Concept-to-Replay Linking
- [ ] Tag concepts/lessons with specific replay moments
- [ ] Click a concept → opens replay viewer at the relevant frame
- [ ] Annotate replays with concept tags
    
---

## Matchup Pages
- [ ] **Matchup-specific replay filters** — on each matchup page, pull all player notes/replays tagged with that character and browse them inline
- [ ] **Kill percent tables** — per-move kill percents by stage (requires IKneeData calculator module; tab stubbed in replay viewer sidebar) (in replay viewer sidebar)
- [ ] **Stage-specific data overlays** — platform movement patterns, kill zone visualization per stage

---

## Site-Wide
- [ ] Make all modules embeddable on any page (way-of-fox, matchup pages, etc.)
- [ ] Unified module loading system
- [ ] Mobile-friendly replay viewer controls

---

## Live USB Slippi Mirroring to Web Viewer (Needs Spec)

Stream live Melee gameplay from a console (via Slippi USB mirroring) directly into the web-based replay viewer. Instead of streaming full video, we only need a minimal data stream — the game is deterministic, so we can reconstruct the full visual state from just the initial conditions + sequential inputs.

### Core Concept
Melee is deterministic: given the same starting state and the same inputs on the same frames, the game produces identical results. This means we don't need to stream the full game state per frame — we just need:
1. **RNG seed** — the game's random seed at match start (determines item spawns, Peach turnips, G&W hammer, etc.)
2. **Starting positions** — character selections, ports, stage, starting positions
3. **Sequential controller inputs** — per-frame stick/button/trigger data for each player (same data Slippi already captures)

The web viewer already renders characters, stages, hitboxes, and animations from .slp frame data. The live mirroring system would feed the same data format in real-time instead of from a file.

### Why This Needs a Spec
This is a complex system with multiple unknowns that need research and design:

- [ ] **Slippi console mirroring protocol** — how does Slippi's existing mirror mode work? What data does the Wii send over USB? Is it raw .slp frame data or something else? Reference: `project-slippi/slippi-desktop-app` mirror mode, `project-slippi/Ishiiruka` (Slippi Dolphin) relay code
- [ ] **Data transport** — WebUSB/WebSerial for direct browser-to-Wii? Or a lightweight local relay server (Node/Python) that reads USB and pushes to the browser via WebSocket?
- [ ] **Frame data format** — can we reuse the existing .slp frame format (`pre`/`post` frame data) as-is, or do we need a lighter wire format for real-time streaming?
- [ ] **RNG seed extraction** — where in the Slippi data stream does the RNG seed appear? Is it in the game start payload? Need to verify this is captured and forwarded
- [ ] **Latency budget** — USB polling → relay → WebSocket → browser render. What's the end-to-end latency? Is sub-100ms achievable?
- [ ] **Sync model** — the viewer needs to handle frames arriving faster or slower than 60fps. Buffer strategy? Drop frames? Interpolate?
- [ ] **Rollback / desync handling** — if a frame is missed or arrives out of order, how do we recover? Melee is deterministic but only if we have every input
- [ ] **Multi-viewer support** — can multiple browser tabs/devices watch the same live stream? Would need a relay server with fan-out
- [ ] **Security** — if this goes through a relay server, how do we prevent unauthorized access to the stream?
- [ ] **Electron vs Web** — direct USB access is easier in Electron (node-hid, serialport). Browser-only path is harder (WebUSB/WebSerial permissions, CORS). Spec should cover both paths.
- [ ] **Integration with existing viewer** — the replay viewer currently expects a complete .slp file. Need to refactor to accept a streaming frame source (iterator/observable pattern) alongside the existing file-based path.

### Key References
- `project-slippi/slippi-desktop-app` — has console mirroring implementation (Electron + node)
- `project-slippi/slippi-js` — JS library for parsing .slp data, may have streaming support
- `vinceau/slippilab` — web-based viewer we've already referenced, file-based only
- Slippi console relay protocol — the Wii sends data over USB to a connected computer, which Slippi Desktop relays to Dolphin for mirror playback
- Fizzi's Slippi architecture docs (if available)

### Spec TODO
- [ ] Create `.kiro/specs/live-slippi-mirroring/` spec directory
- [ ] Research phase: investigate Slippi's USB mirroring protocol and data format
- [ ] Requirements doc: define what "live mirroring" means for our viewer (latency targets, supported setups, fallback behavior)
- [ ] Design doc: relay server architecture, frame streaming protocol, viewer integration points
- [ ] Tasks: implementation plan with clear milestones

---

## AI Replay Generation: Prompt → Playable .slp (Needs Spec)

Describe a Melee scenario in natural language ("Fox dash dances then nairs Marth at 40%") and generate a frame-perfect .slp replay file that plays back in the viewer. Monetizable via token-based pricing.

### Core Concept
Melee inputs are deterministic sequences of stick positions, button presses, and trigger values on specific frames. Every action a character can perform maps to a known input sequence with exact frame timings. If we build a complete dataset mapping human-readable actions to frame-level input sequences, an LLM can compose those primitives into full replay scripts.

### Phase 1: Manual Input Dataset (the hard part)
Build a comprehensive dataset of "action → input sequence" mappings by hand-labeling real Slippi replays:

- [ ] **Atomic action library** — for each character, document every action's input sequence with exact frame timings:
  - Movement: dash, dash dance, wavedash (angle variants), waveland, walk, crouch, platform drop, shield drop
  - Aerials: shorthop nair/fair/bair/uair/dair, fullhop variants, rising vs falling, L-cancel timing
  - Grabs: standing grab, dash grab, JC grab, pivot grab
  - Specials: per-character (Fox shine, Falco laser, Marth counter, etc.)
  - Defensive: shield, spotdodge, roll, airdodge (angle variants), tech (in place, left, right), getup options
  - Advanced: multishines, waveshine, shield drop aerial, ledgedash, haxdash, etc.
- [ ] **Frame timing data** — for each action: startup frames, active frames, endlag, IASA, landing lag, L-cancel window
  - Much of this already exists in our hitbox-data JSON and FightCore data
  - What's missing: the actual controller input sequences (stick + button + trigger per frame) that produce each action
- [ ] **Context-dependent inputs** — same action requires different inputs depending on state:
  - Grounded vs airborne, facing left vs right, from shield, from ledge, etc.
  - DI inputs depend on the hit angle and desired trajectory
- [ ] **Labeling tool** — build a tool that plays back .slp replays frame-by-frame and lets you tag segments: "frames 120-135: Fox shorthop nair (left-facing)"
  - Could semi-automate: detect action state transitions from .slp data, then manually label the input intent
- [ ] **Dataset format** — JSON mapping: `{ action: "shorthop_nair", character: "fox", facing: "right", inputs: [{frame: 0, stick: {x: 0, y: 0.7}, buttons: []}, {frame: 3, stick: {x: 0, y: 0}, buttons: ["A"]}, ...], totalFrames: 28 }`

### Phase 2: Replay Compiler
A system that takes a sequence of high-level actions and compiles them into a valid .slp file:

- [ ] **Action sequencer** — chain atomic actions together respecting frame timings (can't start a new action during endlag unless IASA)
- [ ] **Position tracker** — track character position/velocity to know where they'll be when the next action starts
- [ ] **Interaction resolver** — when two characters interact (hit, grab, clank), compute the outcome using Melee's knockback formula
  - We already have the knockback calculator (IKneeData) — reuse that math
- [ ] **SLP writer** — generate valid .slp binary files from computed frame data
  - Reference: `slippi-js` has SLP parsing, may need to reverse the write path
  - Or generate the frame data JSON and convert to .slp format

### Phase 3: LLM Prompt Layer
The natural language → action sequence translation:

- [ ] **Prompt format** — user describes a scenario: "Fox dash dances twice, then wavedashes forward and grabs Marth. Marth DIs behind. Fox up-throws and follows up with an up-air."
- [ ] **LLM integration** — fine-tuned model or few-shot prompted model that outputs a structured action sequence from the prompt
  - Could use function calling: LLM calls `dash_dance(count=2)`, `wavedash(direction="forward")`, `grab()`, etc.
  - The action library from Phase 1 becomes the function schema
- [ ] **Validation** — verify the generated sequence is physically possible (no impossible frame timings, no actions during hitstun, etc.)
- [ ] **Iteration** — user watches the generated replay, gives feedback ("make the dash dance wider", "nair earlier"), regenerate

### Monetization
- Token-based pricing: each replay generation costs tokens based on complexity (number of actions, characters, duration)
- Free tier: simple single-action demos (show me a Fox wavedash)
- Paid tier: full scenario generation, multi-character interactions, combo sequences
- Could also sell the dataset itself to other Melee tool developers

### Key References
- Slippi .slp file format: `project-slippi/slippi-wiki` (frame data schema)
- `slippi-js` — JS library for reading/writing .slp data
- Existing frame data: `hitbox-data/*.json`, FightCore move data, IKneeData calculator
- Melee decompilation: `doldecomp/melee` — authoritative source for frame timings and game mechanics
- UnclePunch Training Mode — has input sequence recording/playback, could be a reference for action→input mapping

### Spec TODO
- [ ] Create `.kiro/specs/ai-replay-generation/` spec directory
- [ ] Phase 1 first: design the action→input dataset format and build the labeling tool
- [ ] Research: how does slippi-js handle SLP writing? Can we generate valid .slp files programmatically?
- [ ] Research: what's the minimum viable dataset size to cover common Fox/Falco/Marth/Sheik actions?
- [ ] Requirements doc: define scope (which characters first? how complex can scenarios be?)
- [ ] Design doc: dataset schema, compiler architecture, LLM integration approach
- [ ] Pricing model: token cost estimation per replay complexity tier

---

## Long-Term Vision: Full Desktop App (Phase 4)

### Development Phases
- **Phase 1** (done): Python extraction pipeline — hitbox/bone data from ISO to JSON
- **Phase 2** (done): Browser-side 2D rendering — hitbox circles, trails, tooltips, FightCore integration
- **Phase 3** (in progress): 3D model rendering — dat_extractor → glTF → Three.js in the web viewer
- **Phase 4** (future): Full Electron desktop app — everything from the website plus native features

The goal is to eventually port this into a full-stack Electron app that bundles all the tools and features from the web version into a native desktop experience. Key advantages over the current GitHub Pages setup:

- No more export/push loop for notes — direct filesystem writes
- Local .slp file access without browser file picker friction
- Better performance for replay rendering (no browser sandbox limits)
- Potential for real-time replay watching (live Slippi connection via slp-realtime)
- Could run a local server for features that need a backend (e.g. auto-analysis, batch processing)

### Features to port/expand
- [ ] Full notes system with local JSON storage (no GitHub API needed)
- [ ] Replay viewer (already mostly self-contained as functional proof of concept on a website, should port cleanly)
- [ ] IKneeData calculator module
- [ ] VOD linking + embedded player
- [ ] Matchup pages and Way of Fox guide
- [ ] Chat-style note rendering + markdown

### Rwing-inspired features to steal
(Reference: https://melee.cool/rwing/ — source: AlexanderHarrison/dat_extractor)
- [ ] 3D model rendering from ISO DAT files (Phase 3 — see below)
- [ ] Wavedash OSD — show early/late timing, short/fullhop detection
- [ ] Frame advantage OSD — show +/- frames after hitting shield
- [ ] Actionable glow — characters glow green when actionable
- [ ] Notes/diagrams saved into .slp file metadata
- [ ] SLP compression (10x size reduction, still playable)
- [ ] Improover — bulk export dpad-down moments as TM savestates
- [ ] Screenshot export with diagram overlays
- [ ] Combo finder with Clippi playlist import/export
- [ ] Replay takeover / overlay on top of Dolphin (Rwing's core feature)
- [ ] Real-time input display overlay
- [ ] Auto-clip detection (notable moments: kills, combos, edgeguards)
- [ ] Replay browser with filtering by character, opponent, stage, date
- [ ] Session stats dashboard (L-cancel %, combo conversion, neutral win rate)

### ISO-Powered Hitbox/Hurtbox System (Web + Electron)

Two-phase approach that works for both the website and the future Electron app:

**Phase 1 — Offline extraction (Python script, runs locally with your ISO)**
- [ ] Build a Python extraction pipeline using `pfirsich/meleeDat2Json` + `meleeFrameDataExtractor` to extract per-character data from the ISO's character DAT files
- [ ] Extract hitbox data: position, size, bone attachment, damage, angle, KBG, BKB, active frames per subaction/animation frame
- [ ] Extract bone/skeleton joint tree + bone positions per animation frame (needed to place hitboxes at correct world positions)
- [ ] Extract hurtbox data: vulnerable regions per frame for defensive visualization
- [ ] Output as compact JSON files in `hitbox-data/{character}.json` — small enough to commit to the repo
- [ ] Also extract stage collision geometry for kill zone overlays
- [ ] One-time extraction per ISO version — the JSON files are the artifact, not the ISO
- [ ] NOTE: pre-generated hitbox JSON dumps (without bone data) already available at `melee.theshoemaker.de` — evaluate if these are sufficient as a starting point

**Phase 2 — Rendering in replay viewer (works on web AND Electron)**
- [ ] Load `hitbox-data/{character}.json` in the replay viewer alongside the .slp data
- [ ] Per frame: look up current action state + animation frame → get active hitboxes → resolve bone positions → render hitbox circles at correct world positions
- [ ] Render hurtboxes as blue outlines on the character
- [ ] Color-code hitboxes by ID (like Rwing: red, orange, yellow, green for hitbox 0-3)
- [ ] Show hitbox properties on hover (damage, angle, KBG, BKB)
- [ ] Toggle hitbox/hurtbox display independently
- [ ] Replace the current FightCore-based text overlay with actual visual hitbox rendering

**Electron-only extras (future)**
- [ ] Re-extract on the fly when user provides an ISO (no pre-built JSON needed)
- [ ] DI line visualization using real knockback formula + hitbox data
- [ ] Frame-accurate 3D model rendering using actual character model/animation data from ISO

**Phase 3 — 3D Model Rendering for Accurate Hitbox Alignment (future)**
The current 2D SVG silhouettes can't be perfectly aligned with 3D bone-space hitbox positions because different animations project differently to 2D. No single Y offset works for all moves (upair needs hitboxes above, dair below, bair behind). This is why Rwing uses actual 3D model rendering.

Key resource: `AlexanderHarrison/dat_extractor` (https://github.com/AlexanderHarrison/dat_extractor) — the Rust crate used by Rwing. It has complete DAT file parsing including:
- `extract_mesh.rs` — vertex extraction (position, UV, normals, bone weights/indices), triangle indices, primitive groups, textures
- `extract_anims.rs` — FIGATREE animation parsing with hermite spline interpolation, root translation removal, animation blending
- `jobj.rs` — JOBJ skeleton tree with proper Mat4 transforms
- `fighter_data.rs` — high/low poly model selection per character
- `textures.rs` — GX texture format decoding (CMPR, I4, I8, IA4, IA8, RGB565, RGB5A3, RGBA8)

Implementation plan:
- [ ] Build a Rust CLI tool using dat_extractor to extract per-character 3D model data from the ISO
  - Output: glTF or custom JSON with vertices, indices, bone weights, skeleton, textures
  - One-time extraction, committed to repo (like current hitbox-data/*.json)
  - Estimated size: 500KB-2MB per character compressed (mesh + textures)
- [ ] Add Three.js to the replay viewer (lazy-loaded only when 3D mode is enabled)
  - Replace the 2D canvas with a Three.js WebGL renderer (or overlay on top)
  - Side-view camera matching the current 2D perspective
  - Simple toon/flat shader (no need for full PBR)
- [ ] Load character meshes and apply FIGATREE animation transforms per frame
  - Use the existing animation data we already parse, or re-extract with dat_extractor's better hermite interpolation
  - Skinned mesh rendering with bone weights from the model data
  - `AnimationFrame::remove_root_translation()` already handled
- [ ] Render hitbox spheres in the same 3D scene
  - Hitbox positions are in bone-local space → transform by the same bone matrices → perfect alignment
  - Semi-transparent colored spheres matching current color scheme
  - No more 2D projection issues — everything shares the same coordinate system
- [ ] Stage rendering (optional) — dat_extractor also has `extract_stage()` for stage models
- [ ] Fallback: keep current 2D SVG rendering for browsers without WebGL or when 3D mode is disabled
- [ ] Performance target: 2 characters + stage + hitbox spheres at 60fps on modern browsers (trivial for ~5K poly models)

**Spec status:** Phase 1 (extraction pipeline) and Phase 2 (browser rendering) are implemented. Hitbox data is correct (verified against FightCore), bone positions track animations via FIGATREE parsing, trails show previous frame positions. Visual alignment with 2D SVG silhouettes is approximate due to 2D/3D projection mismatch — Phase 3 (3D rendering) needed for pixel-perfect overlay.

### Rwing Data Mining & Open Source Resources
- [ ] Investigate what data Rwing extracts — it uses the ISO for hitbox rendering, DI lines, and frame data overlays
- [ ] Key open-source tools: `pfirsich/meleeDat2Json`, `pfirsich/meleeFrameDataExtractor`, `BroccoliRaab/meleedb`, `HSDLib`, `m-ex`, `doldecomp/melee`
- [ ] The key missing piece for accurate rendering is bone/skeleton position data per animation frame — this requires parsing the character's animation data from the DAT files, not just the hitbox subaction scripts
- [ ] `doldecomp/melee` decompilation may have documented enough internal structures to build our own bone position resolver

---

## Modular Matchup Pages (Requires Careful Planning)

The long-term goal is to make matchup page sections as modular as the notes system — editable, addable, removable, taggable, and shareable from the browser without touching HTML. This is a significant architectural change that needs to be planned carefully before implementation.

### Core Concept
- Each "box" (source-section) on a matchup page becomes a modular content block stored in JSON (like notes)
- Blocks can be added, edited, reordered, and deleted from the browser
- Each block has: title, content (markdown), tags, source attribution, and a stable ID for deep linking
- The matchup page becomes a renderer that reads from `matchup-data/{character}.json` instead of hardcoded HTML

### Design Considerations (Plan Before Building)
- [ ] Data migration: convert existing hardcoded HTML sections into JSON format without losing content
- [ ] Editor UI: inline editing vs modal vs separate edit mode — needs to feel natural, not clunky
- [ ] Content format: markdown? Rich text? HTML? Need to support bullet lists, bold, links at minimum
- [ ] Ordering: drag-and-drop reorder? Manual position numbers? Section grouping under h2 headers?
- [ ] Permissions: should visitors see edit buttons? Or only when GitHub token is connected?
- [ ] Search index: auto-rebuild on save, or manual rebuild step?
- [ ] Module types: plain text blocks, embedded calculators (IKneeData), VOD embeds, CC tables, OoS heatmaps — each needs its own renderer
- [ ] Cross-referencing: link a matchup section to a specific note, replay, or VOD timestamp
- [ ] Version history: since it's all in git, every edit is tracked — but should we surface that in the UI?

### Module Types to Support
- [ ] Text block (current source-sections — bullet lists, paragraphs)
- [ ] VOD embed block (YouTube/Twitch with timestamp)
- [ ] Calculator block (IKneeData embed with pre-filled data)
- [ ] CC/ASDI table block (already exists as a module)
- [ ] OoS heatmap block (already exists as iframe embed)
- [ ] Replay viewer block (link to a specific .slp at a specific frame)
- [ ] Note reference block (pull in a player note inline)

### Dependencies
- Requires the GitHub API sync system to be solid (currently working)
- Requires stable section IDs (already implemented)
- Requires the tagging system (already implemented)
- Should be designed alongside the Electron app vision — the JSON data format should work for both web and desktop

### Pre-Implementation Checkpoint
- [ ] Before starting implementation, re-run the planning agent to update the spec (design.md, requirements.md, tasks.md) to account for any new features developed between now and then. The search system, tagging, note VODs, and matchup page content are still being actively refined — the spec should reflect the final state of these systems before committing to the migration.
