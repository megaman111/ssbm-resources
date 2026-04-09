"""Measure SVG silhouette alignment vs game coordinate system.

This script analyzes the SVG animation paths to determine:
1. Where character feet are in SVG space (per animation)
2. The current transform chain and where things end up
3. What offset is needed to align silhouette feet with gameY
"""
import json, zipfile, re, os

def measure_svg_bounds(zip_path):
    """Measure Y bounds of SVG paths across all animations."""
    results = {}
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            if not name.endswith('.json'):
                continue
            try:
                data = json.loads(z.read(name))
                if not isinstance(data, list) or not data:
                    continue
                # Check multiple frames
                all_min_y = float('inf')
                all_max_y = float('-inf')
                for frame_idx in [0, len(data)//2, len(data)-1]:
                    if frame_idx >= len(data):
                        continue
                    path = data[frame_idx]
                    if not isinstance(path, str) or not path:
                        continue
                    nums = [float(x) for x in re.findall(r'[-+]?\d+\.?\d*', path)]
                    if len(nums) < 4:
                        continue
                    ys = nums[1::2]
                    all_min_y = min(all_min_y, min(ys))
                    all_max_y = max(all_max_y, max(ys))
                if all_min_y < float('inf'):
                    anim_name = name.replace('.json', '')
                    results[anim_name] = {
                        'min_y': all_min_y,
                        'max_y': all_max_y,
                        'center_y': (all_min_y + all_max_y) / 2,
                        'height': all_max_y - all_min_y,
                    }
            except Exception as e:
                pass
    return results


def analyze_transform_chain():
    """Document the current transform chain for the silhouette."""
    print("=" * 70)
    print("CURRENT SILHOUETTE TRANSFORM CHAIN")
    print("=" * 70)
    print()
    print("1. ctx.translate(px, py)")
    print("   px = toCanvasX(gameX) = gameX * canvasScale + offX")
    print("   py = toCanvasY(gameY) = -gameY * canvasScale + offY")
    print("   -> Canvas origin at character's .slp position (feet)")
    print()
    print("2. ctx.scale(facing * cs, cs)")
    print("   cs = CHAR_SCALE_MAP[charId] * 0.1 * canvasScale")
    print("   -> Converts SVG units to canvas pixels")
    print("   -> 1 SVG unit = cs canvas pixels = 0.1 * charScale game units")
    print()
    print("3. ctx.translate(-500, -500)")
    print("   -> Shifts SVG origin from (0,0) to (500,500)")
    print("   -> SVG point (500, Y) maps to canvas X=0 (centered)")
    print("   -> SVG point (X, 500) maps to canvas Y=0 (at gameY)")
    print()
    print("RESULT: SVG point (500, 500) is at (px, py) = gameY position")
    print()


def compute_offset(svg_feet_y):
    """Compute the game-unit offset between SVG center and feet."""
    # With translate(-500, -500):
    # SVG point (500, svg_feet_y) maps to canvas Y = (svg_feet_y - 500) * cs
    # In game units: (svg_feet_y - 500) * 0.1 * charScale
    # For charScale=1: (svg_feet_y - 500) * 0.1
    offset_svg = svg_feet_y - 500
    offset_game = offset_svg * 0.1  # for charScale=1
    return offset_svg, offset_game


# Measure Fox
print("Measuring Fox SVG bounds...")
fox_bounds = measure_svg_bounds('animation-zips/fox.zip')

# Find standing animations for feet reference
standing_anims = ['Wait1', 'Wait2', 'Guard', 'Landing']
print()
print("=" * 70)
print("FOX SVG Y BOUNDS (selected animations)")
print("=" * 70)
for anim in sorted(fox_bounds.keys()):
    b = fox_bounds[anim]
    print(f"  {anim:30s}  minY={b['min_y']:6.0f}  maxY={b['max_y']:6.0f}  "
          f"center={b['center_y']:6.0f}  height={b['height']:6.0f}")

# Compute statistics
all_max_ys = [b['max_y'] for b in fox_bounds.values()]
all_min_ys = [b['min_y'] for b in fox_bounds.values()]
all_centers = [b['center_y'] for b in fox_bounds.values()]

print()
print("=" * 70)
print("STATISTICS ACROSS ALL ANIMATIONS")
print("=" * 70)
print(f"  Max Y (feet) range: {min(all_max_ys):.0f} to {max(all_max_ys):.0f}")
print(f"  Max Y (feet) median: {sorted(all_max_ys)[len(all_max_ys)//2]:.0f}")
print(f"  Max Y (feet) mean: {sum(all_max_ys)/len(all_max_ys):.0f}")
print(f"  Min Y (head) range: {min(all_min_ys):.0f} to {max(all_min_ys):.0f}")
print(f"  Center Y mean: {sum(all_centers)/len(all_centers):.0f}")

median_feet = sorted(all_max_ys)[len(all_max_ys)//2]
offset_svg, offset_game = compute_offset(median_feet)

print()
analyze_transform_chain()

print("=" * 70)
print("PROPOSED FIX")
print("=" * 70)
print(f"  Median SVG feet Y: {median_feet:.0f}")
print(f"  Current translate: (-500, -500)")
print(f"  SVG feet offset from center: {offset_svg:.0f} SVG units")
print(f"  In game units (charScale=1): {offset_game:.1f}")
print()
print(f"  To put feet at gameY, change translate to: (-500, -{median_feet:.0f})")
print(f"  OR keep translate(-500,-500) and offset hitbox Y by {offset_game:.1f} game units")
print()
print("DEPENDENT SYSTEMS TO ADJUST:")
print("  1. Shield offset: CHAR_SHIELD_OFFSET[charId] Y values")
print("     Currently: gameY + sOff[1] (e.g. Fox: gameY + 10.447)")
print(f"     New: gameY + sOff[1] - {offset_game:.1f}")
print("  2. Shine hexagon: gameY + (shieldOffset * 3/4)")
print(f"     New: gameY + (shieldOffset * 3/4) - {offset_game:.1f}")
print("  3. Shadow ellipse: toCanvasY(0) — INDEPENDENT, no change needed")
print("  4. Rotation center: -8 * scale (8 game units above feet)")
print(f"     New: -({8 - offset_game:.1f}) * scale")
print("  5. FightCore fallback hurtboxes: gameY + hp.oy")
print(f"     New: gameY + hp.oy - {offset_game:.1f}")
print("  6. FightCore fallback hitboxes: gameY + hb.y")
print(f"     New: gameY + hb.y - {offset_game:.1f}")
print("  7. Hitbox renderer: bone.y + offY")
print(f"     New: bone.y + offY - {offset_game:.1f}")
