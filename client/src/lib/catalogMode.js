const MODE_KEY = 'bb_store_mode'

export function getCatalogMode() {
  const mode = localStorage.getItem(MODE_KEY)
  return mode === 'woo' ? 'woo' : 'custom'
}

export function setCatalogMode(mode) {
  localStorage.setItem(MODE_KEY, mode === 'woo' ? 'woo' : 'custom')
  window.dispatchEvent(new Event('bb-mode-change'))
}

export function useCatalogMode() {
  // lightweight subscription via storage + custom event handled in Dashboard
  return { getCatalogMode, setCatalogMode, MODE_KEY }
}
