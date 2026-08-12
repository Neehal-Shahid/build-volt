import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Build zip + plugin-update.json if missing (or always refresh). */
export function ensurePluginArtifacts() {
  try {
    const script = path.join(__dirname, '../scripts/build-plugin.js')
    const zip = path.join(__dirname, '../public/buildbot-woocommerce.zip')
    const r = spawnSync(process.execPath, [script], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      env: process.env,
    })
    if (r.status !== 0) {
      console.warn('[plugin] build failed:', r.stderr || r.stdout)
      return
    }
    if (fs.existsSync(zip)) {
      console.log('[boot] Plugin zip ready')
    }
  } catch (err) {
    console.warn('[plugin] could not build artifacts:', err.message)
  }
}
