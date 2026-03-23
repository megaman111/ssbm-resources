# Requirements Document

## Introduction

The IKneeData Calculator Module is a reusable Melee frame data calculator that computes knockback, hitstun, trajectory, kill percents, shield interactions, and combo viability. It reverse-engineers the functionality of ikneedata.com/calculator.html as a standalone ES module embeddable on any page in the site (matchup pages, replay viewer, standalone calculator page). The module builds on the existing `fightcore.js` knockback formula and character data, extending it with full physics simulation, DI modeling, stage geometry, and UI components.

## Glossary

- **Calculator_Module**: The core ES module (`ikneedata-calc.js`) that exposes all computation functions as a reusable API with no DOM dependencies
- **Calculator_UI**: The embeddable UI component that renders input forms and result displays, importable on any page
- **Knockback**: The magnitude of launch force applied to a defender when hit, measured in Melee KB units
- **Hitstun**: The number of frames a defender is locked in a hit reaction and cannot act, calculated as `floor(KB * 0.4)`
- **Tumble**: A knockback state entered when KB exceeds 80 units, causing the defender to enter a tumbling animation
- **DI (Directional Influence)**: A mechanic where the defender holds a direction on the control stick to alter the launch angle by up to ~18 degrees perpendicular to the base trajectory
- **SDI (Smash DI)**: A mechanic where the defender flicks the control stick during hitlag to shift position by a fixed distance before launch
- **ASDI (Automatic Smash DI)**: A smaller positional shift applied automatically based on stick position at the end of hitlag
- **Crouch_Cancel**: A grounded defensive mechanic that multiplies knockback by 2/3 when the defender is crouching
- **Stale_Move_Negation**: A damage reduction system where recently used moves deal less damage based on a 9-entry staleness queue
- **Blast_Zone**: The rectangular boundary around each stage beyond which a character is KO'd
- **Shield_Stun**: The number of frames a shielding defender is locked in shield after being hit
- **Shield_Advantage**: The frame difference between when the attacker can act and when the defender exits Shield_Stun
- **FightCore_Data**: Character move data loaded from the FightCore GitHub repository, including damage, angle, KBG, BKB, and hitbox information
- **Charged_Smash_Multiplier**: A damage multiplier (up to 1.3671) applied when a smash attack is fully charged
- **Launch_Velocity**: The initial speed of a character after being hit, derived from Knockback magnitude and angle
- **Trajectory**: The simulated path of a launched character accounting for gravity, air friction, and DI
- **Stage_Data**: Per-stage constants including Blast_Zone boundaries, platform positions, and ground level
- **Character_Physics**: Per-character constants including weight, gravity, fall speed, max fall speed, air friction, and traction

## Requirements

### Requirement 1: Knockback Calculation

**User Story:** As a Melee player, I want to calculate the exact knockback magnitude for any move hitting any character at any percent, so that I can understand how hard a move launches.

#### Acceptance Criteria

1. WHEN an attacker move, defender percent, and defender weight are provided, THE Calculator_Module SHALL compute the Knockback magnitude using the Melee formula: `((((((p / 10) + (p * damage / 20)) * (200 / (weight + 100)) * 1.4) + 18) * (KBG / 100)) + BKB) * multiplier`, where `p = percent + damage`
2. WHEN a move has a set knockback value greater than zero, THE Calculator_Module SHALL substitute `1 + (10 * setKB / 20)` for the percent-dependent term in the Knockback formula
3. WHEN the Crouch_Cancel option is enabled, THE Calculator_Module SHALL multiply the total Knockback by 2/3
4. WHEN the Charged_Smash_Multiplier is specified, THE Calculator_Module SHALL apply the multiplier to the move damage before computing Knockback
5. WHEN Stale_Move_Negation data is provided, THE Calculator_Module SHALL reduce the move damage according to the staleness queue multipliers before computing Knockback
6. THE Calculator_Module SHALL return the Knockback magnitude as a floating-point number rounded to two decimal places

### Requirement 2: Hitstun Calculation

**User Story:** As a Melee player, I want to know how many frames of hitstun a move inflicts, so that I can determine follow-up timing and combo viability.

#### Acceptance Criteria

1. WHEN a Knockback magnitude is computed, THE Calculator_Module SHALL calculate Hitstun as `floor(Knockback * 0.4)` frames
2. WHEN the computed Knockback exceeds 80 units, THE Calculator_Module SHALL flag the result as entering Tumble
3. THE Calculator_Module SHALL return the Hitstun value as an integer number of frames

### Requirement 3: Launch Angle and DI Modification

**User Story:** As a Melee player, I want to see how DI changes the launch angle of a move, so that I can understand optimal and worst-case DI scenarios.

#### Acceptance Criteria

1. WHEN a move angle and DI stick direction are provided, THE Calculator_Module SHALL compute the modified launch angle by applying the DI influence formula (up to ~18 degrees perpendicular shift)
2. WHEN no DI input is provided, THE Calculator_Module SHALL use the base move angle unmodified
3. WHEN the move angle is 361 (Sakurai angle), THE Calculator_Module SHALL resolve the angle to the appropriate ground or air value based on Knockback magnitude and grounded state
4. WHEN the DI direction is parallel to the launch angle, THE Calculator_Module SHALL apply zero angle modification
5. WHEN the DI direction is perpendicular to the launch angle, THE Calculator_Module SHALL apply the maximum angle modification
6. THE Calculator_Module SHALL return both the base angle and the DI-modified angle in degrees

### Requirement 4: Trajectory Simulation

**User Story:** As a Melee player, I want to simulate the full trajectory of a launched character, so that I can see where the character ends up and whether the move kills.

#### Acceptance Criteria

1. WHEN a Launch_Velocity, angle, and Character_Physics data are provided, THE Calculator_Module SHALL simulate the trajectory frame-by-frame accounting for gravity, air friction, and max fall speed
2. WHEN the simulated trajectory crosses a Blast_Zone boundary, THE Calculator_Module SHALL report the frame on which the KO occurs and which Blast_Zone boundary was crossed
3. WHEN the simulated trajectory does not cross any Blast_Zone boundary, THE Calculator_Module SHALL report that the move does not kill and return the final resting position
4. THE Calculator_Module SHALL accept a starting position (x, y) for the defender to account for stage positioning
5. WHEN DI is applied, THE Calculator_Module SHALL use the DI-modified angle and velocity for the trajectory simulation

### Requirement 5: Kill Percent Calculation

**User Story:** As a Melee player, I want to find the minimum percent at which a move kills from a given position on a given stage, so that I can know my kill confirms.

#### Acceptance Criteria

1. WHEN an attacker move, defender character, stage, and starting position are provided, THE Calculator_Module SHALL compute the minimum percent at which the move results in a KO by crossing a Blast_Zone boundary
2. WHEN DI direction is specified, THE Calculator_Module SHALL compute the kill percent accounting for that DI angle
3. WHEN no DI is specified, THE Calculator_Module SHALL compute kill percents for both no-DI and optimal survival DI scenarios
4. WHEN the move cannot kill at any percent up to 999%, THE Calculator_Module SHALL report that the move does not kill from that position
5. THE Calculator_Module SHALL use binary search over the percent range (0–999) to find the kill percent threshold efficiently

### Requirement 6: Shield Stun and Shield Advantage

**User Story:** As a Melee player, I want to calculate shield stun and frame advantage on shield, so that I can evaluate which moves are safe on shield.

#### Acceptance Criteria

1. WHEN a move damage value is provided, THE Calculator_Module SHALL compute Shield_Stun as `floor((damage + 4.45) / 2.235)` frames
2. WHEN the attacker's endlag (IASA or total frames minus hitbox active frame) and Shield_Stun are known, THE Calculator_Module SHALL compute Shield_Advantage as `Shield_Stun - (endlag remaining after hit)`
3. WHEN Shield_Advantage is negative, THE Calculator_Module SHALL indicate the move is unsafe on shield
4. WHEN Shield_Advantage is zero or positive, THE Calculator_Module SHALL indicate the move is safe or advantageous on shield

### Requirement 7: Stage and Character Physics Data

**User Story:** As a Melee player, I want the calculator to have accurate stage blast zones and character physics constants, so that all calculations use correct Melee data.

#### Acceptance Criteria

1. THE Calculator_Module SHALL include Blast_Zone boundaries (left, right, top, bottom) for all tournament-legal stages: Battlefield, Final Destination, Dreamland, Fountain of Dreams, Yoshi's Story, and Pokemon Stadium
2. THE Calculator_Module SHALL include Character_Physics constants (gravity, max fall speed, air friction, weight) for all 26 Melee characters
3. THE Calculator_Module SHALL include platform positions and ground level for each tournament-legal stage
4. WHEN a character ID is provided, THE Calculator_Module SHALL retrieve the corresponding Character_Physics from the built-in data
5. WHEN a stage name is provided, THE Calculator_Module SHALL retrieve the corresponding Stage_Data from the built-in data

### Requirement 8: Combo Viability Assessment

**User Story:** As a Melee player, I want to know whether I can follow up after landing a hit, so that I can identify true combos and frame traps.

#### Acceptance Criteria

1. WHEN the attacker's endlag, Hitstun, and Knockback trajectory are computed, THE Calculator_Module SHALL determine whether the attacker can reach the defender before Hitstun expires
2. WHEN the Hitstun frames exceed the attacker's endlag plus estimated travel time, THE Calculator_Module SHALL report the interaction as a true combo
3. WHEN the Hitstun frames are fewer than the attacker's endlag, THE Calculator_Module SHALL report the interaction as not a combo
4. THE Calculator_Module SHALL report the frame advantage (Hitstun minus attacker endlag) as a signed integer

### Requirement 9: Embeddable UI Component

**User Story:** As a site developer, I want to embed the calculator UI on any page (matchup pages, replay viewer, standalone), so that the calculator is reusable across the site.

#### Acceptance Criteria

1. THE Calculator_UI SHALL render into any provided DOM container element without requiring page-specific CSS or HTML structure
2. THE Calculator_UI SHALL provide dropdown selectors for attacker character, attacker move, defender character, and stage
3. THE Calculator_UI SHALL provide numeric input fields for defender percent, DI angle, and starting position
4. THE Calculator_UI SHALL provide toggle options for Crouch_Cancel, Charged_Smash_Multiplier, and Stale_Move_Negation
5. WHEN any input value changes, THE Calculator_UI SHALL recompute and display updated results for Knockback, Hitstun, launch angle, kill percent, Shield_Stun, Shield_Advantage, and combo viability
6. THE Calculator_UI SHALL populate the attacker move dropdown by loading FightCore_Data for the selected attacker character
7. THE Calculator_UI SHALL match the existing site visual style (dark theme, rounded cards, consistent with matchup page styling)

### Requirement 10: Replay Viewer Integration API

**User Story:** As a site developer, I want to auto-populate the calculator from replay viewer frame data, so that pausing a replay instantly shows the frame's combat math.

#### Acceptance Criteria

1. THE Calculator_Module SHALL expose a public method that accepts a frame data object containing attacker character ID, move action state, defender character ID, defender percent, and stage
2. WHEN the public method is called with frame data, THE Calculator_Module SHALL resolve the action state to FightCore_Data using the existing ACTION_TO_FC_MOVE and SPECIAL_TO_FC_MOVE mappings from `fightcore.js`
3. WHEN the Calculator_UI is present, calling the public method SHALL update all input fields and trigger a recalculation
4. WHEN the Calculator_UI is not present, calling the public method SHALL return the computed results as a data object without DOM interaction

### Requirement 11: Module Architecture and Integration

**User Story:** As a site developer, I want the calculator to be a clean ES module that integrates with the existing codebase, so that it follows the same patterns as `fightcore.js` and `cc-table-builder.js`.

#### Acceptance Criteria

1. THE Calculator_Module SHALL be implemented as an ES module using `import`/`export` syntax, consistent with `fightcore.js` and `cc-table-builder.js`
2. THE Calculator_Module SHALL import and reuse the existing `FightCore` class from `fightcore.js` for character move data and weight constants
3. THE Calculator_Module SHALL operate without a build step, bundler, or framework dependency
4. THE Calculator_Module SHALL separate computation logic (pure functions, no DOM) from UI rendering (DOM manipulation) into distinct exports
5. IF the FightCore_Data fetch fails, THEN THE Calculator_Module SHALL display a descriptive error message and allow manual entry of move parameters (damage, angle, KBG, BKB)
