export type SeasonRange = 'week' | 'month' | 'all'

export function parseSeasonRange(value: string | null | undefined): SeasonRange {
  if (value === 'week' || value === 'month' || value === 'all') {
    return value
  }
  return 'month'
}

type ParisParts = { year: number; month: number; day: number }

export function seasonWindow(range: SeasonRange, now = new Date()): { from: Date | null; to: Date } {
  if (range === 'all') {
    return { from: null, to: now }
  }
  const paris = parisParts(now)
  if (range === 'month') {
    return { from: startOfParisDay(paris.year, paris.month, 1), to: now }
  }
  const today = startOfParisDay(paris.year, paris.month, paris.day)
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(now)
  const fromMonday = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[weekday] ?? 0
  const monday = new Date(today.getTime() - fromMonday * 24 * 60 * 60 * 1000)
  const mondayParts = parisParts(monday)
  return { from: startOfParisDay(mondayParts.year, mondayParts.month, mondayParts.day), to: now }
}

function parisParts(date: Date): ParisParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return { year, month, day }
}

function startOfParisDay(year: number, month: number, day: number): Date {
  const stamp = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`
  for (const offset of ['+02:00', '+01:00']) {
    const date = new Date(`${stamp}${offset}`)
    const parts = parisParts(date)
    if (parts.year === year && parts.month === month && parts.day === day) {
      return date
    }
  }
  return new Date(`${stamp}+01:00`)
}
