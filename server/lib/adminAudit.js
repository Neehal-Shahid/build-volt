import { getDb } from '../database.js'

/** Record an admin action. Never throws — a logging failure must not break the action itself. */
export async function logAdminAction(req, action, detail = '') {
  try {
    await getDb().execute({
      sql: `INSERT INTO admin_activity_log (admin_id, admin_email, action, detail) VALUES (?, ?, ?, ?)`,
      args: [req.admin?.adminId ?? null, req.admin?.email || '', action, String(detail).slice(0, 500)],
    })
  } catch (err) {
    console.warn('[admin-audit] log failed:', err.message)
  }
}
