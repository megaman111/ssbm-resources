#!/usr/bin/env zx

/**
 * STEP 4: Compress all animation JSON files into a single zip.
 *
 * Input structure:
 *   $inputRoot/
 *     $AnimationName.json
 *     ...
 *
 * Output:
 *   $outputRoot/animations.zip
 *
 * Requires zip:
 *   Linux: sudo apt install zip
 *   Windows: use WSL or install zip via scoop/choco
 *
 * Runtime: ~2 seconds
 */

const inputRoot = process.argv[3];
const outputRoot = process.argv[4];
if (inputRoot === undefined || outputRoot === undefined) {
  console.log('Usage: zx step4jsonToZip.mjs <inputRoot> <outputRoot>');
  process.exit(1);
}

await fs.emptyDir(outputRoot);
const outputZip = path.join(outputRoot, 'animations.zip');
await $`zip -r9j ${outputZip} ${inputRoot}`;
console.log(`✓ Created ${outputZip}`);
