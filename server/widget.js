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
  var EXTRA_CHIPS = ['Monitor', 'Keyboard', 'Mouse', 'Headset', 'Webcam']

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

  function hexLuminance(hex) {
    var c = String(hex || '').replace('#', '')
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
    var r = parseInt(c.slice(0, 2), 16) / 255
    var g = parseInt(c.slice(2, 4), 16) / 255
    var b = parseInt(c.slice(4, 6), 16) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  function applyTheme(cfg) {
    var root = document.documentElement
    if (cfg.brandColor) root.style.setProperty('--bb-brand', cfg.brandColor)
    var bg = cfg.widgetBg || '#FFFFFF'
    root.style.setProperty('--bb-bg', bg)
    if (hexLuminance(bg) > 0.5) {
      root.style.setProperty('--bb-text', '#0A1A2D')
      root.style.setProperty('--bb-muted', '#64748B')
      root.style.setProperty('--bb-border', '#E2E8F0')
      root.style.setProperty('--bb-panel', '#F8FAFC')
    } else {
      root.style.setProperty('--bb-text', '#f8fafc')
      root.style.setProperty('--bb-muted', '#94a3b8')
      root.style.setProperty('--bb-border', 'rgba(255, 255, 255, 0.12)')
      root.style.setProperty('--bb-panel', 'rgba(255, 255, 255, 0.06)')
    }
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
      return (
        '<button type="button" class="bb-chip' + active + '" data-purpose="' + p + '">' +
        p +
        '</button>'
      )
    }).join('')
    body.innerHTML =
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
      return (
        '<button type="button" class="bb-chip' + on + '" data-extra="' + p + '">' +
        p +
        '</button>'
      )
    }).join('')
    body.innerHTML =
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

  function renderResults(body, cfg) {
    var data = state.result || {}
    var builds = data.builds || []
    var currency = data.currency || cfg.currency || 'PKR'

    if (!data.canBuild) {
      body.innerHTML =
        '<h2 class="bb-title">No builds available</h2>' +
        '<p class="bb-muted"></p>' +
        '<button type="button" class="bb-btn" id="bb-home">Start over</button>'
      body.querySelector('.bb-muted').textContent =
        data.noBuildsReason || 'Try a higher budget or check the store catalog.'
      body.querySelector('#bb-home').onclick = function () {
        state.screen = 'welcome'
        render()
      }
      return
    }

    var cards = builds
      .map(function (b, idx) {
        return (
          '<button type="button" class="bb-card" data-idx="' + idx + '">' +
          '<strong>' + escapeHtml(b.tier || 'Build') + '</strong>' +
          '<span class="bb-card-tag">' + escapeHtml(b.tagline || '') + '</span>' +
          '<span class="bb-card-price">' + money(b.totalPrice, currency) + '</span>' +
          '</button>'
        )
      })
      .join('')

    var usage = data.usage
      ? '<p class="bb-tiny">Usage: ' + escapeHtml(String(data.usage.used)) + '/' +
        escapeHtml(String(data.usage.limit)) + ' (' + escapeHtml(String(data.usage.period || '')) + ')</p>'
      : ''

    // D4: Share button — copies a plain-text summary to clipboard
    body.innerHTML =
      '<h2 class="bb-title">Your 3 builds</h2>' +
      '<p class="bb-muted">Tap a card to see the full parts list.</p>' +
      '<div class="bb-cards">' + cards + '</div>' +
      usage +
      '<div class="bb-result-actions">' +
      '<button type="button" class="bb-btn bb-btn-ghost bb-btn-icon" id="bb-share">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
      ' Share builds' +
      '</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost bb-btn-icon" id="bb-print">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
      ' Print / Save PDF' +
      '</button>' +
      '</div>' +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-home" style="margin-top:0.35rem">Start over</button>' +
      '<div id="bb-modal" class="bb-modal" hidden></div>'

    body.querySelectorAll('[data-idx]').forEach(function (el) {
      el.onclick = function () {
        openModal(builds[Number(el.getAttribute('data-idx'))], currency)
      }
    })

    body.querySelector('#bb-home').onclick = function () {
      state.screen = 'welcome'
      state.result = null
      render()
    }

    // D4: Share — copy text summary to clipboard, fallback to nothing visible
    body.querySelector('#bb-share').onclick = function () {
      var btn = body.querySelector('#bb-share')
      var text = buildSummaryText(builds, currency, cfg)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = '✓ Copied!'
          setTimeout(function () {
            btn.innerHTML =
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share builds'
          }, 2000)
        }).catch(function () {
          shareViaFallback(text)
        })
      } else {
        shareViaFallback(text)
      }
    }

    // D3: Print / Save PDF — opens a clean print window, no CDN, no popup blocker
    body.querySelector('#bb-print').onclick = function () {
      printBuilds(builds, currency, cfg)
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

  // ── D3: Print without popup blocker ──────────────────────────────────────────

  function printBuilds(builds, currency, cfg) {
    // Build a self-contained printable HTML string and write it to a
    // same-origin blob URL — avoids popup blockers entirely.
    var title = escapeHtml(cfg.widgetTitle || 'BuildBot') + ' — Recommendations'
    var html = [
      '<!DOCTYPE html><html><head>',
      '<meta charset="utf-8">',
      '<title>' + title + '</title>',
      '<style>',
      'body{font-family:system-ui,sans-serif;padding:32px;color:#0a1a2d;max-width:680px;margin:0 auto}',
      'h1{font-size:1.4rem;margin:0 0 0.25rem}',
      '.meta{color:#64748b;font-size:0.9rem;margin:0 0 1.5rem}',
      '.build{border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:0 0 16px}',
      '.build h2{margin:0 0 0.25rem;font-size:1.05rem}',
      '.build .price{color:#2a5ee8;font-weight:700;margin:0 0 0.75rem;font-size:0.9rem}',
      'table{width:100%;border-collapse:collapse;font-size:0.88rem}',
      'td{padding:5px 8px;border-bottom:1px solid #f1f5f9}',
      'td:last-child{text-align:right;white-space:nowrap;color:#2a5ee8;font-weight:600}',
      '.footer{margin-top:2rem;color:#94a3b8;font-size:0.78rem;text-align:center}',
      '@media print{body{padding:16px}.no-print{display:none}}',
      '</style>',
      '</head><body>',
      '<h1>' + title + '</h1>',
      '<p class="meta">Budget: ' + money(state.budget, currency) + ' &nbsp;·&nbsp; Purpose: ' + escapeHtml(state.purpose || '') + '</p>',
    ]

    builds.forEach(function (b) {
      html.push('<div class="build">')
      html.push('<h2>' + escapeHtml(b.tier || 'Build') + '</h2>')
      html.push('<p class="price">' + money(b.totalPrice, currency) + '</p>')
      html.push('<table>')
      ;(b.parts || []).forEach(function (p) {
        html.push(
          '<tr><td>' + escapeHtml(p.category) + '</td>' +
          '<td>' + escapeHtml(p.name) + '</td>' +
          '<td>' + money(p.price, currency) + '</td></tr>'
        )
      })
      html.push('</table></div>')
    })

    html.push('<div class="footer">Generated by BuildBot</div>')
    html.push('<script class="no-print">window.onload=function(){window.print()}<\/script>')
    html.push('</body></html>')

    var blob = new Blob([html.join('\n')], { type: 'text/html' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener'
    // Trigger in a user-gesture context — this click IS inside an onclick handler
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoke after a short delay so the new tab has time to load the blob
    setTimeout(function () { URL.revokeObjectURL(url) }, 30000)
  }

  // ── Modal (parts detail) ──────────────────────────────────────────────────────

  function openModal(build, currency) {
    var modal = document.getElementById('bb-modal')
    if (!modal || !build) return
    var parts = (build.parts || [])
      .map(function (p) {
        return (
          '<li><strong>' + escapeHtml(p.category) + '</strong> — ' +
          escapeHtml(p.name) +
          ' <span style="color:var(--bb-brand);font-weight:700">(' + money(p.totalPrice || p.price, currency) + ')</span></li>'
        )
      })
      .join('')

    modal.hidden = false
    modal.innerHTML =
      '<div class="bb-modal-card">' +
      '<div class="bb-modal-head">' +
      '<div><strong></strong><p class="bb-muted" style="margin:0.15rem 0 0;font-size:0.82rem"></p></div>' +
      '<button type="button" class="bb-close" id="bb-modal-close" aria-label="Close">×</button>' +
      '</div>' +
      '<ul class="bb-parts">' + parts + '</ul>' +
      '<p style="font-weight:700;margin:0.5rem 0 0">Total: ' + money(build.totalPrice, currency) + '</p>' +
      '</div>'

    modal.querySelector('.bb-modal-head strong').textContent = build.tier || 'Build'
    modal.querySelector('.bb-modal-head .bb-muted').textContent = build.summary || build.tagline || ''
    modal.querySelector('#bb-modal-close').onclick = function () { modal.hidden = true }
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
