(function () {
  'use strict'

  var script =
    document.currentScript ||
    (function () {
      var list = document.getElementsByTagName('script')
      for (var i = list.length - 1; i >= 0; i--) {
        if ((list[i].getAttribute('src') || '').indexOf('widget.js') !== -1) return list[i]
      }
      return null
    })()

  if (!script) return

  var storeId = script.getAttribute('data-store-id')
  if (!storeId) return
  // Preview pages (the dashboard's own /widget-test page) set this so we never
  // report a false "installed" ping just because someone previewed the widget.
  var isPreview = script.getAttribute('data-preview') === '1'

  var origin
  try {
    origin = new URL(script.src || '', window.location.href).origin
  } catch (e) {
    return
  }

  var API = origin
  var PURPOSES = [
    'Office',
    'Studies',
    'Coding',
    'Designing',
    'Video Editing',
    'Gaming',
    'Streaming',
    'Mixed Use',
  ]
  // Inline SVG icons (stroke-based, 24x24 viewBox) — no emoji, no external assets
  function svgIcon(inner) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'
  }

  var PURPOSE_ICONS = {
    'Office': svgIcon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    'Studies': svgIcon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    'Coding': svgIcon('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    'Designing': svgIcon('<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>'),
    'Video Editing': svgIcon('<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5"/>'),
    'Gaming': svgIcon('<rect x="2" y="7" width="20" height="10" rx="5"/><line x1="7" y1="12" x2="11" y2="12"/><line x1="9" y1="10" x2="9" y2="14"/><circle cx="15" cy="10.5" r=".6" fill="currentColor"/><circle cx="17.5" cy="13" r=".6" fill="currentColor"/>'),
    'Streaming': svgIcon('<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M8.5 8.5a5 5 0 0 0 0 7"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.5 5.5a9 9 0 0 0 0 13"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'),
    'Mixed Use': svgIcon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'),
  }
  var EXTRA_CHIPS = ['Monitor', 'Keyboard', 'Mouse', 'Headset', 'Webcam']
  var EXTRA_ICONS = {
    'Monitor': svgIcon('<rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
    'Keyboard': svgIcon('<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="6" y1="14" x2="18" y2="14"/>'),
    'Mouse': svgIcon('<rect x="6" y="2" width="12" height="20" rx="6"/><line x1="12" y1="6" x2="12" y2="10"/>'),
    'Headset': svgIcon('<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="1" y="14" width="5" height="7" rx="2"/><rect x="18" y="14" width="5" height="7" rx="2"/>'),
    'Webcam': svgIcon('<circle cx="12" cy="10" r="6"/><circle cx="12" cy="10" r="2" fill="currentColor" stroke="none"/><path d="M8 21h8"/><path d="M12 16v5"/>'),
  }
  // Steps that make up the guided flow — used to render the top progress bar
  var FLOW_STEPS = ['welcome', 'budget', 'purpose', 'extras']

  function renderProgress(screen) {
    var idx = FLOW_STEPS.indexOf(screen)
    if (idx < 0) return ''
    var pct = Math.round((idx / (FLOW_STEPS.length - 1)) * 100)
    return (
      '<div class="bb-progress" role="progressbar" aria-valuenow="' + pct +
      '" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="bb-progress-fill" style="width:' + pct + '%"></div>' +
      '</div>'
    )
  }

  var state = {
    config: null,
    open: false,
    screen: 'welcome',
    budget: '',
    purpose: '',
    extrasSelected: [],
    extrasText: '',
    result: null,
    error: '',
  }

  // ── CSS injection ─────────────────────────────────────────────────────────────

  function injectCss() {
    if (document.getElementById('bb-widget-css')) return
    var link = document.createElement('link')
    link.id = 'bb-widget-css'
    link.rel = 'stylesheet'
    link.href = API + '/widget.css'
    document.head.appendChild(link)
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────

  function applyTheme(cfg) {
    var root = document.documentElement
    if (cfg.brandColor) root.style.setProperty('--bb-brand', cfg.brandColor)
    // Panel background is always white for readability — no dark mode.
    root.style.setProperty('--bb-bg', '#FFFFFF')
    root.style.setProperty('--bb-text', '#0A1A2D')
    root.style.setProperty('--bb-muted', '#64748B')
    root.style.setProperty('--bb-border', '#E2E8F0')
    root.style.setProperty('--bb-panel', '#F8FAFC')
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function money(n, currency) {
    return (currency || 'PKR') + ' ' + Number(n || 0).toLocaleString()
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // ── Tiny hand-rolled PDF writer (no library) ────────────────────────────────
  // Same philosophy as the server's hand-rolled ZIP writer for the WooCommerce
  // plugin — a real PDF file, built by hand, with no external dependency added
  // to a widget script that runs on arbitrary third-party storefronts.

  // Standard Helvetica AFM advance widths (per 1000 em units) — used only to
  // right-align price text and word-wrap the summary; no font is embedded,
  // Helvetica is one of the 14 standard PDF fonts every reader already has.
  var HELV_W = {
    ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
    '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
    '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
    ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
    A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
    K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
    U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
    '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
    a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
    k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
    u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
    '{': 334, '|': 260, '}': 334, '~': 584,
  }

  function pdfTextWidth(str, size) {
    var w = 0
    for (var i = 0; i < str.length; i++) w += (HELV_W[str[i]] || 556)
    return (w * size) / 1000
  }

  // PDF's standard fonts only cover printable ASCII — strip/normalize anything
  // else so unusual product names never produce a corrupt content stream.
  function pdfSanitize(s) {
    return String(s || '')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/[^\x20-\x7E]/g, '')
  }

  function pdfEscape(s) {
    return pdfSanitize(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  }

  function pdfWrapText(str, maxWidth, size) {
    var words = pdfSanitize(str).split(/\s+/).filter(Boolean)
    var lines = []
    var cur = ''
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i]
      if (cur && pdfTextWidth(test, size) > maxWidth) {
        lines.push(cur)
        cur = words[i]
      } else {
        cur = test
      }
    }
    if (cur) lines.push(cur)
    return lines
  }

  function pdfPad10(n) {
    var s = String(n)
    while (s.length < 10) s = '0' + s
    return s
  }

  // ASCII-only string -> bytes. Every string fed into this has already been
  // through pdfSanitize/pdfEscape, so a 1:1 char->byte mapping is exact.
  function pdfBytes(str) {
    var bytes = new Uint8Array(str.length)
    for (var i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff
    return bytes
  }

  // Renders one build into a single-page Letter-size PDF and returns raw bytes.
  function buildPdfDocument(build, currency, cfg) {
    var margin = 54, pageW = 612, pageH = 792
    var contentW = pageW - margin * 2
    var ops = []
    var y = pageH - 60

    function line(x, yy, str, font, size) {
      ops.push('BT /' + font + ' ' + size + ' Tf ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + pdfEscape(str) + ') Tj ET')
    }
    function lineRight(xRight, yy, str, font, size) {
      var clean = pdfSanitize(str)
      line(xRight - pdfTextWidth(clean, size), yy, clean, font, size)
    }
    function band(x, yy, w, h, gray) {
      ops.push(gray.toFixed(2) + ' g ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f 0 g')
    }
    function rule(x1, yy, x2, gray) {
      ops.push(gray.toFixed(2) + ' G ' + x1.toFixed(2) + ' ' + yy.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + yy.toFixed(2) + ' l S 0 G')
    }

    line(margin, y, build.tier || 'Build', 'F2', 20)
    y -= 24
    var sub = money(state.budget, currency) + ' budget   |   ' + (state.purpose || '') + '   |   ' + (cfg.widgetTitle || 'BuildBot')
    line(margin, y, sub, 'F1', 10)
    y -= 26

    if (build.summary) {
      line(margin, y, 'WHY THIS BUILD?', 'F2', 8)
      y -= 14
      var wrapped = pdfWrapText(build.summary, contentW, 10)
      for (var w = 0; w < wrapped.length; w++) { line(margin, y, wrapped[w], 'F1', 10); y -= 14 }
      y -= 10
    }

    band(margin, y - 4, contentW, 20, 0.93)
    line(margin + 6, y, 'CATEGORY', 'F2', 8)
    line(margin + 140, y, 'COMPONENT', 'F2', 8)
    lineRight(margin + contentW - 6, y, 'PRICE', 'F2', 8)
    y -= 24

    var parts = build.parts || []
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i]
      line(margin + 6, y, p.category || '', 'F1', 10)
      line(margin + 140, y, p.name || '', 'F1', 10)
      lineRight(margin + contentW - 6, y, money(p.price, currency), 'F1', 10)
      y -= 16
      rule(margin, y + 5, margin + contentW, 0.9)
      y -= 4
    }

    y -= 6
    band(margin, y - 6, contentW, 22, 0.93)
    line(margin + 6, y, 'TOTAL', 'F2', 11)
    lineRight(margin + contentW - 6, y, money(build.totalPrice, currency), 'F2', 11)
    y -= 32

    var missing = build.missingCategories || []
    if (missing.length) {
      line(margin, y, 'Not included (not in catalog): ' + missing.join(', '), 'F1', 9)
      y -= 16
    }
    if (build.withinBudget === false) {
      line(margin, y, 'This build exceeds your budget.', 'F1', 9)
      y -= 16
    }

    line(margin, 40, 'Generated by BuildBot', 'F1', 8)

    var content = ops.join('\n')
    var objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] ' +
        '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
      { stream: content },
    ]

    var out = '%PDF-1.4\n'
    var offsets = [0]
    for (var n = 0; n < objs.length; n++) {
      offsets.push(out.length)
      var obj = objs[n]
      if (obj && obj.stream !== undefined) {
        out += (n + 1) + ' 0 obj\n<< /Length ' + obj.stream.length + ' >>\nstream\n' + obj.stream + '\nendstream\nendobj\n'
      } else {
        out += (n + 1) + ' 0 obj\n' + obj + '\nendobj\n'
      }
    }

    var xrefStart = out.length
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n'
    for (var j = 1; j <= objs.length; j++) out += pdfPad10(offsets[j]) + ' 00000 n \n'
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF'

    return pdfBytes(out)
  }

  // ── Config + ping ─────────────────────────────────────────────────────────────

  function fetchConfig() {
    return fetch(API + '/api/store-config/' + encodeURIComponent(storeId))
      .then(function (res) { return res.json() })
      .then(function (data) {
        if (!data || !data.success) return null
        if (data.active === false || data.widgetEnabled === false || data.paused) return null
        return data
      })
      .catch(function () { return null })
  }

  function sendInstallPing() {
    if (isPreview) return
    try {
      fetch(API + '/api/widget-ping/' + encodeURIComponent(storeId), {
        method: 'POST',
        keepalive: true,
      }).catch(function () {})
    } catch (e) {}
  }

  // ── Screen transitions ────────────────────────────────────────────────────────

  function panelBody() {
    return document.querySelector('#bb-panel .bb-body')
  }

  /**
   * D1: Animated screen transitions — fade + subtle slide up.
   * We swap innerHTML then trigger the CSS animation class.
   */
  function render() {
    var body = panelBody()
    if (!body || !state.config) return
    var cfg = state.config

    // Paint the new screen content
    if (state.screen === 'welcome') renderWelcome(body, cfg)
    else if (state.screen === 'budget') renderBudget(body, cfg)
    else if (state.screen === 'purpose') renderPurpose(body)
    else if (state.screen === 'extras') renderExtras(body)
    else if (state.screen === 'loading') renderLoading(body)
    else if (state.screen === 'results') renderResults(body, cfg)
    else if (state.screen === 'error') renderError(body)

    // Trigger enter animation — remove then re-add the class so it restarts
    body.classList.remove('bb-screen-enter')
    // Force reflow so the browser registers the class removal
    void body.offsetWidth
    body.classList.add('bb-screen-enter')
  }

  // ── Screen renderers ──────────────────────────────────────────────────────────

  function renderWelcome(body, cfg) {
    body.innerHTML =
      renderProgress('welcome') +
      '<h2 class="bb-title"></h2>' +
      '<p class="bb-muted"></p>' +
      '<button type="button" class="bb-btn" id="bb-start"></button>'
    body.querySelector('.bb-title').textContent = cfg.widgetTitle || 'BuildBot'
    body.querySelector('.bb-muted').textContent =
      cfg.welcomeMsg || 'Tell us your budget and what you need the PC for.'
    var btn = body.querySelector('#bb-start')
    btn.textContent = cfg.buttonText || 'Get Started'
    btn.onclick = function () {
      state.screen = 'budget'
      render()
    }
  }

  function renderBudget(body, cfg) {
    var presets = cfg.budgetPresets || [50000, 80000, 120000, 200000]
    var chips = presets
      .map(function (p) {
        return (
          '<button type="button" class="bb-chip" data-budget="' + p + '">' +
          Number(p).toLocaleString() +
          '</button>'
        )
      })
      .join('')
    body.innerHTML =
      renderProgress('budget') +
      '<h2 class="bb-title">Your budget</h2>' +
      '<p class="bb-muted">How much can you spend? (' + escapeHtml(cfg.currency || 'PKR') + ')</p>' +
      '<input class="bb-input" id="bb-budget" type="number" min="1000" step="1000" placeholder="e.g. 80000" />' +
      '<div class="bb-chips">' + chips + '</div>' +
      '<button type="button" class="bb-btn" id="bb-next">Continue</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-back">Back</button>'

    var input = body.querySelector('#bb-budget')
    input.value = state.budget || ''
    body.querySelectorAll('[data-budget]').forEach(function (el) {
      el.onclick = function () {
        state.budget = el.getAttribute('data-budget')
        input.value = state.budget
        // Highlight selected chip
        body.querySelectorAll('[data-budget]').forEach(function (c) {
          c.classList.remove('bb-chip-active')
        })
        el.classList.add('bb-chip-active')
      }
    })
    // Pre-highlight if budget already selected
    if (state.budget) {
      var pre = body.querySelector('[data-budget="' + state.budget + '"]')
      if (pre) pre.classList.add('bb-chip-active')
    }
    body.querySelector('#bb-back').onclick = function () {
      state.screen = 'welcome'
      render()
    }
    body.querySelector('#bb-next').onclick = function () {
      state.budget = String(input.value || '').trim()
      if (!state.budget || Number(state.budget) < 1000) {
        input.classList.add('bb-input-error')
        input.focus()
        return
      }
      state.screen = 'purpose'
      render()
    }
  }

  function renderPurpose(body) {
    var chips = PURPOSES.map(function (p) {
      var active = state.purpose === p ? ' bb-chip-active' : ''
      var icon = PURPOSE_ICONS[p] ? '<span class="bb-chip-icon" aria-hidden="true">' + PURPOSE_ICONS[p] + '</span>' : ''
      return (
        '<button type="button" class="bb-chip' + active + '" data-purpose="' + p + '">' +
        icon + p +
        '</button>'
      )
    }).join('')
    body.innerHTML =
      renderProgress('purpose') +
      '<h2 class="bb-title">What will you use it for?</h2>' +
      '<p class="bb-muted">Pick one purpose</p>' +
      '<div class="bb-chips">' + chips + '</div>' +
      '<button type="button" class="bb-btn" id="bb-next">Continue</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-back">Back</button>'

    body.querySelectorAll('[data-purpose]').forEach(function (el) {
      el.onclick = function () {
        state.purpose = el.getAttribute('data-purpose')
        renderPurpose(body)
      }
    })
    body.querySelector('#bb-back').onclick = function () {
      state.screen = 'budget'
      render()
    }
    body.querySelector('#bb-next').onclick = function () {
      if (!state.purpose) {
        // Shake the chips container instead of alert()
        var chips = body.querySelector('.bb-chips')
        if (chips) {
          chips.classList.add('bb-shake')
          setTimeout(function () { chips.classList.remove('bb-shake') }, 500)
        }
        return
      }
      state.screen = 'extras'
      render()
    }
  }

  function renderExtras(body) {
    var chips = EXTRA_CHIPS.map(function (p) {
      var on = state.extrasSelected.indexOf(p) >= 0 ? ' bb-chip-active' : ''
      var icon = EXTRA_ICONS[p] ? '<span class="bb-chip-icon" aria-hidden="true">' + EXTRA_ICONS[p] + '</span>' : ''
      return (
        '<button type="button" class="bb-chip' + on + '" data-extra="' + p + '">' +
        icon + p +
        '</button>'
      )
    }).join('')
    body.innerHTML =
      renderProgress('extras') +
      '<h2 class="bb-title">Any extras?</h2>' +
      '<p class="bb-muted">Optional — accessories or notes</p>' +
      '<div class="bb-chips">' + chips + '</div>' +
      '<input class="bb-input" id="bb-extra-text" placeholder="e.g. WiFi card, white case" />' +
      '<button type="button" class="bb-btn" id="bb-next">Get builds</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-back">Back</button>'

    body.querySelector('#bb-extra-text').value = state.extrasText || ''
    body.querySelectorAll('[data-extra]').forEach(function (el) {
      el.onclick = function () {
        var v = el.getAttribute('data-extra')
        var idx = state.extrasSelected.indexOf(v)
        if (idx >= 0) state.extrasSelected.splice(idx, 1)
        else state.extrasSelected.push(v)
        renderExtras(body)
      }
    })
    body.querySelector('#bb-back').onclick = function () {
      state.screen = 'purpose'
      render()
    }
    body.querySelector('#bb-next').onclick = function () {
      state.extrasText = body.querySelector('#bb-extra-text').value || ''
      runRecommend()
    }
  }

  function renderLoading(body) {
    body.innerHTML =
      '<div class="bb-loading-wrap">' +
      '<div class="bb-spinner"></div>' +
      '<h2 class="bb-title" style="margin-top:1rem">Building recommendations…</h2>' +
      '<ul class="bb-steps">' +
      '<li class="bb-step on">Checking your budget</li>' +
      '<li class="bb-step" id="s2">Matching catalog parts</li>' +
      '<li class="bb-step" id="s3">Assembling 3 builds</li>' +
      '</ul>' +
      '</div>'
    setTimeout(function () {
      var s2 = document.getElementById('s2')
      if (s2) s2.classList.add('on')
    }, 600)
    setTimeout(function () {
      var s3 = document.getElementById('s3')
      if (s3) s3.classList.add('on')
    }, 1400)
  }

  function renderError(body) {
    body.innerHTML =
      '<h2 class="bb-title">Could not get builds</h2>' +
      '<p class="bb-muted"></p>' +
      '<button type="button" class="bb-btn" id="bb-retry">Try again</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-home">Start over</button>'
    body.querySelector('.bb-muted').textContent = state.error || 'Something went wrong'
    body.querySelector('#bb-retry').onclick = function () {
      state.screen = 'extras'
      render()
    }
    body.querySelector('#bb-home').onclick = function () {
      state.screen = 'welcome'
      state.result = null
      render()
    }
  }

  // ── No-build screen: budget-too-low / missing catalog / etc. ──────────────────

  function renderNoBuild(body, data, cfg) {
    var currency = data.currency || cfg.currency || 'PKR'
    var code = data.errorCode || ''
    var heading = 'No builds available'
    var message = ''
    var extraHtml = ''

    if (code === 'budget_too_low' && data.minBudget) {
      heading = 'Budget too low'
      message = 'Your budget of ' + escapeHtml(money(state.budget, currency)) +
        ' is not enough to build a PC from this store\u2019s catalog.'
      extraHtml =
        '<div class="bb-min-budget">' +
          '<span class="bb-min-label">Minimum needed</span>' +
          '<span class="bb-min-amount">' + escapeHtml(money(data.minBudget, currency)) + '</span>' +
        '</div>'
    } else if (code === 'insufficient_catalog') {
      heading = 'Catalog incomplete'
      message = 'This store is missing essential PC components.'
      if (data.missingEssential && data.missingEssential.length) {
        extraHtml =
          '<ul class="bb-missing-cats">' +
          data.missingEssential.map(function (c) {
            return '<li>' + escapeHtml(c) + ' — not in catalog</li>'
          }).join('') +
          '</ul>'
      }
    } else if (code === 'no_products') {
      heading = 'No products yet'
      message = 'This store hasn\u2019t added any products yet. Check back soon.'
    } else {
      message = data.noBuildsReason || 'Try a higher budget or check the store catalog.'
    }

    var noBuildIcon = code === 'budget_too_low'
      ? '<svg class="bb-icon-brand" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>'
      : '<svg class="bb-icon-warn" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'

    body.innerHTML =
      '<div class="bb-no-build">' +
        '<div class="bb-no-build-icon">' + noBuildIcon + '</div>' +
        '<h2 class="bb-title">' + escapeHtml(heading) + '</h2>' +
        '<p class="bb-muted">' + escapeHtml(message) + '</p>' +
        extraHtml +
      '</div>' +
      (code === 'budget_too_low'
        ? '<button type="button" class="bb-btn" id="bb-adjust">Adjust budget</button>'
        : '') +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-restart">Start over</button>'

    var adj = body.querySelector('#bb-adjust')
    if (adj) adj.onclick = function () { state.screen = 'budget'; render() }
    body.querySelector('#bb-restart').onclick = function () {
      state.screen = 'welcome'; state.result = null; render()
    }
  }

  // ── Results screen — 3 cards, each with Details + PDF ─────────────────────────

  function renderResults(body, cfg) {
    var data = state.result || {}
    var builds = data.builds || []
    var currency = data.currency || cfg.currency || 'PKR'

    if (!data.canBuild) { renderNoBuild(body, data, cfg); return }

    var pdfIco = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>'

    var cards = builds.map(function (b, idx) {
      var within = b.withinBudget !== false
      var featured = builds.length === 3 && idx === 1
      return (
        '<div class="bb-rc' + (featured ? ' bb-rc-featured' : '') + '" data-idx="' + idx + '">' +
          (featured
            ? '<span class="bb-rc-ribbon"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
              '<path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 7.1-1.01L12 2z"/></svg> Most Popular</span>'
            : '') +
          '<div class="bb-rc-head">' +
            '<strong class="bb-rc-tier">' + escapeHtml(b.tier || 'Build') + '</strong>' +
            '<span class="bb-rc-price">' + escapeHtml(money(b.totalPrice, currency)) + '</span>' +
          '</div>' +
          '<span class="bb-rc-tag">' + escapeHtml(b.tagline || '') + '</span>' +
          '<span class="bb-rc-badge ' + (within ? 'bb-badge-ok' : 'bb-badge-over') + '">' +
            (within ? '\u2713 Within budget' : '\u2191 Over budget') +
          '</span>' +
          '<div class="bb-rc-actions">' +
            '<button type="button" class="bb-rc-detail" data-action="detail" data-idx="' + idx + '">View details</button>' +
            '<button type="button" class="bb-rc-pdf" data-action="pdf" data-idx="' + idx + '">' + pdfIco + ' PDF</button>' +
          '</div>' +
        '</div>'
      )
    }).join('')

    var usage = data.usage
      ? '<p class="bb-tiny" style="margin-top:0.4rem">Usage: ' +
          escapeHtml(String(data.usage.used)) + '/' +
          escapeHtml(String(data.usage.limit)) + ' (' +
          escapeHtml(String(data.usage.period || '')) + ')</p>'
      : ''

    body.innerHTML =
      '<h2 class="bb-title">Your 3 builds</h2>' +
      '<p class="bb-muted">Tap a build to see why it fits your needs.</p>' +
      '<div class="bb-result-cards">' + cards + '</div>' +
      usage +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-home" style="margin-top:0.5rem">Start over</button>' +
      '<div id="bb-modal" class="bb-modal" hidden></div>'

    // Wire buttons inside each card
    body.querySelectorAll('[data-action="detail"]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation()
        openModal(builds[Number(btn.getAttribute('data-idx'))], currency, cfg)
      }
    })
    body.querySelectorAll('[data-action="pdf"]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation()
        downloadBuildPdf(builds[Number(btn.getAttribute('data-idx'))], currency, cfg)
      }
    })
    // Click anywhere on the card (outside buttons) also opens details
    body.querySelectorAll('.bb-rc').forEach(function (card) {
      card.onclick = function (e) {
        if (e.target.closest('[data-action]')) return
        openModal(builds[Number(card.getAttribute('data-idx'))], currency, cfg)
      }
    })

    body.querySelector('#bb-home').onclick = function () {
      state.screen = 'welcome'; state.result = null; render()
    }
  }

  // ── D4: Build summary text for sharing ───────────────────────────────────────

  function buildSummaryText(builds, currency, cfg) {
    var lines = [
      (cfg.widgetTitle || 'BuildBot') + ' — PC Build Recommendations',
      'Budget: ' + money(state.budget, currency) + ' · Purpose: ' + (state.purpose || ''),
      '',
    ]
    builds.forEach(function (b) {
      lines.push('── ' + (b.tier || 'Build') + ' (' + money(b.totalPrice, currency) + ') ──')
      ;(b.parts || []).forEach(function (p) {
        lines.push('  ' + p.category + ': ' + p.name + ' — ' + money(p.price, currency))
      })
      lines.push('')
    })
    return lines.join('\n')
  }

  function shareViaFallback(text) {
    // Use Web Share API if available (mobile), else show a textarea the user can copy from
    if (navigator.share) {
      navigator.share({ title: 'BuildBot PC Builds', text: text }).catch(function () {})
      return
    }
    // Last resort: show the text in a small overlay inside the panel
    var existing = document.getElementById('bb-share-overlay')
    if (existing) { existing.remove(); return }
    var overlay = document.createElement('div')
    overlay.id = 'bb-share-overlay'
    overlay.className = 'bb-share-overlay'
    overlay.innerHTML =
      '<p class="bb-muted" style="margin:0 0 0.5rem;font-size:0.82rem">Copy the text below:</p>' +
      '<textarea class="bb-share-text" readonly></textarea>' +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-share-close" style="margin-top:0.5rem">Close</button>'
    overlay.querySelector('.bb-share-text').value = text
    var body = panelBody()
    if (body) body.appendChild(overlay)
    overlay.querySelector('#bb-share-close').onclick = function () { overlay.remove() }
    var ta = overlay.querySelector('.bb-share-text')
    ta.focus()
    ta.select()
  }

  // ── Per-build PDF download ─────────────────────────────────────────────────
  // Generates a real PDF (see buildPdfDocument above) and downloads it directly
  // — no new tab, no print dialog. Each build card and the modal call this.

  function downloadBuildPdf(build, currency, cfg) {
    var bytes = buildPdfDocument(build, currency, cfg)
    var blob = new Blob([bytes], { type: 'application/pdf' })
    var url = URL.createObjectURL(blob)
    var filename = pdfSanitize(build.tier || 'Build').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Build'
    var a = document.createElement('a')
    a.href = url; a.download = filename + '.pdf'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(function () { URL.revokeObjectURL(url) }, 30000)
  }

  // ── Modal — build detail + “Why this build?” + per-build PDF ────────────────

  function openModal(build, currency, cfg) {
    var modal = document.getElementById('bb-modal')
    if (!modal || !build) return

    var partsRows = (build.parts || []).map(function (p) {
      return '<tr>' +
        '<td class="bb-pt-cat">' + escapeHtml(p.category) + '</td>' +
        '<td class="bb-pt-nm">'  + escapeHtml(p.name)     + '</td>' +
        '<td class="bb-pt-pr">'  + money(p.price, currency) + '</td>' +
      '</tr>'
    }).join('')

    var missing = build.missingCategories || []
    var missingHtml = missing.length
      ? '<div class="bb-modal-warn">' +
          '<strong>Not included (not in catalog):</strong> ' +
          missing.map(function (c) { return escapeHtml(c) }).join(', ') +
        '</div>'
      : ''

    var overHtml = build.withinBudget === false
      ? '<div class="bb-modal-warn bb-modal-warn-over">This build exceeds your budget.</div>'
      : ''

    var pdfSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>'

    modal.hidden = false
    modal.innerHTML =
      '<div class="bb-modal-card">' +
        '<div class="bb-modal-head">' +
          '<div>' +
            '<strong id="bb-m-tier"></strong>' +
            '<p class="bb-muted" id="bb-m-tag" style="margin:.1rem 0 0;font-size:.82rem"></p>' +
          '</div>' +
          '<div class="bb-modal-head-btns">' +
            '<button type="button" class="bb-btn bb-btn-ghost bb-btn-icon" id="bb-m-pdf">' + pdfSvg + ' Download PDF</button>' +
            '<button type="button" class="bb-close" id="bb-m-close" aria-label="Close">×</button>' +
          '</div>' +
        '</div>' +
        (build.summary
          ? '<div class="bb-modal-why">' +
              '<p class="bb-modal-why-label">Why this build?</p>' +
              '<p class="bb-modal-why-text" id="bb-m-summary"></p>' +
            '</div>'
          : '') +
        '<table class="bb-modal-parts">' +
          '<thead><tr>' +
            '<th>Category</th><th>Component</th><th style="text-align:right">Price</th>' +
          '</tr></thead>' +
          '<tbody>' + partsRows + '</tbody>' +
        '</table>' +
        '<div class="bb-modal-total">' +
          '<span>Total</span>' +
          '<span id="bb-m-total"></span>' +
        '</div>' +
        missingHtml +
        overHtml +
      '</div>'

    modal.querySelector('#bb-m-tier').textContent = build.tier || 'Build'
    modal.querySelector('#bb-m-tag').textContent  = build.tagline || ''
    modal.querySelector('#bb-m-total').textContent = money(build.totalPrice, currency)
    var sumEl = modal.querySelector('#bb-m-summary')
    if (sumEl) sumEl.textContent = build.summary
    modal.querySelector('#bb-m-close').onclick = function () { modal.hidden = true }
    modal.querySelector('#bb-m-pdf').onclick = function () { downloadBuildPdf(build, currency, cfg) }
    modal.onclick = function (e) { if (e.target === modal) modal.hidden = true }
  }

  // ── Recommend API call ────────────────────────────────────────────────────────

  function runRecommend() {
    state.screen = 'loading'
    state.error = ''
    render()
    var extras = state.extrasSelected.concat(state.extrasText ? [state.extrasText] : []).join(', ')
    fetch(API + '/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeId,
        budget: Number(state.budget),
        purpose: state.purpose,
        extras: extras,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data }
        })
      })
      .then(function (out) {
        if (!out.ok || !out.data || !out.data.success) {
          state.error = (out.data && out.data.error) || 'Request failed'
          state.screen = 'error'
          render()
          return
        }
        state.result = out.data
        state.screen = 'results'
        render()
      })
      .catch(function () {
        state.error = 'Network error. Try again.'
        state.screen = 'error'
        render()
      })
  }

  // ── Mount ─────────────────────────────────────────────────────────────────────

  function mount(cfg) {
    injectCss()
    applyTheme(cfg)
    if (document.getElementById('bb-launcher')) return

    // D2: Custom SVG launcher icon — lightning bolt inside a circle
    var launcher = document.createElement('button')
    launcher.id = 'bb-launcher'
    launcher.type = 'button'
    launcher.setAttribute('aria-label', 'Open BuildBot')
    launcher.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' +
      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' +
      '</svg>'

    var panel = document.createElement('div')
    panel.id = 'bb-panel'
    panel.innerHTML =
      '<div class="bb-header">' +
      '<strong></strong>' +
      '<button type="button" class="bb-close" aria-label="Close">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div>' +
      '<div class="bb-body"></div>'
    panel.querySelector('.bb-header strong').textContent = cfg.widgetTitle || 'BuildBot'

    function setOpen(open) {
      state.open = open
      if (open) {
        panel.classList.add('bb-open')
        // Scroll body to top whenever panel opens
        var body = panelBody()
        if (body) body.scrollTop = 0
      } else {
        panel.classList.remove('bb-open')
      }
    }

    launcher.addEventListener('click', function () { setOpen(!state.open) })
    panel.querySelector('.bb-close').addEventListener('click', function () { setOpen(false) })

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.open) setOpen(false)
    })

    document.body.appendChild(panel)
    document.body.appendChild(launcher)
    state.config = cfg
    state.screen = 'welcome'
    sendInstallPing()
    render()
  }

  fetchConfig().then(function (cfg) {
    if (!cfg) return
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { mount(cfg) })
    } else {
      mount(cfg)
    }
  })
})()
