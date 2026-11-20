const esbuild = require('esbuild');
const fs = require('node:fs');
const result = esbuild.buildSync({
  entryPoints: ['src/extension.ts', 'src/core.ts', 'src/runtime.ts', 'src/workspace.ts'],
  bundle: true, outdir: 'dist', platform: 'node', target: 'node20',
  external: ['vscode'], sourcemap: true, metafile: true,
  legalComments: 'eof',
});
fs.writeFileSync('dist/bundle-metadata.json', JSON.stringify(result.metafile));
