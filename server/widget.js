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

    body.innerHTML =
      '<div class="bb-no-build">' +
        '<div class="bb-no-build-icon" aria-hidden="true">' +
          (code === 'budget_too_low' ? '\uD83D\uDCB8' : '\u26A0\uFE0F') +
        '</div>' +
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
      return (
        '<div class="bb-rc" data-idx="' + idx + '">' +
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
  // Opens one build's HTML in a new tab and auto-triggers the print/save dialog.
  // Each build card and the modal have their own button that calls this.

  function downloadBuildPdf(build, currency, cfg) {
    var store = escapeHtml(cfg.widgetTitle || 'BuildBot')
    var tier = escapeHtml(build.tier || 'Build')
    var partsRows = (build.parts || []).map(function (p) {
      return '<tr>' +
        '<td class="cat">' + escapeHtml(p.category) + '</td>' +
        '<td class="nm">'  + escapeHtml(p.name)     + '</td>' +
        '<td class="pr">'  + money(p.price, currency) + '</td>' +
      '</tr>'
    }).join('')
    var missing = (build.missingCategories || [])
    var missingNote = missing.length
      ? '<p class="warn">⚠ Not included (not in catalog): ' +
          missing.map(function (c) { return escapeHtml(c) }).join(', ') + '</p>'
      : ''
    var overNote = build.withinBudget === false
      ? '<p class="warn">⚠ This build exceeds your budget.</p>'
      : ''

    var html = [
      '<!DOCTYPE html><html><head><meta charset="utf-8">',
      '<title>' + tier + ' — ' + store + '</title>',
      '<style>',
      'body{font-family:system-ui,sans-serif;padding:2rem;color:#0a1a2d;max-width:640px;margin:0 auto}',
      'h1{font-size:1.45rem;margin:0 0 .15rem}',
      '.sub{color:#64748b;font-size:.88rem;margin:0 0 1.25rem}',
      '.why{border-left:3px solid #2a5ee8;padding:.6rem 1rem;background:#f8fafc;margin:0 0 1.1rem;font-size:.9rem;line-height:1.55;color:#334155}',
      '.why b{display:block;margin-bottom:.2rem;color:#0a1a2d;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em}',
      'table{width:100%;border-collapse:collapse;font-size:.88rem;margin-top:.5rem}',
      'th{text-align:left;padding:.4rem .6rem;border-bottom:2px solid #e2e8f0;font-size:.78rem;text-transform:uppercase;color:#64748b;letter-spacing:.03em}',
      'td{padding:.4rem .6rem;border-bottom:1px solid #f1f5f9;vertical-align:top}',
      'td.cat{color:#64748b;font-size:.82rem;width:110px}',
      'td.pr{text-align:right;color:#2a5ee8;font-weight:600;white-space:nowrap}',
      '.total{display:flex;justify-content:space-between;align-items:center;margin-top:.75rem;padding:.6rem .6rem;background:#f8fafc;border-radius:6px;font-weight:700}',
      '.total-p{color:#2a5ee8;font-size:1.05rem}',
      '.warn{margin:.75rem 0 0;padding:.5rem .85rem;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;font-size:.85rem;color:#92400e}',
      '.ft{margin-top:2rem;padding-top:.75rem;border-top:1px solid #e2e8f0;font-size:.78rem;color:#94a3b8;text-align:center}',
      '@media print{body{padding:1rem}}',
      '</style></head><body>',
      '<h1>' + tier + '</h1>',
      '<p class="sub">' + escapeHtml(money(state.budget, currency)) + ' budget &nbsp;·&nbsp; ' + escapeHtml(state.purpose || '') + ' &nbsp;·&nbsp; ' + store + '</p>',
      build.summary ? '<div class="why"><b>Why this build?</b>' + escapeHtml(build.summary) + '</div>' : '',
      '<table><thead><tr><th>Category</th><th>Component</th><th style="text-align:right">Price</th></tr></thead>',
      '<tbody>' + partsRows + '</tbody></table>',
      '<div class="total"><span>Total</span><span class="total-p">' + money(build.totalPrice, currency) + '</span></div>',
      missingNote,
      overNote,
      '<div class="ft">Generated by BuildBot</div>',
      '<script>window.onload=function(){window.print()}<\/script>',
      '</body></html>',
    ].join('\n')

    var blob = new Blob([html], { type: 'text/html' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url; a.target = '_blank'; a.rel = 'noopener'
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
