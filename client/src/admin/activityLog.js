const KEY = 'bb_admin_activity'

export function logAdminActivity(action, detail = '') {
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) || '[]')
    const next = [
      { at: new Date().toISOString(), action, detail: String(detail).slice(0, 200) },
      ...(Array.isArray(prev) ? prev : []),
    ].slice(0, 100)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function getAdminActivity() {
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(prev) ? prev : []
  } catch {
    return []
  }
}

export function clearAdminActivity() {
  localStorage.removeItem(KEY)
}
