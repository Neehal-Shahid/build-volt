/**
 * Fetches public platform info from /api/plans once and caches the result
 * in module scope for the lifetime of the page. Returns a plain object so
 * it works both inside and outside React components.
 *
 * Currently exposes:
 *   supportEmail  — ADMIN_EMAIL from the server env (empty string if unset)
 */

import { API_URL } from './api.js'

let cache = null
let inflight = null

export async function getPlatformInfo() {
  if (cache) return cache
  if (inflight) return inflight

  inflight = fetch(`${API_URL}/api/plans`)
    .then((r) => r.json())
    .then((data) => {
      cache = {
        supportEmail: data.supportEmail || '',
      }
      inflight = null
      return cache
    })
    .catch(() => {
      inflight = null
      return { supportEmail: '' }
    })

  return inflight
}
