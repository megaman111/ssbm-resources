# Requirements Document

## Introduction

The accurate hitbox/hurtbox rendering system replaces the current approximate FightCore-based hitbox visualization with frame-perfect, ISO-extracted hitbox and hurtbox rendering in the Melee replay viewer. The system consists of two phases: an offline Python extraction pipeline that parses character DAT files from a Melee ISO to produce per-character JSON data (hitboxes, hurtboxes, bone trees, per-frame bone transforms), and a browser-side rendering pipeline that resolves bone-relative hitbox positions to world coordinates each frame and draws them as colored circles on the replay viewer canvas. The extracted JSON files are committed to the repo and work on both GitHub Pages and the future Electron app.

## Glossary

- **Extraction_Script**: The `extract_hitbox_data.py` Python script that parses Melee character DAT files and outputs per-character JSON data
- **HitboxLoader**: The `hitbox-loader.js` browser module that fetches, caches, and provides access to per-character hitbox JSON data
- **BoneResolver**: The `bone-resolver.js` browser module that resolves bone-relative positions to world coordinates using pre-computed bone transforms
- **HitboxRenderer**: The `hitbox-renderer.js` browser module that draws hitbox circles and hurtbox outlines on the replay viewer canvas
- **Bone_Tree**: The hierarchical skeleton structure of a character, where each bone has a parent and a rest-pose position
- **Subaction**: A Melee animation unit identified by a subaction ID, containing hitbox events and bone frame data
- **Bone_Frame_Data**: Pre-computed per-frame world-space bone positions stored as sparse keyframes in the JSON
- **Hitbox_Event**: A hitbox definition within a subaction, specifying bone attachment, offset, size, damage, angle, knockback, and active frame range
- **Hurtbox**: A vulnerable region attached to a bone, defined by offset and size, used for defensive visualization
- **Action_State_Map**: A mapping from .slp action state IDs to DAT file subaction IDs
- **Character_JSON**: The `hitbox-data/{character}.json` file containing all extracted data for one character
- **Rest_Pose**: The default bone positions used as fallback when animation data is missing for a frame
- **Keyframe_Interpolation**: Linear interpolation between sparse bone position keyframes to compute positions for intermediate frames
- **meleeDat2Json**: The `pfirsich/meleeDat2Json` Python library used to parse Melee DAT binary files into JSON

## Requirements

### Requirement 1: DAT File Extraction

**User Story:** As a developer, I want to extract hitbox, hurtbox, bone, and animation data from Melee character DAT files, so that the browser can render accurate hitboxes without needing the ISO at runtime.

#### Acceptance Criteria

1. WHEN the user runs the Extraction_Script with an ISO path, THE Extraction_Script SHALL parse each character's DAT file using meleeDat2Json and produce a Character_JSON file in the output directory
2. WHEN the `--char` flag is provided, THE Extraction_Script SHALL extract data for only the specified character
3. WHEN the `--outdir` flag is provided, THE Extraction_Script SHALL write output files to the specified directory
4. THE Extraction_Script SHALL extract the Bone_Tree hierarchy (parent/child relationships and rest-pose positions) for each character
5. THE Extraction_Script SHALL extract Hitbox_Events for every subaction that contains at least one hitbox command in the DAT file
6. THE Extraction_Script SHALL extract Hurtbox definitions (bone attachment, offset, size, zone) for each character
7. THE Extraction_Script SHALL extract animation keyframes and pre-compute world-space bone positions per animation frame for each subaction
8. THE Extraction_Script SHALL produce the Action_State_Map that maps .slp action state IDs to DAT subaction IDs for each character

### Requirement 2: JSON Schema and Validation

**User Story:** As a developer, I want the extracted JSON to follow a strict schema with validation rules, so that malformed data does not cause rendering errors.

#### Acceptance Criteria

1. THE Extraction_Script SHALL produce Character_JSON where all bones in the Bone_Tree are ordered such that each bone's parent index is less than the bone's own index
2. THE Extraction_Script SHALL produce Character_JSON where the root bone (index 0) has a parent value of -1
3. THE Extraction_Script SHALL produce Character_JSON where every Hitbox_Event references a valid bone ID that exists in the Bone_Tree
4. THE Extraction_Script SHALL produce Character_JSON where every Hurtbox references a valid bone ID that exists in the Bone_Tree
5. THE Extraction_Script SHALL produce Character_JSON where every Hitbox_Event has `startFrame <= endFrame`
6. THE Extraction_Script SHALL produce Character_JSON where every Hitbox_Event has `startFrame < totalFrames` for its containing subaction
7. THE Extraction_Script SHALL produce Character_JSON where every Hitbox_Event has `size > 0`
8. THE Extraction_Script SHALL produce Character_JSON where all Bone_Frame_Data keys are valid frame numbers within `[0, totalFrames)`
9. WHEN the `--validate` flag is provided with a JSON file path, THE Extraction_Script SHALL validate the file against all schema rules and report any violations

### Requirement 3: Extraction Error Handling

**User Story:** As a developer, I want the extraction script to handle errors gracefully, so that a single character's failure does not prevent extracting the remaining characters.

#### Acceptance Criteria

1. IF meleeDat2Json fails to parse a character's DAT file, THEN THE Extraction_Script SHALL log the error, skip that character, and continue extracting remaining characters
2. IF the provided ISO path does not exist or is unreadable, THEN THE Extraction_Script SHALL display an error message and exit with a non-zero status code
3. WHEN the ISO is not NTSC v1.02, THE Extraction_Script SHALL display a warning that hitbox data may be inaccurate and continue extraction

### Requirement 4: Hitbox Data Loading

**User Story:** As a replay viewer user, I want hitbox data to load automatically when I open a replay, so that I can see accurate hitboxes without manual setup.

#### Acceptance Criteria

1. WHEN a replay is loaded, THE HitboxLoader SHALL fetch Character_JSON files for all characters present in the replay
2. THE HitboxLoader SHALL cache loaded Character_JSON data in memory so that subsequent requests for the same character return the cached data without a network request
3. WHEN a Character_JSON file is not found (HTTP 404), THE HitboxLoader SHALL return null for that character and log a warning
4. IF a Character_JSON file fails to parse as valid JSON, THEN THE HitboxLoader SHALL return null for that character and log the parse error
5. THE HitboxLoader SHALL provide synchronous access to previously loaded character data via a cache lookup method

### Requirement 5: Bone Position Resolution

**User Story:** As a replay viewer user, I want hitboxes to appear at the correct bone positions for each animation frame, so that the visualization matches what the game engine computes.

#### Acceptance Criteria

1. WHEN resolving bone positions for a subaction and frame, THE BoneResolver SHALL look up the pre-computed Bone_Frame_Data from the Character_JSON
2. WHEN the requested frame falls between two sparse keyframes, THE BoneResolver SHALL linearly interpolate bone positions between the surrounding keyframes
3. WHEN a subaction has no Bone_Frame_Data for the requested frame range, THE BoneResolver SHALL fall back to Rest_Pose positions from the Bone_Tree
4. THE BoneResolver SHALL project 3D bone-local hitbox offsets to 2D game coordinates by mapping the Z axis to X (forward) and the Y axis to Y (vertical), collapsing the X axis (lateral)

### Requirement 6: Action State Mapping

**User Story:** As a developer, I want .slp action state IDs to map correctly to DAT subaction IDs, so that the renderer looks up the right hitbox data for each animation.

#### Acceptance Criteria

1. WHEN mapping an action state ID, THE BoneResolver SHALL first check the character's Action_State_Map for an explicit mapping
2. WHEN no explicit mapping exists and the action state ID is less than 341, THE BoneResolver SHALL use the action state ID directly as the subaction ID
3. WHEN no mapping is found and no subaction data exists for the action state ID, THE BoneResolver SHALL return null to indicate no hitbox data is available

### Requirement 7: Hitbox Rendering

**User Story:** As a replay viewer user, I want to see color-coded hitbox circles on the canvas during attacks, so that I can understand the spatial properties of each move.

#### Acceptance Criteria

1. THE HitboxRenderer SHALL draw a hitbox circle only when the current animation frame is within the hitbox's active frame range (`startFrame <= frame <= endFrame`)
2. THE HitboxRenderer SHALL color-code hitbox circles by hitbox ID: ID 0 as red, ID 1 as orange, ID 2 as yellow, ID 3 as green
3. THE HitboxRenderer SHALL position each hitbox circle by applying the hitbox's bone-local offset to the resolved bone world position, then applying the character's facing direction and world position
4. THE HitboxRenderer SHALL scale all hitbox positions and radii by the character's scale factor
5. THE HitboxRenderer SHALL multiply hitbox X coordinates by the character's facing direction (1 for right, -1 for left) to mirror hitboxes correctly

### Requirement 8: Hurtbox Rendering

**User Story:** As a replay viewer user, I want to see hurtbox outlines on characters, so that I can understand vulnerable regions and invincibility states.

#### Acceptance Criteria

1. THE HitboxRenderer SHALL draw Hurtbox outlines positioned at the attached bone's world position plus the hurtbox offset
2. THE HitboxRenderer SHALL color Hurtbox outlines yellow when the character is in a vulnerable state
3. THE HitboxRenderer SHALL color Hurtbox outlines blue when the character is in an invincible or intangible state
4. THE HitboxRenderer SHALL scale Hurtbox positions and sizes by the character's scale factor

### Requirement 9: Hover Tooltip

**User Story:** As a replay viewer user, I want to hover over a hitbox to see its properties, so that I can quickly check damage, angle, and knockback values.

#### Acceptance Criteria

1. WHEN the user hovers the mouse over an active hitbox circle on the canvas, THE HitboxRenderer SHALL display a tooltip showing the hitbox's damage, angle, knockback growth, and base knockback values
2. WHEN the mouse moves away from all hitbox circles, THE HitboxRenderer SHALL hide the tooltip

### Requirement 10: Graceful Degradation

**User Story:** As a replay viewer user, I want the viewer to still work when hitbox JSON is unavailable, so that I can watch replays for characters that haven't been extracted yet.

#### Acceptance Criteria

1. WHEN Character_JSON is not available for a character, THE HitboxRenderer SHALL fall back to the existing FightCore approximation for hitbox display
2. WHEN Character_JSON is available but a specific subaction has no data, THE HitboxRenderer SHALL draw no hitboxes for that action state without displaying an error
3. WHEN Bone_Frame_Data is missing for a subaction, THE HitboxRenderer SHALL render hitboxes at Rest_Pose bone positions as an approximation
4. IF any error occurs during hitbox rendering for a frame, THEN THE HitboxRenderer SHALL catch the error, log it, and continue rendering the rest of the frame without crashing

### Requirement 11: Toggle Controls

**User Story:** As a replay viewer user, I want to toggle hitbox and hurtbox display independently, so that I can focus on the information I need.

#### Acceptance Criteria

1. THE Replay_Viewer SHALL provide independent toggle controls for hitbox display and hurtbox display
2. WHEN hitbox display is toggled off, THE HitboxRenderer SHALL skip all hitbox circle rendering
3. WHEN hurtbox display is toggled off, THE HitboxRenderer SHALL skip all hurtbox outline rendering

### Requirement 12: Cross-Platform Compatibility

**User Story:** As a developer, I want the hitbox system to work on both GitHub Pages and the future Electron app, so that the same data and rendering code can be reused.

#### Acceptance Criteria

1. THE HitboxLoader SHALL support loading Character_JSON via both HTTP fetch (web) and filesystem read (Electron) through the same interface
2. THE Character_JSON format SHALL contain all data needed for rendering without requiring the ISO at runtime
3. THE HitboxRenderer and BoneResolver SHALL use only standard Canvas 2D API and DOM APIs with no platform-specific dependencies
