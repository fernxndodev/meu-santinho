import type { Candidate, CandidateOffice } from './types'

export type TseCandidateRow = {
  ANO_ELEICAO: unknown
  SG_UF: unknown
  CD_CARGO: unknown
  DS_CARGO: unknown
  SQ_CANDIDATO: unknown
  NR_CANDIDATO: unknown
  NM_URNA_CANDIDATO: unknown
  NR_PARTIDO: unknown
  SG_PARTIDO: unknown
}

type SupportedTseOffice = {
  description: string
  office: CandidateOffice
}

const supportedOffices: Record<string, SupportedTseOffice> = {
  '1': { description: 'PRESIDENTE', office: 'PRESIDENT' },
  '3': { description: 'GOVERNADOR', office: 'GOVERNOR' },
  '5': { description: 'SENADOR', office: 'SENATOR' },
  '6': { description: 'DEPUTADO FEDERAL', office: 'FEDERAL_DEPUTY' },
  '7': { description: 'DEPUTADO ESTADUAL', office: 'STATE_DEPUTY' },
  '8': { description: 'DEPUTADO DISTRITAL', office: 'DISTRICT_DEPUTY' },
}

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).trim()
  if (!normalized || normalized === '-1' || normalized === '#NE' || normalized === '#NULO') {
    return null
  }
  return normalized
}

function numericText(value: unknown): string | null {
  const normalized = requiredText(value)
  return normalized && /^\d+$/.test(normalized) ? normalized : null
}

function electionYearValue(value: unknown): number | null {
  const text = numericText(value)
  if (!text) return null
  const year = Number(text)
  return Number.isSafeInteger(year) && year > 0 ? year : null
}

function normalizeUf(value: unknown): string | null {
  const uf = requiredText(value)?.toUpperCase()
  return uf && /^(?:[A-Z]{2}|BR)$/.test(uf) ? uf : null
}

function normalizeTseOffice(
  codeValue: unknown,
  descriptionValue: unknown,
): CandidateOffice | null {
  const code = numericText(codeValue)
  const description = requiredText(descriptionValue)?.toUpperCase()
  if (!code || !description) return null

  const mapping = supportedOffices[code]
  return mapping?.description === description ? mapping.office : null
}

export function normalizeTseCandidate(row: unknown): Candidate | null {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return null

  const source = row as Partial<TseCandidateRow>
  const id = numericText(source.SQ_CANDIDATO)
  const electionYear = electionYearValue(source.ANO_ELEICAO)
  const uf = normalizeUf(source.SG_UF)
  const office = normalizeTseOffice(source.CD_CARGO, source.DS_CARGO)
  const number = numericText(source.NR_CANDIDATO)
  const ballotName = requiredText(source.NM_URNA_CANDIDATO)
  const partyNumber = numericText(source.NR_PARTIDO)
  const partyAbbreviation = requiredText(source.SG_PARTIDO)

  if (
    !id ||
    electionYear === null ||
    !uf ||
    !office ||
    !number ||
    !ballotName ||
    !partyNumber ||
    !partyAbbreviation
  ) {
    return null
  }

  return {
    id,
    electionYear,
    uf,
    office,
    number,
    ballotName,
    partyNumber,
    partyAbbreviation,
    photoUrl: null,
  }
}

export function getTseCandidatePhotoFilename(
  row: Pick<TseCandidateRow, 'SG_UF' | 'SQ_CANDIDATO'>,
): string | null {
  const uf = normalizeUf(row.SG_UF)
  const candidateId = numericText(row.SQ_CANDIDATO)
  if (!uf || !candidateId) return null

  return `F${uf}${candidateId}_div.jpg`
}