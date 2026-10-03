export type BallotContext = {
  electionYear: number
  uf: string
}

export type SavedCandidateIds = Readonly<Record<string, string>>

function storageKey(context: BallotContext): string {
  return `meu-santinho:ballot:${context.electionYear}:${context.uf}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function saveBallot(
  context: BallotContext,
  selections: SavedCandidateIds,
): boolean {
  try {
    window.localStorage.setItem(
      storageKey(context),
      JSON.stringify({
        electionYear: context.electionYear,
        uf: context.uf,
        selections,
      }),
    )
    return true
  } catch {
    return false
  }
}

export function loadBallot(
  context: BallotContext,
  validStageIds: readonly string[],
): Record<string, string> | null {
  try {
    const serialized = window.localStorage.getItem(storageKey(context))
    if (serialized === null) return null

    const stored: unknown = JSON.parse(serialized)
    if (
      !isRecord(stored) ||
      stored.electionYear !== context.electionYear ||
      stored.uf !== context.uf ||
      !isRecord(stored.selections)
    ) {
      return null
    }

    const validStages = new Set(validStageIds)
    const selections: Record<string, string> = {}
    for (const [stageId, candidateId] of Object.entries(stored.selections)) {
      if (
        validStages.has(stageId) &&
        typeof candidateId === 'string' &&
        candidateId.trim().length > 0
      ) {
        selections[stageId] = candidateId
      }
    }
    return selections
  } catch {
    return null
  }
}

export function removeBallot(context: BallotContext): boolean {
  try {
    window.localStorage.removeItem(storageKey(context))
    return true
  } catch {
    return false
  }
}