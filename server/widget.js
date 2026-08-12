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

  function injectCss() {
    if (document.getElementById('bb-widget-css')) return
    var link = document.createElement('link')
    link.id = 'bb-widget-css'
    link.rel = 'stylesheet'
    link.href = API + '/widget.css'
    document.head.appendChild(link)
  }

  function applyTheme(cfg) {
    var root = document.documentElement
    if (cfg.brandColor) root.style.setProperty('--bb-brand', cfg.brandColor)
    if (cfg.widgetBg) root.style.setProperty('--bb-bg', cfg.widgetBg)
  }

  function money(n, currency) {
    return (currency || 'PKR') + ' ' + Number(n || 0).toLocaleString()
  }

  function fetchConfig() {
    return fetch(API + '/api/store-config/' + encodeURIComponent(storeId))
      .then(function (res) {
        return res.json()
      })
      .then(function (data) {
        if (!data || !data.success) return null
        if (data.active === false || data.widgetEnabled === false) return null
        return data
      })
      .catch(function () {
        return null
      })
  }

  function panelBody() {
    return document.querySelector('#bb-panel .bb-body')
  }

  function render() {
    var body = panelBody()
    if (!body || !state.config) return
    var cfg = state.config
    if (state.screen === 'welcome') return renderWelcome(body, cfg)
    if (state.screen === 'budget') return renderBudget(body, cfg)
    if (state.screen === 'purpose') return renderPurpose(body)
    if (state.screen === 'extras') return renderExtras(body)
    if (state.screen === 'loading') return renderLoading(body)
    if (state.screen === 'results') return renderResults(body, cfg)
    if (state.screen === 'error') return renderError(body)
  }

  function renderWelcome(body, cfg) {
    body.innerHTML =
      '<h2 class="bb-title"></h2><p class="bb-muted"></p><button type="button" class="bb-btn" id="bb-start"></button>'
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
          '<button type="button" class="bb-chip" data-budget="' +
          p +
          '">' +
          Number(p).toLocaleString() +
          '</button>'
        )
      })
      .join('')
    body.innerHTML =
      '<h2 class="bb-title">Your budget</h2>' +
      '<p class="bb-muted">How much can you spend? (' +
      (cfg.currency || 'PKR') +
      ')</p>' +
      '<input class="bb-input" id="bb-budget" type="number" min="1000" step="1000" placeholder="e.g. 80000" />' +
      '<div class="bb-chips">' +
      chips +
      '</div>' +
      '<button type="button" class="bb-btn" id="bb-next">Continue</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-back">Back</button>'
    var input = body.querySelector('#bb-budget')
    input.value = state.budget || ''
    body.querySelectorAll('[data-budget]').forEach(function (el) {
      el.onclick = function () {
        state.budget = el.getAttribute('data-budget')
        input.value = state.budget
      }
    })
    body.querySelector('#bb-back').onclick = function () {
      state.screen = 'welcome'
      render()
    }
    body.querySelector('#bb-next').onclick = function () {
      state.budget = String(input.value || '').trim()
      if (!state.budget || Number(state.budget) < 1000) {
        alert('Enter a budget of at least 1000')
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
        '<button type="button" class="bb-chip' +
        active +
        '" data-purpose="' +
        p +
        '">' +
        p +
        '</button>'
      )
    }).join('')
    body.innerHTML =
      '<h2 class="bb-title">What will you use it for?</h2>' +
      '<p class="bb-muted">Pick one purpose</p>' +
      '<div class="bb-chips">' +
      chips +
      '</div>' +
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
        alert('Please choose a purpose')
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
        '<button type="button" class="bb-chip' +
        on +
        '" data-extra="' +
        p +
        '">' +
        p +
        '</button>'
      )
    }).join('')
    body.innerHTML =
      '<h2 class="bb-title">Any extras?</h2>' +
      '<p class="bb-muted">Optional — accessories or notes</p>' +
      '<div class="bb-chips">' +
      chips +
      '</div>' +
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
      '<h2 class="bb-title">Building recommendations…</h2>' +
      '<ul class="bb-steps">' +
      '<li class="bb-step on">Checking your budget</li>' +
      '<li class="bb-step" id="s2">Matching catalog parts</li>' +
      '<li class="bb-step" id="s3">Assembling 3 builds</li>' +
      '</ul>'
    setTimeout(function () {
      var s2 = document.getElementById('s2')
      if (s2) s2.classList.add('on')
    }, 400)
    setTimeout(function () {
      var s3 = document.getElementById('s3')
      if (s3) s3.classList.add('on')
    }, 900)
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
          '<button type="button" class="bb-card" data-idx="' +
          idx +
          '">' +
          '<strong>' +
          escapeHtml(b.tier || 'Build') +
          '</strong>' +
          '<span class="bb-card-tag">' +
          escapeHtml(b.tagline || '') +
          '</span>' +
          '<span class="bb-card-price">' +
          money(b.totalPrice, currency) +
          '</span>' +
          '</button>'
        )
      })
      .join('')

    var usage = data.usage
      ? '<p class="bb-tiny">Usage: ' +
        data.usage.used +
        '/' +
        data.usage.limit +
        ' (' +
        data.usage.period +
        ')</p>'
      : ''

    body.innerHTML =
      '<h2 class="bb-title">Your 3 builds</h2>' +
      '<p class="bb-muted">Tap a card for parts. ' +
      (data.cached ? '(cached) ' : '') +
      '</p>' +
      '<div class="bb-cards">' +
      cards +
      '</div>' +
      usage +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-pdf">Download PDF</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost" id="bb-home">Start over</button>' +
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
    body.querySelector('#bb-pdf').onclick = function () {
      downloadPdf(builds, currency, cfg)
    }
  }

  function openModal(build, currency) {
    var modal = document.getElementById('bb-modal')
    if (!modal || !build) return
    var parts = (build.parts || [])
      .map(function (p) {
        return (
          '<li><strong>' +
          escapeHtml(p.category) +
          '</strong> — ' +
          escapeHtml(p.name) +
          ' <span>(' +
          money(p.totalPrice || p.price, currency) +
          ')</span></li>'
        )
      })
      .join('')
    modal.hidden = false
    modal.innerHTML =
      '<div class="bb-modal-card">' +
      '<div class="bb-modal-head"><strong></strong><button type="button" class="bb-close" id="bb-modal-close">×</button></div>' +
      '<p class="bb-muted"></p>' +
      '<ul class="bb-parts">' +
      parts +
      '</ul>' +
      '<p><strong>Total: ' +
      money(build.totalPrice, currency) +
      '</strong></p>' +
      '</div>'
    modal.querySelector('.bb-modal-head strong').textContent = build.tier || 'Build'
    modal.querySelector('.bb-muted').textContent = build.summary || build.tagline || ''
    modal.querySelector('#bb-modal-close').onclick = function () {
      modal.hidden = true
    }
    modal.onclick = function (e) {
      if (e.target === modal) modal.hidden = true
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function downloadPdf(builds, currency, cfg) {
    var w = window.open('', '_blank')
    if (!w) {
      alert('Allow pop-ups to download PDF')
      return
    }
    var html =
      '<html><head><title>BuildBot Builds</title>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>' +
      '<style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#0a1a2d} h1{font-size:20px} .b{border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:12px 0} li{margin:4px 0}</style>' +
      '</head><body><div id="pdf">' +
      '<h1>' +
      escapeHtml(cfg.widgetTitle || 'BuildBot') +
      ' — Recommendations</h1>' +
      '<p>Budget: ' +
      money(state.budget, currency) +
      ' · Purpose: ' +
      escapeHtml(state.purpose) +
      '</p>'
    builds.forEach(function (b) {
      html +=
        '<div class="b"><h2>' +
        escapeHtml(b.tier) +
        ' — ' +
        money(b.totalPrice, currency) +
        '</h2><ul>'
      ;(b.parts || []).forEach(function (p) {
        html +=
          '<li>' +
          escapeHtml(p.category) +
          ': ' +
          escapeHtml(p.name) +
          ' (' +
          money(p.price, currency) +
          ')</li>'
      })
      html += '</ul></div>'
    })
    html +=
      '</div><script>html2pdf().from(document.getElementById("pdf")).save("buildbot-builds.pdf");<\/script></body></html>'
    w.document.write(html)
    w.document.close()
  }

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

  function mount(cfg) {
    injectCss()
    applyTheme(cfg)
    if (document.getElementById('bb-launcher')) return

    var launcher = document.createElement('button')
    launcher.id = 'bb-launcher'
    launcher.type = 'button'
    launcher.setAttribute('aria-label', 'Open BuildBot')
    launcher.textContent = '⚡'

    var panel = document.createElement('div')
    panel.id = 'bb-panel'
    panel.innerHTML =
      '<div class="bb-header"><strong></strong><button type="button" class="bb-close" aria-label="Close">×</button></div>' +
      '<div class="bb-body"></div>'
    panel.querySelector('.bb-header strong').textContent = cfg.widgetTitle || 'BuildBot'

    function setOpen(open) {
      state.open = open
      if (open) panel.classList.add('bb-open')
      else panel.classList.remove('bb-open')
    }

    launcher.addEventListener('click', function () {
      setOpen(!state.open)
    })
    panel.querySelector('.bb-close').addEventListener('click', function () {
      setOpen(false)
    })

    document.body.appendChild(panel)
    document.body.appendChild(launcher)
    state.config = cfg
    state.screen = 'welcome'
    render()
  }

  fetchConfig().then(function (cfg) {
    if (!cfg) return
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        mount(cfg)
      })
    } else {
      mount(cfg)
    }
  })
})()
