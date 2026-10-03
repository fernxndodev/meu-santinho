import type { Candidate, CandidateOffice } from './types'

export type CandidateQuery = {
  electionYear: number
  uf: string
  office: CandidateOffice
}

export function matchesCandidateQuery(
  candidate: Candidate,
  query: CandidateQuery,
): boolean {
  const matchesUf =
    candidate.uf === query.uf ||
    (query.office === 'PRESIDENT' && candidate.uf === 'BR')

  return (
    candidate.electionYear === query.electionYear &&
    matchesUf &&
    candidate.office === query.office
  )
}