# Requirements Document

## Introduction

The AI Replay Generation system is a standalone practice scenario generator for Super Smash Bros. Melee. Users describe a situation they want to practice in natural language, and the system generates both a `.slp` replay file for visualization and an UnclePunch Training Mode `.gci` savestate for hands-on practice on console or Dolphin. The system is built on three layers: a manually curated Action Dataset mapping actions to frame-level controller inputs, a Replay Compiler that chains actions into valid game state, and an LLM Prompt Layer that translates natural language into structured action sequences. A token-based monetization layer wraps the generation API.

## Glossary

- **Action_Dataset**: The module that loads, queries, and manages per-character JSON files mapping human-readable action names to exact frame-level controller input sequences
- **Replay_Compiler**: The core engine that transforms a sequence of high-level actions into frame-by-frame game state and controller inputs, tracking positions, velocities, and interactions
- **SLP_Writer**: The module that generates valid `.slp` binary files from compiled frame data in UBJSON event stream format
- **GCI_Writer**: The module that converts `.slp` data to UnclePunch Training Mode `.gci` savestates via `@gcpreston/tm_replay_wasm`
- **Sequence_Validator**: The module that validates LLM-generated action sequences for physical possibility within Melee's game mechanics
- **Labeling_Tool**: The semi-automated tool for building the Action Dataset by extracting action-to-input mappings from existing `.slp` replays
- **Token_Manager**: The module that handles token-based monetization including cost estimation, balance tracking, and deduction
- **LLM_Prompt_Layer**: The module that translates natural language prompts into structured action sequences using LLM function calling against the Action Dataset schema
- **Generation_API**: The Netlify Function endpoint that orchestrates the full generation pipeline from prompt to downloadable files
- **Action_Entry**: A single record in the Action Dataset mapping an action name, character, context, and controller input sequence
- **Compiled_Action**: A structured action object output by the LLM specifying player, action name, start frame, and parameters
- **Character_State**: The simulation state of a character at a given frame including position, velocity, facing, percent, action state, and actionability
- **Controller_Input**: A per-frame record of stick positions, button presses, and trigger values
- **Pricing_Tier**: One of four cost levels (free, standard, complex, premium) determined by action count, character count, and duration
- **IKneeData_Calculator**: The existing project module that implements Melee's knockback formula for hit interaction resolution

## Requirements

### Requirement 1: Action Dataset Loading and Querying

**User Story:** As a developer, I want to load and query per-character action datasets, so that the system can resolve natural language actions into exact controller input sequences.

#### Acceptance Criteria

1. WHEN a character name is provided, THE Action_Dataset SHALL load the corresponding `action-dataset/{character}.json` file and return the parsed action library
2. THE Action_Dataset SHALL cache loaded character data in memory so that subsequent requests for the same character return cached data without a file read
3. WHEN a character JSON file is not found, THE Action_Dataset SHALL return null and log a warning
4. WHEN an action name and Action_Context are provided, THE Action_Dataset SHALL return the matching input sequence variant whose context (grounded/airborne, facing direction, fromState) matches the provided context
5. WHEN no variant matches the provided context exactly, THE Action_Dataset SHALL return the closest available variant and log a context mismatch warning
6. THE Action_Dataset SHALL list all available action names for a loaded character

### Requirement 2: Action Dataset Schema Validation

**User Story:** As a developer, I want the action dataset entries to be validated against the schema, so that invalid data is caught before it reaches the compiler.

#### Acceptance Criteria

1. THE Action_Dataset SHALL validate that every `inputs` array in an Action_Entry has monotonically increasing `frame` values
2. THE Action_Dataset SHALL validate that all `stick.x` and `stick.y` values are in the range [-1.0, 1.0]
3. THE Action_Dataset SHALL validate that all `buttons` entries contain only valid Melee button names: A, B, X, Y, Z, L, R, START, DPAD_UP, DPAD_DOWN, DPAD_LEFT, DPAD_RIGHT
4. THE Action_Dataset SHALL validate that all `trigger` values are in the range [0.0, 1.0]
5. THE Action_Dataset SHALL validate that `totalFrames` is greater than or equal to the last input's frame value
6. THE Action_Dataset SHALL validate that `actionStateId` is a non-negative integer
7. THE Action_Dataset SHALL validate that each character file contains at least the core movement actions: idle, walk, dash, jump, shorthop
8. IF an Action_Entry fails validation, THEN THE Action_Dataset SHALL reject the entry and return a descriptive error identifying the failing field and constraint

### Requirement 3: LLM Function Schema Generation

**User Story:** As a developer, I want the Action Dataset to generate an LLM function-calling schema, so that the LLM can produce structured action sequences using typed function calls.

#### Acceptance Criteria

1. WHEN a list of characters is provided, THE Action_Dataset SHALL generate a function-calling schema where each action becomes a callable function with typed parameters
2. THE generated schema SHALL include parameter types, descriptions, and valid value ranges for each action's parameters (direction, lCancel, diAngle, target)
3. THE generated schema SHALL include only actions available for the specified characters
4. THE Action_Dataset SHALL serialize the function schema to JSON format compatible with the target LLM API

### Requirement 4: LLM Prompt Translation

**User Story:** As a user, I want to describe a practice scenario in natural language, so that the system generates a structured action sequence without me needing to know frame data.

#### Acceptance Criteria

1. WHEN a natural language prompt, character list, and stage are provided, THE LLM_Prompt_Layer SHALL send the prompt along with the action function schema to the LLM API
2. THE LLM_Prompt_Layer SHALL parse the LLM response into an ordered array of Compiled_Action objects
3. IF the LLM returns an action name not present in the Action_Dataset, THEN THE LLM_Prompt_Layer SHALL reject the response and retry with a corrective prompt
4. IF the LLM response fails to parse as valid Compiled_Action objects, THEN THE LLM_Prompt_Layer SHALL retry the request up to 2 additional times before returning an error
5. THE LLM_Prompt_Layer SHALL include the character list, stage, and available actions in the system prompt context

### Requirement 5: Sequence Validation

**User Story:** As a developer, I want LLM-generated action sequences validated for physical possibility, so that impossible scenarios are rejected before compilation.

#### Acceptance Criteria

1. WHEN an action sequence is submitted, THE Sequence_Validator SHALL check that each action can be performed from the character's current state (grounded/airborne, actionable frame, hitstun)
2. THE Sequence_Validator SHALL reject an action that requires the character to be airborne when the character is grounded, and vice versa
3. THE Sequence_Validator SHALL reject an action that starts before the character's current action completes (before the actionable frame), unless the action is cancellable via IASA
4. THE Sequence_Validator SHALL verify that frame gaps between consecutive actions for the same character are non-negative
5. IF validation fails, THEN THE Sequence_Validator SHALL return an array of error objects each containing the failing action index, action name, and a human-readable reason string
6. WHEN validation succeeds, THE Sequence_Validator SHALL return a result indicating the sequence is valid

### Requirement 6: Replay Compilation

**User Story:** As a developer, I want the compiler to transform action sequences into frame-by-frame game state, so that the output can be written as a valid replay file.

#### Acceptance Criteria

1. WHEN a validated action sequence is provided, THE Replay_Compiler SHALL produce an array of frame data objects containing per-player Controller_Input and Character_State for every frame
2. THE Replay_Compiler SHALL track each character's position, velocity, facing direction, percent, action state, and actionable frame across all frames
3. THE Replay_Compiler SHALL resolve controller inputs for each action by looking up the matching variant from the Action_Dataset and applying inputs at the correct absolute frame offsets
4. WHEN an action targets an opponent and the active hitbox frames overlap with the opponent's hurtbox, THE Replay_Compiler SHALL invoke the IKneeData_Calculator to compute knockback, angle, hitstun, and updated percent
5. WHEN a hit is resolved, THE Replay_Compiler SHALL apply the computed knockback vector and hitstun duration to the defender's Character_State
6. THE Replay_Compiler SHALL initialize each character at the stage's spawn position for the corresponding port

### Requirement 7: SLP Binary Writing

**User Story:** As a user, I want the system to produce valid `.slp` replay files, so that I can preview generated scenarios in any Slippi-compatible viewer.

#### Acceptance Criteria

1. WHEN compiled frame data and metadata are provided, THE SLP_Writer SHALL produce a valid `.slp` binary in UBJSON event stream format
2. THE SLP_Writer SHALL write a game start payload containing stage ID, character IDs, player ports, and Slippi version
3. THE SLP_Writer SHALL write one pre-frame update per player per frame containing joystick, c-stick, trigger, and button bitfield values
4. THE SLP_Writer SHALL write one post-frame update per player per frame containing action state ID, position, facing direction, percent, shield size, stocks, and L-cancel status
5. THE SLP_Writer SHALL write a game end payload with the appropriate end method code
6. THE SLP_Writer SHALL produce output loadable by Slippi Desktop App, slippilab, and the project's own replay viewer

### Requirement 8: GCI Savestate Conversion

**User Story:** As a user, I want the system to produce UnclePunch Training Mode `.gci` savestates, so that I can load the practice scenario on console or Dolphin and drill it hands-on.

#### Acceptance Criteria

1. WHEN a valid `.slp` binary, target frame, and player index are provided, THE GCI_Writer SHALL convert the data to an UnclePunch Training Mode `.gci` savestate using `@gcpreston/tm_replay_wasm`
2. THE GCI_Writer SHALL produce a `.gci` file that is loadable in Training Mode Community Edition on both GameCube/Wii console and Dolphin emulator
3. THE GCI_Writer SHALL center the savestate around the specified target frame so the user begins practice at the relevant moment
4. IF the `tm_replay_wasm` conversion fails, THEN THE GCI_Writer SHALL return an error with the failure reason and still provide the `.slp` file as fallback

### Requirement 9: Labeling Tool Segment Detection

**User Story:** As a dataset builder, I want the labeling tool to automatically detect action segments in existing replays, so that I can label them efficiently instead of manually identifying frame ranges.

#### Acceptance Criteria

1. WHEN a `.slp` replay file is provided, THE Labeling_Tool SHALL parse the replay using slippi-js and detect action state transitions for each player
2. THE Labeling_Tool SHALL produce an array of action segments, each containing the player index, start frame, end frame, action state ID, and extracted Controller_Input array
3. THE Labeling_Tool SHALL extract controller inputs for each segment normalized relative to the segment's start frame (frame 0 = first frame of the action)
4. THE Labeling_Tool SHALL merge consecutive frames with the same action state ID into a single segment

### Requirement 10: Labeling Tool Auto-Labeling

**User Story:** As a dataset builder, I want the labeling tool to suggest action names for detected segments, so that common actions can be labeled quickly without manual lookup.

#### Acceptance Criteria

1. WHEN an action segment is detected, THE Labeling_Tool SHALL attempt to auto-label the segment by mapping the action state ID to a known action name
2. THE Labeling_Tool SHALL return a suggested action name and a confidence score (0.0 to 1.0) for each auto-label attempt
3. WHEN the action state ID does not map to any known action, THE Labeling_Tool SHALL return null for the suggestion
4. WHEN a human labeler provides a label for a segment, THE Labeling_Tool SHALL normalize the inputs (relative to action start, adjusted for facing direction) and store the result as an Action_Entry in the Action_Dataset

### Requirement 11: Token Cost Estimation

**User Story:** As a user, I want to see the token cost before generating a scenario, so that I can decide whether to proceed.

#### Acceptance Criteria

1. WHEN a generation request is submitted, THE Token_Manager SHALL estimate the token cost based on the Pricing_Tier determined by action count, character count, and duration
2. THE Token_Manager SHALL classify requests into the correct Pricing_Tier: free (up to 3 actions, 1 character, 180 frames), standard (up to 20 actions, 2 characters, 1800 frames), complex (up to 100 actions, 2 characters, 7200 frames), or premium (unlimited actions, up to 4 characters, 28800 frames)
3. THE Token_Manager SHALL apply an interaction multiplier of `1 + (hitInteractions * 0.1)` to the base tier cost
4. THE Token_Manager SHALL return the estimated cost to the user before deducting tokens

### Requirement 12: Token Balance Management

**User Story:** As a user, I want my token balance tracked and enforced, so that I can manage my usage and the system prevents overspending.

#### Acceptance Criteria

1. WHEN a generation is requested, THE Token_Manager SHALL check that the user has sufficient tokens for the estimated cost
2. IF the user has insufficient tokens, THEN THE Token_Manager SHALL reject the request and return the current balance and required amount
3. WHEN a generation completes successfully, THE Token_Manager SHALL deduct the final token cost from the user's balance
4. THE Token_Manager SHALL log each transaction with the user ID, token amount, and generation description

### Requirement 13: Generation API Orchestration

**User Story:** As a user, I want a single API endpoint that takes my natural language prompt and returns downloadable practice files, so that the generation process is seamless.

#### Acceptance Criteria

1. WHEN a POST request with prompt, characters, and stage is received, THE Generation_API SHALL orchestrate the full pipeline: cost estimation, token deduction, LLM translation, validation, compilation, SLP writing, and GCI conversion
2. THE Generation_API SHALL return both the `.slp` binary and the `.gci` binary in the response
3. IF any pipeline stage fails, THEN THE Generation_API SHALL return an error response identifying the failing stage and a human-readable error message
4. THE Generation_API SHALL enforce Pricing_Tier limits on action count, character count, and duration before invoking the LLM
5. WHEN the free tier is used, THE Generation_API SHALL allow generation without authentication, limited to the free tier constraints

### Requirement 14: Action Dataset Serialization Round-Trip

**User Story:** As a developer, I want the action dataset to be serializable and deserializable without data loss, so that the dataset can be stored, transferred, and loaded reliably.

#### Acceptance Criteria

1. THE Action_Dataset SHALL serialize Action_Entry objects to JSON format
2. THE Action_Dataset SHALL deserialize JSON back into Action_Entry objects
3. FOR ALL valid Action_Entry objects, serializing to JSON then deserializing SHALL produce an equivalent Action_Entry object (round-trip property)

### Requirement 15: SLP Binary Round-Trip Integrity

**User Story:** As a developer, I want generated `.slp` files to be parseable by slippi-js, so that the output can be verified and previewed using standard tools.

#### Acceptance Criteria

1. FOR ALL valid compilation results, writing a `.slp` file via SLP_Writer then parsing it with slippi-js SHALL produce frame data equivalent to the original compilation input
2. THE SLP_Writer SHALL produce files where the parsed game start metadata (stage, characters, ports) matches the input metadata
3. THE SLP_Writer SHALL produce files where the parsed pre-frame controller inputs match the compiled Controller_Input values for every frame and player
