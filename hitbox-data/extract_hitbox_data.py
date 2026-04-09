#!/usr/bin/env python3
"""
extract_hitbox_data.py — Extract hitbox/hurtbox data from Melee character DAT files.

Reads a Super Smash Bros. Melee (NTSC v1.02) ISO, extracts character DAT files,
parses them using meleeDat2Json, and outputs per-character JSON files for the
browser-side hitbox renderer.

Usage:
    python extract_hitbox_data.py --iso path/to/melee.iso [--char fox] [--outdir hitbox-data]
    python extract_hitbox_data.py --validate hitbox-data/fox.json
"""

import argparse
import json
import logging
import math as _math
import os
import struct
import sys

# ---------------------------------------------------------------------------
# meleeDat2Json integration
# Install via: pip install -r hitbox-data/requirements.txt
# ---------------------------------------------------------------------------
try:
    from meleedat2json.meleedat2json import DatFile
    HAS_MELEEDAT2JSON = True
except ImportError:
    HAS_MELEEDAT2JSON = False

logger = logging.getLogger("extract_hitbox_data")

# ---------------------------------------------------------------------------
# Character definitions: maps character name -> DAT file prefix in the ISO
# The main fighter data file is Pl{prefix}.dat (e.g. PlFx.dat for Fox)
# ---------------------------------------------------------------------------
CHARACTER_DAT_PREFIX = {
    "bowser":          "Kp",
    "captain_falcon":  "Ca",
    "donkey_kong":     "Dk",
    "dr_mario":        "Dr",
    "falco":           "Fc",
    "fox":             "Fx",
    "game_and_watch":  "Gw",
    "ganondorf":       "Gn",
    "ice_climbers":    "Pp",  # Popo (lead climber) — PlPp.dat
    "jigglypuff":      "Pr",
    "kirby":           "Kb",
    "link":            "Lk",
    "luigi":           "Lg",
    "mario":           "Mr",
    "marth":           "Ms",
    "mewtwo":          "Mt",  # PlMt.dat
    "ness":            "Ns",
    "peach":           "Pe",
    "pichu":           "Pc",
    "pikachu":         "Pk",
    "roy":             "Fe",
    "samus":           "Ss",
    "sheik":           "Sk",
    "yoshi":           "Ys",
    "young_link":      "Cl",
    "zelda":           "Zd",
}


# External character IDs (matching .slp format) for each character
CHARACTER_EXTERNAL_ID = {
    "bowser": 5,
    "captain_falcon": 0,
    "donkey_kong": 1,
    "dr_mario": 22,
    "falco": 20,
    "fox": 2,
    "game_and_watch": 24,
    "ganondorf": 25,
    "ice_climbers": 10,
    "jigglypuff": 15,
    "kirby": 4,
    "link": 6,
    "luigi": 17,
    "mario": 8,
    "marth": 18,
    "mewtwo": 16,
    "ness": 11,
    "peach": 12,
    "pichu": 19,
    "pikachu": 13,
    "roy": 23,
    "samus": 16,  # Note: will be corrected below
    "sheik": 7,
    "yoshi": 3,
    "young_link": 21,
    "zelda": 14,
}
# Fix samus external ID (16 is mewtwo, samus is 15... let me correct)
CHARACTER_EXTERNAL_ID["samus"] = 15  # Samus is actually 15 in some orderings
CHARACTER_EXTERNAL_ID["jigglypuff"] = 15  # Will reconcile below

# Correct external character IDs per Slippi spec:
# https://github.com/project-slippi/slippi-wiki/blob/master/SPEC.md
CHARACTER_EXTERNAL_ID.update({
    "captain_falcon": 0,
    "donkey_kong":    1,
    "fox":            2,
    "game_and_watch": 3,
    "kirby":          4,
    "bowser":         5,
    "link":           6,
    "luigi":          7,
    "mario":          8,
    "marth":          9,
    "mewtwo":         10,
    "ness":           11,
    "peach":          12,
    "pikachu":        13,
    "ice_climbers":   14,
    "jigglypuff":     15,
    "samus":          16,
    "yoshi":          17,
    "zelda":          18,
    "sheik":          19,
    "falco":          20,
    "young_link":     21,
    "dr_mario":       22,
    "roy":            23,
    "pichu":          24,
    "ganondorf":      25,
})


# ---------------------------------------------------------------------------
# Character model scale factors
# ---------------------------------------------------------------------------
# Most characters use a scale of 1.0. Some characters have different
# model scales stored in their fighter attributes in the DAT file.
# These are the known overrides for NTSC v1.02.
# Default is 1.0 for any character not listed here.
# ---------------------------------------------------------------------------
CHARACTER_SCALE = {
    "bowser":          1.0,
    "captain_falcon":  1.0,
    "donkey_kong":     1.0,
    "dr_mario":        1.0,
    "falco":           1.0,
    "fox":             1.0,
    "game_and_watch":  1.0,
    "ganondorf":       1.0,
    "ice_climbers":    1.0,
    "jigglypuff":      1.0,
    "kirby":           1.0,
    "link":            1.0,
    "luigi":           1.0,
    "mario":           1.0,
    "marth":           1.0,
    "mewtwo":          1.0,
    "ness":            1.0,
    "peach":           1.0,
    "pichu":           1.0,
    "pikachu":         1.0,
    "roy":             1.0,
    "samus":           1.0,
    "sheik":           1.0,
    "yoshi":           1.0,
    "young_link":      1.0,
    "zelda":           1.0,
}


# ---------------------------------------------------------------------------
# GCM/ISO filesystem reader
# ---------------------------------------------------------------------------

class GCMReader:
    """Reads the filesystem of a GameCube disc image (GCM/ISO format).

    The GCM format stores a File System Table (FST) that lists all files
    and directories on the disc. This reader parses the header and FST
    to allow listing and extracting files by path.
    """

    def __init__(self, iso_path: str):
        self.iso_path = iso_path
        self._fh = open(iso_path, "rb")
        self._parse_header()
        self._parse_fst()

    def _parse_header(self):
        """Parse the GCM disc header (first 0x2440 bytes)."""
        self._fh.seek(0)
        header = self._fh.read(0x440)

        # Game code at offset 0x00 (4 bytes) + maker code at 0x04 (2 bytes)
        self.game_code = header[0x00:0x04].decode("ascii", errors="replace")
        self.maker_code = header[0x04:0x06].decode("ascii", errors="replace")
        self.disk_id = header[0x06]
        self.version = header[0x07]
        self.game_name = header[0x20:0x3E0].split(b"\x00")[0].decode(
            "ascii", errors="replace"
        )

        # FST offset and size at 0x424 and 0x428
        self.fst_offset = struct.unpack(">I", header[0x424:0x428])[0]
        self.fst_size = struct.unpack(">I", header[0x428:0x42C])[0]

    def _parse_fst(self):
        """Parse the File System Table to build a file listing."""
        self._fh.seek(self.fst_offset)
        fst_data = self._fh.read(self.fst_size)

        # First entry is the root directory; its "size" field = total entries
        _root_flag, _root_offset, num_entries = struct.unpack(
            ">BxxxII", fst_data[0:12]
        )

        # String table starts right after all FST entries
        string_table_offset = num_entries * 12
        string_table = fst_data[string_table_offset:]

        # Parse all entries
        entries = []
        for i in range(num_entries):
            offset = i * 12
            flag = fst_data[offset]
            name_offset = struct.unpack(">I", b"\x00" + fst_data[offset + 1:offset + 4])[0]
            file_offset = struct.unpack(">I", fst_data[offset + 4:offset + 8])[0]
            file_size = struct.unpack(">I", fst_data[offset + 8:offset + 12])[0]

            # Read null-terminated name from string table
            name_end = string_table.index(b"\x00", name_offset)
            name = string_table[name_offset:name_end].decode("ascii", errors="replace")

            entries.append({
                "is_dir": flag == 1,
                "name": name,
                "offset": file_offset,  # For files: offset in ISO. For dirs: parent index.
                "size": file_size,      # For files: file size. For dirs: index of next entry.
            })

        # Build full paths by walking the directory tree
        self.files = {}  # path -> (offset, size)
        dir_stack = []   # stack of (dir_name, end_index)

        for i, entry in enumerate(entries):
            if i == 0:
                # Root entry
                dir_stack.append(("", entry["size"]))
                continue

            # Pop directories that have ended
            while dir_stack and i >= dir_stack[-1][1]:
                dir_stack.pop()

            # Build current path
            parent_path = "/".join(d[0] for d in dir_stack if d[0])
            if parent_path:
                full_path = parent_path + "/" + entry["name"]
            else:
                full_path = entry["name"]

            if entry["is_dir"]:
                dir_stack.append((entry["name"], entry["size"]))
            else:
                self.files[full_path] = (entry["offset"], entry["size"])

    def list_files(self, prefix: str = "") -> list[str]:
        """List all files, optionally filtered by path prefix."""
        if not prefix:
            return sorted(self.files.keys())
        return sorted(p for p in self.files if p.startswith(prefix))

    def read_file(self, path: str) -> bytes:
        """Read the contents of a file from the ISO."""
        if path not in self.files:
            raise FileNotFoundError(f"File not found in ISO: {path}")
        offset, size = self.files[path]
        self._fh.seek(offset)
        return self._fh.read(size)

    def close(self):
        self._fh.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


# ---------------------------------------------------------------------------
# ISO version detection
# ---------------------------------------------------------------------------

def detect_iso_version(gcm: GCMReader) -> tuple[str, bool]:
    """Detect the Melee ISO version from the disc header.

    NTSC v1.02 has game code "GALE" and version byte 0x02.

    Returns:
        (version_string, is_ntsc_102)
    """
    game_code = gcm.game_code
    version = gcm.version

    region = "Unknown"
    if game_code.startswith("GALE"):
        region = "NTSC-U"
    elif game_code.startswith("GALJ"):
        region = "NTSC-J"
    elif game_code.startswith("GALP"):
        region = "PAL"

    version_str = f"{region} v1.{version:02d} (Game Code: {game_code})"
    is_ntsc_102 = game_code == "GALE" and version == 2

    return version_str, is_ntsc_102


# ---------------------------------------------------------------------------
# Character DAT file extraction
# ---------------------------------------------------------------------------

def find_character_dat_files(
    gcm: GCMReader, char_name: str | None = None
) -> dict[str, tuple[str, str | None]]:
    """Find character DAT files in the ISO filesystem.

    Character DAT files are stored at the root level of the ISO filesystem
    with names like PlFx.dat (Fox), PlMs.dat (Marth), etc. Each character
    also has a companion animation file (PlFxAJ.dat) that contains the
    FIGATREE animation data referenced by subactions.

    Args:
        gcm: An open GCMReader instance.
        char_name: If provided, only find DAT files for this character.

    Returns:
        Dict mapping character name -> (main DAT path, AJ DAT path or None).
    """
    characters = CHARACTER_DAT_PREFIX
    if char_name:
        char_name = char_name.lower().replace(" ", "_")
        if char_name not in characters:
            logger.error("Unknown character '%s'.", char_name)
            logger.error(
                "Valid characters: %s",
                ", ".join(sorted(characters.keys())),
            )
            sys.exit(1)
        characters = {char_name: characters[char_name]}

    found = {}
    all_iso_files = gcm.list_files()

    for name, prefix in characters.items():
        dat_filename = f"Pl{prefix}.dat"
        aj_filename = f"Pl{prefix}AJ.dat"
        # Search for the files (could be at root or in a subdirectory)
        dat_matches = [
            f for f in all_iso_files if f.endswith(dat_filename)
        ]
        aj_matches = [
            f for f in all_iso_files if f.endswith(aj_filename)
        ]
        if dat_matches:
            aj_path = aj_matches[0] if aj_matches else None
            found[name] = (dat_matches[0], aj_path)
        else:
            logger.warning(
                "DAT file '%s' not found in ISO for %s",
                dat_filename, name,
            )

    return found


def extract_dat_file(
    gcm: GCMReader, iso_path: str, outdir: str, char_name: str
) -> str | None:
    """Extract a character DAT file from the ISO to the output directory.

    Args:
        gcm: An open GCMReader instance.
        iso_path: Path of the DAT file within the ISO.
        outdir: Output directory to write the extracted file.
        char_name: Character name (used for output filename).

    Returns:
        Path to the extracted DAT file, or None on failure.
    """
    try:
        dat_bytes = gcm.read_file(iso_path)
    except Exception as e:
        logger.error("Error reading '%s' from ISO: %s", iso_path, e)
        return None

    os.makedirs(outdir, exist_ok=True)
    # Write to a temp location for meleeDat2Json processing
    extracted_path = os.path.join(outdir, f".{char_name}.dat")
    with open(extracted_path, "wb") as f:
        f.write(dat_bytes)

    logger.info(
        "  Extracted %s (%s bytes)", iso_path, f"{len(dat_bytes):,}"
    )
    return extracted_path


def extract_aj_file(
    gcm: GCMReader, iso_path: str, outdir: str, char_name: str
) -> str | None:
    """Extract a character AJ (animation) file from the ISO.

    The AJ file contains FIGATREE animation data referenced by
    subactions in the main DAT file.

    Args:
        gcm: An open GCMReader instance.
        iso_path: Path of the AJ file within the ISO.
        outdir: Output directory to write the extracted file.
        char_name: Character name (used for output filename).

    Returns:
        Path to the extracted AJ file, or None on failure.
    """
    try:
        aj_bytes = gcm.read_file(iso_path)
    except Exception as e:
        logger.error(
            "Error reading AJ file '%s' from ISO: %s", iso_path, e
        )
        return None

    os.makedirs(outdir, exist_ok=True)
    extracted_path = os.path.join(outdir, f".{char_name}AJ.dat")
    with open(extracted_path, "wb") as f:
        f.write(aj_bytes)

    logger.info(
        "  Extracted AJ %s (%s bytes)",
        iso_path, f"{len(aj_bytes):,}",
    )
    return extracted_path


# ---------------------------------------------------------------------------
# Validation (--validate mode)
# ---------------------------------------------------------------------------

def validate_json(json_path: str) -> bool:
    """Validate a character JSON file against the schema rules.

    Checks:
    - Bone tree ordering: parent index < bone index for all non-root bones
    - Root bone has parent == -1
    - All hitbox bone references are valid
    - All hurtbox bone references are valid
    - Hitbox startFrame <= endFrame
    - Hitbox startFrame < totalFrames
    - Hitbox size > 0
    - Bone frame keys are valid frame numbers

    Returns:
        True if all validations pass, False otherwise.
    """
    try:
        with open(json_path, "r") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.error(
            "Cannot read/parse '%s': %s", json_path, e
        )
        return False

    violations = []
    char_name = data.get("character", "unknown")

    # Validate bones
    bones = data.get("bones", [])
    bone_ids = {b["id"] for b in bones}

    if bones:
        root = bones[0]
        if root.get("parent") != -1:
            violations.append(f"Root bone (id={root['id']}) parent is {root.get('parent')}, expected -1")

    for bone in bones:
        if bone["id"] == 0:
            continue
        parent = bone.get("parent", -1)
        if parent >= bone["id"]:
            violations.append(
                f"Bone {bone['id']} has parent {parent} (must be < {bone['id']})"
            )
        if parent != -1 and parent not in bone_ids:
            violations.append(f"Bone {bone['id']} references non-existent parent {parent}")

    # Validate subactions
    subactions = data.get("subactions", {})
    for sub_id_str, sub in subactions.items():
        total_frames = sub.get("totalFrames", 0)

        # Validate hitboxes
        for i, hb in enumerate(sub.get("hitboxes", [])):
            hb_label = f"subaction {sub_id_str}, hitbox {i}"

            if hb.get("bone") not in bone_ids:
                violations.append(f"{hb_label}: bone {hb.get('bone')} not in bone tree")
            if hb.get("startFrame", 0) > hb.get("endFrame", 0):
                violations.append(
                    f"{hb_label}: startFrame ({hb['startFrame']}) > endFrame ({hb['endFrame']})"
                )
            if hb.get("startFrame", 0) >= total_frames and total_frames > 0:
                violations.append(
                    f"{hb_label}: startFrame ({hb['startFrame']}) >= totalFrames ({total_frames})"
                )
            if hb.get("size", 0) <= 0:
                violations.append(f"{hb_label}: size ({hb.get('size')}) must be > 0")

        # Validate bone frame keys
        bone_frames = sub.get("boneFrames", {})
        for frame_str in bone_frames:
            try:
                frame_num = int(frame_str)
                if frame_num < 0 or (total_frames > 0 and frame_num >= total_frames):
                    violations.append(
                        f"subaction {sub_id_str}: boneFrame key {frame_str} "
                        f"out of range [0, {total_frames})"
                    )
            except ValueError:
                violations.append(
                    f"subaction {sub_id_str}: invalid boneFrame key '{frame_str}'"
                )

    # Validate hurtboxes
    for i, hb in enumerate(data.get("hurtboxes", [])):
        if hb.get("bone") not in bone_ids:
            violations.append(f"hurtbox {i}: bone {hb.get('bone')} not in bone tree")

    # Report results
    if violations:
        print(f"Validation FAILED for {char_name} ({json_path}):")
        for v in violations:
            print(f"  - {v}")
        return False
    else:
        print(f"Validation PASSED for {char_name} ({json_path})")
        return True


# ---------------------------------------------------------------------------
# JOBJ (Joint Object) tree parsing — bone extraction
# ---------------------------------------------------------------------------
# The JOBJ structure in Melee DAT files (0x40 bytes each):
#   0x00: unknown (4 bytes)
#   0x04: flags (4 bytes)
#   0x08: childOffset (4 bytes) — first child JOBJ
#   0x0C: nextOffset (4 bytes) — next sibling JOBJ
#   0x10: dobjOffset (4 bytes)
#   0x14: rotationX, rotationY, rotationZ (3 floats)
#   0x20: scaleX, scaleY, scaleZ (3 floats)
#   0x2C: translationX, translationY, translationZ (3 floats)
#   0x38: transformOffset (4 bytes)
#   0x3C: unknown (4 bytes)
# ---------------------------------------------------------------------------

JOBJ_SIZE = 0x40
JOBJ_CHILD_OFFSET = 0x08
JOBJ_NEXT_OFFSET = 0x0C
JOBJ_ROTATION_OFFSET = 0x14
JOBJ_SCALE_OFFSET = 0x20
JOBJ_TRANSLATION_OFFSET = 0x2C


def _parse_jobj_node(data_block, offset):
    """Parse a single JOBJ node from the data block.

    Args:
        data_block: The DAT file's data block (bytes).
        offset: Offset within the data block to the JOBJ.

    Returns:
        Dict with child_offset, next_offset, rotation,
        scale, and translation. Offsets are 0 if null.
    """
    if offset + JOBJ_SIZE > len(data_block):
        return None

    child_off = struct.unpack_from(
        ">I", data_block, offset + JOBJ_CHILD_OFFSET
    )[0]
    next_off = struct.unpack_from(
        ">I", data_block, offset + JOBJ_NEXT_OFFSET
    )[0]
    rx, ry, rz = struct.unpack_from(
        ">3f", data_block, offset + JOBJ_ROTATION_OFFSET
    )
    sx, sy, sz = struct.unpack_from(
        ">3f", data_block, offset + JOBJ_SCALE_OFFSET
    )
    tx, ty, tz = struct.unpack_from(
        ">3f", data_block, offset + JOBJ_TRANSLATION_OFFSET
    )

    return {
        "child_offset": child_off,
        "next_offset": next_off,
        "rotation": (rx, ry, rz),
        "scale": (sx, sy, sz),
        "translation": (tx, ty, tz),
    }


def _find_jobj_root(file_data):
    """Find the JOBJ root offset in a DAT file.

    Parses the DAT header and root node table to find a root
    node whose name contains '_joint' (but not 'matanim' or
    'shapeanim'). For main fighter DATs that only have ftData,
    returns None.

    For fighter DATs, the JOBJ tree is embedded in the data
    block. We scan root nodes for any that look like JOBJ
    trees by checking for '_joint' in the name.

    Args:
        file_data: Complete DAT file bytes.

    Returns:
        (data_block, jobj_root_offset) or (None, None).
    """
    if len(file_data) < 0x20:
        return None, None

    values = struct.unpack_from(">8I", file_data, 0)
    data_block_size = values[1]
    reloc_count = values[2]
    root_count = values[3]
    root_count2 = values[4]

    data_offset = 0x20
    data_block = file_data[
        data_offset:data_offset + data_block_size
    ]

    reloc_offset = data_offset + data_block_size
    reloc_size = reloc_count * 4
    root_nodes_offset = reloc_offset + reloc_size
    total_roots = root_count + root_count2
    string_table_offset = (
        root_nodes_offset + total_roots * 8
    )

    # Scan root nodes for a _joint node
    for i in range(total_roots):
        off = root_nodes_offset + i * 8
        root_off, str_off = struct.unpack_from(
            ">2I", file_data, off
        )

        # Read name from string table
        name_start = string_table_offset + str_off
        if name_start >= len(file_data):
            continue
        try:
            name_end = file_data.index(b"\x00", name_start)
            name = file_data[name_start:name_end].decode(
                "ascii", errors="replace"
            )
        except ValueError:
            continue

        # Look for _joint nodes (not matanim/shapeanim)
        if "_joint" in name.lower():
            if "matanim" in name.lower():
                continue
            if "shapeanim" in name.lower():
                continue
            return data_block, root_off

    # No _joint root found — try the first non-ftData root
    # In some DAT files the JOBJ tree is the first root
    for i in range(total_roots):
        off = root_nodes_offset + i * 8
        root_off, str_off = struct.unpack_from(
            ">2I", file_data, off
        )
        name_start = string_table_offset + str_off
        if name_start >= len(file_data):
            continue
        try:
            name_end = file_data.index(b"\x00", name_start)
            name = file_data[name_start:name_end].decode(
                "ascii", errors="replace"
            )
        except ValueError:
            continue
        if not name.startswith("ftData"):
            # Could be a JOBJ root — validate by checking
            # if it looks like a valid JOBJ structure
            if root_off + JOBJ_SIZE <= len(data_block):
                node = _parse_jobj_node(data_block, root_off)
                if node and _looks_like_jobj(node):
                    return data_block, root_off

    # ---------------------------------------------------------------
    # Fighter DAT fallback: the JOBJ tree is embedded inside ftData.
    # Use the relocation table to find pointer targets in the data
    # block, then test each as a potential JOBJ root. Pick the one
    # that produces the largest valid tree.
    # ---------------------------------------------------------------
    reloc_targets = _get_reloc_targets(file_data, data_block_size,
                                       reloc_count, data_offset)
    best_root = None
    best_count = 0
    for target_off in reloc_targets:
        if target_off + JOBJ_SIZE > len(data_block):
            continue
        node = _parse_jobj_node(data_block, target_off)
        if node is None or not _looks_like_jobj(node):
            continue
        # Must have at least a child (real skeleton roots always do)
        if node["child_offset"] == 0:
            continue
        count = _count_jobj_tree(data_block, target_off)
        if count > best_count:
            best_count = count
            best_root = target_off

    if best_root is not None and best_count >= 10:
        logger.info(
            "  Found JOBJ tree via relocation scan: "
            "offset 0x%X, %d bones",
            best_root, best_count,
        )
        return data_block, best_root

    return None, None


def _looks_like_jobj(node):
    """Heuristic check if a parsed node looks like a JOBJ.

    Valid JOBJ nodes typically have reasonable scale values
    (close to 1.0) and finite translation/rotation values.
    """
    sx, sy, sz = node["scale"]
    tx, ty, tz = node["translation"]
    rx, ry, rz = node["rotation"]

    # Scale should be finite and positive
    for v in (sx, sy, sz):
        if v != v or abs(v) > 1000:  # NaN or huge
            return False
        if v <= 0:
            return False

    # Translation and rotation should be finite
    for v in (tx, ty, tz, rx, ry, rz):
        if v != v or abs(v) > 100000:  # NaN or huge
            return False

    return True


def _get_reloc_targets(file_data, data_block_size, reloc_count, data_offset):
    """Read the relocation table and return all pointer target offsets.

    The DAT relocation table is a list of uint32 offsets into the data
    block. At each of those offsets, there is a uint32 pointer (also
    relative to the data block start). We read those pointers to get
    the set of all referenced offsets in the data block.

    Args:
        file_data: Complete DAT file bytes.
        data_block_size: Size of the data block.
        reloc_count: Number of relocation entries.
        data_offset: Offset of the data block in the file (0x20).

    Returns:
        Set of uint32 offsets within the data block that are pointed to.
    """
    targets = set()
    reloc_table_offset = data_offset + data_block_size
    data_block = file_data[data_offset:data_offset + data_block_size]

    for i in range(reloc_count):
        entry_off = reloc_table_offset + i * 4
        if entry_off + 4 > len(file_data):
            break
        # The relocation entry is an offset into the data block
        # where a pointer lives
        ptr_location = struct.unpack_from(">I", file_data, entry_off)[0]
        if ptr_location + 4 > data_block_size:
            continue
        # Read the pointer value at that location in the data block
        ptr_value = struct.unpack_from(">I", data_block, ptr_location)[0]
        if ptr_value < data_block_size:
            targets.add(ptr_value)

    return targets


def _count_jobj_tree(data_block, root_offset):
    """Count the number of JOBJ nodes reachable from a root offset.

    Walks the JOBJ tree via child/sibling pointers to count total
    nodes. Used to find the largest valid JOBJ tree in the data block.

    Args:
        data_block: The DAT file's data block bytes.
        root_offset: Offset of the root JOBJ in the data block.

    Returns:
        Number of valid JOBJ nodes in the tree.
    """
    count = 0
    stack = [root_offset]
    visited = set()

    while stack:
        offset = stack.pop()
        if offset in visited or offset < 0:
            continue
        if offset + JOBJ_SIZE > len(data_block):
            continue
        visited.add(offset)

        node = _parse_jobj_node(data_block, offset)
        if node is None or not _looks_like_jobj(node):
            continue

        count += 1

        if node["child_offset"] != 0:
            stack.append(node["child_offset"])
        if node["next_offset"] != 0:
            stack.append(node["next_offset"])

    return count


def _make_local_matrix(rx, ry, rz, sx, sy, sz, tx, ty, tz):
    """Build a 4x4 local transform matrix from JOBJ rotation/scale/translation.

    Melee uses intrinsic XYZ Euler rotation order. The transform is
    composed as: T * Rz * Ry * Rx * S (applied right-to-left to a point).

    Returns a 16-element list in row-major order (4x4 matrix).
    """
    import math
    cx, sxr = math.cos(rx), math.sin(rx)
    cy, syr = math.cos(ry), math.sin(ry)
    cz, szr = math.cos(rz), math.sin(rz)

    # Rotation matrix = Rz * Ry * Rx (intrinsic XYZ = extrinsic ZYX)
    r00 = cy * cz
    r01 = sxr * syr * cz - cx * szr
    r02 = cx * syr * cz + sxr * szr
    r10 = cy * szr
    r11 = sxr * syr * szr + cx * cz
    r12 = cx * syr * szr - sxr * cz
    r20 = -syr
    r21 = sxr * cy
    r22 = cx * cy

    # Apply scale to rotation columns
    return [
        r00 * sx, r01 * sy, r02 * sz, tx,
        r10 * sx, r11 * sy, r12 * sz, ty,
        r20 * sx, r21 * sy, r22 * sz, tz,
        0.0,      0.0,      0.0,      1.0,
    ]


def _mat4_multiply(a, b):
    """Multiply two 4x4 matrices (row-major, 16-element lists)."""
    result = [0.0] * 16
    for row in range(4):
        for col in range(4):
            s = 0.0
            for k in range(4):
                s += a[row * 4 + k] * b[k * 4 + col]
            result[row * 4 + col] = s
    return result


_IDENTITY_4x4 = [
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]


def extract_bone_tree(dat_file_data):
    """Extract the bone tree from a DAT file's JOBJ hierarchy.

    Parses the binary DAT file to find and walk the JOBJ (Joint
    Object) tree. Assigns sequential bone IDs via depth-first
    traversal, ensuring parent index < child index. Computes
    rest-pose world positions using full hierarchical transform
    composition (rotation + scale + translation).

    For 2D projection:
      restX = Z component (forward axis -> 2D X)
      restY = Y component (vertical axis -> 2D Y)

    Args:
        dat_file_data: Raw bytes of the DAT file.

    Returns:
        List of bone dicts:
        [{"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
         {"id": 1, "parent": 0, "restX": 1.0, "restY": 2.0},
         ...]
        Returns empty list if no JOBJ tree is found.
    """
    data_block, jobj_root = _find_jobj_root(dat_file_data)
    if data_block is None or jobj_root is None:
        logger.warning("No JOBJ tree found in DAT file")
        return []

    bones = []
    # Stack: (jobj_offset, parent_bone_id, parent_world_matrix)
    stack = [(jobj_root, -1, list(_IDENTITY_4x4))]

    visited = set()

    while stack:
        offset, parent_id, parent_matrix = stack.pop()

        if offset < 0 or offset in visited:
            continue
        if offset + JOBJ_SIZE > len(data_block):
            continue

        visited.add(offset)

        node = _parse_jobj_node(data_block, offset)
        if node is None:
            continue

        bone_id = len(bones)
        rx, ry, rz = node["rotation"]
        sx, sy, sz = node["scale"]
        tx, ty, tz = node["translation"]

        # Build local transform matrix (Scale * Rotate * Translate)
        local_mat = _make_local_matrix(rx, ry, rz, sx, sy, sz, tx, ty, tz)

        # Compose with parent's world matrix
        world_mat = _mat4_multiply(parent_matrix, local_mat)

        # Extract world position from the matrix (translation column)
        # world_mat[3] = X (lateral, collapsed in 2D)
        world_y = world_mat[7]   # column 3, row 1
        world_z = world_mat[11]  # column 3, row 2

        # 2D projection: Z -> restX, Y -> restY
        bones.append({
            "id": bone_id,
            "parent": parent_id,
            "restX": round(world_z, 4),
            "restY": round(world_y, 4),
            # Store local transform components for animation defaults
            "_local_rx": rx,
            "_local_ry": ry,
            "_local_rz": rz,
            "_local_sx": sx,
            "_local_sy": sy,
            "_local_sz": sz,
            "_local_tx": tx,
            "_local_ty": ty,
            "_local_tz": tz,
        })

        # Push sibling first, then child, so child is
        # processed first (depth-first). This ensures
        # parent index < child index.
        if node["next_offset"] != 0:
            stack.append((
                node["next_offset"],
                parent_id,
                parent_matrix,
            ))
        if node["child_offset"] != 0:
            stack.append((
                node["child_offset"],
                bone_id,
                world_mat,
            ))

    return bones


# ---------------------------------------------------------------------------
# Hitbox extraction from subaction events
# ---------------------------------------------------------------------------

# Map meleeDat2Json element strings back to numeric IDs for the output JSON.
# The library's postProcessHitboxEvent converts numeric element codes to
# human-readable strings. We store the numeric form in our JSON for
# compactness and because the renderer doesn't need the string names.
_ELEMENT_TO_ID = {
    "normal": 0,
    "fire": 1,
    "electric": 2,
    "slash": 3,
    "coin": 4,
    "ice": 5,
    "sleep_103f": 6,
    "sleep_412f": 7,
    "grab": 8,
    "grounded": 9,
    "cape": 10,
    "empty": 11,
    "disabled": 12,
    "darkness": 13,
    "screwAttack": 14,
    "poison/flower": 15,
    "nothing": 16,
}


def _element_to_int(element_value) -> int:
    """Convert an element value (string or int) to an integer ID."""
    if isinstance(element_value, int):
        return element_value
    return _ELEMENT_TO_ID.get(element_value, 0)


def extract_hitboxes(raw_json: dict) -> dict:
    """Extract hitbox events from meleeDat2Json subaction commands.

    Walks each subaction's event list to find hitbox definitions and
    timing commands. Builds a dict of subaction data keyed by subaction
    index, containing the subaction name, total frame count, and a list
    of hitbox dicts with active frame ranges.

    The meleeDat2Json output structure is:
        raw_json["nodes"][0]["data"]["subactions"] — list of subaction objects
        Each subaction has "events" — list of event dicts
        Each event has "name" (str) and optionally "fields" (dict)

    Timing model:
        - Current frame starts at 0
        - "waitFor" events advance the frame counter by fields["frames"]
        - "waitUntil" events set the frame counter to fields["frame"]
        - A hitbox is created at the current frame
        - A hitbox is removed by "endAllCollisions", "endOneCollision",
          or "exit" (end of script)
        - The hitbox's endFrame is the frame *before* the removal event

    Args:
        raw_json: The parsed meleeDat2Json output dict.

    Returns:
        Dict mapping subaction index (int) to:
        {
            "name": str,
            "totalFrames": int,
            "hitboxes": [
                {
                    "id": int, "bone": int,
                    "x": float, "y": float, "z": float,
                    "size": float, "damage": int, "angle": int,
                    "kbg": int, "bkb": int, "setKb": int,
                    "element": int,
                    "startFrame": int, "endFrame": int
                },
                ...
            ]
        }
        Only subactions that contain at least one hitbox are included.
    """
    result = {}

    # Find the ftData node (first node with subactions)
    nodes = raw_json.get("nodes", [])
    subactions_list = None
    for node in nodes:
        data = node.get("data")
        if data and "subactions" in data:
            subactions_list = data["subactions"]
            break

    if not subactions_list:
        return result

    for sub_idx, subaction in enumerate(subactions_list):
        events = subaction.get("events", [])
        name = subaction.get("shortName", subaction.get("name", f"Subaction{sub_idx}"))

        # Walk events to extract hitboxes with timing
        current_frame = 0
        # Track active hitboxes: hitbox_id -> hitbox dict (without endFrame yet)
        active_hitboxes = {}
        # Completed hitboxes with frame ranges
        completed_hitboxes = []
        # Track total frames for this subaction
        total_frames = 0

        for event in events:
            event_name = event.get("name")
            fields = event.get("fields", {})

            if event_name == "waitFor":
                # Advance frame counter by the specified number of frames
                frames = fields.get("frames", 0)
                current_frame += frames

            elif event_name == "waitUntil":
                # Set frame counter to the specified frame
                frame = fields.get("frame", 0)
                current_frame = frame

            elif event_name == "hitbox":
                # Create/set a hitbox at the current frame
                hb_id = fields.get("id", 0)

                # If this hitbox ID is already active, close it first
                if hb_id in active_hitboxes:
                    prev = active_hitboxes.pop(hb_id)
                    prev["endFrame"] = max(
                        prev["startFrame"], current_frame - 1
                    )
                    completed_hitboxes.append(prev)

                size_val = fields.get("size", 0)
                active_hitboxes[hb_id] = {
                    "id": hb_id,
                    "bone": fields.get("bone", 0),
                    "x": round(float(fields.get("x", 0)), 4),
                    "y": round(float(fields.get("y", 0)), 4),
                    "z": round(float(fields.get("z", 0)), 4),
                    "size": round(float(size_val), 4),
                    "damage": int(fields.get("damage", 0)),
                    "angle": int(fields.get("angle", 0)),
                    "kbg": int(fields.get("kbGrowth", 0)),
                    "bkb": int(fields.get("baseKb", 0)),
                    "setKb": int(fields.get("weightDepKb", 0)),
                    "element": _element_to_int(fields.get("element", 0)),
                    "startFrame": current_frame,
                }

            elif event_name == "endOneCollision":
                # Remove a specific hitbox
                hb_id = fields.get("hitboxId", 0)
                if hb_id in active_hitboxes:
                    hb = active_hitboxes.pop(hb_id)
                    hb["endFrame"] = max(
                        hb["startFrame"], current_frame - 1
                    )
                    completed_hitboxes.append(hb)

            elif event_name == "endAllCollisions":
                # Remove all active hitboxes
                for hb_id, hb in active_hitboxes.items():
                    hb["endFrame"] = max(
                        hb["startFrame"], current_frame - 1
                    )
                    completed_hitboxes.append(hb)
                active_hitboxes.clear()

            elif event_name == "exit":
                # End of script — close any remaining hitboxes
                for hb_id, hb in active_hitboxes.items():
                    hb["endFrame"] = max(
                        hb["startFrame"], current_frame - 1
                    )
                    completed_hitboxes.append(hb)
                active_hitboxes.clear()

            # Track the highest frame we've seen for totalFrames
            if current_frame > total_frames:
                total_frames = current_frame

        # Close any hitboxes still active at the end of the event list
        # (in case there was no explicit exit event)
        for hb_id, hb in active_hitboxes.items():
            hb["endFrame"] = max(
                hb["startFrame"], current_frame
            )
            completed_hitboxes.append(hb)
        active_hitboxes.clear()

        # Update totalFrames to be at least 1 past the last frame
        if total_frames == 0 and completed_hitboxes:
            total_frames = max(
                hb["endFrame"] for hb in completed_hitboxes
            ) + 1
        elif total_frames > 0:
            # totalFrames should be the count, so at least current_frame + 1
            total_frames = max(total_frames, current_frame) + 1

        # Only include subactions that have hitboxes
        if not completed_hitboxes:
            continue

        # Validate and filter hitboxes
        valid_hitboxes = []
        for hb in completed_hitboxes:
            # Validate: size > 0
            if hb["size"] <= 0:
                logger.debug(
                    "Subaction %d (%s): skipping hitbox %d with size <= 0",
                    sub_idx, name, hb["id"],
                )
                continue
            # Validate: startFrame <= endFrame
            if hb["startFrame"] > hb["endFrame"]:
                logger.debug(
                    "Subaction %d (%s): skipping hitbox %d with "
                    "startFrame %d > endFrame %d",
                    sub_idx, name, hb["id"],
                    hb["startFrame"], hb["endFrame"],
                )
                continue
            # Validate: startFrame < totalFrames
            if total_frames > 0 and hb["startFrame"] >= total_frames:
                logger.debug(
                    "Subaction %d (%s): skipping hitbox %d with "
                    "startFrame %d >= totalFrames %d",
                    sub_idx, name, hb["id"],
                    hb["startFrame"], total_frames,
                )
                continue
            valid_hitboxes.append(hb)

        if valid_hitboxes:
            result[sub_idx] = {
                "name": name,
                "totalFrames": total_frames,
                "hitboxes": valid_hitboxes,
            }

    return result


# ---------------------------------------------------------------------------
# Hurtbox extraction from binary DAT file
# ---------------------------------------------------------------------------
# Melee stores hurtbox data in the fighter data section of the DAT file.
# The ftData header (parsed by meleeDat2Json as 6 uint32 values) is actually
# part of a larger structure. The hurtbox table pointer is not exposed by
# meleeDat2Json, so we parse it directly from the binary.
#
# The ftData structure in the data block has additional fields beyond what
# meleeDat2Json reads. After the 6 header fields (0x18 bytes), there are
# more pointers. The hurtbox count and hurtbox table offset are stored
# at known positions within the fighter data attributes area.
#
# Each hurtbox entry is 0x18 (24) bytes:
#   0x00: bone index (uint32)
#   0x04: x offset (float)
#   0x08: y offset (float)
#   0x0C: z offset (float)
#   0x10: sizeX — capsule radius (float)
#   0x14: sizeY — capsule half-length (float)
#
# The zone (high/mid/low) is inferred from the bone attachment:
#   - Bones in the head/neck area → "high"
#   - Bones in the torso/arm area → "mid"
#   - Bones in the leg/foot area → "low"
# Since we don't have a universal bone-to-zone mapping, we use a
# heuristic based on the bone's rest-pose Y position relative to
# the character's height.
# ---------------------------------------------------------------------------

HURTBOX_ENTRY_SIZE = 0x18


def _find_ftdata_offset(file_data):
    """Find the ftData root node offset in a DAT file.

    Scans the root node table for a node whose name starts with 'ftData'.

    Args:
        file_data: Complete DAT file bytes.

    Returns:
        (data_block, ftdata_offset) or (None, None) if not found.
    """
    if len(file_data) < 0x20:
        return None, None

    values = struct.unpack_from(">8I", file_data, 0)
    data_block_size = values[1]
    reloc_count = values[2]
    root_count = values[3]
    root_count2 = values[4]

    data_offset = 0x20
    data_block = file_data[data_offset:data_offset + data_block_size]

    reloc_offset = data_offset + data_block_size
    reloc_size = reloc_count * 4
    root_nodes_offset = reloc_offset + reloc_size
    total_roots = root_count + root_count2
    string_table_offset = root_nodes_offset + total_roots * 8

    for i in range(total_roots):
        off = root_nodes_offset + i * 8
        root_off, str_off = struct.unpack_from(">2I", file_data, off)

        name_start = string_table_offset + str_off
        if name_start >= len(file_data):
            continue
        try:
            name_end = file_data.index(b"\x00", name_start)
            name = file_data[name_start:name_end].decode(
                "ascii", errors="replace"
            )
        except ValueError:
            continue

        if name.startswith("ftData"):
            return data_block, root_off

    return None, None


def _parse_hurtbox_entry(data_block, offset):
    """Parse a single hurtbox entry from the data block.

    Each hurtbox is 0x18 bytes:
      0x00: bone index (uint32, big-endian)
      0x04: x offset (float, big-endian)
      0x08: y offset (float, big-endian)
      0x0C: z offset (float, big-endian)
      0x10: sizeX (float, big-endian)
      0x14: sizeY (float, big-endian)

    Args:
        data_block: The DAT file's data block bytes.
        offset: Offset within the data block.

    Returns:
        Dict with bone, x, y, z, sizeX, sizeY or None if invalid.
    """
    if offset + HURTBOX_ENTRY_SIZE > len(data_block):
        return None

    bone, x, y, z, size_x, size_y = struct.unpack_from(
        ">I5f", data_block, offset
    )

    # Sanity checks: bone index should be reasonable, sizes should be positive
    if bone > 200:  # Characters have at most ~60 bones
        return None
    if size_x != size_x or size_y != size_y:  # NaN check
        return None
    if size_x < 0 or size_y < 0:
        return None
    # Allow zero-size hurtboxes (they'll be filtered later if needed)

    return {
        "bone": bone,
        "x": round(float(x), 4),
        "y": round(float(y), 4),
        "z": round(float(z), 4),
        "sizeX": round(float(size_x), 4),
        "sizeY": round(float(size_y), 4),
    }


def _classify_hurtbox_zone(bone_id, bones):
    """Classify a hurtbox zone based on its bone's rest-pose Y position.

    Uses a simple heuristic:
      - Top third of character height → "high"
      - Middle third → "mid"
      - Bottom third → "low"

    If no bone data is available, defaults to "mid".

    Args:
        bone_id: The bone index this hurtbox is attached to.
        bones: List of bone dicts from extract_bone_tree.

    Returns:
        "high", "mid", or "low".
    """
    if not bones:
        return "mid"

    # Find the bone's rest Y position
    bone_y = None
    for bone in bones:
        if bone["id"] == bone_id:
            bone_y = bone["restY"]
            break

    if bone_y is None:
        return "mid"

    # Find the character's height range from all bones
    all_y = [b["restY"] for b in bones]
    min_y = min(all_y)
    max_y = max(all_y)
    height = max_y - min_y

    if height <= 0:
        return "mid"

    # Normalize bone position to [0, 1] range
    normalized = (bone_y - min_y) / height

    if normalized > 0.66:
        return "high"
    elif normalized > 0.33:
        return "mid"
    else:
        return "low"


def extract_hurtboxes(dat_file_data, bones=None):
    """Extract hurtbox definitions from a character DAT file.

    Parses the binary DAT file to find the hurtbox table in the ftData
    structure. meleeDat2Json does not expose hurtbox data, so we parse
    it directly from the binary.

    The ftData header (at the ftData root offset) contains:
      0x00-0x17: 6 uint32 values (attributes, subactions offsets)
    After these, additional pointers exist in the fighter data. The
    hurtbox table is referenced from the fighter model data.

    This function scans the data block for potential hurtbox tables
    by looking for sequences of valid hurtbox entries near the ftData
    structure.

    Args:
        dat_file_data: Raw bytes of the complete DAT file.
        bones: Optional list of bone dicts (from extract_bone_tree)
               used for zone classification.

    Returns:
        List of hurtbox dicts:
        [{"bone": 3, "x": 0.0, "y": 0.0, "z": 0.0,
          "sizeX": 2.0, "sizeY": 3.5, "zone": "mid"}, ...]
        Returns empty list if no hurtbox data is found.
    """
    data_block, ftdata_off = _find_ftdata_offset(dat_file_data)
    if data_block is None or ftdata_off is None:
        logger.warning("No ftData found in DAT file — cannot extract hurtboxes")
        return []

    # The ftData header is 6 uint32 values (0x18 bytes).
    # After the standard header, there may be additional pointers.
    # We look for a hurtbox table pointer in the extended ftData area.
    #
    # In Melee's fighter data, the hurtbox count and table offset are
    # stored at specific offsets relative to the ftData root. The exact
    # layout varies, but common patterns in NTSC v1.02:
    #   ftData + 0x18: modelLookupTablesOffset (pointer)
    #   ftData + 0x1C: unknown
    #   ...
    # The hurtbox data is typically found by following pointers from
    # the model data or by scanning for valid hurtbox entry patterns.

    # Strategy: scan the data block for contiguous runs of valid
    # hurtbox entries. A valid hurtbox table will have multiple
    # consecutive entries with reasonable bone IDs and sizes.

    bone_ids = set()
    if bones:
        bone_ids = {b["id"] for b in bones}
    max_bone_id = max(bone_ids) if bone_ids else 60

    best_hurtboxes = []
    best_offset = -1

    # Scan data block at aligned offsets looking for hurtbox tables
    scan_end = min(len(data_block), ftdata_off + 0x10000)  # Limit scan range
    for scan_off in range(ftdata_off, scan_end - HURTBOX_ENTRY_SIZE, 4):
        # Try to parse a sequence of hurtbox entries starting here
        hurtboxes = []
        off = scan_off
        while off + HURTBOX_ENTRY_SIZE <= len(data_block):
            entry = _parse_hurtbox_entry(data_block, off)
            if entry is None:
                break
            # Additional validation: bone ID should be within range
            if entry["bone"] > max_bone_id:
                break
            # At least one size dimension should be positive
            if entry["sizeX"] <= 0 and entry["sizeY"] <= 0:
                break
            # Sizes should be reasonable (not huge)
            if entry["sizeX"] > 50 or entry["sizeY"] > 50:
                break
            hurtboxes.append(entry)
            off += HURTBOX_ENTRY_SIZE

        # A valid hurtbox table should have at least 5 entries
        # (characters typically have 15-20 hurtboxes)
        if len(hurtboxes) >= 5 and len(hurtboxes) > len(best_hurtboxes):
            best_hurtboxes = hurtboxes
            best_offset = scan_off

    if not best_hurtboxes:
        # TODO: Binary hurtbox parsing did not find a valid table.
        # This may require more sophisticated parsing of the ftData
        # structure or following pointer chains from the model data.
        logger.warning(
            "No hurtbox table found in DAT file — "
            "binary parsing may need refinement"
        )
        return []

    logger.info(
        "  Found %d hurtbox entries at data block offset 0x%X",
        len(best_hurtboxes), best_offset,
    )

    # Validate bone references if we have bone data
    if bone_ids:
        valid_hurtboxes = []
        for hb in best_hurtboxes:
            if hb["bone"] in bone_ids:
                valid_hurtboxes.append(hb)
            else:
                logger.debug(
                    "  Skipping hurtbox with invalid bone %d",
                    hb["bone"],
                )
        best_hurtboxes = valid_hurtboxes

    # Add zone classification
    for hb in best_hurtboxes:
        hb["zone"] = _classify_hurtbox_zone(hb["bone"], bones)

    return best_hurtboxes


# ---------------------------------------------------------------------------
# Animation extraction — per-frame bone world transforms
# ---------------------------------------------------------------------------
# FIGATREE animation binary format parsing.
#
# Each subaction's animation is stored as a separate DAT file within the
# AJ (animation joint) file. The DAT contains a FigaTree root node with:
#   - A bone table: one byte per skeleton bone, giving the number of
#     animation tracks for that bone (terminated by 0xFF).
#   - Track descriptors: 0x0C bytes each, specifying track type
#     (rotation/translation/scale axis), value/tangent encoding format,
#     and a pointer to compressed keyframe data.
#   - Compressed keyframe buffers: packed integers encoding interpolation
#     type, frame timing, and values.
#
# We parse this binary data to extract per-bone keyframe tracks, then
# compute world-space bone positions for each animation frame using
# hierarchical transform composition (same math as rest-pose, but with
# animated rotation/translation/scale values).
# ---------------------------------------------------------------------------


# JointTrackType enum values
_TRACK_ROTX = 1
_TRACK_ROTY = 2
_TRACK_ROTZ = 3
_TRACK_TRAX = 5
_TRACK_TRAY = 6
_TRACK_TRAZ = 7
_TRACK_SCAX = 8
_TRACK_SCAY = 9
_TRACK_SCAZ = 10

# GXAnimDataFormat — upper 3 bits of valueFlag/tanFlag
_FMT_FLOAT = 0x00
_FMT_S16 = 0x20
_FMT_U16 = 0x40
_FMT_S8 = 0x60
_FMT_U8 = 0x80

# GXInterpolationType — lower 4 bits of packed type/count byte
_INTERP_NONE = 0
_INTERP_CON = 1
_INTERP_LIN = 2
_INTERP_SPL0 = 3
_INTERP_SPL = 4
_INTERP_SLP = 5
_INTERP_KEY = 6


def _read_packed_int(data, offset):
    """Read a variable-length packed integer from the keyframe buffer.

    Encoding: each byte contributes 7 bits of value. Bit 7 (0x80) is
    a continuation flag — if set, read the next byte. Bytes are
    accumulated in little-endian order (first byte = lowest bits).

    Args:
        data: bytes buffer.
        offset: current read position.

    Returns:
        (value, new_offset) tuple.
    """
    value = 0
    shift = 0
    while offset < len(data):
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        shift += 7
        if not (byte & 0x80):
            break
    return value, offset


def _parse_track_value(data, offset, fmt_type, scale):
    """Parse a single value from the keyframe buffer.

    The format is determined by the upper 3 bits of the flag byte.
    All formats are read in little-endian byte order, matching
    HSDLib's behavior (BigEndian=false in ParseFloat).

    Args:
        data: bytes buffer.
        offset: current read position.
        fmt_type: format type (upper 3 bits of flag, masked to 0xE0).
        scale: divisor for integer formats (2^(flag & 0x1F)).

    Returns:
        (float_value, new_offset) tuple.
    """
    if fmt_type == _FMT_FLOAT:
        if offset + 4 > len(data):
            return 0.0, offset
        val = struct.unpack_from('<f', data, offset)[0]
        return val, offset + 4
    elif fmt_type == _FMT_S16:
        if offset + 2 > len(data):
            return 0.0, offset
        val = struct.unpack_from('<h', data, offset)[0]
        return val / scale, offset + 2
    elif fmt_type == _FMT_U16:
        if offset + 2 > len(data):
            return 0.0, offset
        val = struct.unpack_from('<H', data, offset)[0]
        return val / scale, offset + 2
    elif fmt_type == _FMT_S8:
        if offset + 1 > len(data):
            return 0.0, offset
        val = struct.unpack_from('<b', data, offset)[0]
        return val / scale, offset + 1
    elif fmt_type == _FMT_U8:
        if offset + 1 > len(data):
            return 0.0, offset
        val = data[offset]
        return val / scale, offset + 1
    else:
        # Unknown format — skip
        return 0.0, offset


def _decode_keyframe_buffer(data, offset, length, value_flag, tan_flag):
    """Decode a compressed keyframe buffer into a list of (frame, value) pairs.

    The buffer contains packed entries. Each entry starts with a packed
    integer whose lower 4 bits encode the interpolation type and upper
    bits encode (count - 1). Depending on the interpolation type,
    value/tangent/time data follows.

    Args:
        data: The full data block bytes.
        offset: Start offset of this track's keyframe buffer.
        length: Length of the buffer in bytes (used as safety bound).
        value_flag: The valueFlag byte from the track descriptor.
        tan_flag: The tanFlag byte from the track descriptor.

    Returns:
        List of (frame, value) tuples, sorted by frame.
    """
    val_fmt = value_flag & 0xE0
    val_scale = 1 << (value_flag & 0x1F)
    tan_fmt = tan_flag & 0xE0
    tan_scale = 1 << (tan_flag & 0x1F)

    end = offset + length if length > 0 else len(data)
    keyframes = []
    current_frame = 0.0
    pos = offset

    while pos < end:
        # Read packed type/count integer
        packed, pos = _read_packed_int(data, pos)
        interp_type = packed & 0x0F
        count = (packed >> 4) + 1

        if interp_type == _INTERP_NONE:
            break

        for _ in range(count):
            if pos >= end:
                break

            if interp_type == _INTERP_CON:
                # Constant: read value, then time
                value, pos = _parse_track_value(data, pos, val_fmt, val_scale)
                duration, pos = _read_packed_int(data, pos)
                keyframes.append((current_frame, value))
                current_frame += duration

            elif interp_type == _INTERP_LIN:
                # Linear: read value, then time
                value, pos = _parse_track_value(data, pos, val_fmt, val_scale)
                duration, pos = _read_packed_int(data, pos)
                keyframes.append((current_frame, value))
                current_frame += duration

            elif interp_type == _INTERP_SPL0:
                # Spline (no tangent): read value, then time
                value, pos = _parse_track_value(data, pos, val_fmt, val_scale)
                duration, pos = _read_packed_int(data, pos)
                keyframes.append((current_frame, value))
                current_frame += duration

            elif interp_type == _INTERP_SPL:
                # Spline with tangent: read value, tangent, then time
                value, pos = _parse_track_value(data, pos, val_fmt, val_scale)
                _tan, pos = _parse_track_value(data, pos, tan_fmt, tan_scale)
                duration, pos = _read_packed_int(data, pos)
                keyframes.append((current_frame, value))
                current_frame += duration

            elif interp_type == _INTERP_SLP:
                # Slope only: read tangent (no value, no time advance)
                _tan, pos = _parse_track_value(data, pos, tan_fmt, tan_scale)

            elif interp_type == _INTERP_KEY:
                # Single key: read value (no time advance)
                value, pos = _parse_track_value(data, pos, val_fmt, val_scale)
                keyframes.append((current_frame, value))

            else:
                # Unknown interpolation type — stop parsing
                break

    return keyframes


def parse_figatree_animation(anim_dat_bytes):
    """Parse a FIGATREE animation DAT file into per-bone keyframe tracks.

    Each subaction's animation is a complete DAT file extracted from the
    AJ file. This function parses the DAT header, finds the FigaTree
    root node, reads the bone table and track descriptors, and decodes
    each track's compressed keyframe buffer.

    Args:
        anim_dat_bytes: Raw bytes of the animation DAT file.

    Returns:
        Tuple of (num_frames, tracks_dict) where:
        - num_frames: float, total animation frames from FigaTree header
        - tracks_dict: dict mapping bone_index (int) to a dict of
          track_type (int) -> [(frame, value), ...] keyframe lists.
        Returns (0, {}) on parse failure.
    """
    if not anim_dat_bytes or len(anim_dat_bytes) < 0x20:
        return 0, {}

    try:
        # Parse DAT file header
        values = struct.unpack_from(">8I", anim_dat_bytes, 0)
        data_block_size = values[1]
        reloc_count = values[2]
        root_count = values[3]
        root_count2 = values[4]

        data_offset = 0x20
        if data_offset + data_block_size > len(anim_dat_bytes):
            return 0, {}
        data_block = anim_dat_bytes[data_offset:data_offset + data_block_size]

        # Find the FigaTree root node
        reloc_table_offset = data_offset + data_block_size
        root_nodes_offset = reloc_table_offset + reloc_count * 4
        total_roots = root_count + root_count2
        string_table_offset = root_nodes_offset + total_roots * 8

        figatree_root_off = None
        for i in range(total_roots):
            off = root_nodes_offset + i * 8
            if off + 8 > len(anim_dat_bytes):
                break
            root_off, str_off = struct.unpack_from(">2I", anim_dat_bytes, off)

            name_start = string_table_offset + str_off
            if name_start >= len(anim_dat_bytes):
                continue
            try:
                name_end = anim_dat_bytes.index(b"\x00", name_start)
                name = anim_dat_bytes[name_start:name_end].decode("ascii", errors="replace")
            except ValueError:
                continue

            if name.endswith("_figatree"):
                figatree_root_off = root_off
                break

        if figatree_root_off is None:
            # Try the first root node as fallback
            if total_roots > 0:
                off = root_nodes_offset
                if off + 8 <= len(anim_dat_bytes):
                    figatree_root_off = struct.unpack_from(">I", anim_dat_bytes, off)[0]

        if figatree_root_off is None:
            return 0, {}

        # Parse FigaTree header (0x14 bytes at root offset in data block)
        if figatree_root_off + 0x14 > len(data_block):
            return 0, {}

        ft_values = struct.unpack_from(">2If2I", data_block, figatree_root_off)
        # ft_values[0] = type (usually 1), ft_values[1] = unknown (usually 0)
        num_frames = ft_values[2]
        bone_table_offset = ft_values[3]
        anim_data_offset = ft_values[4]

        if num_frames <= 0:
            return 0, {}

        # Read bone table (array of bytes, one per bone, terminated by 0xFF)
        bone_track_counts = []
        pos = bone_table_offset
        while pos < len(data_block):
            byte = data_block[pos]
            if byte == 0xFF:
                break
            bone_track_counts.append(byte)
            pos += 1

        if not bone_track_counts:
            return num_frames, {}

        # Read track descriptors (0x0C bytes each)
        tracks_dict = {}
        track_idx = 0

        for bone_idx, track_count in enumerate(bone_track_counts):
            if track_count == 0:
                continue

            bone_tracks = {}
            for t in range(track_count):
                desc_offset = anim_data_offset + track_idx * 0x0C
                if desc_offset + 0x0C > len(data_block):
                    track_idx += 1
                    continue

                track_type = data_block[desc_offset + 4]
                value_flag = data_block[desc_offset + 5]
                tan_flag = data_block[desc_offset + 6]
                # Byte 0x01 contains the buffer data length
                buf_data_len = data_block[desc_offset + 1]
                # 0x08-0x0B: buffer pointer (relocated, data-block-relative)
                buf_offset = struct.unpack_from(">I", data_block, desc_offset + 8)[0]
                buf_length = buf_data_len if buf_data_len > 0 else 0

                # Decode keyframes from the buffer
                if buf_offset < len(data_block):
                    keyframes = _decode_keyframe_buffer(
                        data_block, buf_offset, buf_length,
                        value_flag, tan_flag,
                    )
                    if keyframes:
                        bone_tracks[track_type] = keyframes

                track_idx += 1

            if bone_tracks:
                tracks_dict[bone_idx] = bone_tracks

        return num_frames, tracks_dict

    except Exception as e:
        logger.debug("FIGATREE parse error: %s", e)
        return 0, {}


def _interpolate_track(keyframes, frame):
    """Linearly interpolate a track value at a given frame.

    Finds the two surrounding keyframes and interpolates between them.
    If the frame is before the first keyframe, returns the first value.
    If after the last, returns the last value.

    Args:
        keyframes: List of (frame, value) tuples, sorted by frame.
        frame: The target frame number (float).

    Returns:
        Interpolated float value.
    """
    if not keyframes:
        return 0.0
    if len(keyframes) == 1:
        return keyframes[0][1]

    # Before first keyframe
    if frame <= keyframes[0][0]:
        return keyframes[0][1]
    # After last keyframe
    if frame >= keyframes[-1][0]:
        return keyframes[-1][1]

    # Find surrounding keyframes via linear scan (tracks are typically short)
    for i in range(len(keyframes) - 1):
        kf_a = keyframes[i]
        kf_b = keyframes[i + 1]
        if kf_a[0] <= frame <= kf_b[0]:
            span = kf_b[0] - kf_a[0]
            if span <= 0:
                return kf_a[1]
            t = (frame - kf_a[0]) / span
            return kf_a[1] + (kf_b[1] - kf_a[1]) * t

    return keyframes[-1][1]


def compute_animated_bone_positions(bones, anim_tracks, num_frames, referenced_bones):
    """Compute per-frame world-space bone positions using animation tracks.

    For each integer frame in [0, num_frames), interpolates animation
    track values (rotation, translation, scale) for each bone, builds
    the local transform matrix, composes with the parent's world matrix,
    and projects to 2D (Z→X, Y→Y).

    Only stores frames where at least one referenced bone's position
    changes by more than 0.01 game units from the previous stored frame.

    Args:
        bones: List of bone dicts from extract_bone_tree. Each must have
               'id', 'parent', and the original JOBJ rest-pose data is
               used as defaults for non-animated channels.
        anim_tracks: Dict from parse_figatree_animation:
                     {bone_index: {track_type: [(frame, value), ...]}}.
        num_frames: Total number of animation frames.
        referenced_bones: Set of bone IDs to include in output.

    Returns:
        Dict mapping frame_str -> {bone_id_str: [x, y], ...}.
        Only frames where positions change significantly are included.
    """
    if not bones or num_frames <= 0:
        return {}

    # Build bone info lookup: id -> (parent_id, rest rotation, rest scale, rest translation)
    # We need the original JOBJ rest-pose values as defaults for non-animated channels.
    # The bones list only has world-space restX/restY, so we need to re-parse
    # the JOBJ data. Instead, we use the bone tree structure and default values.
    # For bones without animation tracks, their rest-pose contribution comes
    # from the parent chain computation.

    # The bone dicts now include _local_* fields with the original JOBJ
    # rest-pose local transforms. These are used as defaults for channels
    # that don't have animation tracks.

    # Default local transform values from JOBJ rest-pose
    bone_defaults = {}
    for bone in bones:
        bone_defaults[bone["id"]] = {
            "rx": bone.get("_local_rx", 0.0),
            "ry": bone.get("_local_ry", 0.0),
            "rz": bone.get("_local_rz", 0.0),
            "sx": bone.get("_local_sx", 1.0),
            "sy": bone.get("_local_sy", 1.0),
            "sz": bone.get("_local_sz", 1.0),
            "tx": bone.get("_local_tx", 0.0),
            "ty": bone.get("_local_ty", 0.0),
            "tz": bone.get("_local_tz", 0.0),
        }

    bone_parent = {}
    for bone in bones:
        bone_parent[bone["id"]] = bone["parent"]

    bone_frames = {}
    prev_positions = {}  # bone_id -> (x, y) of last stored frame

    num_frames_int = int(_math.ceil(num_frames))

    for frame in range(num_frames_int):
        # Compute world transforms for all bones at this frame
        world_matrices = {}

        for bone in bones:
            bid = bone["id"]
            parent_id = bone["parent"]

            # Get animated values for this bone, falling back to defaults
            defaults = bone_defaults[bid]
            tracks = anim_tracks.get(bid, {})

            rx = _interpolate_track(tracks.get(_TRACK_ROTX, []), frame) if _TRACK_ROTX in tracks else defaults["rx"]
            ry = _interpolate_track(tracks.get(_TRACK_ROTY, []), frame) if _TRACK_ROTY in tracks else defaults["ry"]
            rz = _interpolate_track(tracks.get(_TRACK_ROTZ, []), frame) if _TRACK_ROTZ in tracks else defaults["rz"]
            sx = _interpolate_track(tracks.get(_TRACK_SCAX, []), frame) if _TRACK_SCAX in tracks else defaults["sx"]
            sy = _interpolate_track(tracks.get(_TRACK_SCAY, []), frame) if _TRACK_SCAY in tracks else defaults["sy"]
            sz = _interpolate_track(tracks.get(_TRACK_SCAZ, []), frame) if _TRACK_SCAZ in tracks else defaults["sz"]
            tx = _interpolate_track(tracks.get(_TRACK_TRAX, []), frame) if _TRACK_TRAX in tracks else defaults["tx"]
            ty = _interpolate_track(tracks.get(_TRACK_TRAY, []), frame) if _TRACK_TRAY in tracks else defaults["ty"]
            tz = _interpolate_track(tracks.get(_TRACK_TRAZ, []), frame) if _TRACK_TRAZ in tracks else defaults["tz"]

            # Clamp scale to avoid degenerate matrices
            sx = max(sx, 0.001)
            sy = max(sy, 0.001)
            sz = max(sz, 0.001)

            local_mat = _make_local_matrix(rx, ry, rz, sx, sy, sz, tx, ty, tz)

            if parent_id == -1 or parent_id not in world_matrices:
                world_mat = local_mat
            else:
                world_mat = _mat4_multiply(world_matrices[parent_id], local_mat)

            # Remove root bone translation to avoid double-counting
            # with the .slp character position. The .slp positionX/positionY
            # already includes the character's world position, so the animation's
            # root bone translation would be applied twice otherwise.
            # This matches Rwing's remove_root_translation() approach.
            # In our skeleton, bone 2 is the "TransN" bone that carries the
            # root Y/Z translation (bones 0-1 are at origin).
            # Zero out Y (index 7) and Z (index 11) translation in the world matrix.
            if bid == 2:
                world_mat[7] = 0.0   # Y translation (vertical)
                world_mat[11] = 0.0  # Z translation (forward/depth → 2D X)

            world_matrices[bid] = world_mat

        # Extract 2D positions and bone direction for referenced bones.
        # The bone direction is computed from parent→bone vector, which
        # represents "along the bone" — the direction hitbox Z offsets follow.
        frame_data = {}
        any_changed = False

        # First pass: compute all bone 2D positions
        bone_2d = {}
        for bone in bones:
            bid = bone["id"]
            if bid not in world_matrices:
                continue
            wm = world_matrices[bid]
            bone_2d[bid] = (round(wm[11], 4), round(wm[7], 4))  # (z→x, y→y)

        for bid in referenced_bones:
            if bid not in bone_2d:
                continue
            pos_x, pos_y = bone_2d[bid]

            # Compute bone direction from parent→bone vector
            parent_id = bone_parent.get(bid, -1)
            if parent_id >= 0 and parent_id in bone_2d:
                px, py = bone_2d[parent_id]
                dx = pos_x - px
                dy = pos_y - py
                length = (dx * dx + dy * dy) ** 0.5
                if length > 0.001:
                    zdir_x = round(dx / length, 4)
                    zdir_y = round(dy / length, 4)
                else:
                    zdir_x, zdir_y = 1.0, 0.0
            else:
                zdir_x, zdir_y = 1.0, 0.0

            prev = prev_positions.get(bid)
            if prev is None or abs(pos_x - prev[0]) > 0.1 or abs(pos_y - prev[1]) > 0.1:
                any_changed = True

            frame_data[str(bid)] = [round(pos_x, 4), round(pos_y, 4),
                                    zdir_x, zdir_y]

        # Always store frame 0; after that, only store if positions changed
        if frame == 0 or any_changed:
            bone_frames[str(frame)] = frame_data
            for bid_str, pos in frame_data.items():
                prev_positions[int(bid_str)] = (pos[0], pos[1])

    return bone_frames


def _get_referenced_bone_ids(hitbox_data, hurtboxes):
    """Collect all bone IDs referenced by hitboxes and hurtboxes.

    Args:
        hitbox_data: Dict from extract_hitboxes (sub_idx -> subaction data).
        hurtboxes: List of hurtbox dicts from extract_hurtboxes.

    Returns:
        Set of bone IDs (ints) referenced by at least one hitbox or hurtbox.
    """
    bone_ids = set()
    for sub_data in hitbox_data.values():
        for hb in sub_data.get("hitboxes", []):
            bone_ids.add(hb["bone"])
    for hb in (hurtboxes or []):
        bone_ids.add(hb["bone"])
    return bone_ids


def _build_rest_pose_frame(bones, referenced_bones):
    """Build a single bone frame dict from rest-pose positions.

    Only includes bones that are in the referenced_bones set.

    Args:
        bones: List of bone dicts from extract_bone_tree.
        referenced_bones: Set of bone IDs to include.

    Returns:
        Dict mapping bone_id (str) -> [x, y] rest-pose position.
    """
    frame = {}
    for bone in bones:
        if bone["id"] in referenced_bones:
            frame[str(bone["id"])] = [
                round(bone["restX"], 4),
                round(bone["restY"], 4),
            ]
    return frame


def _get_anim_num_frames(raw_json, sub_idx):
    """Get the number of animation frames for a subaction from FigaTree data.

    meleeDat2Json embeds animation files when the AJ file is provided.
    Each subaction may reference an animationFile index, and that
    animation file's FigaTree root node has a numFrames field.

    Args:
        raw_json: The parsed meleeDat2Json output dict.
        sub_idx: The subaction index.

    Returns:
        Number of frames (int) or None if not available.
    """
    # Find the ftData node to get subaction info
    nodes = raw_json.get("nodes", [])
    subactions_list = None
    for node in nodes:
        data = node.get("data")
        if data and "subactions" in data:
            subactions_list = data["subactions"]
            break

    if not subactions_list or sub_idx >= len(subactions_list):
        return None

    subaction = subactions_list[sub_idx]
    anim_file_idx = subaction.get("animationFile")
    if anim_file_idx is None:
        return None

    anim_files = raw_json.get("animationFiles", [])
    if anim_file_idx >= len(anim_files):
        return None

    anim_file = anim_files[anim_file_idx]
    # The animation file is itself a DatFile with FigaTree root nodes
    anim_nodes = anim_file.get("nodes", [])
    for anim_node in anim_nodes:
        anim_data = anim_node.get("data")
        if anim_data and "numFrames" in anim_data:
            num_frames = anim_data["numFrames"]
            if isinstance(num_frames, (int, float)) and num_frames > 0:
                return int(num_frames)

    return None


def extract_animations(raw_json, bones, hitbox_data, hurtboxes=None, aj_bytes=None):
    """Extract animation data and compute per-frame bone world transforms.

    For each subaction that has hitboxes, parses the FIGATREE animation
    binary data from the AJ file to get per-bone keyframe tracks, then
    computes world-space bone positions for each animation frame using
    hierarchical transform composition.

    Falls back to rest-pose positions when AJ bytes are not available
    or when FIGATREE parsing fails for a particular subaction.

    Only includes bones referenced by hitboxes or hurtboxes to
    minimize JSON size.

    Args:
        raw_json: The parsed meleeDat2Json output dict.
        bones: List of bone dicts from extract_bone_tree.
        hitbox_data: Dict from extract_hitboxes (sub_idx -> subaction data).
        hurtboxes: Optional list of hurtbox dicts from extract_hurtboxes.
        aj_bytes: Optional raw bytes of the AJ animation file. When
                  provided, enables full FIGATREE animation parsing.

    Returns:
        Dict mapping subaction index (int) to:
        {
            "boneFrames": {
                "0": {"bone_id": [x, y], ...},
                ...
            },
            "totalFrames": int or None
        }
        Only subactions present in hitbox_data are included.
        Returns empty dict if no bones or hitbox_data are available.
    """
    if not bones or not hitbox_data:
        return {}

    # Collect all bone IDs referenced by hitboxes and hurtboxes
    referenced_bones = _get_referenced_bone_ids(hitbox_data, hurtboxes)
    if not referenced_bones:
        return {}

    # Build the rest-pose frame (used as fallback)
    rest_frame = _build_rest_pose_frame(bones, referenced_bones)
    if not rest_frame:
        return {}

    # Get subaction list from raw_json for animation offsets
    subactions_list = None
    nodes = raw_json.get("nodes", [])
    for node in nodes:
        data = node.get("data")
        if data and "subactions" in data:
            subactions_list = data["subactions"]
            break

    result = {}
    anim_parsed_count = 0

    for sub_idx, sub_data in hitbox_data.items():
        total_frames = sub_data.get("totalFrames", 1)

        # Try to get accurate frame count from animation data
        anim_num_frames = _get_anim_num_frames(raw_json, sub_idx)
        if anim_num_frames is not None and anim_num_frames > 0:
            total_frames = max(total_frames, anim_num_frames)

        # Try FIGATREE parsing if AJ bytes are available
        bone_frames = None
        if aj_bytes and subactions_list and sub_idx < len(subactions_list):
            subaction = subactions_list[sub_idx]
            anim_offset = subaction.get("animOffset", 0)
            anim_size = subaction.get("animSize", 0)

            if anim_size > 0 and anim_offset + anim_size <= len(aj_bytes):
                anim_dat = aj_bytes[anim_offset:anim_offset + anim_size]
                ft_num_frames, anim_tracks = parse_figatree_animation(anim_dat)

                if anim_tracks and ft_num_frames > 0:
                    total_frames = max(total_frames, int(_math.ceil(ft_num_frames)))
                    bone_frames = compute_animated_bone_positions(
                        bones, anim_tracks, ft_num_frames, referenced_bones,
                    )
                    if bone_frames:
                        anim_parsed_count += 1

        # Fall back to rest-pose if FIGATREE parsing didn't produce frames
        if not bone_frames:
            bone_frames = {"0": rest_frame}

        # Validate: all bone frame keys must be in [0, totalFrames)
        valid_bone_frames = {}
        for frame_str, frame_data in bone_frames.items():
            frame_num = int(frame_str)
            if 0 <= frame_num < total_frames:
                valid_bone_frames[frame_str] = frame_data

        result[sub_idx] = {
            "boneFrames": valid_bone_frames,
            "totalFrames": total_frames,
        }

    if anim_parsed_count > 0:
        logger.info(
            "  Parsed FIGATREE animations for %d/%d subaction(s)",
            anim_parsed_count, len(hitbox_data),
        )

    return result


# ---------------------------------------------------------------------------
# Action state ID → subaction ID mapping
# ---------------------------------------------------------------------------
# In Melee, action state IDs 0-340 are common across all characters and
# map 1:1 to subaction indices (identity mapping). Action state IDs >= 341
# are character-specific special moves. Each character has a different
# starting subaction index for their specials in the DAT file.
#
# The mapping for specials is:
#   subaction_index = actionStateId - 341 + special_start_index
#
# The special_start_index varies by character. These values are derived
# from the Melee decompilation project and represent the subaction index
# where each character's special moves begin in their DAT file.
# ---------------------------------------------------------------------------

COMMON_ACTION_STATE_LIMIT = 341

# Known special move start indices per character.
# These are the subaction indices where character-specific special moves
# begin in each character's DAT file. Derived from the Melee
# decompilation project (github.com/doldecomp/melee).
SPECIAL_MOVE_START_INDEX = {
    "bowser":          295,
    "captain_falcon":  295,
    "donkey_kong":     295,
    "dr_mario":        295,
    "falco":           295,
    "fox":             295,
    "game_and_watch":  295,
    "ganondorf":       295,
    "ice_climbers":    295,
    "jigglypuff":      295,
    "kirby":           295,
    "link":            295,
    "luigi":           295,
    "mario":           295,
    "marth":           295,
    "mewtwo":          295,
    "ness":            295,
    "peach":           295,
    "pichu":           295,
    "pikachu":         295,
    "roy":             295,
    "samus":           295,
    "sheik":           295,
    "yoshi":           295,
    "young_link":      295,
    "zelda":           295,
}


def _detect_special_start_index(hitbox_data):
    """Detect the special move start index by scanning hitbox data.

    Scans the subaction list for the first subaction index after 273
    (the last common subaction with hitbox data in most characters)
    that has hitbox data. This heuristic works because special move
    subactions are typically the first entries after the common
    action subactions.

    Args:
        hitbox_data: Dict from extract_hitboxes (sub_idx -> subaction data).

    Returns:
        Detected special start index, or None if not detectable.
    """
    if not hitbox_data:
        return None

    # Look for subaction indices in the range where specials typically start
    # Common subactions go up to ~273, specials start around 274-295
    candidates = sorted(
        idx for idx in hitbox_data.keys()
        if 274 <= idx <= 350
    )

    if candidates:
        return candidates[0]

    return None


def build_action_state_map(char_name, hitbox_data):
    """Build the action state ID → subaction ID mapping for a character.

    In Melee, action state IDs 0-340 are common across all characters
    and map 1:1 to subaction indices (identity mapping). Action state
    IDs >= 341 are character-specific special moves that map to
    different subaction indices in the DAT file.

    For common actions (< 341): no entry is needed since the browser
    uses identity mapping as the default.

    For character-specific specials (>= 341): the mapping is
    ``subaction_index = actionStateId - 341 + special_start_index``
    where special_start_index varies by character.

    Args:
        char_name: Character name (e.g. "fox").
        hitbox_data: Dict from extract_hitboxes (sub_idx -> subaction data).

    Returns:
        Dict mapping action state ID (str) to subaction index (int).
        Only includes entries where actionStateId != subactionId.
        Returns empty dict if no special move mappings are needed.
    """
    action_state_map = {}

    # Get the special move start index for this character
    special_start = SPECIAL_MOVE_START_INDEX.get(char_name)

    # If not in the hardcoded table, try to detect from hitbox data
    if special_start is None:
        special_start = _detect_special_start_index(hitbox_data)

    if special_start is None:
        logger.warning(
            "  Cannot determine special move start index for %s — "
            "action state map will be empty",
            char_name,
        )
        return action_state_map

    # Build mappings for special moves (action state >= 341)
    # The number of special move subactions varies by character,
    # but we generate mappings for a reasonable range.
    # We scan hitbox_data to find which subaction indices actually
    # have data in the special move range.
    max_subaction = max(hitbox_data.keys()) if hitbox_data else 0
    num_specials = max(0, max_subaction - special_start + 1)

    # Also generate mappings for a reasonable range even if some
    # subactions don't have hitbox data (they may have other data)
    # Typical characters have 20-60 special move subactions
    num_specials = max(num_specials, 60)

    for i in range(num_specials):
        action_state_id = COMMON_ACTION_STATE_LIMIT + i
        subaction_id = special_start + i

        # Only include non-identity mappings
        if action_state_id != subaction_id:
            action_state_map[str(action_state_id)] = subaction_id

    return action_state_map


# ---------------------------------------------------------------------------
# DAT file parsing via meleeDat2Json
# ---------------------------------------------------------------------------

def parse_dat_file(
    dat_path: str, aj_path: str | None = None
) -> dict | None:
    """Parse a character DAT file into a raw JSON dict using meleeDat2Json.

    Uses the DatFile class from meleeDat2Json to parse the binary DAT
    format into a structured dict containing root nodes (ftData with
    attributes, subactions, events) and optionally FIGATREE animation
    data from the companion AJ file.

    Args:
        dat_path: Path to the extracted .dat file on disk.
        aj_path: Optional path to the companion AJ animation file.

    Returns:
        Parsed JSON dict from DatFile.toJsonDict(), or None on failure.
    """
    if not HAS_MELEEDAT2JSON:
        logger.error(
            "meleedat2json is not installed. "
            "Install with: pip install -r hitbox-data/requirements.txt"
        )
        return None

    try:
        with open(dat_path, "rb") as f:
            file_data = f.read()
    except OSError as e:
        logger.error("Cannot read DAT file '%s': %s", dat_path, e)
        return None

    anim_file_data = None
    if aj_path and os.path.isfile(aj_path):
        try:
            with open(aj_path, "rb") as f:
                anim_file_data = f.read()
            logger.info("  Loaded AJ animation data (%s bytes)",
                        f"{len(anim_file_data):,}")
        except OSError as e:
            logger.warning(
                "Could not read AJ file '%s': %s "
                "(continuing without animation data)",
                aj_path, e,
            )

    try:
        dat_file = DatFile(file_data, anim_file_data)
        raw_json = dat_file.toJsonDict()
    except Exception as e:
        logger.error(
            "meleeDat2Json failed to parse '%s': %s", dat_path, e
        )
        return None

    return raw_json


# ---------------------------------------------------------------------------
# JSON serialization
# ---------------------------------------------------------------------------


def serialize_character_json(
    char_name: str,
    bone_tree: list,
    hitbox_data: dict,
    hurtboxes: list,
    action_state_map: dict,
) -> dict:
    """Serialize all extracted data into the final output JSON schema.

    Combines bone tree, hitbox/animation data, hurtboxes, and action
    state mapping into a single dict matching the Character_JSON schema
    defined in the design document.

    Args:
        char_name: Character name (e.g. "fox").
        bone_tree: List of bone dicts from extract_bone_tree.
        hitbox_data: Dict from extract_hitboxes, with boneFrames merged
                     in by extract_animations.
        hurtboxes: List of hurtbox dicts from extract_hurtboxes.
        action_state_map: Dict from build_action_state_map.

    Returns:
        Dict matching the Character_JSON output schema.
    """
    # Build subactions dict keyed by string subaction ID
    subactions = {}
    for sub_idx, sub_data in hitbox_data.items():
        sub_key = str(sub_idx)
        subactions[sub_key] = {
            "name": sub_data.get("name", f"Subaction{sub_idx}"),
            "totalFrames": sub_data.get("totalFrames", 1),
            "boneFrames": sub_data.get("boneFrames", {}),
            "hitboxes": sub_data.get("hitboxes", []),
        }

    # Strip internal _local_* fields from bone dicts for output
    clean_bones = []
    for bone in bone_tree:
        clean_bones.append({
            k: v for k, v in bone.items() if not k.startswith("_local_")
        })

    return {
        "character": char_name,
        "internalId": CHARACTER_EXTERNAL_ID.get(char_name, 0),
        "scale": CHARACTER_SCALE.get(char_name, 1.0),
        "bones": clean_bones,
        "subactions": subactions,
        "hurtboxes": hurtboxes,
        "actionStateMap": action_state_map,
    }


# ---------------------------------------------------------------------------
# Main extraction pipeline
# ---------------------------------------------------------------------------

def process_character(
    gcm: GCMReader,
    char_name: str,
    dat_iso_path: str,
    aj_iso_path: str | None,
    outdir: str,
) -> bool:
    """Process a single character: extract DAT, parse, and output JSON.

    This is the main per-character pipeline entry point. Extracts the
    DAT file (and optional AJ animation file) from the ISO, then parses
    them using meleeDat2Json into a raw JSON dict. The raw JSON is saved
    as an intermediate file for downstream tasks (2.1-2.6) to process.

    Args:
        gcm: An open GCMReader instance.
        char_name: Character name (e.g. "fox").
        dat_iso_path: Path of the DAT file within the ISO.
        aj_iso_path: Path of the AJ file within the ISO, or None.
        outdir: Output directory for JSON files.

    Returns:
        True if processing succeeded, False otherwise.
    """
    print(f"\nProcessing {char_name}...")

    # Step 1: Extract DAT file from ISO
    extracted_path = extract_dat_file(
        gcm, dat_iso_path, outdir, char_name
    )
    if not extracted_path:
        return False

    # Step 1b: Extract AJ (animation) file from ISO if available
    aj_extracted_path = None
    if aj_iso_path:
        aj_extracted_path = extract_aj_file(
            gcm, aj_iso_path, outdir, char_name
        )
        if not aj_extracted_path:
            logger.warning(
                "  AJ file extraction failed for %s; "
                "continuing without animation data",
                char_name,
            )

    # Step 2: Parse DAT file with meleeDat2Json
    raw_json = parse_dat_file(extracted_path, aj_extracted_path)
    if raw_json is None:
        logger.error(
            "  Failed to parse DAT file for %s — skipping",
            char_name,
        )
        return False

    # Save raw parsed JSON for downstream tasks (2.1-2.6)
    raw_json_path = os.path.join(
        outdir, f".{char_name}_raw.json"
    )
    try:
        with open(raw_json_path, "w") as f:
            json.dump(raw_json, f, indent=2)
        logger.info("  Saved raw parsed JSON: %s", raw_json_path)
    except OSError as e:
        logger.error(
            "  Failed to write raw JSON for %s: %s",
            char_name, e,
        )
        return False

    # Log summary of parsed data
    nodes = raw_json.get("nodes", [])
    node_names = [n.get("name", "?") for n in nodes]
    logger.info("  Parsed %d root node(s): %s",
                len(nodes), ", ".join(node_names))

    for node in nodes:
        data = node.get("data")
        if data and "subactions" in data:
            n_sub = len(data["subactions"])
            logger.info("  Found %d subaction(s)", n_sub)
            break

    anim_files = raw_json.get("animationFiles", [])
    if anim_files:
        logger.info(
            "  Found %d embedded animation file(s)",
            len(anim_files),
        )

    print(f"  DAT parsed successfully for {char_name}")

    # Step 3: Extract bone tree from JOBJ hierarchy
    try:
        with open(extracted_path, "rb") as f:
            dat_bytes = f.read()
        bone_tree = extract_bone_tree(dat_bytes)
        if bone_tree:
            logger.info(
                "  Extracted %d bones from JOBJ tree",
                len(bone_tree),
            )
        else:
            logger.warning(
                "  No JOBJ tree found for %s — "
                "bone tree will be empty",
                char_name,
            )
    except Exception as e:
        logger.error(
            "  Failed to extract bone tree for %s: %s",
            char_name, e,
        )
        bone_tree = []

    # Step 4: Extract hitboxes from subaction events
    hitbox_data = extract_hitboxes(raw_json)
    if hitbox_data:
        logger.info(
            "  Extracted hitboxes from %d subaction(s)",
            len(hitbox_data),
        )
    else:
        logger.warning(
            "  No hitbox data found for %s", char_name,
        )

    # Step 5: Extract hurtboxes from binary DAT data
    try:
        hurtboxes = extract_hurtboxes(dat_bytes, bone_tree)
        if hurtboxes:
            logger.info(
                "  Extracted %d hurtbox(es)", len(hurtboxes),
            )
        else:
            logger.warning(
                "  No hurtbox data found for %s", char_name,
            )
    except Exception as e:
        logger.error(
            "  Failed to extract hurtboxes for %s: %s",
            char_name, e,
        )
        hurtboxes = []

    # Step 6: Extract animations and compute bone world transforms
    # Load AJ bytes for FIGATREE animation parsing
    aj_raw_bytes = None
    if aj_extracted_path and os.path.isfile(aj_extracted_path):
        try:
            with open(aj_extracted_path, "rb") as f:
                aj_raw_bytes = f.read()
            logger.info("  Loaded AJ bytes for FIGATREE parsing (%s bytes)",
                        f"{len(aj_raw_bytes):,}")
        except OSError as e:
            logger.warning("  Could not read AJ file for animation parsing: %s", e)

    try:
        animations = extract_animations(
            raw_json, bone_tree, hitbox_data, hurtboxes,
            aj_bytes=aj_raw_bytes,
        )
        if animations:
            # Merge boneFrames into hitbox_data subactions
            for sub_id, anim_data in animations.items():
                if sub_id in hitbox_data:
                    hitbox_data[sub_id]["boneFrames"] = anim_data["boneFrames"]
                    # Update totalFrames from animation if available and larger
                    if anim_data.get("totalFrames") and anim_data["totalFrames"] > hitbox_data[sub_id].get("totalFrames", 0):
                        hitbox_data[sub_id]["totalFrames"] = anim_data["totalFrames"]
            logger.info(
                "  Extracted animation data for %d subaction(s)",
                len(animations),
            )
        else:
            logger.warning(
                "  No animation data extracted for %s", char_name,
            )
    except Exception as e:
        logger.error(
            "  Failed to extract animations for %s: %s",
            char_name, e,
        )

    # Step 7: Build action state map
    try:
        action_state_map = build_action_state_map(char_name, hitbox_data)
        if action_state_map:
            logger.info(
                "  Built action state map with %d entries",
                len(action_state_map),
            )
        else:
            logger.info(
                "  Action state map is empty (all identity mappings)",
            )
    except Exception as e:
        logger.error(
            "  Failed to build action state map for %s: %s",
            char_name, e,
        )
        action_state_map = {}

    # Step 8: Serialize to final JSON and write output
    try:
        character_json = serialize_character_json(
            char_name, bone_tree, hitbox_data,
            hurtboxes, action_state_map,
        )
        output_path = os.path.join(outdir, f"{char_name}.json")
        with open(output_path, "w") as f:
            json.dump(character_json, f, separators=(",", ":"))
        file_size = os.path.getsize(output_path)
        logger.info(
            "  Wrote %s (%s bytes)", output_path, f"{file_size:,}"
        )
        print(f"  Output: {output_path} ({file_size:,} bytes)")
    except Exception as e:
        logger.error(
            "  Failed to write output JSON for %s: %s",
            char_name, e,
        )
        return False

    # Step 9: Validate the output JSON
    if not validate_json(output_path):
        logger.warning(
            "  Output JSON for %s has validation warnings",
            char_name,
        )

    # Step 10: Clean up intermediate files
    for tmp_file in [extracted_path, aj_extracted_path, raw_json_path]:
        if tmp_file and os.path.isfile(tmp_file):
            try:
                os.remove(tmp_file)
            except OSError as e:
                logger.debug(
                    "  Could not remove temp file %s: %s",
                    tmp_file, e,
                )

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Extract hitbox/hurtbox data from Melee character DAT files.",
        epilog=(
            "Examples:\n"
            "  python extract_hitbox_data.py --iso melee.iso\n"
            "  python extract_hitbox_data.py --iso melee.iso --char fox\n"
            "  python extract_hitbox_data.py --iso melee.iso --outdir hitbox-data\n"
            "  python extract_hitbox_data.py --validate hitbox-data/fox.json\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--iso",
        type=str,
        help="Path to the Melee ISO file (NTSC v1.02 recommended).",
    )
    parser.add_argument(
        "--char",
        type=str,
        default=None,
        help=(
            "Extract data for a single character only. "
            f"Valid names: {', '.join(sorted(CHARACTER_DAT_PREFIX.keys()))}"
        ),
    )
    parser.add_argument(
        "--outdir",
        type=str,
        default="hitbox-data",
        help="Output directory for JSON files (default: hitbox-data).",
    )
    parser.add_argument(
        "--validate",
        type=str,
        default=None,
        metavar="JSON_FILE",
        help="Validate a character JSON file against the schema rules.",
    )

    args = parser.parse_args()

    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    # --validate mode: validate a JSON file and exit
    if args.validate:
        success = validate_json(args.validate)
        sys.exit(0 if success else 1)

    # Extraction mode: --iso is required
    if not args.iso:
        parser.error(
            "--iso is required for extraction "
            "(or use --validate for validation mode)"
        )

    # Check that meleeDat2Json is available
    if not HAS_MELEEDAT2JSON:
        logger.error(
            "meleedat2json is not installed.\n"
            "Install with: pip install -r hitbox-data/requirements.txt"
        )
        sys.exit(1)

    # Validate ISO path exists
    if not os.path.isfile(args.iso):
        logger.error("ISO file not found: %s", args.iso)
        sys.exit(1)

    # Open ISO and detect version
    try:
        gcm = GCMReader(args.iso)
    except Exception as e:
        logger.error(
            "Failed to read ISO '%s': %s", args.iso, e
        )
        sys.exit(1)

    with gcm:
        version_str, is_ntsc_102 = detect_iso_version(gcm)
        print(f"ISO: {args.iso}")
        print(f"Version: {version_str}")

        if not is_ntsc_102:
            logger.warning(
                "This ISO is not NTSC v1.02. "
                "Hitbox data may be inaccurate for other versions."
            )

        # Find character DAT files
        dat_files = find_character_dat_files(gcm, args.char)
        if not dat_files:
            logger.error(
                "No character DAT files found in ISO."
            )
            sys.exit(1)

        print(f"\nFound {len(dat_files)} character(s):")
        for name, (path, aj_path) in sorted(dat_files.items()):
            offset, size = gcm.files[path]
            aj_info = ""
            if aj_path:
                _, aj_size = gcm.files[aj_path]
                aj_info = f" + AJ ({aj_size:,} bytes)"
            print(
                f"  {name:20s} -> {path} "
                f"({size:,} bytes){aj_info}"
            )

        # Process each character
        os.makedirs(args.outdir, exist_ok=True)
        succeeded = 0
        failed = 0

        for char_name, (dat_path, aj_path) in sorted(
            dat_files.items()
        ):
            try:
                ok = process_character(
                    gcm, char_name, dat_path, aj_path,
                    args.outdir,
                )
                if ok:
                    succeeded += 1
                else:
                    failed += 1
            except Exception as e:
                logger.error(
                    "Error processing %s: %s", char_name, e
                )
                failed += 1

        # Summary
        total = len(dat_files)
        print(
            f"\nDone. {succeeded} succeeded, "
            f"{failed} failed out of {total} characters."
        )
        if failed > 0:
            sys.exit(1)


if __name__ == "__main__":
    main()
