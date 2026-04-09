# Requirements Document

## Introduction

The 3D model rendering system replaces the current 2D SVG silhouette character rendering in the Melee replay viewer with Three.js-powered 3D character models. Character mesh data has already been extracted from the Melee ISO using dat_extractor (Rwing's library) and committed to `model-data/*.json`. The system loads these meshes, applies skeletal animation driven by FIGATREE bone transforms (already parsed in `hitbox-data/*.json`), and renders characters in a side-view perspective matching the current 2D view. Hitbox spheres are rendered in the same 3D scene, eliminating the 2D/3D projection alignment issues present in the current system. The existing 2D SVG rendering is preserved as a fallback when WebGL is unavailable or 3D mode is disabled.

## Glossary

- **Model_Loader**: The browser module that fetches, parses, and caches per-character 3D model JSON data from `model-data/*.json`
- **Scene_Manager**: The module that initializes and manages the Three.js WebGL scene, camera, and renderer, overlaid on or replacing the existing Canvas 2D context
- **Skeleton_Builder**: The module that constructs a Three.js `Skeleton` (bone hierarchy with transforms) from the model JSON bone data and inverse bind matrices
- **Mesh_Builder**: The module that constructs a Three.js `SkinnedMesh` from the model JSON vertex, normal, UV, index, and bone weight data
- **Animation_Driver**: The module that applies per-frame FIGATREE bone transforms from `hitbox-data/*.json` to the Three.js skeleton each frame, driving skeletal animation
- **Hitbox_Sphere_Renderer**: The module that renders hitbox and hurtbox data as semi-transparent 3D spheres in the Three.js scene, positioned via bone transforms
- **Toon_Shader**: A simple flat/toon material applied to character meshes (no PBR or textures required initially)
- **Replay_Viewer**: The existing replay viewer in `player-notes.html` that renders replays using Canvas 2D
- **Model_JSON**: A `model-data/{character}.json` file containing vertices, normals, UVs, triangle indices, bone hierarchy, bone weights, and inverse bind matrices
- **Hitbox_JSON**: A `hitbox-data/{character}.json` file containing per-subaction bone frame data, hitbox events, and hurtbox definitions
- **Side_View_Camera**: An orthographic or perspective camera positioned to match the current 2D side-view perspective of the replay viewer
- **Render_Mode**: The user-selectable toggle between 2D SVG silhouette rendering and 3D model rendering

## Requirements

### Requirement 1: Three.js Scene Integration

**User Story:** As a replay viewer user, I want the replay viewer to support a WebGL rendering layer, so that 3D character models and hitbox spheres can be rendered alongside the existing stage and UI elements.

#### Acceptance Criteria

1. WHEN 3D Render_Mode is enabled, THE Scene_Manager SHALL initialize a Three.js WebGLRenderer and overlay its canvas on top of the existing replay viewer Canvas 2D element
2. THE Scene_Manager SHALL size and position the Three.js canvas to exactly match the existing replay viewer canvas dimensions, including on window resize
3. THE Scene_Manager SHALL configure the WebGLRenderer with a transparent background so that the existing 2D stage rendering remains visible beneath the 3D layer
4. WHEN the replay viewer calls `renderFrame()`, THE Scene_Manager SHALL render the Three.js scene once per frame in sync with the existing 2D rendering pass
5. IF WebGL is not available in the browser, THEN THE Scene_Manager SHALL log a warning and leave the existing 2D rendering unchanged
6. THE Scene_Manager SHALL lazy-load the Three.js library only when 3D Render_Mode is first enabled, to avoid increasing initial page load time

### Requirement 2: Side-View Camera

**User Story:** As a replay viewer user, I want the 3D scene to use a side-view camera matching the current 2D perspective, so that the 3D models appear in the same position and scale as the existing 2D silhouettes.

#### Acceptance Criteria

1. THE Side_View_Camera SHALL use an orthographic projection that maps Melee game-unit coordinates to canvas pixel coordinates using the same transform as the existing `toCanvasX`/`toCanvasY` functions
2. WHEN the user zooms or pans the replay viewer, THE Side_View_Camera SHALL update its projection to match the new viewport, maintaining alignment with the 2D stage layer
3. WHEN the dynamic camera mode is active, THE Side_View_Camera SHALL track the same target position and zoom level as the existing dynamic camera system
4. THE Side_View_Camera SHALL orient along the Z axis (Melee's lateral axis) so that the X-Z plane (Melee's forward-vertical plane) faces the viewer in a side-view perspective

### Requirement 3: Model Loading

**User Story:** As a replay viewer user, I want character 3D models to load automatically when a replay is opened, so that I can see 3D characters without manual setup.

#### Acceptance Criteria

1. WHEN a replay is loaded and 3D Render_Mode is enabled, THE Model_Loader SHALL fetch Model_JSON files for all characters present in the replay
2. THE Model_Loader SHALL cache loaded Model_JSON data in memory so that subsequent requests for the same character return the cached data without a network request
3. WHEN a Model_JSON file is not found (HTTP 404), THE Model_Loader SHALL return null for that character and log a warning
4. IF a Model_JSON file fails to parse as valid JSON, THEN THE Model_Loader SHALL return null for that character and log the parse error
5. THE Model_Loader SHALL map Slippi character IDs (0–25) to the correct `model-data/{character_name}.json` filenames using the same character name mapping as the existing HitboxLoader

### Requirement 4: Mesh Construction

**User Story:** As a developer, I want the model JSON data to be converted into Three.js SkinnedMesh objects, so that characters can be rendered with skeletal animation.

#### Acceptance Criteria

1. THE Mesh_Builder SHALL construct a Three.js `BufferGeometry` from the Model_JSON vertex positions, normals, UVs, and triangle indices
2. THE Mesh_Builder SHALL construct a Three.js `Skeleton` from the Model_JSON bone hierarchy (parent references) and base transforms
3. THE Mesh_Builder SHALL apply per-vertex bone weights and bone indices from the Model_JSON to the `BufferGeometry` as skinning attributes
4. THE Mesh_Builder SHALL apply the inverse bind matrices from the Model_JSON to each bone in the skeleton
5. THE Mesh_Builder SHALL produce a `SkinnedMesh` that combines the geometry, skeleton, and a Toon_Shader material

### Requirement 5: Character Materials and Textures

**User Story:** As a replay viewer user, I want characters to be rendered with their actual Melee textures on the low-poly models (like Rwing), so that the 3D view looks authentic to the game.

#### Acceptance Criteria

1. THE model extractor SHALL extract texture data (GX format decoded to RGBA) from the character DAT files and include it in the Model_JSON or as separate image files
2. THE Mesh_Builder SHALL apply extracted textures to the character mesh using UV coordinates from the Model_JSON
3. WHEN texture data is not available for a character, THE Mesh_Builder SHALL fall back to a simple flat/toon shader with a distinct base color per player port
4. THE Toon_Shader fallback SHALL use a flat or cel-shaded lighting model with a single directional light source
5. THE materials SHALL support semi-transparency so that overlapping character geometry does not fully occlude hitbox spheres rendered behind the mesh
6. THE Toon_Shader fallback SHALL render visible outlines or edge detection to improve character silhouette readability against the stage background

### Requirement 6: Skeletal Animation from FIGATREE Data

**User Story:** As a replay viewer user, I want 3D character models to animate using the same FIGATREE bone transforms that drive the hitbox system, so that the model pose matches the hitbox positions exactly.

#### Acceptance Criteria

1. WHEN rendering a frame, THE Animation_Driver SHALL read the bone world transforms for the current subaction and animation frame from the Hitbox_JSON bone frame data
2. THE Animation_Driver SHALL apply the bone transforms from the Hitbox_JSON to the corresponding bones in the Three.js skeleton, updating the SkinnedMesh pose
3. WHEN the Hitbox_JSON contains sparse keyframes, THE Animation_Driver SHALL interpolate bone transforms between surrounding keyframes using the same linear interpolation as the existing BoneResolver
4. WHEN no bone frame data exists for the current subaction, THE Animation_Driver SHALL pose the skeleton in the rest pose defined by the Model_JSON base transforms
5. THE Animation_Driver SHALL apply the character's facing direction by mirroring the skeleton along the appropriate axis (X scale = -1 for left-facing)
6. THE Animation_Driver SHALL apply the character's world position (from .slp frame data) as the root transform of the SkinnedMesh

### Requirement 7: 3D Hitbox Sphere Rendering

**User Story:** As a replay viewer user, I want hitbox and hurtbox spheres rendered as 3D objects in the same scene as the character models, so that hitbox positions align perfectly with the character mesh without 2D projection errors.

#### Acceptance Criteria

1. WHEN hitbox display is enabled and 3D Render_Mode is active, THE Hitbox_Sphere_Renderer SHALL render each active hitbox as a semi-transparent 3D sphere in the Three.js scene
2. THE Hitbox_Sphere_Renderer SHALL position each hitbox sphere by applying the hitbox's bone-local offset to the bone's world transform from the skeleton, using the same bone transform data as the Animation_Driver
3. THE Hitbox_Sphere_Renderer SHALL color-code hitbox spheres by hitbox ID: ID 0 as red, ID 1 as orange, ID 2 as yellow, ID 3 as green, matching the existing 2D color scheme
4. THE Hitbox_Sphere_Renderer SHALL scale hitbox sphere radii by the character's scale factor
5. WHEN hurtbox display is enabled and 3D Render_Mode is active, THE Hitbox_Sphere_Renderer SHALL render each hurtbox as a semi-transparent 3D sphere positioned at the attached bone's world position plus the hurtbox offset
6. THE Hitbox_Sphere_Renderer SHALL color hurtbox spheres yellow when the character is in a vulnerable state and blue when the character is in an invincible or intangible state
7. THE Hitbox_Sphere_Renderer SHALL render hitbox spheres only when the current animation frame is within the hitbox's active frame range (`startFrame <= frame <= endFrame`)

### Requirement 8: Render Mode Toggle

**User Story:** As a replay viewer user, I want to toggle between 2D SVG silhouette rendering and 3D model rendering, so that I can choose the visualization that works for my needs.

#### Acceptance Criteria

1. THE Replay_Viewer SHALL provide a toggle control in the toolbar to switch between 2D SVG Render_Mode and 3D model Render_Mode
2. WHEN 3D Render_Mode is enabled, THE Replay_Viewer SHALL hide the 2D SVG character silhouettes and display the Three.js 3D character meshes
3. WHEN 2D Render_Mode is enabled, THE Replay_Viewer SHALL hide the Three.js canvas and display the existing 2D SVG character silhouettes and 2D hitbox circles
4. WHEN switching from 2D to 3D Render_Mode, THE Replay_Viewer SHALL initialize the Three.js scene and load model data if not already loaded
5. THE Replay_Viewer SHALL persist the user's Render_Mode preference in localStorage so that the chosen mode is restored on the next visit
6. WHEN 3D Render_Mode is active, THE Replay_Viewer SHALL use the 3D Hitbox_Sphere_Renderer instead of the existing 2D HitboxRenderer for hitbox visualization

### Requirement 9: SVG Fallback

**User Story:** As a replay viewer user, I want the viewer to fall back to 2D SVG rendering when 3D rendering is unavailable, so that I can still watch replays on devices without WebGL support.

#### Acceptance Criteria

1. IF WebGL is not available, THEN THE Replay_Viewer SHALL automatically use 2D SVG Render_Mode and disable the 3D toggle control
2. IF a character's Model_JSON is not available, THEN THE Replay_Viewer SHALL render that character using the existing 2D SVG silhouette while other characters with available models render in 3D
3. WHEN 2D SVG Render_Mode is active, THE Replay_Viewer SHALL use the existing 2D HitboxRenderer and BoneResolver for hitbox visualization, unchanged from current behavior

### Requirement 10: Performance

**User Story:** As a replay viewer user, I want the 3D rendering to maintain 60fps with 2 characters and hitbox spheres on modern browsers, so that replay playback remains smooth.

#### Acceptance Criteria

1. THE Scene_Manager SHALL render 2 character SkinnedMeshes plus up to 8 hitbox spheres and 40 hurtbox spheres at 60 frames per second on a modern desktop browser (Chrome/Firefox/Safari, 2020+ hardware)
2. THE Model_Loader SHALL reuse a single geometry and skeleton instance per character, cloning only the mesh and material when the same character appears on both player ports
3. THE Scene_Manager SHALL dispose of Three.js geometries, materials, and textures when the replay viewer is closed or a new replay is loaded, to prevent GPU memory leaks
4. THE Animation_Driver SHALL update bone transforms by directly setting matrix values on the skeleton bones, avoiding per-frame object allocation

### Requirement 11: Coordinate System Alignment

**User Story:** As a developer, I want the 3D scene coordinate system to match Melee's game-unit coordinate system, so that character positions from .slp data and hitbox offsets from the JSON data can be used directly without additional conversion.

#### Acceptance Criteria

1. THE Scene_Manager SHALL use a coordinate system where one Three.js unit equals one Melee game unit
2. THE Scene_Manager SHALL orient the scene so that the Melee Y axis (vertical) maps to the Three.js Y axis, and the Melee Z axis (forward/depth in side-view) maps to the Three.js X axis
3. THE Side_View_Camera SHALL produce a projection where a character at Melee position (gameX, gameY) appears at the same canvas pixel as the existing `toCanvasX(gameX)` / `toCanvasY(gameY)` functions produce
4. THE Hitbox_Sphere_Renderer SHALL position hitbox spheres using the same bone transform and offset math as the existing 2D BoneResolver, ensuring that switching between 2D and 3D modes shows hitboxes at equivalent positions

### Requirement 12: Hover Tooltip in 3D Mode

**User Story:** As a replay viewer user, I want to hover over hitbox spheres in 3D mode to see their properties, so that the tooltip functionality works the same as in 2D mode.

#### Acceptance Criteria

1. WHEN the user hovers the mouse over a hitbox sphere in 3D Render_Mode, THE Replay_Viewer SHALL display a tooltip showing the hitbox's damage, angle, knockback growth, and base knockback values
2. THE Replay_Viewer SHALL perform hit-testing against hitbox spheres using Three.js raycasting from the mouse position through the Side_View_Camera
3. WHEN the mouse moves away from all hitbox spheres, THE Replay_Viewer SHALL hide the tooltip

### Requirement 13: Error Handling and Graceful Degradation

**User Story:** As a replay viewer user, I want the viewer to handle 3D rendering errors gracefully, so that a failure in the 3D system does not break replay playback.

#### Acceptance Criteria

1. IF the Three.js library fails to load, THEN THE Scene_Manager SHALL fall back to 2D SVG Render_Mode and log the error
2. IF an error occurs during SkinnedMesh construction for a character, THEN THE Mesh_Builder SHALL log the error and THE Replay_Viewer SHALL render that character using the 2D SVG fallback
3. IF an error occurs during a Three.js render pass, THEN THE Scene_Manager SHALL catch the error, log it, and continue rendering subsequent frames without crashing the replay viewer
4. WHEN switching to 3D Render_Mode fails for any reason, THE Replay_Viewer SHALL revert to 2D SVG Render_Mode and display a brief notification to the user
