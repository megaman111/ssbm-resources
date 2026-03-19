#!/usr/bin/env zx

/**
 * STEP 2: Optimize SVG files using svgo.
 *
 * Input/output structure (identical):
 *   $root/
 *     $AnimationName/
 *       0.svg
 *       1.svg
 *       ...
 *
 * Requires svgo:
 *   npm install -g svgo
 *
 * Runtime: ~5 minutes
 */

const inputRoot = process.argv[3];
const outputRoot = process.argv[4];
if (inputRoot === undefined || outputRoot === undefined) {
  console.log('Usage: zx step2optimizeSvg.mjs <inputRoot> <outputRoot>');
  process.exit(1);
}

await fs.emptyDir(outputRoot);
const animationDirectories = await fs.readdir(inputRoot);

for (const animationName of animationDirectories) {
  const animationInputDirectory = path.join(inputRoot, animationName);
  const animationOutputDirectory = path.join(outputRoot, animationName);
  await $`svgo -f ${animationInputDirectory} -o ${animationOutputDirectory} -p 1 --multipass --config ${path.join(__dirname, 'svgo.config.js')}`;
  console.log(`✓ ${animationName}`);
}
