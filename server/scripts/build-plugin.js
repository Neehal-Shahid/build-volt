/**
 * Zip plugin/buildbot-woocommerce → server/public/buildbot-woocommerce.zip
 * and write plugin-update.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const pluginDir = path.join(root, 'plugin', 'buildbot-woocommerce')
const outDir = path.join(root, 'server', 'public')
const zipPath = path.join(outDir, 'buildbot-woocommerce.zip')
const updatePath = path.join(outDir, 'plugin-update.json')

const VERSION = '1.0.0'

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

try {
  zipFolderStoreOnly(pluginDir, zipPath, 'buildbot-woocommerce')
  console.log('[build-plugin] Wrote', zipPath)
} catch (err) {
  console.warn('[build-plugin] Pure zip failed, trying PowerShell…', err.message)
  const ps = `Compress-Archive -Path '${pluginDir}\\*' -DestinationPath '${zipPath}' -Force`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    process.exit(1)
  }
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
