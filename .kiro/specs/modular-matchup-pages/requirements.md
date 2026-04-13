# Requirements Document

## Introduction

The modular matchup pages system converts 16 hardcoded matchup HTML pages into a JSON-driven, browser-editable content system. Each matchup page's content is stored as structured JSON in `matchup-data/{character}.json`, rendered dynamically by a shared page template, and editable from the browser when a GitHub token is connected. The system preserves all existing functionality (deep linking, tagging, search indexing, related notes, CC/ASDI tables, OoS heatmaps) while making content editable without touching HTML.

## Glossary

- **Renderer**: The `matchup-renderer.js` module responsible for reading character JSON data and rendering the full matchup page into the DOM
- **Editor**: The `matchup-editor.js` module responsible for inline editing, section CRUD operations, and saving changes to GitHub
- **Block_Registry**: The `module-blocks.js` module that maps section types to their rendering functions
- **Search_Index_Builder**: The `search-index-builder.js` module that rebuilds search-index.json from matchup JSON data after edits
- **Migration_Script**: The one-time script that converts existing matchup HTML pages into the JSON data format
- **MatchupData**: The JSON data structure containing a character's page metadata and ordered groups of sections
- **Section**: A single content block within a group, identified by a stable ID and a module type
- **Group**: An ordered collection of sections under a shared h2 header
- **Module_Type**: One of seven block types: text, vod, calculator, cc-table, oos-heatmap, replay, note-ref
- **GitHub_Token**: A GitHub Personal Access Token stored in localStorage, used for write access to the repository
- **Section_ID**: A URL-safe, unique identifier for each section, used for deep linking via URL hash fragments
- **Markdown_Parser**: The lightweight custom parser that converts a subset of markdown (bullets, bold, italic, links) to HTML

## Requirements

### Requirement 1: Matchup Page Rendering

**User Story:** As a user, I want matchup pages to load content from JSON data files, so that the content is dynamically rendered and maintainable without editing HTML.

#### Acceptance Criteria

1. WHEN a user navigates to a matchup page with a character parameter, THE Renderer SHALL fetch `matchup-data/{character}.json` and render all groups and sections into the page container
2. THE Renderer SHALL render groups in the same order as they appear in the `groups` array of the MatchupData
3. THE Renderer SHALL render sections within each group in the same order as they appear in the `sections` array of that Group
4. WHEN rendering is complete, THE Renderer SHALL initialize the matchup tagging system and related notes module for the loaded character
5. WHEN a Section has a non-empty `id` field, THE Renderer SHALL set that value as the DOM element's `id` attribute to preserve deep linking
6. WHEN a GitHub_Token exists in localStorage, THE Renderer SHALL display edit controls on the rendered page
7. WHEN no GitHub_Token exists in localStorage, THE Renderer SHALL hide all edit controls from the rendered page

### Requirement 2: Module Block Rendering

**User Story:** As a user, I want each section type to render with its appropriate visual format, so that text, VODs, calculators, tables, and heatmaps all display correctly.

#### Acceptance Criteria

1. WHEN a Section has type 'text', THE Block_Registry SHALL render the markdown content as HTML with bullet lists, bold text, italic text, and links
2. WHEN a Section has type 'vod', THE Block_Registry SHALL render an embedded video player (YouTube or Twitch) using the config's videoId and optional timestamp
3. WHEN a Section has type 'calculator', THE Block_Registry SHALL render an embedded IKneeData calculator with pre-filled parameters from the config
4. WHEN a Section has type 'cc-table', THE Block_Registry SHALL delegate rendering to the existing cc-table-builder.js module using the config's foxId, opponentId, and opponentName
5. WHEN a Section has type 'oos-heatmap', THE Block_Registry SHALL render an iframe pointing to the IKneeData heatmap URL from the config
6. WHEN a Section has type 'replay', THE Block_Registry SHALL render a link to the replay file at the specified frame from the config
7. WHEN a Section has type 'note-ref', THE Block_Registry SHALL render the referenced player note inline using the config's noteId
8. IF a Section has an unrecognized type, THEN THE Block_Registry SHALL render a fallback block displaying the section title and a message indicating the unknown type
9. THE Block_Registry SHALL assign the class `source-section` to every rendered block element to preserve existing CSS styling

### Requirement 3: Markdown Parsing and Rendering

**User Story:** As a content author, I want text sections stored as markdown, so that content is human-readable in JSON and renders correctly as HTML.

#### Acceptance Criteria

1. WHEN rendering a text section, THE Markdown_Parser SHALL convert lines starting with `- ` into HTML unordered list items
2. WHEN rendering a text section, THE Markdown_Parser SHALL convert `**text**` patterns into bold HTML elements
3. WHEN rendering a text section, THE Markdown_Parser SHALL convert `*text*` patterns into italic HTML elements
4. WHEN rendering a text section, THE Markdown_Parser SHALL convert `[text](url)` patterns into HTML anchor elements with the specified URL
5. WHEN rendering a text section containing no bullet list items, THE Markdown_Parser SHALL render the content as paragraph elements

### Requirement 4: Section Editing

**User Story:** As a content author with a connected GitHub token, I want to edit matchup sections inline, so that I can update content directly from the browser.

#### Acceptance Criteria

1. WHEN a user clicks the edit button on a section, THE Editor SHALL open an inline textarea pre-filled with the section's current markdown content
2. WHEN a user saves an edited section, THE Editor SHALL update the in-memory MatchupData, re-render the affected section, and commit the updated JSON to GitHub
3. WHEN a user cancels an edit, THE Editor SHALL discard changes and restore the section to its previous rendered state
4. WHILE no GitHub_Token is present in localStorage, THE Editor SHALL prevent all editing operations

### Requirement 5: Section Management

**User Story:** As a content author, I want to add, remove, and reorder sections within matchup pages, so that I can organize content as the matchup knowledge evolves.

#### Acceptance Criteria

1. WHEN a user adds a new section to a group, THE Editor SHALL generate a stable URL-safe Section_ID, append the section to the group, render the new section, and commit the updated JSON to GitHub
2. WHEN a user removes a section, THE Editor SHALL remove the section from the in-memory data, remove the DOM element, and commit the updated JSON to GitHub
3. WHEN a user moves a section up or down within its group, THE Editor SHALL update the section order in the data, re-render the group, and commit the updated JSON to GitHub
4. THE Editor SHALL support adding sections of any registered Module_Type

### Requirement 6: GitHub API Persistence

**User Story:** As a content author, I want edits saved to the GitHub repository, so that changes are version-controlled and visible on the live site after deploy.

#### Acceptance Criteria

1. WHEN saving matchup data, THE Editor SHALL fetch the current file SHA from the GitHub Contents API before committing
2. WHEN saving matchup data, THE Editor SHALL commit the updated JSON with a descriptive commit message that includes the character name
3. IF the GitHub API returns a 401 unauthorized error, THEN THE Editor SHALL display an error message indicating the token is invalid or expired
4. IF the GitHub API returns a 409 conflict error, THEN THE Editor SHALL re-fetch the current SHA and retry the save automatically
5. IF a save operation fails, THEN THE Editor SHALL preserve the user's unsaved edits in the editor interface
6. IF a save operation fails due to a network error, THEN THE Editor SHALL display an error message with the specific failure reason

### Requirement 7: Search Index Rebuild

**User Story:** As a user, I want the search index to stay current after edits, so that I can find updated content through the site search.

#### Acceptance Criteria

1. WHEN a matchup data save completes successfully, THE Search_Index_Builder SHALL rebuild the search index entries for the edited character
2. THE Search_Index_Builder SHALL extract searchable text from all sections in the character's data
3. THE Search_Index_Builder SHALL merge updated entries with existing search index entries for other characters without modifying those entries
4. WHEN the search index is rebuilt, THE Search_Index_Builder SHALL commit the updated search-index.json to GitHub

### Requirement 8: HTML to JSON Migration

**User Story:** As a developer, I want to migrate existing matchup HTML pages to JSON format, so that the new modular system has all existing content without data loss.

#### Acceptance Criteria

1. WHEN the Migration_Script processes a matchup HTML file, THE Migration_Script SHALL extract all groups (`.matchup-content` elements) and sections (`.source-section` elements) into a valid MatchupData structure
2. WHEN converting text content, THE Migration_Script SHALL convert HTML bullet lists, bold text, and links into their markdown equivalents
3. THE Migration_Script SHALL preserve all existing Section_IDs from the HTML `id` attributes in the output JSON
4. THE Migration_Script SHALL detect CC/ASDI table sections, OoS heatmap sections, and VOD embed sections and assign the correct Module_Type with appropriate config
5. THE Migration_Script SHALL preserve the ordering of groups and sections as they appear in the original HTML
6. IF the Migration_Script detects that any Section_ID from the original HTML is missing in the output JSON, THEN THE Migration_Script SHALL throw an error listing the missing IDs and refuse to write the output file
7. THE Migration_Script SHALL produce a MatchupData JSON file where the `meta.character` field matches the filename slug

### Requirement 9: JSON Data Validation

**User Story:** As a developer, I want the JSON data to be validated against the schema, so that malformed data does not cause rendering errors.

#### Acceptance Criteria

1. THE Renderer SHALL validate that every Section in the MatchupData has a unique `id` within the file
2. THE Renderer SHALL validate that every Section has a `type` field matching one of the registered Module_Types
3. THE Renderer SHALL validate that text-type Sections have a non-empty `content` field
4. THE Renderer SHALL validate that non-text-type Sections have a `config` object
5. THE Renderer SHALL validate that all Section_IDs and Group IDs are URL-safe (lowercase alphanumeric and hyphens only)

### Requirement 10: Deep Linking Preservation

**User Story:** As a user, I want existing URLs with section hash fragments to continue working after migration, so that bookmarks and shared links remain valid.

#### Acceptance Criteria

1. WHEN a page URL contains a hash fragment matching a Section_ID, THE Renderer SHALL scroll to that section after rendering is complete
2. WHEN scrolling to a deep-linked section, THE Renderer SHALL apply a temporary visual highlight to the target section
3. THE Migration_Script SHALL ensure that every Section_ID in the migrated JSON matches the original HTML element `id` exactly

### Requirement 11: URL Routing and Backward Compatibility

**User Story:** As a user, I want both old matchup URLs and new template URLs to work, so that no existing links break during the migration.

#### Acceptance Criteria

1. THE Renderer SHALL accept a character parameter from the URL query string (e.g., `matchup.html?c=marth`)
2. WHILE old matchup HTML files exist alongside the new template, THE system SHALL serve both URL formats without errors
3. WHEN the old HTML files are replaced with redirects, THE system SHALL redirect from `matchups/{character}.html` to `matchup.html?c={character}`

### Requirement 12: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong, so that I understand what happened and how to recover.

#### Acceptance Criteria

1. IF the character JSON file fails to load (404, network error, or invalid JSON), THEN THE Renderer SHALL display a user-friendly error message in the page container with a retry button
2. IF the character JSON file does not exist because the page has not been migrated yet, THEN THE Renderer SHALL display a message explaining the page has not been migrated
3. IF a GitHub save fails, THEN THE Editor SHALL display an error toast with the specific failure reason without discarding the user's edits

### Requirement 13: Electron App Compatibility

**User Story:** As a developer, I want the JSON data format and rendering modules to work in both web and Electron environments, so that the future desktop app can reuse the same code.

#### Acceptance Criteria

1. THE Renderer and Block_Registry SHALL perform pure DOM rendering without dependencies on browser-specific APIs beyond the standard DOM API
2. THE MatchupData JSON format SHALL support both HTTP fetch (web) and filesystem read (Electron) as data sources through an abstracted storage interface
