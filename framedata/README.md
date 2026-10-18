# Optional: extractor hitbox data

The replay viewer can use pfirsich's meleeFrameDataExtractor output as a fallback
hitbox source. Its host (melee.theshoemaker.de) blocks cross-site requests, so the
files have to live here instead.

To enable it, open these in your browser and save each one into this folder,
keeping the file name, e.g. `Fox.framedata.json`, `Captain Falcon.framedata.json`:

    https://melee.theshoemaker.de/framedata-json-fullhitboxes/Fox.framedata.json

(The exact names are in `EXTRACTOR_CHAR_NAMES` in fightcore.js.)

Nothing breaks if this folder is empty: the viewer draws hitboxes from hitbox-data/.
