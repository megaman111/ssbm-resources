# Melee Model Extractor

Extracts 3D character models from a Melee ISO using [dat_extractor](https://github.com/AlexanderHarrison/dat_extractor) (the same library used by Rwing).

## Prerequisites

- [Rust](https://rustup.rs/) (install via rustup)
- Melee ISO (NTSC v1.02)

## Usage

```bash
# Install Rust first
# https://rustup.rs/

# Extract all characters
cargo run --release -- --iso "path/to/melee.iso" --outdir model-data/

# Extract single character
cargo run --release -- --iso "path/to/melee.iso" --char fox --outdir model-data/
```

## Output

Per-character JSON files in `model-data/` containing:
- Vertex positions, normals, UVs
- Triangle indices
- Bone hierarchy with transforms
- Per-vertex bone weights (for skeletal animation)

These files are loaded by Three.js in the replay viewer for 3D character rendering.
