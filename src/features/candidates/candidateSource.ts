import type { CandidateQuery } from './candidateQuery'

export const officialCandidateDataUfs = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
])

const officialOffices = new Set([
  'FEDERAL_DEPUTY',
  'STATE_DEPUTY',
  'DISTRICT_DEPUTY',
  'SENATOR',
  'GOVERNOR',
  'PRESIDENT',
])

export function hasOfficialCandidateData(
  electionYear: number,
  uf: string,
): boolean {
  return electionYear === 2026 && officialCandidateDataUfs.has(uf)
}

export function candidateSourceForQuery(
  query: CandidateQuery,
): 'official' | 'unavailable' {
  return hasOfficialCandidateData(query.electionYear, query.uf) &&
    officialOffices.has(query.office)
    ? 'official'
    : 'unavailable'
}
