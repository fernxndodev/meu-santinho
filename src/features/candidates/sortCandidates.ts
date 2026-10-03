import type { Candidate } from './types'

const portugueseCollator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
})

export function sortCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((left, right) => {
    const numberOrder = portugueseCollator.compare(left.number, right.number)
    if (numberOrder !== 0) return numberOrder

    const nameOrder = portugueseCollator.compare(left.ballotName, right.ballotName)
    if (nameOrder !== 0) return nameOrder

    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  })
}