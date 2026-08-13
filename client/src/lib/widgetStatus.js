/** Widget install / enable status helpers (client-side). */

export const WIDGET_LIVE_KEY = (storeId) => `bb_widget_live_${storeId}`;

export function isPlanLapsed(store) {
  if (!store) return false
  const now = Date.now()
  if (store.plan === 'trial' && store.trialEnds) {
    return new Date(store.trialEnds).getTime() < now
  }
  if (store.plan !== 'trial' && store.planEnds) {
    return new Date(store.planEnds).getTime() < now
  }
  return !!(store.trialExpired || store.planExpired)
}

export function isWidgetPaused(store) {
  if (!store) return false
  if (!store.active || store.disabled) return true
  return isPlanLapsed(store)
}

/** Server beacon, WooCommerce, or manual confirmation. */
export function isWidgetInstalled(store) {
  if (!store?.id) return false
  if (store.wooConnected || store.widgetInstalled) return true
  if (store.widgetInstalledAt || store.widgetLastSeen) return true
  try {
    return localStorage.getItem(WIDGET_LIVE_KEY(store.id)) === '1'
  } catch {
    return false
  }
}

export function isWidgetEnabled(store) {
  return store?.widgetEnabled !== false
}

/**
 * @returns {'active' | 'disabled' | 'not_installed' | 'paused'}
 */
export function getWidgetStatus(store) {
  if (isWidgetPaused(store)) return 'paused'
  const installed = isWidgetInstalled(store)
  const enabled = isWidgetEnabled(store)
  if (!installed) return 'not_installed'
  if (!enabled) return 'disabled'
  return 'active'
}

export const WIDGET_STATUS_LABELS = {
  active: 'Active',
  disabled: 'Disabled',
  not_installed: 'Not installed',
  paused: 'Paused',
}

export function widgetStatusTone(status) {
  if (status === 'active') return 'green'
  if (status === 'disabled') return 'amber'
  if (status === 'paused') return 'red'
  return 'purple'
}

export function widgetPauseHint(store) {
  if (!isPlanLapsed(store)) return null
  if (store?.plan === 'trial' || store?.trialExpired) {
    return 'Your trial has ended. Upgrade from Billing to restore your widget.'
  }
  return 'Your plan has expired. Renew from Billing to restore your widget.'
}
