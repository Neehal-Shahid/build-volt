import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { getDb, getPlatformConfig } from '../database.js'
import { getStoreById } from '../lib/auth.js'
import {
  canServeWidget,
  widgetPauseReason,
  pauseMessage,
  planLimit,
} from '../lib/storePlan.js'

const router = Router()

// USD per-token pricing, keyed by model ID prefix (checked longest-prefix-first below).
// Used only to estimate est_cost_usd for the admin usage/profit dashboard — not billed anywhere.
const MODEL_PRICING_PER_TOKEN = {
  'claude-opus-5':    { in: 5 / 1e6,    out: 25 / 1e6 },
  'claude-opus-4':     { in: 5 / 1e6,    out: 25 / 1e6 },
  'claude-sonnet-5':  { in: 3 / 1e6,    out: 15 / 1e6 },
  'claude-sonnet-4':   { in: 3 / 1e6,    out: 15 / 1e6 },
  'claude-haiku-4-5': { in: 1 / 1e6,    out: 5 / 1e6 },
  'claude-fable-5':   { in: 10 / 1e6,   out: 50 / 1e6 },
}

function pricingForModel(modelName) {
  const key = Object.keys(MODEL_PRICING_PER_TOKEN)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => modelName.startsWith(prefix))
  return key ? MODEL_PRICING_PER_TOKEN[key] : MODEL_PRICING_PER_TOKEN['claude-haiku-4-5']
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    builds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tier: { type: 'string' },
          tagline: { type: 'string' },
          buildName: { type: 'string' },
          totalPrice: { type: 'number' },
          withinBudget: { type: 'boolean' },
          budgetRemaining: { type: 'number' },
          compatible: { type: 'boolean' },
          compatibilityNote: { type: 'string' },
          parts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'number' },
                quantity: { type: 'number' },
                totalPrice: { type: 'number' },
                reason: { type: 'string' },
              },
              required: ['category', 'name', 'price', 'quantity', 'totalPrice', 'reason'],
              additionalProperties: false,
            },
          },
          missingCategories: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          tips: { type: 'string' },
          budgetAdvice: { type: 'string' },
        },
        required: [
          'tier', 'tagline', 'buildName', 'totalPrice', 'withinBudget', 'budgetRemaining',
          'compatible', 'compatibilityNote', 'parts', 'missingCategories', 'summary', 'tips', 'budgetAdvice',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['builds'],
  additionalProperties: false,
}

// Minimum set of categories required to produce a viable PC build.
// If the store catalog is missing any of these, we cannot build at all.
const ESSENTIAL_CATS = ['CPU', 'Motherboard', 'RAM', 'Storage']

// Cheapest possible build using the essentials — returned as minBudget
// when the user's budget is too low.
function computeMinBudget(products) {
  const cheapest = {}
  for (const p of products) {
    const price = Number(p.price)
    if (cheapest[p.category] === undefined || price < cheapest[p.category]) {
      cheapest[p.category] = price
    }
  }
  let total = 0
  for (const cat of ESSENTIAL_CATS) total += cheapest[cat] || 0
  return Math.ceil(total / 1000) * 1000   // round up to nearest 1 000
}

const PURPOSES = [
  'Office',
  'Studies',
  'Coding',
  'Designing',
  'Video Editing',
  'Gaming',
  'Streaming',
  'Mixed Use',
]

const ipHits = new Map()

function clientIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

function rateLimitIp(ip) {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000
  const max = 15
  let entry = ipHits.get(ip)
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 }
    ipHits.set(ip, entry)
  }
  entry.count += 1
  return entry.count <= max
}

function cacheKey(storeId, budget, purpose, extras) {
  return `${storeId}|${budget}|${purpose}|${String(extras || '').trim().toLowerCase()}`
}

async function countUsage(storeId, period) {
  const db = getDb()
  const sql =
    period === 'day'
      ? `SELECT COUNT(*) AS c FROM recommendations
         WHERE store_id = ? AND source != 'cached'
           AND created_at >= datetime('now', '-1 day')`
      : `SELECT COUNT(*) AS c FROM recommendations
         WHERE store_id = ? AND source != 'cached'
           AND created_at >= datetime('now', '-30 days')`
  const result = await db.execute({ sql, args: [storeId] })
  return Number(result.rows[0]?.c || 0)
}

function planLimitFromStore(store, config) {
  return planLimit(store, config)
}

function pickProducts(products, budget, purpose) {
  const cats = ['CPU', 'Motherboard', 'RAM', 'Storage', 'GPU', 'PSU', 'Case', 'Cooler']
  const byCat = {}
  for (const p of products) {
    if (Number(p.price) > budget) continue
    const cat = p.category || 'Other'
    if (!byCat[cat]) byCat[cat] = []
    byCat[cat].push(p)
  }
  for (const cat of Object.keys(byCat)) {
    byCat[cat].sort((a, b) => Number(a.price) - Number(b.price))
  }

  const gaming = /gaming|streaming|video|design/i.test(purpose)

  function buildTier(mode) {
    const parts = []
    let total = 0
    const missing = []
    for (const cat of cats) {
      const list = byCat[cat] || []
      if (!list.length) {
        if (cat === 'GPU' && !gaming && mode === 'budget') continue
        missing.push(cat)
        continue
      }
      let pick
      if (mode === 'budget') pick = list[0]
      else if (mode === 'max') pick = list[list.length - 1]
      else pick = list[Math.floor((list.length - 1) / 2)] || list[0]

      if (total + Number(pick.price) > budget && mode !== 'max') {
        // try cheaper
        const cheaper = list.find((x) => total + Number(x.price) <= budget)
        if (!cheaper) {
          missing.push(cat)
          continue
        }
        pick = cheaper
      }
      const price = Number(pick.price)
      parts.push({
        category: cat,
        name: pick.name,
        price,
        quantity: 1,
        totalPrice: price,
        reason: `${mode} pick for ${purpose}`,
      })
      total += price
    }
    return { parts, total, missing }
  }

  const budgetBuild = buildTier('budget')
  const balanced = buildTier('balanced')
  const max = buildTier('max')

  function buildSummary(tier, data) {
    const t = tier.toLowerCase()
    let why
    if (t.includes('budget')) {
      why = `focuses on the most affordable options to keep costs low while covering essential ${purpose} requirements`
    } else if (t.includes('balanced')) {
      why = `strikes the best price-to-performance balance for ${purpose} — a solid all-rounder without overspending`
    } else {
      why = `uses the highest-performing available components to maximise ${purpose} capability within the catalog`
    }
    const notes = []
    if (data.missing.length) {
      const m = data.missing.join(', ')
      notes.push(`${m} could not be included — not available in this store's catalog`)
    }
    if (data.total > budget) notes.push('this build slightly exceeds your budget')
    const suffix = notes.length ? ` Note: ${notes.join('; ')}.` : ''
    return `This build ${why}.${suffix}`
  }

  function pack(tier, tagline, data) {
    const within = data.total <= budget
    return {
      tier,
      tagline,
      buildName: `${purpose} ${tier}`,
      totalPrice: data.total,
      withinBudget: within,
      budgetRemaining: Math.max(0, budget - data.total),
      compatible: true,
      compatibilityNote: '',
      parts: data.parts,
      missingCategories: data.missing,
      summary: buildSummary(tier, data),
      tips: "Prices are from this store's catalog. Confirm stock before ordering.",
      budgetAdvice: within
        ? `About ${Math.round(data.total).toLocaleString()} PKR used of your budget.`
        : 'This build may exceed budget — trim GPU or storage if needed.',
    }
  }

  return [
    pack('Budget Build', 'Best value under budget', budgetBuild),
    pack('Balanced Build', 'Sweet spot performance', balanced),
    pack('Max Build', 'Push the budget', max),
  ]
}

function fakeBuilds(budget, purpose, currency) {
  const slice = Math.max(5000, Math.floor(budget / 6))
  const mk = (tier, tagline, mult) => {
    const total = Math.min(budget, Math.round(slice * mult * 5))
    return {
      tier,
      tagline,
      buildName: `${purpose} ${tier}`,
      totalPrice: total,
      withinBudget: total <= budget,
      budgetRemaining: Math.max(0, budget - total),
      compatible: true,
      compatibilityNote: '',
      parts: [
        { category: 'CPU', name: `[TEST] ${tier} CPU`, price: slice, quantity: 1, totalPrice: slice, reason: 'TEST_MODE' },
        { category: 'GPU', name: `[TEST] ${tier} GPU`, price: slice * 2, quantity: 1, totalPrice: slice * 2, reason: 'TEST_MODE' },
        { category: 'RAM', name: `[TEST] 16GB RAM`, price: Math.round(slice * 0.6), quantity: 1, totalPrice: Math.round(slice * 0.6), reason: 'TEST_MODE' },
        { category: 'Storage', name: `[TEST] 1TB SSD`, price: Math.round(slice * 0.7), quantity: 1, totalPrice: Math.round(slice * 0.7), reason: 'TEST_MODE' },
        { category: 'Motherboard', name: `[TEST] Board`, price: Math.round(slice * 0.8), quantity: 1, totalPrice: Math.round(slice * 0.8), reason: 'TEST_MODE' },
      ],
      missingCategories: [],
      summary: `TEST_MODE fake ${tier} for ${purpose}.`,
      tips: 'These are placeholder parts — add real catalog products for live AI picks.',
      budgetAdvice: `Budget ${Number(budget).toLocaleString()} ${currency}.`,
    }
  }
  return [
    mk('Budget Build', 'Test budget tier', 0.7),
    mk('Balanced Build', 'Test balanced tier', 0.9),
    mk('Max Build', 'Test max tier', 1.05),
  ]
}

async function logRecommendation({
  storeId,
  budget,
  purpose,
  extras,
  builds,
  canBuild,
  noBuildsReason,
  source,
  model,
  ip,
  inputTokens = 0,
  outputTokens = 0,
  estCost = 0,
}) {
  await getDb().execute({
    sql: `INSERT INTO recommendations (
      store_id, budget, purpose, extras, builds_json, can_build, no_builds_reason,
      source, model, input_tokens, output_tokens, est_cost_usd, ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      storeId,
      budget,
      purpose,
      extras || '',
      JSON.stringify(builds || []),
      canBuild ? 1 : 0,
      noBuildsReason || '',
      source,
      model || null,
      inputTokens,
      outputTokens,
      estCost,
      ip,
    ],
  })
}

router.post('/recommend', async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    const budget = Number(req.body.budget)
    const purpose = String(req.body.purpose || '').trim()
    const extras = String(req.body.extras || '').trim().slice(0, 300)
    const ip = clientIp(req)

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'storeId is required' })
    }
    if (!Number.isFinite(budget) || budget < 1000 || budget > 50_000_000) {
      return res.status(400).json({ success: false, error: 'Enter a valid budget' })
    }
    if (!purpose || !PURPOSES.includes(purpose)) {
      return res.status(400).json({
        success: false,
        error: 'Choose a valid purpose',
        purposes: PURPOSES,
      })
    }

    if (!rateLimitIp(ip)) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests from this network. Try again later.',
      })
    }

    const store = await getStoreById(storeId)
    if (!store || !store.active || store.disabled) {
      return res.status(404).json({ success: false, error: 'Store not available' })
    }

    const pauseReason = widgetPauseReason(store)
    if (pauseReason === 'trial_expired' || pauseReason === 'plan_expired') {
      return res.status(403).json({
        success: false,
        error: pauseMessage(pauseReason),
        code: pauseReason,
      })
    }
    if (!store.widget_enabled) {
      return res.status(403).json({ success: false, error: 'Widget is disabled for this store' })
    }

    const config = await getPlatformConfig()
    if (config.maintenance_mode === '1') {
      return res.status(503).json({ success: false, error: 'BuildBot is under maintenance' })
    }

    const { limit, period } = planLimitFromStore(store, config)
    const used = await countUsage(storeId, period)
    if (used >= limit) {
      return res.status(429).json({
        success: false,
        error: `Recommendation limit reached (${used}/${limit} per ${period}).`,
        usage: { used, limit, remaining: 0, period },
      })
    }

    const currency = store.currency || 'PKR'
    const productsResult = await getDb().execute({
      sql: `SELECT name, category, price, stock FROM products WHERE store_id = ? AND stock = 1`,
      args: [storeId],
    })
    const products = productsResult.rows || []

    // Cache: identical request within 24h
    const key = cacheKey(storeId, budget, purpose, extras)
    const cached = await getDb().execute({
      sql: `SELECT builds_json, can_build, no_builds_reason FROM recommendations
            WHERE store_id = ? AND budget = ? AND purpose = ? AND extras = ?
              AND source != 'cached'
              AND created_at >= datetime('now', '-1 day')
            ORDER BY id DESC LIMIT 1`,
      args: [storeId, budget, purpose, extras || ''],
    })

    if (cached.rows.length) {
      const row = cached.rows[0]
      let builds = []
      try {
        builds = JSON.parse(row.builds_json || '[]')
      } catch {
        builds = []
      }
      await logRecommendation({
        storeId,
        budget,
        purpose,
        extras,
        builds,
        canBuild: !!row.can_build,
        noBuildsReason: row.no_builds_reason || '',
        source: 'cached',
        model: null,
        ip,
      })
      return res.json({
        success: true,
        builds,
        canBuild: !!row.can_build,
        noBuildsReason: row.no_builds_reason || '',
        currency,
        usage: {
          used,
          limit,
          remaining: Math.max(0, limit - used),
          period,
        },
        cached: true,
        cacheKey: key,
      })
    }

    let builds = []
    let source = 'ai'
    let canBuild = true
    let noBuildsReason = ''
    let model = null

    const affordable = products.filter((p) => Number(p.price) <= budget)

    // ── Catalog sufficiency check ─────────────────────────────────────────
    // Verify the store has at least all 4 essential categories before we try
    // to build. If not, return a clear error — budget is irrelevant here.
    if (process.env.TEST_MODE !== 'true' && products.length) {
      const availableCats = new Set(products.map((p) => p.category))
      const missingEssential = ESSENTIAL_CATS.filter((c) => !availableCats.has(c))
      if (missingEssential.length > 0) {
        const noBuildsReason =
          `Store catalog is missing essential categories: ${missingEssential.join(', ')}. Cannot build a complete PC.`
        await logRecommendation({
          storeId, budget, purpose, extras, builds: [], canBuild: false,
          noBuildsReason, source: 'empty', model: null, ip,
        })
        return res.json({
          success: true,
          builds: [],
          canBuild: false,
          noBuildsReason,
          errorCode: 'insufficient_catalog',
          missingEssential,
          currency,
          usage: { used, limit, remaining: Math.max(0, limit - used), period },
          cached: false,
        })
      }
    }

    if (process.env.TEST_MODE === 'true') {
      source = 'test'
      model = 'test-mode'
      builds = fakeBuilds(budget, purpose, currency)
      canBuild = true
    } else if (!products.length) {
      canBuild = false
      noBuildsReason = 'This store has no products in stock yet.'
      builds = []
      source = 'empty'

      await logRecommendation({ storeId, budget, purpose, extras, builds, canBuild, noBuildsReason, source, model, ip })
      return res.json({
        success: true, builds, canBuild, noBuildsReason,
        errorCode: 'no_products',
        currency,
        usage: { used, limit, remaining: Math.max(0, limit - used), period },
        cached: false,
      })
    } else if (!affordable.length) {
      canBuild = false
      const minBudget = computeMinBudget(products)
      noBuildsReason =
        `Your budget of PKR ${Number(budget).toLocaleString()} is too low. ` +
        `A minimum of PKR ${minBudget.toLocaleString()} is needed for a basic build.`
      builds = []
      source = 'empty'

      await logRecommendation({ storeId, budget, purpose, extras, builds, canBuild, noBuildsReason, source, model, ip })
      return res.json({
        success: true, builds, canBuild, noBuildsReason,
        errorCode: 'budget_too_low',
        minBudget,
        currency,
        usage: { used, limit, remaining: Math.max(0, limit - used), period },
        cached: false,
      })
    } else {
      // Real Anthropic call
      const apiKey = process.env.ANTHROPIC_API_KEY
      const modelName = config.anthropic_model || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
      const maxTokens = Number(config.max_tokens || process.env.ANTHROPIC_MAX_TOKENS || 4096)

      if (!apiKey) {
        // No key yet — use heuristic so the widget still works locally
        source = 'heuristic'
        model = 'catalog-heuristic'
        builds = pickProducts(products, budget, purpose)
        canBuild = builds.some((b) => b.parts && b.parts.length > 0)
        if (!canBuild) noBuildsReason = 'Could not assemble builds from the catalog for this budget.'
      } else {
        // Build compact catalog string (no descriptions — reduces tokens)
        const catalogLines = affordable
          .map((p) => `[${p.category}] ${p.name} | PKR ${Number(p.price).toLocaleString()}`)
          .join('\n')

        const systemPrompt = [
          'You are BuildBot, an AI PC build recommender for a Pakistani PC parts store.',
          'Produce exactly 3 builds: Budget Build, Balanced Build, Max Build.',
          'summary: 2 sentences — first explains WHY this build suits the stated purpose and budget tier; second notes any trade-offs or missing parts.',
          'Only use products listed in the catalog. Do NOT invent or guess product names.',
          'If a required category is not in the catalog, add it to missingCategories — do NOT invent a product for it.',
          'Prices are in PKR.',
        ].join('\n')

        const userMsg = [
          `Budget: PKR ${budget.toLocaleString()}`,
          `Purpose: ${purpose}`,
          extras ? `Extras requested: ${extras}` : '',
          '',
          'Available products catalog:',
          catalogLines,
        ].filter(Boolean).join('\n')

        try {
          const anthropic = new Anthropic({ apiKey })
          const aiRes = await anthropic.messages.create({
            model: modelName,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMsg }],
            output_config: { format: { type: 'json_schema', schema: BUILD_SCHEMA } },
          })

          const rawText = aiRes.content.find((b) => b.type === 'text')?.text || ''
          const inputTokens  = aiRes.usage?.input_tokens  || 0
          const outputTokens = aiRes.usage?.output_tokens || 0

          const pricing = pricingForModel(modelName)
          const estCostUsd = inputTokens * pricing.in + outputTokens * pricing.out

          let parsed = null
          try {
            const obj = JSON.parse(rawText)
            if (Array.isArray(obj.builds)) parsed = obj.builds
          } catch (parseErr) {
            console.warn('[recommend] Anthropic response was not valid JSON — falling back to heuristic:', parseErr.message)
          }

          if (parsed && parsed.length) {
            builds = parsed.slice(0, 3)
            source = 'ai'
            model  = modelName
            canBuild = builds.some((b) => b.parts && b.parts.length > 0)
            if (!canBuild) noBuildsReason = 'AI could not assemble builds from the catalog for this budget.'

            // Log tokens/cost into this recommendation row
            await logRecommendation({
              storeId, budget, purpose, extras, builds, canBuild, noBuildsReason,
              source, model, ip, inputTokens, outputTokens, estCost: estCostUsd,
            })

            return res.json({
              success: true, builds, canBuild, noBuildsReason, currency,
              usage: { used: used + 1, limit, remaining: Math.max(0, limit - used - 1), period },
              cached: false,
            })
          } else {
            // AI returned empty — fall through to heuristic
            source = 'heuristic'
            model = 'catalog-heuristic'
            builds = pickProducts(products, budget, purpose)
            canBuild = builds.some((b) => b.parts && b.parts.length > 0)
            if (!canBuild) noBuildsReason = 'Could not assemble builds from the catalog for this budget.'
          }
        } catch (aiErr) {
          if (aiErr instanceof Anthropic.AuthenticationError) {
            console.error('[recommend] Anthropic auth error (bad/missing API key) — falling back to heuristic:', aiErr.message)
          } else if (aiErr instanceof Anthropic.RateLimitError) {
            console.error('[recommend] Anthropic rate limited — falling back to heuristic:', aiErr.message)
          } else if (aiErr instanceof Anthropic.APIConnectionError) {
            console.error('[recommend] Anthropic connection error — falling back to heuristic:', aiErr.message)
          } else if (aiErr instanceof Anthropic.APIError) {
            console.error(`[recommend] Anthropic API error (${aiErr.status}) — falling back to heuristic:`, aiErr.message)
          } else {
            console.error('[recommend] Unexpected error calling Anthropic — falling back to heuristic:', aiErr.message)
          }
          source = 'heuristic'
          model = 'catalog-heuristic'
          builds = pickProducts(products, budget, purpose)
          canBuild = builds.some((b) => b.parts && b.parts.length > 0)
          if (!canBuild) noBuildsReason = 'Could not assemble builds from the catalog for this budget.'
        }
      }
    }

    await logRecommendation({
      storeId,
      budget,
      purpose,
      extras,
      builds,
      canBuild,
      noBuildsReason,
      source,
      model,
      ip,
    })

    res.json({
      success: true,
      builds,
      canBuild,
      noBuildsReason,
      currency,
      usage: {
        used: used + 1,
        limit,
        remaining: Math.max(0, limit - used - 1),
        period,
      },
      cached: false,
    })
  } catch (err) {
    console.error('[recommend]', err)
    res.status(500).json({ success: false, error: 'Recommendation failed. Try again.' })
  }
})

export default router
export { PURPOSES }
