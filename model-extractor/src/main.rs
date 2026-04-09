//! Melee Model Extractor
//!
//! Extracts 3D character models from a Melee ISO using dat_extractor
//! (the same library used by Rwing) and outputs them as JSON files
//! suitable for Three.js rendering in the browser.
//!
//! Usage:
//!   cargo run -- --iso path/to/melee.iso --outdir model-data/
//!   cargo run -- --iso path/to/melee.iso --char fox --outdir model-data/

use clap::Parser;
use dat_extractor::dat::{
    DatFile, HSDRawFile, extract_character_model,
    extract_anim_from_action,
};
use dat_extractor::dat::fighter_data::FighterData;
use serde::Serialize;
use std::path::PathBuf;
use std::rc::Rc;

#[derive(Parser)]
#[command(name = "melee-model-extractor")]
#[command(about = "Extract 3D character models from Melee ISO")]
struct Args {
    /// Path to the Melee ISO file
    #[arg(long)]
    iso: PathBuf,

    /// Extract only this character (e.g. "fox")
    #[arg(long)]
    char: Option<String>,

    /// Output directory for model files
    #[arg(long, default_value = "model-data")]
    outdir: PathBuf,
}

/// Character name -> (DAT prefix, color DAT prefix)
const CHARACTERS: &[(&str, &str, &str)] = &[
    ("bowser", "Kp", "Bo"),
    ("captain_falcon", "Ca", "Ca"),
    ("donkey_kong", "Dk", "Dk"),
    ("dr_mario", "Dr", "Dr"),
    ("falco", "Fc", "Fc"),
    ("fox", "Fx", "Fx"),
    ("game_and_watch", "Gw", "Gw"),
    ("ganondorf", "Gn", "Gn"),
    ("ice_climbers", "Pp", "Pp"),
    ("jigglypuff", "Pr", "Pr"),
    ("kirby", "Kb", "Kb"),
    ("link", "Lk", "Lk"),
    ("luigi", "Lg", "Lg"),
    ("mario", "Mr", "Mr"),
    ("marth", "Ms", "Ms"),
    ("mewtwo", "Mt", "Mt"),
    ("ness", "Ns", "Ns"),
    ("peach", "Pe", "Pe"),
    ("pichu", "Pc", "Pc"),
    ("pikachu", "Pk", "Pk"),
    ("roy", "Fe", "Fe"),
    ("samus", "Ss", "Ss"),
    ("sheik", "Sk", "Sk"),
    ("yoshi", "Ys", "Ys"),
    ("young_link", "Cl", "Cl"),
    ("zelda", "Zd", "Zd"),
];

#[derive(Serialize)]
struct ModelOutput {
    character: String,
    vertices: Vec<[f32; 3]>,
    normals: Vec<[f32; 3]>,
    uvs: Vec<[f32; 2]>,
    indices: Vec<u16>,
    bones: Vec<BoneOutput>,
    bone_weights: Vec<BoneWeightOutput>,
}

#[derive(Serialize)]
struct BoneOutput {
    parent: Option<u16>,
    transform: [f32; 16], // 4x4 matrix, column-major for Three.js
}

#[derive(Serialize)]
struct BoneWeightOutput {
    bones: [u32; 4],
    weights: [f32; 4],
}

fn main() {
    let args = Args::parse();

    if !args.iso.exists() {
        eprintln!("ISO file not found: {}", args.iso.display());
        std::process::exit(1);
    }

    std::fs::create_dir_all(&args.outdir).expect("Failed to create output directory");

    // Read ISO
    let iso_data = std::fs::read(&args.iso).expect("Failed to read ISO");
    let iso_parser = dat_extractor::dat::isoparser::ISOParser::new(&iso_data);

    println!("ISO loaded: {} bytes", iso_data.len());

    for &(char_name, prefix, _color_prefix) in CHARACTERS {
        if let Some(ref filter) = args.char {
            if char_name != filter {
                continue;
            }
        }

        println!("\nProcessing {}...", char_name);

        // Find and read the fighter DAT file
        let dat_filename = format!("Pl{}.dat", prefix);
        let model_filename = format!("Pl{}Nr.dat", prefix); // Normal color model

        let fighter_dat = match iso_parser.find_file(&dat_filename) {
            Some(data) => data,
            None => {
                eprintln!("  DAT file not found: {}", dat_filename);
                continue;
            }
        };

        let model_dat = match iso_parser.find_file(&model_filename) {
            Some(data) => data,
            None => {
                eprintln!("  Model DAT not found: {}", model_filename);
                continue;
            }
        };

        let fighter_dat_file = DatFile {
            filename: Rc::from(dat_filename.as_str()),
            data: Rc::from(fighter_dat),
        };
        let model_dat_file = DatFile {
            filename: Rc::from(model_filename.as_str()),
            data: Rc::from(model_dat),
        };

        let parsed_fighter = HSDRawFile::new(&fighter_dat_file);
        let parsed_model = HSDRawFile::new(&model_dat_file);

        // Extract the 3D model
        let model = match extract_character_model(&parsed_fighter, &parsed_model) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("  Failed to extract model: {:?}", e);
                continue;
            }
        };

        println!("  Bones: {}", model.bones.len());
        println!("  Vertices: {}", model.vertices.len());
        println!("  Indices: {}", model.indices.len());
        println!("  Textures: {}", model.textures.len());

        // Convert to output format
        let mut vertices = Vec::with_capacity(model.vertices.len());
        let mut normals = Vec::with_capacity(model.vertices.len());
        let mut uvs = Vec::with_capacity(model.vertices.len());
        let mut bone_weights = Vec::with_capacity(model.vertices.len());

        for v in model.vertices.iter() {
            let pos = v.pos();
            let norm = v.normal();
            let uv = v.uv();
            let w = v.weights();
            let b = v.bones();

            vertices.push([pos.x, pos.y, pos.z]);
            normals.push([norm.x, norm.y, norm.z]);
            uvs.push([uv.x, uv.y]);
            bone_weights.push(BoneWeightOutput {
                bones: [b[0], b[1], b[2], b[3]],
                weights: [w[0], w[1], w[2], w[3]],
            });
        }

        let mut bones = Vec::with_capacity(model.bones.len());
        for (i, bone) in model.bones.iter().enumerate() {
            let t = model.base_transforms[i];
            bones.push(BoneOutput {
                parent: bone.parent,
                transform: t.to_cols_array(), // column-major for Three.js
            });
        }

        let output = ModelOutput {
            character: char_name.to_string(),
            vertices,
            normals,
            uvs,
            indices: model.indices.to_vec(),
            bones,
            bone_weights,
        };

        // Write output
        let output_path = args.outdir.join(format!("{}.json", char_name));
        let json = serde_json::to_string(&output).expect("Failed to serialize");
        std::fs::write(&output_path, &json).expect("Failed to write output");

        let size = json.len();
        println!("  Output: {} ({} bytes)", output_path.display(), size);
    }

    println!("\nDone!");
}
