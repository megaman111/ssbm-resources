#!/usr/bin/env zx

/**
 * STEP 3: Collect SVG path strings into per-animation JSON files.
 * Duplicate frames are replaced with a reference "frameN" to save space.
 *
 * Input structure:
 *   $inputRoot/
 *     $AnimationName/
 *       0.svg
 *       1.svg
 *       ...
 *
 * Output structure:
 *   $outputRoot/
 *     $AnimationName.json   <- array of path strings or "frameN" references
 *
 * Runtime: ~7 seconds
 */

const inputRoot = process.argv[3];
const outputRoot = process.argv[4];
if (inputRoot === undefined || outputRoot === undefined) {
  console.log('Usage: zx step3svgToJson.mjs <inputRoot> <outputRoot>');
  process.exit(1);
}

await fs.emptyDir(outputRoot);
const animationDirectories = await fs.readdir(inputRoot);

for (const animationName of animationDirectories) {
  const animationInputDirectory = path.join(inputRoot, animationName);
  const animationOutputPath = `${path.join(outputRoot, animationName)}.json`;

  const animationSvgs = await fs.readdir(animationInputDirectory);
  animationSvgs.sort((a, b) =>
    Number(a.replace('.svg', '')) > Number(b.replace('.svg', '')) ? 1 : -1,
  );

  const paths = [];
  for (const animationSvg of animationSvgs) {
    const svgPath = path.join(animationInputDirectory, animationSvg);
    const svgContents = await fs.readFile(svgPath, 'utf8');
    const pathMatch = svgContents.match(/d="([^"]*)"/);
    paths.push(pathMatch?.[1] ?? '');
  }

  // Deduplicate: replace repeated frames with a reference to the first occurrence
  const dedupedPaths = paths.map((p, index) => {
    const firstIndex = paths.indexOf(p);
    return firstIndex === index ? p : `frame${firstIndex}`;
  });

  console.log(`writing ${animationOutputPath}`);
  await fs.writeFile(animationOutputPath, JSON.stringify(dedupedPaths));
}
