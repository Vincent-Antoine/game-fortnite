export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${sign}${euros},${rest} €`
}

export function parseStakeToCents(value: string): number | null {
  const normalized = value.replace(',', '.').trim()
  const euros = Number(normalized)
  if (!Number.isFinite(euros) || euros < 0.01 || euros > 50) {
    return null
  }
  return Math.round(euros * 100)
}
