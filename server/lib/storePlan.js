/** Plan access + widget availability helpers (shared server-side). */

export function isTrialExpired(store) {
  if (!store || String(store.plan || '').toLowerCase() !== 'trial') return false
  if (!store.trial_ends) return false
  return new Date(store.trial_ends).getTime() < Date.now()
}

export function isPaidPlanExpired(store) {
  const plan = String(store?.plan || '').toLowerCase()
  if (!store || plan === 'trial') return false
  if (!store.plan_ends) return false
  return new Date(store.plan_ends).getTime() < Date.now()
}

export function isPlanLapsed(store) {
  return isTrialExpired(store) || isPaidPlanExpired(store)
}

export function widgetPauseReason(store) {
  if (!store) return 'unavailable'
  if (store.disabled) return 'disabled_account'
  if (!store.active) return 'inactive'
  if (!store.widget_enabled) return 'widget_disabled'
  if (isTrialExpired(store)) return 'trial_expired'
  if (isPaidPlanExpired(store)) return 'plan_expired'
  return null
}

export function pauseMessage(reason) {
  switch (reason) {
    case 'trial_expired':
      return 'Your trial has ended. Upgrade from Billing to restore your widget.'
    case 'plan_expired':
      return 'Your plan has expired. Renew from Billing to restore your widget.'
    case 'widget_disabled':
      return 'Widget is disabled in your dashboard settings.'
    case 'disabled_account':
      return 'This store account has been disabled.'
    case 'inactive':
      return 'This store is not active.'
    default:
      return 'Widget is temporarily unavailable.'
  }
}

export function canServeWidget(store) {
  return !widgetPauseReason(store)
}

export function isWidgetDetectedInstalled(store) {
  if (!store) return false
  if (store.woo_connected) return true
  if (store.widget_installed_at) return true
  if (store.widget_last_seen) {
    const age = Date.now() - new Date(store.widget_last_seen).getTime()
    return Number.isFinite(age) && age < 30 * 24 * 60 * 60 * 1000
  }
  return false
}

export function planLimit(store, config) {
  const plan = String(store?.plan || 'trial').toLowerCase()
  if (plan === 'trial') {
    return {
      limit: Number(config?.trial_daily_limit || 3),
      period: 'day',
    }
  }
  if (plan === 'starter') {
    return { limit: Number(config?.limit_starter || 500), period: 'month' }
  }
  if (plan === 'growth') {
    return { limit: Number(config?.limit_growth || 2000), period: 'month' }
  }
  if (plan === 'pro') {
    return { limit: Number(config?.limit_pro || 5000), period: 'month' }
  }
  return {
    limit: Number(config?.trial_daily_limit || 3),
    period: 'day',
  }
}

export function publicPlanStatus(store) {
  const lapsed = isPlanLapsed(store)
  const reason = widgetPauseReason(store)
  return {
    trialExpired: isTrialExpired(store),
    planExpired: isPaidPlanExpired(store),
    planLapsed: lapsed,
    widgetPaused: !!reason && reason !== 'widget_disabled',
    widgetPauseReason: reason,
    widgetInstalled: isWidgetDetectedInstalled(store),
    widgetLastSeen: store?.widget_last_seen || null,
    widgetInstalledAt: store?.widget_installed_at || null,
  }
}
