import { build } from 'esbuild'
import { mkdirSync, readdirSync } from 'node:fs'

const shim = [
  'import { createRequire as __createRequire } from "node:module";',
  'import { fileURLToPath as __fileURLToPath } from "node:url";',
  'import { dirname as __dirnameOf } from "node:path";',
  'const require = __createRequire(import.meta.url);',
  'const __filename = __fileURLToPath(import.meta.url);',
  'const __dirname = __dirnameOf(__filename);',
].join(' ')

mkdirSync('api', { recursive: true })
for (const file of readdirSync('functions').filter((f) => f.endsWith('.ts'))) {
  await build({
    entryPoints: [`functions/${file}`],
    outfile: `api/${file.replace(/\.ts$/, '.js')}`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    banner: { js: shim },
    logLevel: 'warning',
  })
  console.log('bundled', file)
}
