"""Tests for extract_hitbox_data.py — Tasks 1.2, 2.1."""

import importlib.util
import json
import os
import struct
import tempfile
import unittest

# Load the extraction module from its file path
_spec = importlib.util.spec_from_file_location(
    "extract_hitbox_data",
    os.path.join(os.path.dirname(__file__), "extract_hitbox_data.py"),
)
extract = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(extract)


class TestParseDatFile(unittest.TestCase):
    """Test parse_dat_file error handling and basic functionality."""

    def test_nonexistent_file_returns_none(self):
        """parse_dat_file returns None for a file that doesn't exist."""
        result = extract.parse_dat_file("/nonexistent/path.dat")
        self.assertIsNone(result)

    def test_invalid_dat_returns_dict(self):
        """parse_dat_file returns a dict (possibly empty) for garbage data.

        meleeDat2Json is lenient — it parses garbage bytes without raising
        and returns an OrderedDict with an empty 'nodes' list. This is
        valid behavior; downstream extraction tasks handle empty data.
        """
        with tempfile.NamedTemporaryFile(
            suffix=".dat", delete=False
        ) as f:
            f.write(b"\x00" * 64)  # garbage data
            tmp_path = f.name
        try:
            result = extract.parse_dat_file(tmp_path)
            # meleeDat2Json parses garbage without error — returns a dict
            self.assertIsNotNone(result)
            self.assertIn("nodes", result)
        finally:
            os.unlink(tmp_path)

    def test_aj_path_none_is_ok(self):
        """parse_dat_file handles aj_path=None without error."""
        with tempfile.NamedTemporaryFile(
            suffix=".dat", delete=False
        ) as f:
            f.write(b"\x00" * 64)
            tmp_path = f.name
        try:
            # Should not raise — returns parsed result
            result = extract.parse_dat_file(tmp_path, aj_path=None)
            self.assertIsNotNone(result)
            self.assertIn("nodes", result)
        finally:
            os.unlink(tmp_path)

    def test_aj_path_nonexistent_continues(self):
        """parse_dat_file continues when AJ file doesn't exist."""
        with tempfile.NamedTemporaryFile(
            suffix=".dat", delete=False
        ) as f:
            f.write(b"\x00" * 64)
            tmp_path = f.name
        try:
            result = extract.parse_dat_file(
                tmp_path, aj_path="/nonexistent/aj.dat"
            )
            # AJ file is skipped (doesn't exist), DAT still parsed
            self.assertIsNotNone(result)
            self.assertIn("nodes", result)
        finally:
            os.unlink(tmp_path)


class TestHasMeleeDat2Json(unittest.TestCase):
    """Verify meleeDat2Json is importable."""

    def test_meleedat2json_available(self):
        """The HAS_MELEEDAT2JSON flag should be True."""
        self.assertTrue(extract.HAS_MELEEDAT2JSON)


class TestExtractAjFile(unittest.TestCase):
    """Test extract_aj_file function."""

    def test_extract_aj_file_nonexistent_iso_path(self):
        """extract_aj_file returns None when ISO read fails."""
        class MockGCM:
            def read_file(self, path):
                raise FileNotFoundError("not found")

        with tempfile.TemporaryDirectory() as tmpdir:
            result = extract.extract_aj_file(
                MockGCM(), "PlFxAJ.dat", tmpdir, "fox"
            )
            self.assertIsNone(result)


class TestProcessCharacter(unittest.TestCase):
    """Test process_character error handling."""

    def test_process_character_bad_dat_extraction(self):
        """process_character returns False when DAT extraction fails."""
        class MockGCM:
            def read_file(self, path):
                raise FileNotFoundError("not found")

        with tempfile.TemporaryDirectory() as tmpdir:
            result = extract.process_character(
                MockGCM(), "fox", "PlFx.dat", None, tmpdir
            )
            self.assertFalse(result)

    def test_process_character_saves_raw_json(self):
        """process_character writes final JSON when parsing succeeds."""
        # Create a mock GCM that returns minimal valid-ish data
        class MockGCM:
            def read_file(self, path):
                # Return 64 bytes of zeros — meleeDat2Json will parse
                # this into an empty-nodes structure
                return b"\x00" * 64

        with tempfile.TemporaryDirectory() as tmpdir:
            result = extract.process_character(
                MockGCM(), "fox", "PlFx.dat", None, tmpdir
            )
            self.assertTrue(result)
            # Verify final JSON was saved (raw JSON is cleaned up)
            final_path = os.path.join(tmpdir, "fox.json")
            self.assertTrue(
                os.path.isfile(final_path),
                f"Expected final JSON at {final_path}"
            )


class TestCharacterMappings(unittest.TestCase):
    """Test character definition constants."""

    def test_all_characters_have_dat_prefix(self):
        """Every character has a DAT prefix mapping."""
        self.assertEqual(
            len(extract.CHARACTER_DAT_PREFIX), 26
        )

    def test_all_characters_have_external_id(self):
        """Every character has an external ID mapping."""
        for name in extract.CHARACTER_DAT_PREFIX:
            self.assertIn(
                name, extract.CHARACTER_EXTERNAL_ID,
                f"Missing external ID for {name}"
            )

    def test_external_ids_are_unique(self):
        """All external character IDs are unique."""
        ids = list(extract.CHARACTER_EXTERNAL_ID.values())
        self.assertEqual(len(ids), len(set(ids)))

    def test_external_ids_range(self):
        """External IDs are in the valid range [0, 25]."""
        for name, ext_id in extract.CHARACTER_EXTERNAL_ID.items():
            self.assertGreaterEqual(ext_id, 0, f"{name} ID < 0")
            self.assertLessEqual(ext_id, 25, f"{name} ID > 25")


# ---------------------------------------------------------------------------
# Helpers for building synthetic DAT files with JOBJ trees
# ---------------------------------------------------------------------------

def _build_jobj_node(
    child_off=0, next_off=0,
    rx=0.0, ry=0.0, rz=0.0,
    sx=1.0, sy=1.0, sz=1.0,
    tx=0.0, ty=0.0, tz=0.0,
):
    """Build a 0x40-byte JOBJ binary node."""
    return struct.pack(
        ">II II I 3f 3f 3f I I",
        0,          # unknown 0x00
        0,          # flags 0x04
        child_off,  # child 0x08
        next_off,   # next 0x0C
        0,          # dobj 0x10
        rx, ry, rz,  # rotation 0x14
        sx, sy, sz,  # scale 0x20
        tx, ty, tz,  # translation 0x2C
        0,          # transform offset 0x38
        0,          # unknown 0x3C
    )


def _build_dat_file(data_block, root_name=b"Test_joint"):
    """Build a minimal DAT file with one root node."""
    data_block_size = len(data_block)
    reloc_count = 0
    root_count = 1
    root_count2 = 0

    root_node = struct.pack(">II", 0, 0)
    string_table = root_name + b"\x00"

    header_size = 0x20
    root_nodes_size = root_count * 8
    total_size = (
        header_size + data_block_size
        + root_nodes_size + len(string_table)
    )

    header = struct.pack(
        ">8I",
        total_size,
        data_block_size,
        reloc_count,
        root_count,
        root_count2,
        0, 0, 0,
    )

    return header + data_block + root_node + string_table


class TestExtractBoneTree(unittest.TestCase):
    """Test extract_bone_tree — Task 2.1."""

    def test_empty_data_returns_empty(self):
        """extract_bone_tree returns [] for garbage data."""
        result = extract.extract_bone_tree(b"\x00" * 64)
        self.assertEqual(result, [])

    def test_single_root_bone(self):
        """Single JOBJ node produces one bone at origin."""
        jobj = _build_jobj_node(tx=0.0, ty=0.0, tz=0.0)
        dat = _build_dat_file(jobj)
        bones = extract.extract_bone_tree(dat)

        self.assertEqual(len(bones), 1)
        self.assertEqual(bones[0]["id"], 0)
        self.assertEqual(bones[0]["parent"], -1)
        self.assertAlmostEqual(bones[0]["restX"], 0.0)
        self.assertAlmostEqual(bones[0]["restY"], 0.0)

    def test_parent_child_ordering(self):
        """Parent bone index is always < child bone index."""
        root = _build_jobj_node(
            child_off=0x40, tx=1.0, ty=2.0, tz=3.0
        )
        child = _build_jobj_node(tx=0.5, ty=0.5, tz=0.5)
        dat = _build_dat_file(root + child)
        bones = extract.extract_bone_tree(dat)

        self.assertEqual(len(bones), 2)
        self.assertEqual(bones[0]["id"], 0)
        self.assertEqual(bones[0]["parent"], -1)
        self.assertEqual(bones[1]["id"], 1)
        self.assertEqual(bones[1]["parent"], 0)
        self.assertLess(
            bones[1]["parent"], bones[1]["id"]
        )

    def test_world_position_accumulation(self):
        """Child world pos = parent + child translation."""
        root = _build_jobj_node(
            child_off=0x40, tx=1.0, ty=2.0, tz=3.0
        )
        child = _build_jobj_node(tx=0.5, ty=0.5, tz=0.5)
        dat = _build_dat_file(root + child)
        bones = extract.extract_bone_tree(dat)

        self.assertEqual(len(bones), 2)
        self.assertAlmostEqual(bones[0]["restX"], 3.0)
        self.assertAlmostEqual(bones[0]["restY"], 2.0)
        self.assertAlmostEqual(bones[1]["restX"], 3.5)
        self.assertAlmostEqual(bones[1]["restY"], 2.5)

    def test_sibling_bones(self):
        """Sibling bones share the same parent."""
        root = _build_jobj_node(
            child_off=0x40, tx=0.0, ty=5.0, tz=0.0
        )
        child1 = _build_jobj_node(
            next_off=0x80, tx=1.0, ty=0.0, tz=0.0
        )
        child2 = _build_jobj_node(
            tx=2.0, ty=0.0, tz=0.0
        )
        dat = _build_dat_file(root + child1 + child2)
        bones = extract.extract_bone_tree(dat)

        self.assertEqual(len(bones), 3)
        self.assertEqual(bones[1]["parent"], 0)
        self.assertEqual(bones[2]["parent"], 0)
        for bone in bones:
            if bone["parent"] != -1:
                self.assertLess(
                    bone["parent"], bone["id"]
                )

    def test_deep_hierarchy(self):
        """Three-level hierarchy maintains ordering."""
        root = _build_jobj_node(
            child_off=0x40, tx=0.0, ty=1.0, tz=0.0
        )
        child = _build_jobj_node(
            child_off=0x80, tx=0.0, ty=2.0, tz=0.0
        )
        grandchild = _build_jobj_node(
            tx=0.0, ty=3.0, tz=0.0
        )
        dat = _build_dat_file(root + child + grandchild)
        bones = extract.extract_bone_tree(dat)

        self.assertEqual(len(bones), 3)
        self.assertEqual(bones[0]["parent"], -1)
        self.assertEqual(bones[1]["parent"], 0)
        self.assertEqual(bones[2]["parent"], 1)
        self.assertAlmostEqual(bones[2]["restY"], 6.0)

    def test_root_bone_has_parent_minus_one(self):
        """Root bone (index 0) always has parent = -1."""
        jobj = _build_jobj_node(
            tx=5.0, ty=10.0, tz=15.0
        )
        dat = _build_dat_file(jobj)
        bones = extract.extract_bone_tree(dat)

        self.assertEqual(len(bones), 1)
        self.assertEqual(bones[0]["parent"], -1)

    def test_no_joint_root_returns_list(self):
        """DAT without _joint root returns a list (no crash)."""
        jobj = _build_jobj_node()
        dat = _build_dat_file(
            jobj, root_name=b"ftDataFox"
        )
        bones = extract.extract_bone_tree(dat)
        self.assertIsInstance(bones, list)

    def test_2d_projection_z_to_x(self):
        """restX uses the Z component of world position."""
        jobj = _build_jobj_node(
            tx=99.0, ty=0.0, tz=42.0
        )
        dat = _build_dat_file(jobj)
        bones = extract.extract_bone_tree(dat)
        self.assertAlmostEqual(bones[0]["restX"], 42.0)

    def test_2d_projection_y_to_y(self):
        """restY uses the Y component of world position."""
        jobj = _build_jobj_node(
            tx=0.0, ty=7.5, tz=0.0
        )
        dat = _build_dat_file(jobj)
        bones = extract.extract_bone_tree(dat)
        self.assertAlmostEqual(bones[0]["restY"], 7.5)


class TestParseJobjNode(unittest.TestCase):
    """Test _parse_jobj_node helper."""

    def test_parse_valid_node(self):
        """Parses translation, rotation, scale correctly."""
        jobj = _build_jobj_node(
            rx=0.1, ry=0.2, rz=0.3,
            sx=1.0, sy=1.0, sz=1.0,
            tx=4.0, ty=5.0, tz=6.0,
        )
        node = extract._parse_jobj_node(jobj, 0)
        self.assertIsNotNone(node)
        self.assertAlmostEqual(
            node["translation"][0], 4.0
        )
        self.assertAlmostEqual(
            node["translation"][1], 5.0
        )
        self.assertAlmostEqual(
            node["translation"][2], 6.0
        )
        self.assertAlmostEqual(
            node["rotation"][0], 0.1, places=5
        )
        self.assertAlmostEqual(node["scale"][0], 1.0)

    def test_parse_too_short_returns_none(self):
        """Returns None if data too short for a JOBJ."""
        result = extract._parse_jobj_node(
            b"\x00" * 10, 0
        )
        self.assertIsNone(result)


class TestValidateJson(unittest.TestCase):
    """Test the --validate mode."""

    def test_validate_valid_json(self):
        """validate_json passes for a well-formed character JSON."""
        import json
        valid_data = {
            "character": "test",
            "internalId": 0,
            "scale": 1.0,
            "bones": [
                {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
                {"id": 1, "parent": 0, "restX": 1.0, "restY": 2.0},
            ],
            "subactions": {
                "44": {
                    "name": "Attack11",
                    "totalFrames": 30,
                    "boneFrames": {
                        "0": {"0": [0.0, 0.0], "1": [1.0, 2.0]},
                        "5": {"0": [0.0, 0.0], "1": [1.5, 2.5]},
                    },
                    "hitboxes": [
                        {
                            "id": 0, "bone": 1,
                            "x": 0.0, "y": 0.0, "z": 2.5,
                            "size": 3.2, "damage": 7,
                            "angle": 80, "kbg": 100,
                            "bkb": 0, "setKb": 0,
                            "element": 0,
                            "startFrame": 2, "endFrame": 5,
                        }
                    ],
                }
            },
            "hurtboxes": [
                {
                    "bone": 0, "x": 0.0, "y": 0.0, "z": 0.0,
                    "sizeX": 2.0, "sizeY": 3.5, "zone": "mid",
                }
            ],
            "actionStateMap": {},
        }
        with tempfile.NamedTemporaryFile(
            suffix=".json", mode="w", delete=False
        ) as f:
            json.dump(valid_data, f)
            tmp_path = f.name
        try:
            self.assertTrue(extract.validate_json(tmp_path))
        finally:
            os.unlink(tmp_path)

    def test_validate_bad_bone_ordering(self):
        """validate_json fails when bone parent >= bone id."""
        import json
        bad_data = {
            "character": "test",
            "bones": [
                {"id": 0, "parent": -1},
                {"id": 1, "parent": 2},  # parent 2 >= id 1
            ],
            "subactions": {},
            "hurtboxes": [],
        }
        with tempfile.NamedTemporaryFile(
            suffix=".json", mode="w", delete=False
        ) as f:
            json.dump(bad_data, f)
            tmp_path = f.name
        try:
            self.assertFalse(extract.validate_json(tmp_path))
        finally:
            os.unlink(tmp_path)

    def test_validate_nonexistent_file(self):
        """validate_json fails for a file that doesn't exist."""
        self.assertFalse(
            extract.validate_json("/nonexistent/file.json")
        )


if __name__ == "__main__":
    unittest.main()


# ---------------------------------------------------------------------------
# Helpers for building synthetic meleeDat2Json event data
# ---------------------------------------------------------------------------

def _make_event(name, fields=None):
    """Build a synthetic meleeDat2Json event dict."""
    event = {"commandId": "0x00", "name": name, "length": 4}
    if fields:
        event["fields"] = fields
    return event


def _make_hitbox_event(
    hb_id=0, bone=11, damage=7, size=816,
    x=0, y=0, z=638,
    angle=80, kbGrowth=100, baseKb=0, weightDepKb=0,
    element="normal",
):
    """Build a synthetic hitbox event matching meleeDat2Json output.

    Note: meleeDat2Json divides size/x/y/z by 255 in postProcessHitboxEvent,
    so the values here should already be the post-processed floats.
    """
    return _make_event("hitbox", {
        "id": hb_id,
        "bone": bone,
        "damage": damage,
        "size": size / 255,  # simulate post-processing
        "x": x / 255,
        "y": y / 255,
        "z": z / 255,
        "angle": angle,
        "kbGrowth": kbGrowth,
        "baseKb": baseKb,
        "weightDepKb": weightDepKb,
        "element": element,
        "hitboxInteraction": 0,
        "shieldDamage": 0,
        "sfx": 0,
        "hitGrounded": True,
        "hitAirborne": True,
    })


def _make_raw_json(subactions):
    """Build a minimal meleeDat2Json raw JSON dict with given subactions."""
    return {
        "nodes": [{
            "name": "ftDataFox",
            "rootOffset": 0,
            "data": {
                "attributesOffset": 0,
                "attributes": [],
                "subactionsOffset": 0,
                "subactions": subactions,
                "subroutines": {},
            },
        }],
    }


class TestExtractHitboxes(unittest.TestCase):
    """Test extract_hitboxes — Task 2.2."""

    def test_empty_raw_json(self):
        """extract_hitboxes returns empty dict for empty input."""
        result = extract.extract_hitboxes({"nodes": []})
        self.assertEqual(result, {})

    def test_no_ftdata_node(self):
        """extract_hitboxes returns empty dict when no ftData node exists."""
        raw = {"nodes": [{"name": "SomeOtherNode", "data": {}}]}
        result = extract.extract_hitboxes(raw)
        self.assertEqual(result, {})

    def test_subaction_with_no_events(self):
        """Subaction with no events produces no hitboxes."""
        raw = _make_raw_json([{
            "shortName": "Wait",
            "name": "Wait",
            "events": [],
        }])
        result = extract.extract_hitboxes(raw)
        self.assertEqual(result, {})

    def test_single_hitbox_with_timing(self):
        """Single hitbox with waitFor timing produces correct frame range."""
        events = [
            _make_event("waitFor", {"frames": 2}),
            _make_hitbox_event(hb_id=0, bone=11, damage=7, size=816, z=638),
            _make_event("waitFor", {"frames": 4}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "Attack11",
            "name": "ACTION_Attack11_figatree",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)

        self.assertIn(0, result)
        sub = result[0]
        self.assertEqual(sub["name"], "Attack11")
        self.assertEqual(len(sub["hitboxes"]), 1)

        hb = sub["hitboxes"][0]
        self.assertEqual(hb["id"], 0)
        self.assertEqual(hb["bone"], 11)
        self.assertEqual(hb["damage"], 7)
        self.assertAlmostEqual(hb["size"], 816 / 255, places=3)
        self.assertAlmostEqual(hb["z"], 638 / 255, places=3)
        self.assertEqual(hb["angle"], 80)
        self.assertEqual(hb["kbg"], 100)
        self.assertEqual(hb["bkb"], 0)
        self.assertEqual(hb["setKb"], 0)
        self.assertEqual(hb["startFrame"], 2)
        self.assertEqual(hb["endFrame"], 5)

    def test_multiple_hitboxes_same_frame(self):
        """Multiple hitboxes created on the same frame."""
        events = [
            _make_event("waitFor", {"frames": 3}),
            _make_hitbox_event(hb_id=0, bone=11, damage=10, size=510),
            _make_hitbox_event(hb_id=1, bone=12, damage=8, size=408),
            _make_hitbox_event(hb_id=2, bone=13, damage=6, size=306),
            _make_event("waitFor", {"frames": 3}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "AttackS3",
            "name": "ACTION_AttackS3_figatree",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)

        self.assertIn(0, result)
        hitboxes = result[0]["hitboxes"]
        self.assertEqual(len(hitboxes), 3)

        for hb in hitboxes:
            self.assertEqual(hb["startFrame"], 3)
            self.assertEqual(hb["endFrame"], 5)

        ids = {hb["id"] for hb in hitboxes}
        self.assertEqual(ids, {0, 1, 2})

    def test_hitbox_removed_by_endOneCollision(self):
        """endOneCollision removes only the specified hitbox."""
        events = [
            _make_event("waitFor", {"frames": 2}),
            _make_hitbox_event(hb_id=0, bone=11, damage=10, size=510),
            _make_hitbox_event(hb_id=1, bone=12, damage=8, size=408),
            _make_event("waitFor", {"frames": 3}),
            _make_event("endOneCollision", {"hitboxId": 0}),
            _make_event("waitFor", {"frames": 2}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "AttackHi3",
            "name": "ACTION_AttackHi3_figatree",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)

        hitboxes = result[0]["hitboxes"]
        self.assertEqual(len(hitboxes), 2)

        hb0 = next(h for h in hitboxes if h["id"] == 0)
        hb1 = next(h for h in hitboxes if h["id"] == 1)

        # Hitbox 0: created at frame 2, removed at frame 5 (endOneCollision)
        self.assertEqual(hb0["startFrame"], 2)
        self.assertEqual(hb0["endFrame"], 4)

        # Hitbox 1: created at frame 2, removed at frame 7 (endAllCollisions)
        self.assertEqual(hb1["startFrame"], 2)
        self.assertEqual(hb1["endFrame"], 6)

    def test_hitbox_replaced_same_id(self):
        """Hitbox with same ID replaces the previous one."""
        events = [
            _make_event("waitFor", {"frames": 2}),
            _make_hitbox_event(hb_id=0, bone=11, damage=10, size=510),
            _make_event("waitFor", {"frames": 3}),
            _make_hitbox_event(hb_id=0, bone=11, damage=14, size=612),
            _make_event("waitFor", {"frames": 2}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "AttackS4",
            "name": "ACTION_AttackS4_figatree",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)

        hitboxes = result[0]["hitboxes"]
        self.assertEqual(len(hitboxes), 2)

        # First hitbox: frame 2-4 (replaced at frame 5)
        first = [h for h in hitboxes if h["damage"] == 10][0]
        self.assertEqual(first["startFrame"], 2)
        self.assertEqual(first["endFrame"], 4)

        # Second hitbox: frame 5-6 (endAllCollisions at frame 7)
        second = [h for h in hitboxes if h["damage"] == 14][0]
        self.assertEqual(second["startFrame"], 5)
        self.assertEqual(second["endFrame"], 6)

    def test_waitUntil_timing(self):
        """waitUntil sets the frame counter to an absolute value."""
        events = [
            _make_event("waitUntil", {"frame": 5}),
            _make_hitbox_event(hb_id=0, bone=11, damage=7, size=510),
            _make_event("waitFor", {"frames": 3}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "AttackLw3",
            "name": "ACTION_AttackLw3_figatree",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)

        hb = result[0]["hitboxes"][0]
        self.assertEqual(hb["startFrame"], 5)
        self.assertEqual(hb["endFrame"], 7)

    def test_exit_closes_active_hitboxes(self):
        """Exit event closes any remaining active hitboxes."""
        events = [
            _make_event("waitFor", {"frames": 2}),
            _make_hitbox_event(hb_id=0, bone=11, damage=7, size=510),
            _make_event("waitFor", {"frames": 3}),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "AttackAirF",
            "name": "ACTION_AttackAirF_figatree",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)

        hb = result[0]["hitboxes"][0]
        self.assertEqual(hb["startFrame"], 2)
        self.assertEqual(hb["endFrame"], 4)

    def test_no_exit_event_closes_hitboxes(self):
        """Hitboxes still active at end of event list are closed."""
        events = [
            _make_event("waitFor", {"frames": 1}),
            _make_hitbox_event(hb_id=0, bone=11, damage=7, size=510),
            _make_event("waitFor", {"frames": 4}),
        ]
        raw = _make_raw_json([{
            "shortName": "AttackAirN",
            "name": "ACTION_AttackAirN_figatree",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)

        hb = result[0]["hitboxes"][0]
        self.assertEqual(hb["startFrame"], 1)
        self.assertEqual(hb["endFrame"], 5)

    def test_zero_size_hitbox_filtered(self):
        """Hitboxes with size <= 0 are filtered out."""
        events = [
            _make_event("waitFor", {"frames": 2}),
            _make_hitbox_event(hb_id=0, bone=11, damage=7, size=0),
            _make_event("waitFor", {"frames": 3}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "Test",
            "name": "Test",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)
        # No valid hitboxes, so subaction not included
        self.assertEqual(result, {})

    def test_element_string_to_int(self):
        """Element strings from meleeDat2Json are converted to ints."""
        events = [
            _make_event("waitFor", {"frames": 1}),
            _make_hitbox_event(hb_id=0, bone=11, damage=7, size=510, element="fire"),
            _make_event("waitFor", {"frames": 2}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "SpecialN",
            "name": "ACTION_SpecialN_figatree",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)

        hb = result[0]["hitboxes"][0]
        self.assertEqual(hb["element"], 1)  # fire = 1

    def test_multiple_subactions(self):
        """extract_hitboxes processes multiple subactions correctly."""
        sub0_events = [
            _make_event("waitFor", {"frames": 1}),
            _make_hitbox_event(hb_id=0, bone=11, damage=5, size=510),
            _make_event("waitFor", {"frames": 2}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        sub1_events = []  # No hitboxes
        sub2_events = [
            _make_event("waitFor", {"frames": 3}),
            _make_hitbox_event(hb_id=0, bone=12, damage=12, size=612),
            _make_event("waitFor", {"frames": 4}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        raw = _make_raw_json([
            {"shortName": "Attack11", "name": "Attack11", "events": sub0_events},
            {"shortName": "Wait", "name": "Wait", "events": sub1_events},
            {"shortName": "AttackS3", "name": "AttackS3", "events": sub2_events},
        ])
        result = extract.extract_hitboxes(raw)

        # Only subactions 0 and 2 should be present (1 has no hitboxes)
        self.assertIn(0, result)
        self.assertNotIn(1, result)
        self.assertIn(2, result)

        self.assertEqual(result[0]["name"], "Attack11")
        self.assertEqual(result[2]["name"], "AttackS3")

    def test_total_frames_computed(self):
        """totalFrames is computed from timing events."""
        events = [
            _make_event("waitFor", {"frames": 2}),
            _make_hitbox_event(hb_id=0, bone=11, damage=7, size=510),
            _make_event("waitFor", {"frames": 4}),
            _make_event("endAllCollisions"),
            _make_event("waitFor", {"frames": 10}),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "Test",
            "name": "Test",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)

        # Total frames: waitFor(2) + waitFor(4) + waitFor(10) = 16, +1 = 17
        self.assertEqual(result[0]["totalFrames"], 17)

    def test_hitbox_output_schema(self):
        """Hitbox output matches the expected JSON schema fields."""
        events = [
            _make_event("waitFor", {"frames": 2}),
            _make_hitbox_event(
                hb_id=0, bone=11, damage=7, size=816,
                x=0, y=0, z=638,
                angle=80, kbGrowth=100, baseKb=0, weightDepKb=0,
                element="normal",
            ),
            _make_event("waitFor", {"frames": 4}),
            _make_event("endAllCollisions"),
            _make_event("exit"),
        ]
        raw = _make_raw_json([{
            "shortName": "Attack11",
            "name": "Attack11",
            "events": events,
        }])
        result = extract.extract_hitboxes(raw)
        hb = result[0]["hitboxes"][0]

        expected_keys = {
            "id", "bone", "x", "y", "z", "size",
            "damage", "angle", "kbg", "bkb", "setKb",
            "element", "startFrame", "endFrame",
        }
        self.assertEqual(set(hb.keys()), expected_keys)


class TestElementToInt(unittest.TestCase):
    """Test _element_to_int helper."""

    def test_string_elements(self):
        self.assertEqual(extract._element_to_int("normal"), 0)
        self.assertEqual(extract._element_to_int("fire"), 1)
        self.assertEqual(extract._element_to_int("electric"), 2)
        self.assertEqual(extract._element_to_int("darkness"), 13)

    def test_int_passthrough(self):
        self.assertEqual(extract._element_to_int(0), 0)
        self.assertEqual(extract._element_to_int(5), 5)

    def test_unknown_string_defaults_to_zero(self):
        self.assertEqual(extract._element_to_int("unknown_element"), 0)


# ---------------------------------------------------------------------------
# Helpers for building synthetic DAT files with hurtbox data
# ---------------------------------------------------------------------------

def _build_hurtbox_entry(bone=0, x=0.0, y=0.0, z=0.0, size_x=2.0, size_y=3.5):
    """Build a single 0x18-byte hurtbox entry."""
    return struct.pack(">I5f", bone, x, y, z, size_x, size_y)


def _build_ftdata_dat_with_hurtboxes(hurtbox_entries_bytes, jobj_data=None):
    """Build a minimal DAT file with an ftData root and hurtbox data.

    Layout:
      - ftData header (0x18 bytes): attributes/subactions offsets (all zero)
      - Padding to align hurtbox data
      - Hurtbox entries
      - Optionally a JOBJ tree for bone data

    The ftData root is placed at offset 0 in the data block.
    Hurtbox entries are placed after the ftData header.
    """
    # ftData header: 6 uint32 values (attributesOff, attributesEnd,
    # unknown1, subactionsOff, unknown2, subactionsEnd)
    # All zeros means no attributes and no subactions
    ftdata_header = struct.pack(">6I", 0, 0, 0, 0, 0, 0)

    # Place hurtbox data right after the ftData header
    data_block = ftdata_header + hurtbox_entries_bytes

    if jobj_data:
        data_block += jobj_data

    data_block_size = len(data_block)
    reloc_count = 0
    root_count = 1
    root_count2 = 0

    # Root node entry: (root_offset=0, string_offset=0)
    root_node = struct.pack(">II", 0, 0)
    string_table = b"ftDataTest\x00"

    header = struct.pack(
        ">8I",
        0x20 + data_block_size + len(root_node) + len(string_table),
        data_block_size,
        reloc_count,
        root_count,
        root_count2,
        0, 0, 0,
    )

    return header + data_block + root_node + string_table


class TestExtractHurtboxes(unittest.TestCase):
    """Test extract_hurtboxes — Task 2.3."""

    def test_empty_data_returns_empty(self):
        """extract_hurtboxes returns [] for too-small data."""
        result = extract.extract_hurtboxes(b"\x00" * 10)
        self.assertEqual(result, [])

    def test_no_ftdata_returns_empty(self):
        """extract_hurtboxes returns [] when no ftData root exists."""
        # Build a DAT with a non-ftData root
        jobj = _build_jobj_node()
        dat = _build_dat_file(jobj, root_name=b"SomeOther")
        result = extract.extract_hurtboxes(dat)
        self.assertEqual(result, [])

    def test_single_hurtbox(self):
        """Extracts a single valid hurtbox entry."""
        # Build 6 hurtbox entries (minimum 5 needed for detection)
        entries = b""
        for i in range(6):
            entries += _build_hurtbox_entry(
                bone=i, x=0.0, y=float(i), z=0.0,
                size_x=2.0, size_y=3.5,
            )
        dat = _build_ftdata_dat_with_hurtboxes(entries)
        bones = [{"id": i, "parent": max(-1, i - 1), "restX": 0.0, "restY": float(i * 2)}
                 for i in range(6)]
        result = extract.extract_hurtboxes(dat, bones)

        self.assertGreaterEqual(len(result), 5)
        for hb in result:
            self.assertIn("bone", hb)
            self.assertIn("x", hb)
            self.assertIn("y", hb)
            self.assertIn("z", hb)
            self.assertIn("sizeX", hb)
            self.assertIn("sizeY", hb)
            self.assertIn("zone", hb)

    def test_hurtbox_schema_fields(self):
        """Each hurtbox has the expected JSON schema fields."""
        entries = b""
        for i in range(6):
            entries += _build_hurtbox_entry(
                bone=i, x=1.0, y=2.0, z=3.0,
                size_x=4.0, size_y=5.0,
            )
        dat = _build_ftdata_dat_with_hurtboxes(entries)
        bones = [{"id": i, "parent": max(-1, i - 1), "restX": 0.0, "restY": 0.0}
                 for i in range(6)]
        result = extract.extract_hurtboxes(dat, bones)

        self.assertTrue(len(result) > 0)
        expected_keys = {"bone", "x", "y", "z", "sizeX", "sizeY", "zone"}
        for hb in result:
            self.assertEqual(set(hb.keys()), expected_keys)

    def test_hurtbox_values_extracted_correctly(self):
        """Hurtbox offset and size values are extracted correctly."""
        entries = b""
        for i in range(6):
            entries += _build_hurtbox_entry(
                bone=0, x=1.5, y=2.5, z=3.5,
                size_x=4.0, size_y=5.0,
            )
        dat = _build_ftdata_dat_with_hurtboxes(entries)
        bones = [{"id": 0, "parent": -1, "restX": 0.0, "restY": 5.0}]
        result = extract.extract_hurtboxes(dat, bones)

        self.assertTrue(len(result) > 0)
        hb = result[0]
        self.assertEqual(hb["bone"], 0)
        self.assertAlmostEqual(hb["x"], 1.5, places=3)
        self.assertAlmostEqual(hb["y"], 2.5, places=3)
        self.assertAlmostEqual(hb["z"], 3.5, places=3)
        self.assertAlmostEqual(hb["sizeX"], 4.0, places=3)
        self.assertAlmostEqual(hb["sizeY"], 5.0, places=3)

    def test_invalid_bone_filtered(self):
        """Hurtboxes with bone IDs not in the bone tree are filtered."""
        entries = b""
        # 3 entries with valid bone 0, 3 with invalid bone 99
        for i in range(3):
            entries += _build_hurtbox_entry(bone=0, size_x=2.0, size_y=3.0)
        for i in range(3):
            entries += _build_hurtbox_entry(bone=99, size_x=2.0, size_y=3.0)
        # Need at least 5 consecutive valid entries for detection,
        # so this may not find a table. Let's make all 6 have bone=0
        entries = b""
        for i in range(6):
            entries += _build_hurtbox_entry(bone=0, size_x=2.0, size_y=3.0)
        # Add some with invalid bone after
        entries += _build_hurtbox_entry(bone=99, size_x=2.0, size_y=3.0)

        dat = _build_ftdata_dat_with_hurtboxes(entries)
        bones = [{"id": 0, "parent": -1, "restX": 0.0, "restY": 5.0}]
        result = extract.extract_hurtboxes(dat, bones)

        # All returned hurtboxes should have valid bone IDs
        for hb in result:
            self.assertEqual(hb["bone"], 0)

    def test_zone_classification(self):
        """Hurtbox zones are classified based on bone Y position."""
        entries = b""
        # Bone 0 at Y=0 (low), bone 1 at Y=5 (mid), bone 2 at Y=10 (high)
        for bone_id in range(3):
            entries += _build_hurtbox_entry(
                bone=bone_id, size_x=2.0, size_y=3.0,
            )
        # Pad to 6 entries minimum
        for bone_id in range(3):
            entries += _build_hurtbox_entry(
                bone=bone_id, size_x=2.0, size_y=3.0,
            )

        dat = _build_ftdata_dat_with_hurtboxes(entries)
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 1, "parent": 0, "restX": 0.0, "restY": 5.0},
            {"id": 2, "parent": 1, "restX": 0.0, "restY": 10.0},
        ]
        result = extract.extract_hurtboxes(dat, bones)

        self.assertTrue(len(result) > 0)
        # Check that zones are assigned
        zones = {hb["zone"] for hb in result}
        self.assertTrue(zones.issubset({"high", "mid", "low"}))

    def test_no_bones_defaults_to_mid(self):
        """Without bone data, all zones default to 'mid'."""
        entries = b""
        for i in range(6):
            entries += _build_hurtbox_entry(
                bone=i, size_x=2.0, size_y=3.0,
            )
        dat = _build_ftdata_dat_with_hurtboxes(entries)
        # No bones provided — no bone validation, zones default to "mid"
        result = extract.extract_hurtboxes(dat, bones=None)

        # Without bones, bone validation is skipped
        for hb in result:
            self.assertEqual(hb["zone"], "mid")

    def test_negative_size_filtered(self):
        """Hurtbox entries with negative sizes are not included."""
        entries = b""
        # 6 valid entries
        for i in range(6):
            entries += _build_hurtbox_entry(
                bone=0, size_x=2.0, size_y=3.0,
            )
        # 1 entry with negative size — should break the scan
        entries += _build_hurtbox_entry(bone=0, size_x=-1.0, size_y=3.0)

        dat = _build_ftdata_dat_with_hurtboxes(entries)
        bones = [{"id": 0, "parent": -1, "restX": 0.0, "restY": 5.0}]
        result = extract.extract_hurtboxes(dat, bones)

        # Should find the 6 valid entries, not the negative one
        for hb in result:
            self.assertGreater(hb["sizeX"], 0)


class TestParseHurtboxEntry(unittest.TestCase):
    """Test _parse_hurtbox_entry helper."""

    def test_valid_entry(self):
        """Parses a valid hurtbox entry correctly."""
        data = _build_hurtbox_entry(
            bone=3, x=1.0, y=2.0, z=3.0,
            size_x=4.0, size_y=5.0,
        )
        result = extract._parse_hurtbox_entry(data, 0)
        self.assertIsNotNone(result)
        self.assertEqual(result["bone"], 3)
        self.assertAlmostEqual(result["x"], 1.0)
        self.assertAlmostEqual(result["y"], 2.0)
        self.assertAlmostEqual(result["z"], 3.0)
        self.assertAlmostEqual(result["sizeX"], 4.0)
        self.assertAlmostEqual(result["sizeY"], 5.0)

    def test_too_short_returns_none(self):
        """Returns None if data is too short."""
        result = extract._parse_hurtbox_entry(b"\x00" * 10, 0)
        self.assertIsNone(result)

    def test_huge_bone_id_returns_none(self):
        """Returns None if bone ID is unreasonably large."""
        data = struct.pack(">I5f", 999, 0.0, 0.0, 0.0, 2.0, 3.0)
        result = extract._parse_hurtbox_entry(data, 0)
        self.assertIsNone(result)

    def test_negative_size_returns_none(self):
        """Returns None if size is negative."""
        data = struct.pack(">I5f", 0, 0.0, 0.0, 0.0, -1.0, 3.0)
        result = extract._parse_hurtbox_entry(data, 0)
        self.assertIsNone(result)


class TestClassifyHurtboxZone(unittest.TestCase):
    """Test _classify_hurtbox_zone helper."""

    def test_no_bones_returns_mid(self):
        """Returns 'mid' when no bone data is available."""
        self.assertEqual(extract._classify_hurtbox_zone(0, []), "mid")
        self.assertEqual(extract._classify_hurtbox_zone(0, None), "mid")

    def test_high_zone(self):
        """Bone in top third classified as 'high'."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 1, "parent": 0, "restX": 0.0, "restY": 5.0},
            {"id": 2, "parent": 1, "restX": 0.0, "restY": 10.0},
        ]
        self.assertEqual(extract._classify_hurtbox_zone(2, bones), "high")

    def test_mid_zone(self):
        """Bone in middle third classified as 'mid'."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 1, "parent": 0, "restX": 0.0, "restY": 5.0},
            {"id": 2, "parent": 1, "restX": 0.0, "restY": 10.0},
        ]
        self.assertEqual(extract._classify_hurtbox_zone(1, bones), "mid")

    def test_low_zone(self):
        """Bone in bottom third classified as 'low'."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 1, "parent": 0, "restX": 0.0, "restY": 5.0},
            {"id": 2, "parent": 1, "restX": 0.0, "restY": 10.0},
        ]
        self.assertEqual(extract._classify_hurtbox_zone(0, bones), "low")

    def test_unknown_bone_returns_mid(self):
        """Returns 'mid' when bone ID is not in the bone list."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 5.0},
        ]
        self.assertEqual(extract._classify_hurtbox_zone(99, bones), "mid")

    def test_zero_height_returns_mid(self):
        """Returns 'mid' when all bones are at the same Y position."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 5.0},
            {"id": 1, "parent": 0, "restX": 0.0, "restY": 5.0},
        ]
        self.assertEqual(extract._classify_hurtbox_zone(0, bones), "mid")


class TestFindFtdataOffset(unittest.TestCase):
    """Test _find_ftdata_offset helper."""

    def test_finds_ftdata_root(self):
        """Finds the ftData root offset in a valid DAT file."""
        entries = b""
        for i in range(6):
            entries += _build_hurtbox_entry(bone=i, size_x=2.0, size_y=3.0)
        dat = _build_ftdata_dat_with_hurtboxes(entries)
        data_block, offset = extract._find_ftdata_offset(dat)
        self.assertIsNotNone(data_block)
        self.assertEqual(offset, 0)

    def test_no_ftdata_returns_none(self):
        """Returns (None, None) when no ftData root exists."""
        jobj = _build_jobj_node()
        dat = _build_dat_file(jobj, root_name=b"SomeOther")
        data_block, offset = extract._find_ftdata_offset(dat)
        self.assertIsNone(data_block)
        self.assertIsNone(offset)

    def test_too_small_returns_none(self):
        """Returns (None, None) for data smaller than header."""
        data_block, offset = extract._find_ftdata_offset(b"\x00" * 10)
        self.assertIsNone(data_block)
        self.assertIsNone(offset)


# ---------------------------------------------------------------------------
# Tests for extract_animations — Task 2.4
# ---------------------------------------------------------------------------

class TestGetReferencedBoneIds(unittest.TestCase):
    """Test _get_referenced_bone_ids helper."""

    def test_empty_inputs(self):
        """Returns empty set for empty hitbox_data and hurtboxes."""
        result = extract._get_referenced_bone_ids({}, [])
        self.assertEqual(result, set())

    def test_hitbox_bones_collected(self):
        """Collects bone IDs from hitbox data."""
        hitbox_data = {
            0: {"hitboxes": [{"bone": 3}, {"bone": 11}]},
            1: {"hitboxes": [{"bone": 5}]},
        }
        result = extract._get_referenced_bone_ids(hitbox_data, [])
        self.assertEqual(result, {3, 5, 11})

    def test_hurtbox_bones_collected(self):
        """Collects bone IDs from hurtboxes."""
        hurtboxes = [{"bone": 0}, {"bone": 7}, {"bone": 12}]
        result = extract._get_referenced_bone_ids({}, hurtboxes)
        self.assertEqual(result, {0, 7, 12})

    def test_combined_hitbox_and_hurtbox(self):
        """Collects bone IDs from both hitboxes and hurtboxes."""
        hitbox_data = {0: {"hitboxes": [{"bone": 3}]}}
        hurtboxes = [{"bone": 7}]
        result = extract._get_referenced_bone_ids(hitbox_data, hurtboxes)
        self.assertEqual(result, {3, 7})

    def test_none_hurtboxes(self):
        """Handles None hurtboxes gracefully."""
        hitbox_data = {0: {"hitboxes": [{"bone": 5}]}}
        result = extract._get_referenced_bone_ids(hitbox_data, None)
        self.assertEqual(result, {5})


class TestBuildRestPoseFrame(unittest.TestCase):
    """Test _build_rest_pose_frame helper."""

    def test_empty_bones(self):
        """Returns empty dict for empty bones list."""
        result = extract._build_rest_pose_frame([], {0})
        self.assertEqual(result, {})

    def test_filters_to_referenced_bones(self):
        """Only includes bones in the referenced set."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 1, "parent": 0, "restX": 1.0, "restY": 2.0},
            {"id": 2, "parent": 0, "restX": 3.0, "restY": 4.0},
        ]
        result = extract._build_rest_pose_frame(bones, {0, 2})
        self.assertEqual(len(result), 2)
        self.assertIn("0", result)
        self.assertIn("2", result)
        self.assertNotIn("1", result)

    def test_position_values(self):
        """Rest-pose positions are [restX, restY]."""
        bones = [
            {"id": 5, "parent": 0, "restX": 3.5, "restY": 7.2},
        ]
        result = extract._build_rest_pose_frame(bones, {5})
        self.assertEqual(result["5"], [3.5, 7.2])


class TestGetAnimNumFrames(unittest.TestCase):
    """Test _get_anim_num_frames helper."""

    def test_no_animation_data(self):
        """Returns None when no animation files exist."""
        raw = _make_raw_json([{
            "shortName": "Attack11",
            "name": "Attack11",
            "events": [],
        }])
        result = extract._get_anim_num_frames(raw, 0)
        self.assertIsNone(result)

    def test_with_animation_file(self):
        """Returns numFrames from FigaTree animation data."""
        raw = _make_raw_json([{
            "shortName": "Attack11",
            "name": "Attack11",
            "events": [],
        }])
        # Add animationFile reference to the subaction
        raw["nodes"][0]["data"]["subactions"][0]["animationFile"] = 0
        # Add the animation file with FigaTree data
        raw["animationFiles"] = [{
            "nodes": [{
                "name": "Attack11_figatree",
                "data": {
                    "numFrames": 30,
                    "boneTableOffset": 0,
                    "animDataOffset": 0,
                },
            }],
        }]
        result = extract._get_anim_num_frames(raw, 0)
        self.assertEqual(result, 30)

    def test_invalid_subaction_index(self):
        """Returns None for out-of-range subaction index."""
        raw = _make_raw_json([{
            "shortName": "Attack11",
            "name": "Attack11",
            "events": [],
        }])
        result = extract._get_anim_num_frames(raw, 99)
        self.assertIsNone(result)

    def test_no_ftdata_node(self):
        """Returns None when no ftData node exists."""
        raw = {"nodes": []}
        result = extract._get_anim_num_frames(raw, 0)
        self.assertIsNone(result)


class TestExtractAnimations(unittest.TestCase):
    """Test extract_animations — Task 2.4."""

    def test_empty_bones_returns_empty(self):
        """Returns empty dict when bones list is empty."""
        raw = _make_raw_json([])
        result = extract.extract_animations(raw, [], {})
        self.assertEqual(result, {})

    def test_empty_hitbox_data_returns_empty(self):
        """Returns empty dict when hitbox_data is empty."""
        bones = [{"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0}]
        raw = _make_raw_json([])
        result = extract.extract_animations(raw, bones, {})
        self.assertEqual(result, {})

    def test_rest_pose_keyframe_at_frame_zero(self):
        """Produces boneFrames with rest-pose at frame 0."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 11, "parent": 0, "restX": 4.1, "restY": 4.8},
        ]
        hitbox_data = {
            0: {
                "name": "Attack11",
                "totalFrames": 30,
                "hitboxes": [{"bone": 11, "id": 0}],
            },
        }
        raw = _make_raw_json([])
        result = extract.extract_animations(raw, bones, hitbox_data)

        self.assertIn(0, result)
        bone_frames = result[0]["boneFrames"]
        self.assertIn("0", bone_frames)
        # Bone 11 should be in frame 0
        self.assertIn("11", bone_frames["0"])
        self.assertEqual(bone_frames["0"]["11"], [4.1, 4.8])

    def test_only_referenced_bones_included(self):
        """Only bones referenced by hitboxes/hurtboxes are in boneFrames."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 1, "parent": 0, "restX": 1.0, "restY": 2.0},
            {"id": 2, "parent": 0, "restX": 3.0, "restY": 4.0},
            {"id": 3, "parent": 0, "restX": 5.0, "restY": 6.0},
        ]
        hitbox_data = {
            0: {
                "name": "Attack11",
                "totalFrames": 10,
                "hitboxes": [{"bone": 1, "id": 0}],
            },
        }
        hurtboxes = [{"bone": 3}]
        raw = _make_raw_json([])
        result = extract.extract_animations(
            raw, bones, hitbox_data, hurtboxes
        )

        frame_0 = result[0]["boneFrames"]["0"]
        # Only bones 1 and 3 should be included
        self.assertIn("1", frame_0)
        self.assertIn("3", frame_0)
        self.assertNotIn("0", frame_0)
        self.assertNotIn("2", frame_0)

    def test_bone_frame_keys_valid(self):
        """All bone frame keys are valid frame numbers in [0, totalFrames)."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 5, "parent": 0, "restX": 2.0, "restY": 3.0},
        ]
        hitbox_data = {
            0: {
                "name": "Attack11",
                "totalFrames": 20,
                "hitboxes": [{"bone": 5, "id": 0}],
            },
        }
        raw = _make_raw_json([])
        result = extract.extract_animations(raw, bones, hitbox_data)

        total_frames = result[0]["totalFrames"]
        for frame_str in result[0]["boneFrames"]:
            frame_num = int(frame_str)
            self.assertGreaterEqual(frame_num, 0)
            self.assertLess(frame_num, total_frames)

    def test_total_frames_from_animation(self):
        """totalFrames is updated from FigaTree animation data."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 11, "parent": 0, "restX": 1.0, "restY": 2.0},
        ]
        hitbox_data = {
            0: {
                "name": "Attack11",
                "totalFrames": 10,
                "hitboxes": [{"bone": 11, "id": 0}],
            },
        }
        raw = _make_raw_json([{
            "shortName": "Attack11",
            "name": "Attack11",
            "events": [],
        }])
        raw["nodes"][0]["data"]["subactions"][0]["animationFile"] = 0
        raw["animationFiles"] = [{
            "nodes": [{
                "name": "Attack11_figatree",
                "data": {
                    "numFrames": 45,
                    "boneTableOffset": 0,
                    "animDataOffset": 0,
                },
            }],
        }]
        result = extract.extract_animations(raw, bones, hitbox_data)

        # totalFrames should be updated to 45 (from animation)
        self.assertEqual(result[0]["totalFrames"], 45)

    def test_multiple_subactions(self):
        """Produces boneFrames for multiple subactions."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 3, "parent": 0, "restX": 1.0, "restY": 5.0},
            {"id": 11, "parent": 0, "restX": 4.0, "restY": 4.0},
        ]
        hitbox_data = {
            0: {
                "name": "Attack11",
                "totalFrames": 20,
                "hitboxes": [{"bone": 3, "id": 0}],
            },
            5: {
                "name": "AttackS3",
                "totalFrames": 30,
                "hitboxes": [{"bone": 11, "id": 0}],
            },
        }
        raw = _make_raw_json([])
        result = extract.extract_animations(raw, bones, hitbox_data)

        self.assertIn(0, result)
        self.assertIn(5, result)
        self.assertIn("0", result[0]["boneFrames"])
        self.assertIn("0", result[5]["boneFrames"])

    def test_no_animation_file_still_works(self):
        """Works correctly when no AJ file / animation data is available."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 7, "parent": 0, "restX": 2.0, "restY": 8.0},
        ]
        hitbox_data = {
            0: {
                "name": "Attack11",
                "totalFrames": 15,
                "hitboxes": [{"bone": 7, "id": 0}],
            },
        }
        # No animationFiles in raw_json
        raw = {"nodes": []}
        result = extract.extract_animations(raw, bones, hitbox_data)

        self.assertIn(0, result)
        self.assertEqual(result[0]["totalFrames"], 15)
        self.assertIn("0", result[0]["boneFrames"])
        self.assertIn("7", result[0]["boneFrames"]["0"])

    def test_hurtbox_bones_included(self):
        """Bones from hurtboxes are included in boneFrames."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 3, "parent": 0, "restX": 1.0, "restY": 5.0},
            {"id": 7, "parent": 0, "restX": 2.0, "restY": 8.0},
        ]
        hitbox_data = {
            0: {
                "name": "Attack11",
                "totalFrames": 10,
                "hitboxes": [{"bone": 3, "id": 0}],
            },
        }
        hurtboxes = [{"bone": 7}]
        raw = _make_raw_json([])
        result = extract.extract_animations(
            raw, bones, hitbox_data, hurtboxes
        )

        frame_0 = result[0]["boneFrames"]["0"]
        self.assertIn("3", frame_0)  # from hitbox
        self.assertIn("7", frame_0)  # from hurtbox

    def test_output_format(self):
        """Output matches expected boneFrames format."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 5, "parent": 0, "restX": 3.0, "restY": 7.0},
        ]
        hitbox_data = {
            0: {
                "name": "Attack11",
                "totalFrames": 20,
                "hitboxes": [{"bone": 5, "id": 0}],
            },
        }
        raw = _make_raw_json([])
        result = extract.extract_animations(raw, bones, hitbox_data)

        # Check structure
        self.assertIn("boneFrames", result[0])
        self.assertIn("totalFrames", result[0])
        # boneFrames keys are string frame numbers
        for frame_key in result[0]["boneFrames"]:
            self.assertIsInstance(frame_key, str)
            int(frame_key)  # should not raise
        # bone positions are [x, y] lists
        for bone_id, pos in result[0]["boneFrames"]["0"].items():
            self.assertIsInstance(pos, list)
            self.assertEqual(len(pos), 2)


class TestExtractAnimationsIntegration(unittest.TestCase):
    """Integration test: extract_animations with process_character."""

    def test_process_character_calls_extract_animations(self):
        """process_character integrates extract_animations."""
        # Create a mock GCM that returns minimal data
        class MockGCM:
            def read_file(self, path):
                return b"\x00" * 64

        with tempfile.TemporaryDirectory() as tmpdir:
            result = extract.process_character(
                MockGCM(), "fox", "PlFx.dat", None, tmpdir
            )
            # Should succeed (even with minimal data)
            self.assertTrue(result)


# ---------------------------------------------------------------------------
# Tests for build_action_state_map — Task 2.5
# ---------------------------------------------------------------------------

class TestBuildActionStateMap(unittest.TestCase):
    """Test build_action_state_map function."""

    def test_empty_hitbox_data(self):
        """Returns a map (possibly empty) for empty hitbox data."""
        result = extract.build_action_state_map("fox", {})
        self.assertIsInstance(result, dict)

    def test_common_actions_not_in_map(self):
        """Common actions (< 341) are not in the map."""
        hitbox_data = {
            44: {"name": "Attack11", "totalFrames": 30, "hitboxes": []},
        }
        result = extract.build_action_state_map("fox", hitbox_data)
        # Common action state IDs should not appear
        for key in result:
            self.assertGreaterEqual(int(key), 341)

    def test_special_moves_mapped(self):
        """Special moves (>= 341) are mapped to subaction indices."""
        hitbox_data = {
            295: {"name": "SpecialN", "totalFrames": 30, "hitboxes": []},
        }
        result = extract.build_action_state_map("fox", hitbox_data)
        # Action state 341 should map to the special start index
        self.assertIn("341", result)
        self.assertEqual(result["341"], 295)

    def test_non_identity_only(self):
        """Only non-identity mappings are included."""
        hitbox_data = {
            295: {"name": "SpecialN", "totalFrames": 30, "hitboxes": []},
        }
        result = extract.build_action_state_map("fox", hitbox_data)
        for key, val in result.items():
            self.assertNotEqual(int(key), val)

    def test_sequential_mapping(self):
        """Sequential special moves map to sequential subactions."""
        hitbox_data = {
            295: {"name": "SpecialN", "totalFrames": 30, "hitboxes": []},
            296: {"name": "SpecialNStart", "totalFrames": 20, "hitboxes": []},
        }
        result = extract.build_action_state_map("fox", hitbox_data)
        # 341 -> 295, 342 -> 296
        self.assertEqual(result["341"], 295)
        self.assertEqual(result["342"], 296)

    def test_all_characters_have_special_start(self):
        """All characters in CHARACTER_DAT_PREFIX have a special start index."""
        for char_name in extract.CHARACTER_DAT_PREFIX:
            self.assertIn(
                char_name,
                extract.SPECIAL_MOVE_START_INDEX,
                f"Missing special start index for {char_name}",
            )

    def test_keys_are_strings(self):
        """Map keys are string representations of action state IDs."""
        hitbox_data = {
            295: {"name": "SpecialN", "totalFrames": 30, "hitboxes": []},
        }
        result = extract.build_action_state_map("fox", hitbox_data)
        for key in result:
            self.assertIsInstance(key, str)
            int(key)  # should not raise

    def test_values_are_ints(self):
        """Map values are integer subaction indices."""
        hitbox_data = {
            295: {"name": "SpecialN", "totalFrames": 30, "hitboxes": []},
        }
        result = extract.build_action_state_map("fox", hitbox_data)
        for val in result.values():
            self.assertIsInstance(val, int)

    def test_unknown_character_uses_heuristic(self):
        """Unknown character falls back to heuristic detection."""
        hitbox_data = {
            280: {"name": "SpecialN", "totalFrames": 30, "hitboxes": []},
        }
        result = extract.build_action_state_map(
            "unknown_char", hitbox_data
        )
        # Should detect 280 as the special start
        self.assertIn("341", result)
        self.assertEqual(result["341"], 280)


class TestDetectSpecialStartIndex(unittest.TestCase):
    """Test _detect_special_start_index helper."""

    def test_empty_hitbox_data(self):
        """Returns None for empty hitbox data."""
        result = extract._detect_special_start_index({})
        self.assertIsNone(result)

    def test_no_candidates_in_range(self):
        """Returns None when no subactions in the special range."""
        hitbox_data = {
            44: {"name": "Attack11", "hitboxes": []},
            100: {"name": "AttackS3", "hitboxes": []},
        }
        result = extract._detect_special_start_index(hitbox_data)
        self.assertIsNone(result)

    def test_detects_first_special(self):
        """Detects the first subaction in the special range."""
        hitbox_data = {
            44: {"name": "Attack11", "hitboxes": []},
            295: {"name": "SpecialN", "hitboxes": []},
            296: {"name": "SpecialNStart", "hitboxes": []},
        }
        result = extract._detect_special_start_index(hitbox_data)
        self.assertEqual(result, 295)

    def test_picks_lowest_candidate(self):
        """Picks the lowest subaction index in the special range."""
        hitbox_data = {
            300: {"name": "SpecialS", "hitboxes": []},
            280: {"name": "SpecialN", "hitboxes": []},
        }
        result = extract._detect_special_start_index(hitbox_data)
        self.assertEqual(result, 280)


class TestSpecialMoveStartIndex(unittest.TestCase):
    """Test SPECIAL_MOVE_START_INDEX constant."""

    def test_all_characters_present(self):
        """All 26 characters have a special start index."""
        self.assertEqual(
            len(extract.SPECIAL_MOVE_START_INDEX), 26
        )

    def test_values_in_reasonable_range(self):
        """Special start indices are in a reasonable range."""
        for char, idx in extract.SPECIAL_MOVE_START_INDEX.items():
            self.assertGreaterEqual(
                idx, 274,
                f"{char} special start {idx} < 274",
            )
            self.assertLessEqual(
                idx, 350,
                f"{char} special start {idx} > 350",
            )


# ---------------------------------------------------------------------------
# Tests for serialize_character_json — Task 2.6
# ---------------------------------------------------------------------------

class TestSerializeCharacterJson(unittest.TestCase):
    """Test serialize_character_json function."""

    def test_basic_serialization(self):
        """Produces a valid character JSON with all top-level keys."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 1, "parent": 0, "restX": 1.0, "restY": 2.0},
        ]
        hitbox_data = {
            44: {
                "name": "Attack11",
                "totalFrames": 30,
                "boneFrames": {"0": {"1": [1.0, 2.0]}},
                "hitboxes": [{
                    "id": 0, "bone": 1,
                    "x": 0.0, "y": 0.0, "z": 2.5,
                    "size": 3.2, "damage": 7,
                    "angle": 80, "kbg": 100,
                    "bkb": 0, "setKb": 0,
                    "element": 0,
                    "startFrame": 2, "endFrame": 5,
                }],
            },
        }
        hurtboxes = [
            {"bone": 0, "x": 0.0, "y": 0.0, "z": 0.0,
             "sizeX": 2.0, "sizeY": 3.5, "zone": "mid"},
        ]
        action_state_map = {"341": 295}

        result = extract.serialize_character_json(
            "fox", bones, hitbox_data, hurtboxes, action_state_map,
        )

        expected_keys = {
            "character", "internalId", "scale",
            "bones", "subactions", "hurtboxes", "actionStateMap",
        }
        self.assertEqual(set(result.keys()), expected_keys)

    def test_character_name_and_id(self):
        """Character name and internalId are set correctly."""
        result = extract.serialize_character_json(
            "fox", [], {}, [], {},
        )
        self.assertEqual(result["character"], "fox")
        self.assertEqual(result["internalId"], 2)

    def test_scale_default(self):
        """Scale defaults to 1.0 for known characters."""
        result = extract.serialize_character_json(
            "fox", [], {}, [], {},
        )
        self.assertEqual(result["scale"], 1.0)

    def test_scale_unknown_character(self):
        """Scale defaults to 1.0 for unknown characters."""
        result = extract.serialize_character_json(
            "unknown_char", [], {}, [], {},
        )
        self.assertEqual(result["scale"], 1.0)

    def test_subactions_keyed_by_string(self):
        """Subaction keys are string representations of indices."""
        hitbox_data = {
            44: {
                "name": "Attack11",
                "totalFrames": 30,
                "hitboxes": [],
            },
        }
        result = extract.serialize_character_json(
            "fox", [], hitbox_data, [], {},
        )
        self.assertIn("44", result["subactions"])
        self.assertNotIn(44, result["subactions"])

    def test_subaction_structure(self):
        """Each subaction has name, totalFrames, boneFrames, hitboxes."""
        hitbox_data = {
            44: {
                "name": "Attack11",
                "totalFrames": 30,
                "boneFrames": {"0": {"1": [1.0, 2.0]}},
                "hitboxes": [{"id": 0, "bone": 1}],
            },
        }
        result = extract.serialize_character_json(
            "fox", [], hitbox_data, [], {},
        )
        sub = result["subactions"]["44"]
        self.assertEqual(sub["name"], "Attack11")
        self.assertEqual(sub["totalFrames"], 30)
        self.assertIn("boneFrames", sub)
        self.assertIn("hitboxes", sub)

    def test_empty_data_produces_valid_json(self):
        """Empty extraction data produces a valid (minimal) JSON."""
        result = extract.serialize_character_json(
            "fox", [], {}, [], {},
        )
        self.assertEqual(result["bones"], [])
        self.assertEqual(result["subactions"], {})
        self.assertEqual(result["hurtboxes"], [])
        self.assertEqual(result["actionStateMap"], {})

    def test_missing_boneframes_defaults_to_empty(self):
        """Subaction without boneFrames gets empty dict."""
        hitbox_data = {
            44: {
                "name": "Attack11",
                "totalFrames": 30,
                "hitboxes": [],
            },
        }
        result = extract.serialize_character_json(
            "fox", [], hitbox_data, [], {},
        )
        self.assertEqual(
            result["subactions"]["44"]["boneFrames"], {},
        )

    def test_validates_after_serialization(self):
        """Serialized JSON passes validate_json."""
        bones = [
            {"id": 0, "parent": -1, "restX": 0.0, "restY": 0.0},
            {"id": 1, "parent": 0, "restX": 1.0, "restY": 2.0},
        ]
        hitbox_data = {
            44: {
                "name": "Attack11",
                "totalFrames": 30,
                "boneFrames": {
                    "0": {"0": [0.0, 0.0], "1": [1.0, 2.0]},
                },
                "hitboxes": [{
                    "id": 0, "bone": 1,
                    "x": 0.0, "y": 0.0, "z": 2.5,
                    "size": 3.2, "damage": 7,
                    "angle": 80, "kbg": 100,
                    "bkb": 0, "setKb": 0,
                    "element": 0,
                    "startFrame": 2, "endFrame": 5,
                }],
            },
        }
        hurtboxes = [
            {"bone": 0, "x": 0.0, "y": 0.0, "z": 0.0,
             "sizeX": 2.0, "sizeY": 3.5, "zone": "mid"},
        ]
        result = extract.serialize_character_json(
            "fox", bones, hitbox_data, hurtboxes, {},
        )

        # Write to temp file and validate
        with tempfile.NamedTemporaryFile(
            suffix=".json", mode="w", delete=False,
        ) as f:
            json.dump(result, f)
            tmp_path = f.name
        try:
            self.assertTrue(extract.validate_json(tmp_path))
        finally:
            os.unlink(tmp_path)


class TestCharacterScale(unittest.TestCase):
    """Test CHARACTER_SCALE constant."""

    def test_all_characters_have_scale(self):
        """All 26 characters have a scale value."""
        for char_name in extract.CHARACTER_DAT_PREFIX:
            self.assertIn(
                char_name, extract.CHARACTER_SCALE,
                f"Missing scale for {char_name}",
            )

    def test_scales_are_positive(self):
        """All scale values are positive."""
        for char_name, scale in extract.CHARACTER_SCALE.items():
            self.assertGreater(
                scale, 0,
                f"{char_name} scale {scale} <= 0",
            )


class TestProcessCharacterEndToEnd(unittest.TestCase):
    """Test process_character end-to-end with JSON output."""

    def test_writes_final_json(self):
        """process_character writes a {char_name}.json file."""
        class MockGCM:
            def read_file(self, path):
                return b"\x00" * 64

        with tempfile.TemporaryDirectory() as tmpdir:
            result = extract.process_character(
                MockGCM(), "fox", "PlFx.dat", None, tmpdir,
            )
            self.assertTrue(result)
            output_path = os.path.join(tmpdir, "fox.json")
            self.assertTrue(
                os.path.isfile(output_path),
                f"Expected output JSON at {output_path}",
            )

    def test_output_json_has_correct_schema(self):
        """Output JSON has all required top-level keys."""
        class MockGCM:
            def read_file(self, path):
                return b"\x00" * 64

        with tempfile.TemporaryDirectory() as tmpdir:
            extract.process_character(
                MockGCM(), "fox", "PlFx.dat", None, tmpdir,
            )
            output_path = os.path.join(tmpdir, "fox.json")
            with open(output_path, "r") as f:
                data = json.load(f)

            expected_keys = {
                "character", "internalId", "scale",
                "bones", "subactions", "hurtboxes",
                "actionStateMap",
            }
            self.assertEqual(set(data.keys()), expected_keys)
            self.assertEqual(data["character"], "fox")
            self.assertEqual(data["internalId"], 2)
            self.assertEqual(data["scale"], 1.0)

    def test_cleans_up_intermediate_files(self):
        """process_character removes intermediate .dat and _raw.json files."""
        class MockGCM:
            def read_file(self, path):
                return b"\x00" * 64

        with tempfile.TemporaryDirectory() as tmpdir:
            extract.process_character(
                MockGCM(), "fox", "PlFx.dat", None, tmpdir,
            )
            # Intermediate files should be cleaned up
            dat_path = os.path.join(tmpdir, ".fox.dat")
            raw_path = os.path.join(tmpdir, ".fox_raw.json")
            self.assertFalse(
                os.path.isfile(dat_path),
                "Intermediate .dat file should be removed",
            )
            self.assertFalse(
                os.path.isfile(raw_path),
                "Intermediate _raw.json file should be removed",
            )


if __name__ == "__main__":
    unittest.main()