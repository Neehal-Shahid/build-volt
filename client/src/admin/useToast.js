import { useState, useCallback } from 'react'

let idSeq = 0

/**
 * Simple auto-dismiss toast hook.
 * Returns { toasts, toast } where toast(msg, type?, ms?) adds a notification.
 */
export function useToast() {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success', ms = 3500) => {
    const id = ++idSeq
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, ms)
  }, [])

  return { toasts, toast }
}
