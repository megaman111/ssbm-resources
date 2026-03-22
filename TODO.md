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
- [ ] **Fountain of Dreams moving platforms** — use `stageEvents` from frame data (fodLeftPlatformHeight/fodRightPlatformHeight, replay format >= 3.18.0.0)
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
- [ ] **Practice plan generator** — auto-summarize habits from clips data (missed L-cancels, shield options, ledge habits) into a "here's what to work on" report

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

### IKneeData Calculator Module
- [ ] Melee frame data calculator (like IKneeData)
- [ ] Knockback calculator
- [ ] Combo/DI calculator
- [ ] Hitbox visualization
- [ ] Embeddable as a module on any page
- [ ] Replay viewer integration — pause on a frame and auto-populate the calculator with that frame's data

### VOD Linking Module
- [ ] Link VODs (YouTube/Twitch timestamps) to notes
- [ ] Embedded VOD player with timestamp jumping
- [ ] Cross-reference VODs with .slp replays
- [ ] Side-by-side VOD + replay viewer — sync stream footage with input data

### Concept-to-Replay Linking
- [ ] Tag concepts/lessons with specific replay moments
- [ ] Click a concept → opens replay viewer at the relevant frame
- [ ] Annotate replays with concept tags

---

## Matchup Pages
- [ ] **Matchup-specific replay filters** — on each matchup page, pull all player notes/replays tagged with that character and browse them inline
- [ ] **Kill percent tables** — per-move kill percents by stage using fightcore.js knockback formula + blast zone data
- [ ] **Stage-specific data overlays** — platform movement patterns, kill zone visualization per stage

---

## Site-Wide
- [ ] Make all modules embeddable on any page (way-of-fox, matchup pages, etc.)
- [ ] Unified module loading system
- [ ] Mobile-friendly replay viewer controls
