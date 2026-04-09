//! Melee Model Extractor
//!
//! Extracts 3D character models from a Melee ISO using dat_tools
//! (the same library used by Rwing) and outputs them as JSON files
//! suitable for Three.js rendering in the browser.

use clap::Parser;
use dat_tools::{open_iso, get_fighter_data};
use serde::Serialize;
use slp_parser::{Character, CharacterColour, character_colours::*};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "melee-model-extractor")]
#[command(about = "Extract 3D character models from Melee ISO")]
struct Args {
    /// Path to the Melee ISO file
    #[arg(long)]
    iso: PathBuf,

    /// Extract only this character (e.g. "fox")
    #[arg(long, name = "char")]
    character: Option<String>,

    /// Output directory for model files
    #[arg(long, default_value = "model-data")]
    outdir: PathBuf,
}

const CHARACTERS: &[(&str, CharacterColour)] = &[
    ("bowser", CharacterColour::Bowser(BowserColour::Neutral)),
    ("captain_falcon", CharacterColour::CaptainFalcon(CaptainFalconColour::Neutral)),
    ("donkey_kong", CharacterColour::DonkeyKong(DonkeyKongColour::Neutral)),
    ("dr_mario", CharacterColour::DrMario(DrMarioColour::Neutral)),
    ("falco", CharacterColour::Falco(FalcoColour::Neutral)),
    ("fox", CharacterColour::Fox(FoxColour::Neutral)),
    ("game_and_watch", CharacterColour::MrGameAndWatch(MrGameAndWatchColour::Neutral)),
    ("ganondorf", CharacterColour::Ganondorf(GanondorfColour::Neutral)),
    ("ice_climbers", CharacterColour::Popo(IceClimbersColour::Neutral)),
    ("jigglypuff", CharacterColour::Jigglypuff(JigglypuffColour::Neutral)),
    ("kirby", CharacterColour::Kirby(KirbyColour::Neutral)),
    ("link", CharacterColour::Link(LinkColour::Neutral)),
    ("luigi", CharacterColour::Luigi(LuigiColour::Neutral)),
    ("mario", CharacterColour::Mario(MarioColour::Neutral)),
    ("marth", CharacterColour::Marth(MarthColour::Neutral)),
    ("mewtwo", CharacterColour::Mewtwo(MewtwoColour::Neutral)),
    ("ness", CharacterColour::Ness(NessColour::Neutral)),
    ("peach", CharacterColour::Peach(PeachColour::Neutral)),
    ("pichu", CharacterColour::Pichu(PichuColour::Neutral)),
    ("pikachu", CharacterColour::Pikachu(PikachuColour::Neutral)),
    ("roy", CharacterColour::Roy(RoyColour::Neutral)),
    ("samus", CharacterColour::Samus(SamusColour::Neutral)),
    ("sheik", CharacterColour::Sheik(ZeldaColour::Neutral)),
    ("yoshi", CharacterColour::Yoshi(YoshiColour::Neutral)),
    ("young_link", CharacterColour::YoungLink(YoungLinkColour::Neutral)),
    ("zelda", CharacterColour::Zelda(ZeldaColour::Neutral)),
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
    inv_bind_matrices: Vec<[f32; 16]>,
}

#[derive(Serialize)]
struct BoneOutput {
    parent: Option<u16>,
    transform: [f32; 16],
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

    let mut iso_files = open_iso(&args.iso).expect("Failed to open ISO");
    println!("ISO loaded: {}", args.iso.display());

    for &(char_name, char_colour) in CHARACTERS {
        if let Some(ref filter) = args.character {
            if char_name != filter {
                continue;
            }
        }

        println!("\nProcessing {}...", char_name);

        let fighter_data = match get_fighter_data(&mut iso_files, char_colour) {
            Ok(fd) => fd,
            Err(e) => {
                eprintln!("  Failed to get fighter data: {:?}", e);
                continue;
            }
        };

        let model = &fighter_data.model;

        println!("  Bones: {}", model.bones.len());
        println!("  Vertices: {}", model.vertices.len());
        println!("  Indices: {}", model.indices.len());
        println!("  Textures: {}", model.textures.len());

        // Convert vertices
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

        // Convert bones
        let mut bones = Vec::with_capacity(model.bones.len());
        let mut inv_bind_matrices = Vec::with_capacity(model.bones.len());

        for (i, bone) in model.bones.iter().enumerate() {
            bones.push(BoneOutput {
                parent: bone.parent,
                transform: model.base_transforms[i].to_cols_array(),
            });
            inv_bind_matrices.push(model.inv_world_transforms[i].to_cols_array());
        }

        let output = ModelOutput {
            character: char_name.to_string(),
            vertices,
            normals,
            uvs,
            indices: model.indices.to_vec(),
            bones,
            bone_weights,
            inv_bind_matrices,
        };

        let output_path = args.outdir.join(format!("{}.json", char_name));
        let json = serde_json::to_string(&output).expect("Failed to serialize");
        std::fs::write(&output_path, &json).expect("Failed to write output");

        println!("  Output: {} ({} bytes)", output_path.display(), json.len());
    }

    println!("\nDone!");
}
