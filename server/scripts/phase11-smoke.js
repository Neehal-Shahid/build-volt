/**
 * Phase 11 plugin API smoke test
 */
import 'dotenv/config'

const BASE = 'http://127.0.0.1:3001'
const uid = Date.now().toString(36)
const email = `woo_${uid}@test.local`
const password = 'WooTest123!'

async function req(path, { method = 'GET', body, token, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data }
}

function assert(name, cond, detail = '') {
  if (!cond) {
    console.error('FAIL', name, detail)
    process.exit(1)
  }
  console.log('PASS', name, detail || '')
}

const h = await req('/')
assert('phase 11', h.data?.phase === 11, `phase=${h.data?.phase}`)

const zip = await fetch(`${BASE}/buildbot-woocommerce.zip`)
assert('zip download', zip.status === 200, `len=${zip.headers.get('content-length')}`)

const upd = await req('/plugin-update.json')
assert('plugin-update.json', upd.status === 200 && upd.data?.version)

const signup = await req('/api/signup', {
  method: 'POST',
  body: { email, password },
})
const otp = signup.data?.devHint?.otp
const ver = await req('/api/verify-email-otp', { method: 'POST', body: { email, otp } })
let token = ver.data.token
const setup = await req('/api/store-setup', {
  method: 'PUT',
  token,
  body: { name: `Woo Shop ${uid}` },
})
token = setup.data.token
const storeId = setup.data.store.id

const bad = await req('/api/plugin/ping', {
  method: 'POST',
  body: {},
  headers: { 'X-BuildBot-Store-ID': storeId, 'X-BuildBot-Secret': 'wrong' },
})
assert('wrong secret rejected', bad.status === 401)

const gen = await req('/api/plugin/generate-key', { method: 'POST', token })
assert('generate-key', gen.status === 200 && gen.data.pluginSecret)
const secret = gen.data.pluginSecret

const st = await req('/api/plugin/status', { token })
assert('status hasSecret', st.data?.hasSecret === true)

const ping = await req('/api/plugin/ping', {
  method: 'POST',
  body: {},
  headers: { 'X-BuildBot-Store-ID': storeId, 'X-BuildBot-Secret': secret },
})
assert('ping', ping.status === 200 && ping.data.success)

const sync = await req('/api/plugin/sync', {
  method: 'POST',
  headers: { 'X-BuildBot-Store-ID': storeId, 'X-BuildBot-Secret': secret },
  body: {
    products: [
      {
        id: '101',
        name: 'Ryzen 5 5600',
        price: 45000,
        categories: ['Processors'],
        stock: true,
      },
      {
        id: '102',
        name: 'RTX 3060',
        price: 90000,
        categories: ['Graphics Cards'],
        stock: true,
      },
      { id: '103', name: 'Random Cable', price: 500, categories: ['Accessories'], stock: true },
    ],
  },
})
assert('sync', sync.status === 200 && sync.data.imported === 3, JSON.stringify(sync.data))

const manage = await req(`/api/products/manage/${storeId}`, { token })
assert('products after sync', (manage.data?.products?.length || 0) === 3)
const cats = manage.data.products.map((p) => p.category)
assert('category map CPU', cats.includes('CPU'))
assert('category map GPU', cats.includes('GPU'))

const updP = await req('/api/plugin/product/update', {
  method: 'POST',
  headers: { 'X-BuildBot-Store-ID': storeId, 'X-BuildBot-Secret': secret },
  body: { wooProductId: '101', name: 'Ryzen 5 5600X', price: 48000, categories: ['CPU'], stock: true },
})
assert('product update', updP.status === 200)

const del = await req('/api/plugin/product/delete', {
  method: 'POST',
  headers: { 'X-BuildBot-Store-ID': storeId, 'X-BuildBot-Secret': secret },
  body: { wooProductId: '103' },
})
assert('product delete', del.status === 200)

const manage2 = await req(`/api/products/manage/${storeId}`, { token })
assert('after delete count', manage2.data.products.length === 2)

const lock = await req('/api/product', {
  method: 'POST',
  token,
  body: { name: 'Manual Part', category: 'Other', price: 1 },
})
assert('woo locks manual create', lock.status === 403)

const tog = await req('/api/plugin/widget-toggle', {
  method: 'POST',
  headers: { 'X-BuildBot-Store-ID': storeId, 'X-BuildBot-Secret': secret },
  body: { enabled: false },
})
assert('widget toggle', tog.status === 200 && tog.data.widgetEnabled === false)

const cfg = await req(`/api/plugin/widget-config/${storeId}`, {
  headers: { 'X-BuildBot-Store-ID': storeId, 'X-BuildBot-Secret': secret },
})
assert('widget-config', cfg.status === 200 && cfg.data.storeId === storeId)

const cs = await req('/api/plugin/connection-status', {
  method: 'POST',
  headers: { 'X-BuildBot-Store-ID': storeId, 'X-BuildBot-Secret': secret },
  body: {},
})
assert('connection-status', cs.status === 200 && cs.data.wooConnected === true)

const disc = await req('/api/plugin/disconnect', { method: 'POST', token })
assert('dashboard disconnect', disc.status === 200 && disc.data.store.wooConnected === false)

console.log('\nPHASE11_OK')
