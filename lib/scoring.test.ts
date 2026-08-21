import { describe, expect, it } from 'vitest'
import { netBalances, sessionPoints, settleGame, simplifyDebts } from './scoring'

const brandon = 'brandon'
const dany = 'dany'
const vincent = 'vincent'

describe('settleGame', () => {
  it('fait payer au dernier 0,25 € par point du gagnant (exemple Brandon 5, Dany 4, Vincent 0)', () => {
    const result = settleGame({
      scores: [
        { playerId: brandon, kills: 1, revives: 4 },
        { playerId: dany, kills: 4, revives: 0 },
        { playerId: vincent, kills: 0, revives: 0 },
      ],
      firstKillPlayerId: null,
      stakeCents: 25,
    })

    expect(result).toEqual([
      { fromPlayerId: vincent, toPlayerId: brandon, amountCents: 125 },
    ])
  })

  it('reste à 0 si le gagnant a 0 point', () => {
    const result = settleGame({
      scores: [
        { playerId: brandon, kills: 0, revives: 0 },
        { playerId: dany, kills: 0, revives: 0 },
        { playerId: vincent, kills: 0, revives: 0 },
      ],
      firstKillPlayerId: brandon,
      stakeCents: 25,
    })

    expect(result).toEqual([])
  })

  it('partage la dette entre derniers ex aequo', () => {
    const result = settleGame({
      scores: [
        { playerId: brandon, kills: 5, revives: 0 },
        { playerId: dany, kills: 0, revives: 0 },
        { playerId: vincent, kills: 0, revives: 0 },
      ],
      firstKillPlayerId: brandon,
      stakeCents: 25,
    })

    const total = result.reduce((sum, row) => sum + row.amountCents, 0)
    expect(total).toBe(125)
    expect(result).toHaveLength(2)
    expect(result.every((row) => row.toPlayerId === brandon)).toBe(true)
    expect(result.map((row) => row.fromPlayerId).sort()).toEqual([dany, vincent])
    expect(result.map((row) => row.amountCents).sort((a, b) => a - b)).toEqual([
      62, 63,
    ])
  })

  it('donne l’avantage au first kill en cas d’égalité de points', () => {
    const result = settleGame({
      scores: [
        { playerId: brandon, kills: 2, revives: 2 },
        { playerId: dany, kills: 4, revives: 0 },
        { playerId: vincent, kills: 0, revives: 1 },
      ],
      firstKillPlayerId: brandon,
      stakeCents: 25,
    })

    expect(result).toEqual([
      { fromPlayerId: vincent, toPlayerId: brandon, amountCents: 100 },
    ])
  })

  it('à 2 joueurs, le perdant paie les points du gagnant', () => {
    const result = settleGame({
      scores: [
        { playerId: brandon, kills: 3, revives: 1 },
        { playerId: vincent, kills: 1, revives: 0 },
      ],
      firstKillPlayerId: null,
      stakeCents: 25,
    })

    expect(result).toEqual([
      { fromPlayerId: vincent, toPlayerId: brandon, amountCents: 100 },
    ])
  })

  it('à 4 joueurs, seuls dernier et premier bougent, les milieux sont neutres', () => {
    const result = settleGame({
      scores: [
        { playerId: brandon, kills: 6, revives: 0 },
        { playerId: dany, kills: 3, revives: 0 },
        { playerId: 'lea', kills: 2, revives: 0 },
        { playerId: vincent, kills: 0, revives: 0 },
      ],
      firstKillPlayerId: null,
      stakeCents: 50,
    })

    expect(result).toEqual([
      { fromPlayerId: vincent, toPlayerId: brandon, amountCents: 300 },
    ])
  })

  it('ignore une partie à un seul joueur', () => {
    const result = settleGame({
      scores: [{ playerId: brandon, kills: 8, revives: 2 }],
      firstKillPlayerId: brandon,
      stakeCents: 25,
    })

    expect(result).toEqual([])
  })

  it('sans first kill, une égalité générale ne crée aucune dette', () => {
    const result = settleGame({
      scores: [
        { playerId: brandon, kills: 2, revives: 0 },
        { playerId: dany, kills: 1, revives: 1 },
        { playerId: vincent, kills: 0, revives: 2 },
      ],
      firstKillPlayerId: null,
      stakeCents: 25,
    })

    expect(result).toEqual([])
  })
})

describe('pouvoirs', () => {
  const scores = [
    { playerId: brandon, kills: 2, revives: 0 },
    { playerId: dany, kills: 3, revives: 0 },
    { playerId: vincent, kills: 0, revives: 0 },
  ]

  it('double le score du lanceur avant le classement', () => {
    const result = settleGame({
      scores,
      firstKillPlayerId: null,
      stakeCents: 25,
      powers: [{ playerId: brandon, kind: 'double', targetPlayerId: null }],
    })
    expect(result).toEqual([
      { fromPlayerId: vincent, toPlayerId: brandon, amountCents: 100 },
    ])
  })

  it('divise par deux le score de la cible', () => {
    const result = settleGame({
      scores: [
        { playerId: brandon, kills: 6, revives: 0 },
        { playerId: dany, kills: 4, revives: 0 },
        { playerId: vincent, kills: 0, revives: 0 },
      ],
      firstKillPlayerId: null,
      stakeCents: 25,
      powers: [{ playerId: vincent, kind: 'halve', targetPlayerId: brandon }],
    })
    expect(result).toEqual([
      { fromPlayerId: vincent, toPlayerId: dany, amountCents: 100 },
    ])
  })

  it('ne crée pas de dette si la mise est à 0 €', () => {
    expect(
      settleGame({
        scores: [
          { playerId: brandon, kills: 5, revives: 0 },
          { playerId: vincent, kills: 0, revives: 0 },
        ],
        firstKillPlayerId: null,
        stakeCents: 0,
      }),
    ).toEqual([])
  })

  it('le bouclier fait payer le 2e au lieu du dernier', () => {
    const result = settleGame({
      scores: [
        { playerId: brandon, kills: 5, revives: 0 },
        { playerId: dany, kills: 4, revives: 0 },
        { playerId: vincent, kills: 0, revives: 0 },
      ],
      firstKillPlayerId: null,
      stakeCents: 25,
      powers: [{ playerId: vincent, kind: 'shield', targetPlayerId: null }],
    })
    expect(result).toEqual([
      { fromPlayerId: dany, toPlayerId: brandon, amountCents: 125 },
    ])
  })
})

describe('sessionPoints', () => {
  it('applique x2 et /2 au cumul de soirée, pas seulement à la game en cours', () => {
    const totals = sessionPoints([
      {
        scores: [
          { playerId: brandon, kills: 2, revives: 0 },
          { playerId: vincent, kills: 1, revives: 0 },
        ],
        powers: [{ playerId: brandon, kind: 'double', targetPlayerId: null }],
      },
      {
        scores: [
          { playerId: brandon, kills: 1, revives: 0 },
          { playerId: vincent, kills: 3, revives: 0 },
        ],
        powers: [{ playerId: vincent, kind: 'halve', targetPlayerId: brandon }],
      },
    ])
    expect(totals.get(brandon)).toBe(4)
    expect(totals.get(vincent)).toBe(4)
  })
})

describe('simplifyDebts', () => {
  it('agrège les games en un ticket Tricount (Vincent doit 2,50 € à Brandon)', () => {
    const net = netBalances([
      { fromPlayerId: vincent, toPlayerId: brandon, amountCents: 125 },
      { fromPlayerId: vincent, toPlayerId: brandon, amountCents: 125 },
      { fromPlayerId: dany, toPlayerId: brandon, amountCents: 50 },
      { fromPlayerId: brandon, toPlayerId: dany, amountCents: 50 },
    ])

    expect(net).toEqual({
      [brandon]: 250,
      [dany]: 0,
      [vincent]: -250,
    })

    expect(simplifyDebts(net)).toEqual([
      { fromPlayerId: vincent, toPlayerId: brandon, amountCents: 250 },
    ])
  })
})
