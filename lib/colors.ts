export const PLAYER_COLORS = [
  '#FF7A45',
  '#F0C14B',
  '#2EC4B6',
  '#8B9BFF',
  '#FF5A7A',
  '#C084FC',
  '#F4A261',
  '#E8D5B5',
] as const

export function colorForIndex(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]
}
