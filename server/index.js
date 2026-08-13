import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { initDB, countTable, getPlatformConfig } from './database.js'
import { cleanupOldPending } from './lib/auth.js'
import authRoutes from './routes/auth.js'
import storeRoutes from './routes/store.js'
import productRoutes from './routes/products.js'
import recommendRoutes from './routes/recommend.js'
import billingRoutes from './routes/billing.js'
import adminRoutes from './routes/admin.js'
import adminAdvancedRoutes from './routes/adminAdvanced.js'
import pluginRoutes from './routes/plugin.js'
import { startCron } from './cron.js'
import { ensurePluginArtifacts } from './lib/pluginArtifacts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '2mb' }))

app.get('/widget.js', (_req, res) => {
  res.type('application/javascript')
  res.sendFile(path.join(__dirname, 'widget.js'))
})

app.get('/widget.css', (_req, res) => {
  res.type('text/css')
  res.sendFile(path.join(__dirname, 'widget.css'))
})

app.get('/widget-test', (_req, res) => {
  res.type('html')
  res.sendFile(path.join(__dirname, 'widget-test.html'))
})

app.get('/buildbot-woocommerce.zip', (_req, res) => {
  const zip = path.join(__dirname, 'public', 'buildbot-woocommerce.zip')
  if (!fs.existsSync(zip)) {
    return res.status(404).json({ ok: false, error: 'Plugin zip not built yet' })
  }
  res.download(zip, 'buildbot-woocommerce.zip')
})

app.get('/plugin-update.json', (_req, res) => {
  const file = path.join(__dirname, 'public', 'plugin-update.json')
  if (!fs.existsSync(file)) {
    return res.status(404).json({ ok: false, error: 'plugin-update.json missing' })
  }
  res.type('json')
  res.sendFile(file)
})

app.get('/', async (_req, res) => {
  try {
    const [admins, stores, products, configKeys] = await Promise.all([
      countTable('admins'),
      countTable('stores'),
      countTable('products'),
      countTable('platform_config'),
    ])
    const config = await getPlatformConfig()

    res.json({
      ok: true,
      service: 'buildbot-api',
      phase: 12,
      time: new Date().toISOString(),
      testMode: process.env.TEST_MODE === 'true',
      emailTestMode: process.env.EMAIL_TEST_MODE === 'true',
      cronEnabled: process.env.CRON_ENABLED === 'true',
      db: {
        admins,
        stores,
        products,
        platform_config_keys: configKeys,
        trial_days: config.trial_days ?? null,
      },
    })
  } catch (err) {
    console.error('[health]', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const recommendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many recommendation requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/login', authLimiter)
app.use('/api/signup', authLimiter)
app.use('/api/forgot-password', authLimiter)
app.use('/api/resend-verification', authLimiter)
app.use('/api/admin/login', authLimiter)
app.use('/api/admin/forgot-password', authLimiter)
app.use('/api/recommend', recommendLimiter)

app.use('/api', authRoutes)
app.use('/api', storeRoutes)
app.use('/api', productRoutes)
app.use('/api', recommendRoutes)
app.use('/api', billingRoutes)
app.use('/api', adminRoutes)
app.use('/api', adminAdvancedRoutes)
app.use('/api', pluginRoutes)

async function start() {
  console.log('[boot] Initializing database…')
  await initDB()
  await cleanupOldPending()
  ensurePluginArtifacts()
  console.log('[boot] Database ready')

  app.listen(PORT, () => {
    console.log(`[boot] BuildBot API listening on http://127.0.0.1:${PORT}`)
    console.log(`[boot] Health check: GET http://127.0.0.1:${PORT}/`)
    console.log(`[boot] Widget test: http://127.0.0.1:${PORT}/widget-test?storeId=YOUR_STORE_ID`)
    console.log(`[boot] Plugin zip: http://127.0.0.1:${PORT}/buildbot-woocommerce.zip`)
    startCron()
  })
}

start().catch((err) => {
  console.error('[boot] Failed to start:', err.message)
  process.exit(1)
})
