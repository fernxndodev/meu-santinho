import { sortCandidates } from './sortCandidates'
import {
  matchesCandidateQuery,
  type CandidateQuery,
} from './candidateQuery'
import { candidateSourceForQuery } from './candidateSource'
import type { Candidate } from './types'

export type { CandidateQuery } from './candidateQuery'

type CandidateDataModule = {
  default: Candidate[]
}

const candidateDataModules = import.meta.glob<CandidateDataModule>(
  '../../data/candidates/2026/*.json',
)

async function loadCandidateData(
  uf: string,
): Promise<Candidate[]> {
  const modulePath =
    `../../data/candidates/2026/${uf}.json`

  const loader = candidateDataModules[modulePath]

  if (!loader) {
    return []
  }

  const module = await loader()

  return module.default
}

export async function getCandidates(
  query: CandidateQuery,
): Promise<Candidate[]> {
  if (candidateSourceForQuery(query) !== 'official') {
    return []
  }

  // Presidente é uma candidatura de abrangência nacional.
  // Os demais cargos são carregados da UF do eleitor.
  const dataUf =
    query.office === 'PRESIDENT'
      ? 'BR'
      : query.uf

  const candidates = await loadCandidateData(dataUf)

  const matches = candidates.filter((candidate) =>
    matchesCandidateQuery(candidate, query),
  )

  return sortCandidates(matches)
}
