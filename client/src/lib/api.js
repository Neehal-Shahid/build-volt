const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')

let loadingCount = 0
const listeners = new Set()

function setLoading(active) {
  loadingCount = Math.max(0, loadingCount + (active ? 1 : -1))
  listeners.forEach((fn) => fn(loadingCount > 0))
}

export function subscribeLoading(fn) {
  listeners.add(fn)
  fn(loadingCount > 0)
  return () => listeners.delete(fn)
}

export async function api(path, { method = 'GET', body, token, headers } = {}) {
  setLoading(true)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    let data = null
    const text = await res.text()
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { success: false, error: text || 'Invalid server response' }
    }
    if (!res.ok) {
      const err = new Error(data?.error || `Request failed (${res.status})`)
      err.status = res.status
      err.data = data
      throw err
    }
    return data
  } finally {
    setLoading(false)
  }
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUpload(path, { file, fieldName = 'file', token } = {}) {
  setLoading(true)
  try {
    const form = new FormData()
    form.append(fieldName, file)
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    })
    let data = null
    const text = await res.text()
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { success: false, error: text || 'Invalid server response' }
    }
    if (!res.ok) {
      const err = new Error(data?.error || `Upload failed (${res.status})`)
      err.status = res.status
      err.data = data
      throw err
    }
    return data
  } finally {
    setLoading(false)
  }
}

export { API_URL }
