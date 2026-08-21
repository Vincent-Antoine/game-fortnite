type CareerView = {
  kills: number
  revives: number
  points: number
  firstKills: number
  games: number
  sessions: number
  wonLabel: string
  lostLabel: string
  netLabel: string
  bestGame?: number
  winStreak?: number
  worstNightLabel?: string
}

export function CareerGrid({ stats }: { stats: CareerView }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="KILLS" value={stats.kills} accent="kill" />
      <StatCard label="RÉAS" value={stats.revives} accent="rez" />
      <StatCard label="POINTS" value={stats.points} accent="gold" />
      <StatCard label="FIRST KILLS" value={stats.firstKills} accent="horizon" />
      <StatCard label="GAGNÉ" value={stats.wonLabel} accent="rez" />
      <StatCard label="PERDU" value={stats.lostLabel} accent="kill" />
      <StatCard label="NET" value={stats.netLabel} />
      <StatCard label="GAMES" value={`${stats.games} · ${stats.sessions} sess.`} />
      <StatCard label="BEST GAME" value={stats.bestGame ?? 0} accent="gold" />
      <StatCard label="SÉRIE WINS" value={stats.winStreak ?? 0} accent="horizon" />
      <StatCard label="PIRE SOIR" value={stats.worstNightLabel ?? '0,00 €'} accent="kill" />
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: 'kill' | 'rez' | 'gold' | 'horizon'
}) {
  const color =
    accent === 'kill'
      ? 'text-kill'
      : accent === 'rez'
        ? 'text-rez'
        : accent === 'gold'
          ? 'text-gold'
          : accent === 'horizon'
            ? 'text-horizon'
            : 'text-mute'
  return (
    <article className="rounded-3xl bg-panel p-4">
      <p className={`font-hud text-xs ${color}`}>{label}</p>
      <p className="font-display text-3xl">{value}</p>
    </article>
  )
}
