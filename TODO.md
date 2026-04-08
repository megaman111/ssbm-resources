# Megaman's SSBM Resources — TODO / Feature Roadmap

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

## Long-Term Vision: Electron Desktop App

The goal is to eventually port this into a full-stack Electron app that bundles all the tools and features from the web version into a native desktop experience. Key advantages over the current GitHub Pages setup:

- No more export/push loop for notes — direct filesystem writes
- Local .slp file access without browser file picker friction
- Better performance for replay rendering (no browser sandbox limits)
- Potential for real-time replay watching (live Slippi connection via slp-realtime)
- Could run a local server for features that need a backend (e.g. auto-analysis, batch processing)

### Features to port/expand
- [ ] Full notes system with local JSON storage (no GitHub API needed)
- [ ] Replay viewer (already mostly self-contained, should port cleanly)
- [ ] IKneeData calculator module
- [ ] VOD linking + embedded player
- [ ] Matchup pages and Way of Fox guide
- [ ] Chat-style note rendering + markdown

### Rwing-inspired features to steal
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

**Spec status:** Needs its own spec — run the planning agent when ready to implement. The spec should cover the extraction pipeline, JSON data format, bone position resolution algorithm, and renderer integration.

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
