# Implementation Plan: Modular Matchup Pages

## Overview

Convert 16 hardcoded matchup HTML pages into a JSON-driven, browser-editable content system. Implementation follows a phased approach: (1) build the rendering pipeline and migrate HTML to JSON, (2) create the shared template, (3) add editing capabilities and redirect old URLs. All code is vanilla JavaScript ES modules, no build step.

## Tasks

- [ ] 1. Create module-blocks.js — block type registry and renderers
  - [ ] 1.1 Create `module-blocks.js` with `renderBlock()` and `registerBlockType()` exports
    - Implement the block registry mapping type → renderer function
    - Implement text block renderer: parse markdown (bullets, bold, italic, links) → HTML
    - Implement fallback renderer for unrecognized types (show type name, graceful degradation)
    - Every rendered block must have `id` set to `section.id` and class `source-section`
    - _Requirements: 2.1, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 1.2 Add cc-table block renderer
    - Delegate to existing `cc-table-builder.js` `buildCCTables()` using config's foxId, opponentId, opponentName
    - Render the collapsible toggle wrapper matching current HTML structure
    - _Requirements: 2.4_

  - [ ] 1.3 Add oos-heatmap block renderer
    - Render iframe pointing to IKneeData heatmap URL from config
    - _Requirements: 2.5_

  - [ ] 1.4 Add vod, calculator, replay, and note-ref block renderers
    - VOD: embed YouTube/Twitch iframe with videoId and optional timestamp
    - Calculator: embed IKneeData calculator with pre-filled params
    - Replay: render link to replay file at specified frame
    - Note-ref: render referenced player note inline using noteId
    - _Requirements: 2.2, 2.3, 2.6, 2.7_

  - [ ]* 1.5 Write property tests for module-blocks.js
    - **Property 4: Graceful Degradation for Unknown Block Types** — for any section with unrecognized type, renderBlock returns a valid HTMLElement with fallback message
    - **Property 5: CSS Class Invariant** — for any section of any type, rendered element has class `source-section`
    - **Property 2: Section ID Preservation in DOM** — for any section with non-empty id, rendered element's id attribute matches exactly
    - **Validates: Requirements 2.8, 2.9, 1.5**

  - [ ]* 1.6 Write property test for markdown round-trip
    - **Property 6: Markdown Round-Trip** — for any valid markdown with bullets, bold, italic, links, converting to HTML and back preserves content
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 8.2**

- [ ] 2. Create matchup-renderer.js — page rendering from JSON
  - [ ] 2.1 Create `matchup-renderer.js` with `initMatchupPage()` and `rerenderSection()` exports
    - Fetch and parse `matchup-data/{character}.json`
    - Render group headers (h2) and delegate section rendering to module-blocks.js
    - Initialize matchup-tags-ui.js (`initMatchupTags`) and note-tags.js (`buildRelatedNotes`)
    - Show/hide edit controls based on `localStorage.getItem('gh_token')`
    - Maintain in-memory state of current page data for editing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ] 2.2 Add JSON validation in the renderer
    - Validate unique section IDs within the file
    - Validate section type matches registered Module_Types
    - Validate text sections have non-empty content, non-text sections have config
    - Validate all IDs are URL-safe (lowercase alphanumeric + hyphens)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 2.3 Add deep linking support
    - After rendering, check URL hash fragment and scroll to matching section
    - Apply temporary visual highlight (outline) to the target section
    - _Requirements: 10.1, 10.2_

  - [ ] 2.4 Add error handling for JSON fetch failures
    - Display user-friendly error message on 404, network error, or invalid JSON
    - Show retry button
    - Show "not migrated yet" message if file doesn't exist
    - _Requirements: 12.1, 12.2_

  - [ ]* 2.5 Write property tests for matchup-renderer.js
    - **Property 1: Rendering Order Invariant** — groups and sections render in same order as JSON arrays, all present in DOM
    - **Property 3: Permission Gating** — edit controls visible iff gh_token exists in localStorage
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.6, 1.7, 4.4**

- [ ] 3. Checkpoint — Rendering pipeline
  - Ensure all tests pass, ask the user if questions arise.
  - At this point, module-blocks.js and matchup-renderer.js should be able to render a matchup page from a hand-crafted JSON file.

- [ ] 4. Create migrate-matchups.js — HTML to JSON migration script
  - [ ] 4.1 Create `migrate-matchups.js` with `migrateHtmlToJson()` and `migrateAllMatchups()` exports
    - Parse HTML using DOMParser, extract `.matchup-content` groups and `.source-section` elements
    - Convert HTML bullet lists, bold, links to markdown equivalents
    - Preserve all existing section IDs from HTML `id` attributes
    - Detect CC/ASDI table sections (`.cc-asdi-toggle`), OoS heatmap iframes, VOD iframes and assign correct module types with config
    - Preserve group and section ordering from original HTML
    - Validate no section IDs are lost — throw error listing missing IDs if any
    - Ensure `meta.character` matches filename slug
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 4.2 Create `matchup-data/` directory and run migration on all 16 matchup HTML files
    - Generate JSON files for: marth, falco, falcon, sheik, peach, puff, ics, pikachu, samus, doc, dk, ganon, luigi, yoshi, fox, doubles
    - Include correct meta fields (character, displayName, title, subtitle, icon, fightcoreId) for each
    - _Requirements: 8.1, 8.3, 8.5_

  - [ ]* 4.3 Write property tests for migration
    - **Property 10: Migration Losslessness** — for any matchup HTML, migration produces valid MatchupData with all original section IDs preserved, ordering matches
    - **Property 11: Migration Type Detection** — CC table, OoS heatmap, and VOD sections get correct module types
    - **Validates: Requirements 8.1, 8.3, 8.4, 8.5, 10.3**

- [ ] 5. Checkpoint — Migration validation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify migrated JSON files render correctly through matchup-renderer.js. Compare rendered output against original HTML pages for content parity.

- [ ] 6. Create matchup.html — shared page template
  - [ ] 6.1 Create `matchup.html` as the single shared template
    - Accept character from URL query string (`?c=marth`)
    - Include all shared CSS (matchup-content, source-section, CC table styles, etc.)
    - Import and call `initMatchupPage(character, container)`
    - Include the back-link, character header with icon, and related notes container
    - _Requirements: 11.1, 11.2_

  - [ ]* 6.2 Write unit tests for URL routing
    - Test that `?c=marth` loads marth.json, `?c=falco` loads falco.json, etc.
    - Test that missing `?c=` parameter shows an error
    - _Requirements: 11.1_

- [ ] 7. Create matchup-editor.js — inline editing and GitHub persistence
  - [ ] 7.1 Create `matchup-editor.js` with `initEditor()`, `editSection()`, `addSection()`, `removeSection()`, `moveSection()` exports
    - Inline markdown editing with textarea, pre-filled with current content
    - Save/cancel buttons on the editor
    - Permission gating: all operations require `gh_token` in localStorage
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 7.2 Implement section management (add, remove, reorder)
    - Add section: generate URL-safe unique ID, append to group, render, commit
    - Remove section: remove from data and DOM, commit
    - Move section: swap in array, re-render group, commit
    - Support adding any registered Module_Type
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 7.3 Implement GitHub API save with error handling
    - Fetch current SHA before committing
    - Commit with descriptive message including character name
    - Handle 401 (invalid token), 409 (conflict — re-fetch SHA and retry), network errors
    - Preserve unsaved edits on failure, show error toast
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 12.3_

  - [ ]* 7.4 Write property tests for editor operations
    - **Property 7: Section Reorder Correctness** — move up/down produces expected permutation, boundary moves are no-ops
    - **Property 8: Generated IDs are URL-Safe and Unique** — new section IDs contain only lowercase alphanumeric + hyphens, unique within file
    - **Property 13: Edit Idempotency** — load then save without changes produces identical JSON
    - **Validates: Requirements 5.1, 5.3, 9.5, 4.2, 6.2**

- [ ] 8. Create search-index-builder.js — browser-side search index rebuild
  - [ ] 8.1 Create `search-index-builder.js` with `rebuildSearchIndex()` export
    - Extract searchable text from all sections in a character's data
    - Merge with existing search index entries (other characters unchanged)
    - Commit updated search-index.json to GitHub
    - Output format must match existing search-index.json structure (matchup, file, id, h2, h3, preview, text fields)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.2 Write property test for search index consistency
    - **Property 9: Search Index Consistency** — after save, search index entries cover every section's text, other characters' entries unchanged
    - **Validates: Requirements 7.2, 7.3**

- [ ] 9. Wire editor and search index into the rendering pipeline
  - [ ] 9.1 Integrate matchup-editor.js into matchup-renderer.js
    - After page render, call `initEditor()` if gh_token exists
    - Wire edit/add/remove/move buttons to editor functions
    - After successful save, trigger `rebuildSearchIndex()`
    - _Requirements: 1.6, 4.2, 7.1_

  - [ ] 9.2 Integrate search-index-builder.js into matchup-editor.js save flow
    - After successful GitHub save of matchup data, call `rebuildSearchIndex(character, data)`
    - _Requirements: 7.1_

- [ ] 10. Checkpoint — Full editing pipeline
  - Ensure all tests pass, ask the user if questions arise.
  - Verify end-to-end: load matchup.html?c=marth → edit a section → save → reload → verify content persisted and search index updated.

- [ ] 11. Add redirects from old matchup URLs to new template
  - [ ] 11.1 Add redirect logic to old `matchups/{character}.html` files
    - Each old HTML file redirects to `matchup.html?c={character}`
    - Preserve hash fragments in the redirect (e.g., `matchups/marth.html#marth-edgeguarding` → `matchup.html?c=marth#marth-edgeguarding`)
    - _Requirements: 11.3_

  - [ ] 11.2 Ensure Electron compatibility of renderer and block registry
    - Verify no browser-specific APIs beyond standard DOM API are used in renderer/blocks
    - Document the storage interface abstraction point for future Electron filesystem reads
    - _Requirements: 13.1, 13.2_

- [ ] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify old URLs redirect correctly, deep links work, search index is accurate, and editing flow is complete.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The existing `matchup-tags-ui.js`, `note-tags.js`, and `cc-table-builder.js` modules are already working and just need integration — no new code needed for those
- The `build-search-index.py` script continues to work during migration; `search-index-builder.js` replaces it for browser-side rebuilds after edits
