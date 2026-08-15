/** Map WooCommerce category / product name keywords → BuildBot categories. */

export const BUILDBOT_CATEGORIES = [
  'CPU',
  'GPU',
  'RAM',
  'Motherboard',
  'Storage',
  'PSU',
  'Case',
  'Cooler',
  'Monitor',
  'Keyboard',
  'Mouse',
  'Headset',
  'Webcam',
  'Other',
]

const RULES = [
  // 'amd' is deliberately excluded — AMD also brands GPUs (Radeon) and
  // motherboard chipsets, so a bare "amd" match here would steal those
  // products into the CPU bucket since CPU is checked first.
  { cat: 'CPU', keys: ['cpu', 'processor', 'ryzen'] },
  { cat: 'GPU', keys: ['gpu', 'graphics', 'geforce', 'radeon', 'rtx', 'gtx', 'vga'] },
  { cat: 'RAM', keys: ['ram', 'memory', 'ddr4', 'ddr5', 'sodimm'] },
  { cat: 'Motherboard', keys: ['motherboard', 'mainboard', 'mobo', 'b550', 'b650', 'z790', 'x670'] },
  {
    cat: 'Storage',
    keys: ['ssd', 'hdd', 'nvme', 'storage', 'hard drive', 'm.2', 'solid state'],
  },
  { cat: 'PSU', keys: ['psu', 'power supply', 'smps'] },
  { cat: 'Case', keys: ['case', 'chassis', 'cabinet'] },
  { cat: 'Cooler', keys: ['cooler', 'aio', 'liquid cool', 'heatsink', 'fan cpu'] },
  { cat: 'Monitor', keys: ['monitor', 'display', 'screen'] },
  { cat: 'Keyboard', keys: ['keyboard', 'mechanical key'] },
  { cat: 'Mouse', keys: ['mouse', 'mice'] },
  { cat: 'Headset', keys: ['headset', 'headphone', 'earphone'] },
  { cat: 'Webcam', keys: ['webcam', 'camera'] },
]

export function mapWooCategory(wooCategories = [], productName = '') {
  const hay = [...(Array.isArray(wooCategories) ? wooCategories : [wooCategories]), productName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const rule of RULES) {
    if (rule.keys.some((k) => hay.includes(k))) return rule.cat
  }
  return 'Other'
}
