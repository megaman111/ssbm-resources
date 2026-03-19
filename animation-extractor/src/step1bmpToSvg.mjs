#!/usr/bin/env zx

/**
 * STEP 1: Trace .bmp files into .svg files using potrace.
 *
 * Input structure (output of Maya step0renderAnimations.mel):
 *   $inputRoot/
 *     Ply$Character_Share_ACTION_$AnimationName_figatree/
 *       Ply$Character_Share_ACTION_$AnimationName_figatree_0_tmp.bmp
 *       Ply$Character_Share_ACTION_$AnimationName_figatree_1_tmp.bmp
 *       ...
 *
 * Output structure:
 *   $outputRoot/
 *     $AnimationName/
 *       0.svg
 *       1.svg
 *       ...
 *
 * Requires potrace. Install with:
 *   npm install -g potrace
 *   OR on Linux: sudo apt install potrace
 *
 * Runtime: ~3.5 hours for a full character
 */

const inputRoot = process.argv[3];
const outputRoot = process.argv[4];
if (inputRoot === undefined || outputRoot === undefined) {
  console.log('Usage: zx step1bmpToSvg.mjs <inputRoot> <outputRoot>');
  process.exit(1);
}

await fs.emptyDir(outputRoot);
const animationDirectories = await fs.readdir(inputRoot);

for (const animationName of animationDirectories) {
  const trimmedAnimationName = animationName.match(/.*_ACTION_(.*)_figatree.*/)?.[1];
  if (!trimmedAnimationName) {
    console.log(`Skipping unrecognized directory: ${animationName}`);
    continue;
  }
  const animationInputDirectory = path.join(inputRoot, animationName);
  const animationOutputDirectory = path.join(outputRoot, trimmedAnimationName);
  await fs.ensureDir(animationOutputDirectory);

  const animationBmps = await fs.readdir(animationInputDirectory);
  await Promise.all(animationBmps.map((animationBmp) => {
    const match = animationBmp.match(/.*_figatree_([0-9]+)_tmp\.bmp/);
    if (!match) return;
    const frameNumber = Number(match[1]);
    const inputPath = path.join(animationInputDirectory, animationBmp);
    const outputPath = path.join(animationOutputDirectory, `${frameNumber}.svg`);
    return $`potrace --svg --opaque ${inputPath} -o ${outputPath}`;
  }));
  console.log(`✓ ${trimmedAnimationName}`);
}
