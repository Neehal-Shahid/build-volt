/**
 * Zip plugin/buildbot-woocommerce → server/public/buildbot-woocommerce.zip
 * and write plugin-update.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const pluginDir = path.join(root, 'plugin', 'buildbot-woocommerce')
const outDir = path.join(root, 'server', 'public')
const zipPath = path.join(outDir, 'buildbot-woocommerce.zip')
const updatePath = path.join(outDir, 'plugin-update.json')

const apiBase = process.env.PUBLIC_API_URL || process.env.APP_URL || 'http://127.0.0.1:3001'

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    }
  }
  return ~c >>> 0
}

function zipFolderStoreOnly(sourceDir, destZip, rootFolderName) {
  const files = []
  function walk(dir, rel = '') {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      const relPath = rel ? `${rel}/${name}` : name
      const st = fs.statSync(full)
      if (st.isDirectory()) walk(full, relPath)
      else
        files.push({
          relPath: `${rootFolderName}/${relPath}`,
          size: st.size,
          data: fs.readFileSync(full),
        })
    }
  }
  walk(sourceDir)

  const parts = []
  const central = []
  let offset = 0

  function u16(n) {
    const b = Buffer.alloc(2)
    b.writeUInt16LE(n, 0)
    return b
  }
  function u32(n) {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(n >>> 0, 0)
    return b
  }

  for (const f of files) {
    const nameBuf = Buffer.from(f.relPath, 'utf8')
    const crc = crc32(f.data)
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(f.size),
      u32(f.size),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      f.data,
    ])

    const cen = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(f.size),
      u32(f.size),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ])
    parts.push(local)
    central.push(cen)
    offset += local.length
  }

  const centralDir = Buffer.concat(central)
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])

  fs.writeFileSync(destZip, Buffer.concat([...parts, centralDir, end]))
}

ensureDir(outDir)

if (!fs.existsSync(pluginDir)) {
  console.error('Plugin folder missing:', pluginDir)
  process.exit(1)
}

// Patch the PHP file with the real API base URL
const phpSrc = path.join(pluginDir, 'buildbot-woocommerce.php')
const phpContent = fs.readFileSync(phpSrc, 'utf8')
const patchedPhp = phpContent.replace(
  /define\('BUILDBOT_API_BASE',\s*'[^']*'\);/,
  `define('BUILDBOT_API_BASE', '${apiBase}');`
)

// Read the version straight from the plugin header — never hardcode it here,
// it drifts out of sync with the PHP file the moment either one is bumped alone.
const versionMatch = phpContent.match(/^\s*\*\s*Version:\s*([\d.]+)/m)
if (!versionMatch) {
  console.error('Could not find "Version:" header in', phpSrc)
  process.exit(1)
}
const VERSION = versionMatch[1]

// Write patched plugin to a temp dir for zipping
const tmpDir = path.join(outDir, '_tmp_plugin')
if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true })
fs.mkdirSync(tmpDir, { recursive: true })
// Copy all plugin files, using patched PHP
for (const name of fs.readdirSync(pluginDir)) {
  const src = path.join(pluginDir, name)
  const dst = path.join(tmpDir, name)
  if (name === 'buildbot-woocommerce.php') {
    fs.writeFileSync(dst, patchedPhp, 'utf8')
  } else {
    fs.copyFileSync(src, dst)
  }
}

try {
  zipFolderStoreOnly(tmpDir, zipPath, 'buildbot-woocommerce')
  console.log('[build-plugin] Wrote', zipPath, '(API base:', apiBase + ')')
} catch (err) {
  // Pure-JS zip has no OS dependency and should always succeed — if it
  // doesn't, a Windows-only PowerShell fallback would silently no-op on
  // Railway's Linux container, so fail loudly instead of masking it.
  console.error('[build-plugin] Zip failed:', err.message)
  try { fs.rmSync(tmpDir, { recursive: true }) } catch {}
  process.exit(1)
} finally {
  // Clean up temp dir
  try { fs.rmSync(tmpDir, { recursive: true }) } catch {}
}

const update = {
  name: 'BuildBot for WooCommerce',
  slug: 'buildbot-woocommerce',
  version: VERSION,
  download_url: `${process.env.PUBLIC_API_URL || 'https://build-volt-production.up.railway.app'}/buildbot-woocommerce.zip`,
  requires: '5.8',
  tested: '6.5',
  last_updated: new Date().toISOString().slice(0, 10),
  sections: {
    description: 'Sync WooCommerce products to BuildBot and inject the builder widget.',
  },
  api_base_hint: 'Set BUILDBOT_API_BASE in buildbot-woocommerce.php',
}

fs.writeFileSync(updatePath, JSON.stringify(update, null, 2))
console.log('[build-plugin] Wrote', updatePath)
