import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesCandidateQuery } from '../src/features/candidates/candidateQuery.ts'
import {
  getTseCandidatePhotoFilename,
  normalizeTseCandidate,
} from '../src/features/candidates/normalizeTseCandidate.ts'

const validRow = {
  ANO_ELEICAO: '2026',
  SG_UF: 'SP',
  CD_CARGO: '6',
  DS_CARGO: 'DEPUTADO FEDERAL',
  SQ_CANDIDATO: '250002552369',
  NR_CANDIDATO: '232',
  NM_URNA_CANDIDATO: 'CANDIDATO EXEMPLO',
  NR_PARTIDO: '23',
  SG_PARTIDO: 'PARTIDO EXEMPLO',
}

test('normalizes required candidate fields and preserves numeric identifiers as text', () => {
  assert.deepEqual(normalizeTseCandidate(validRow), {
    id: '250002552369',
    electionYear: 2026,
    uf: 'SP',
    office: 'FEDERAL_DEPUTY',
    number: '232',
    ballotName: 'CANDIDATO EXEMPLO',
    partyNumber: '23',
    partyAbbreviation: 'PARTIDO EXEMPLO',
    photoUrl: null,
  })
})

test('maps all supported 2026 offices including the District Federal office', () => {
  const cases = [
    ['1', 'PRESIDENTE', 'PRESIDENT'],
    ['3', 'GOVERNADOR', 'GOVERNOR'],
    ['5', 'SENADOR', 'SENATOR'],
    ['6', 'DEPUTADO FEDERAL', 'FEDERAL_DEPUTY'],
    ['7', 'DEPUTADO ESTADUAL', 'STATE_DEPUTY'],
    ['8', 'DEPUTADO DISTRITAL', 'DISTRICT_DEPUTY'],
  ]

  for (const [code, description, expectedOffice] of cases) {
    const candidate = normalizeTseCandidate({
      ...validRow,
      CD_CARGO: code,
      DS_CARGO: description,
    })
    assert.equal(candidate?.office, expectedOffice)
  }
})

test('rejects missing required fields and unsupported or inconsistent offices', () => {
  assert.equal(normalizeTseCandidate(null), null)
  assert.equal(normalizeTseCandidate({ ...validRow, SQ_CANDIDATO: '-1' }), null)
  assert.equal(normalizeTseCandidate({ ...validRow, NR_CANDIDATO: '#NULO' }), null)
  assert.equal(normalizeTseCandidate({ ...validRow, SG_UF: '???' }), null)
  assert.equal(normalizeTseCandidate({ ...validRow, NR_PARTIDO: '' }), null)
  assert.equal(
    normalizeTseCandidate({ ...validRow, CD_CARGO: '4', DS_CARGO: 'VICE-GOVERNADOR' }),
    null,
  )
  assert.equal(
    normalizeTseCandidate({ ...validRow, CD_CARGO: '7', DS_CARGO: 'DEPUTADO DISTRITAL' }),
    null,
  )
})

test('derives the official photo filename from UF and candidacy identifier', () => {
  assert.equal(
    getTseCandidatePhotoFilename({ SG_UF: 'SP', SQ_CANDIDATO: '250002552369' }),
    'FSP250002552369_div.jpg',
  )
  assert.equal(
    getTseCandidatePhotoFilename({ SG_UF: 'BR', SQ_CANDIDATO: '280002551932' }),
    'FBR280002551932_div.jpg',
  )
  assert.equal(getTseCandidatePhotoFilename({ SG_UF: 'SP', SQ_CANDIDATO: '-1' }), null)
})

test('matches national presidential candidates for an elector UF only', () => {
  const nationalPresident = {
    ...normalizeTseCandidate({
      ...validRow,
      SG_UF: 'BR',
      CD_CARGO: '1',
      DS_CARGO: 'PRESIDENTE',
    }),
  }
  const query = { electionYear: 2026, uf: 'SP', office: 'PRESIDENT' }

  assert.equal(matchesCandidateQuery(nationalPresident, query), true)
  assert.equal(
    matchesCandidateQuery(nationalPresident, { ...query, electionYear: 2022 }),
    false,
  )
  assert.equal(
    matchesCandidateQuery(nationalPresident, { ...query, office: 'GOVERNOR' }),
    false,
  )
})