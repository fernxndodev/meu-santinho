import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { election2026RNConfig, createElectionStages } from '../src/features/elections/electionConfig.ts'
import { matchesCandidateQuery } from '../src/features/candidates/candidateQuery.ts'
import { candidateSourceForQuery } from '../src/features/candidates/candidateSource.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const candidates = JSON.parse(
  readFileSync(
    new URL('../src/data/candidates/2026-rn-br.json', import.meta.url),
    'utf8',
  ),
)

function queryCandidates(office, uf = 'RN') {
  return candidates.filter((candidate) =>
    matchesCandidateQuery(candidate, { electionYear: 2026, uf, office }),
  )
}

test('contains only official records in the RN plus BR presidential scope', () => {
  assert.equal(candidates.length, 303)
  assert.equal(candidates.some((candidate) => candidate.id.startsWith('mock-')), false)
  assert.equal(candidates.every((candidate) => candidate.electionYear === 2026), true)
  assert.equal(
    candidates.every((candidate) => candidate.uf === 'RN' || candidate.uf === 'BR'),
    true,
  )
})

test('queries return the complete scoped set for each flow office', () => {
  assert.equal(queryCandidates('FEDERAL_DEPUTY').length, 111)
  assert.equal(queryCandidates('STATE_DEPUTY').length, 154)
  assert.equal(queryCandidates('SENATOR').length, 14)
  assert.equal(queryCandidates('GOVERNOR').length, 10)
  assert.equal(queryCandidates('PRESIDENT').length, 14)
  assert.equal(queryCandidates('PRESIDENT').every((candidate) => candidate.uf === 'BR'), true)
  assert.equal(queryCandidates('PRESIDENT', 'SP').length, 14)
})

test('selects official 2026 candidate data for supported Brazilian UFs', () => {
  for (const office of [
    'FEDERAL_DEPUTY',
    'STATE_DEPUTY',
    'SENATOR',
    'GOVERNOR',
    'PRESIDENT',
  ]) {
    assert.equal(
      candidateSourceForQuery({ electionYear: 2026, uf: 'RN', office }),
      'official',
    )
  }

  assert.equal(
    candidateSourceForQuery({
      electionYear: 2026,
      uf: 'SP',
      office: 'PRESIDENT',
    }),
    'official',
  )

  assert.equal(
    candidateSourceForQuery({
      electionYear: 2026,
      uf: 'DF',
      office: 'DISTRICT_DEPUTY',
    }),
    'official',
  )

  assert.equal(
    candidateSourceForQuery({
      electionYear: 2022,
      uf: 'RN',
      office: 'GOVERNOR',
    }),
    'unavailable',
  )
})

test('all imported candidates point to an extracted local photograph', () => {
  const photographedCandidates = candidates.filter((candidate) => candidate.photoUrl)
  assert.equal(photographedCandidates.length, 303)
  for (const candidate of photographedCandidates) {
    const localPath = path.join(projectRoot, 'public', candidate.photoUrl.replace(/^\//, ''))
    assert.equal(existsSync(localPath), true, `${candidate.id} photo asset exists`)
  }
})

test('2026 retains two separate senator selection stages', () => {
  const senatorStages = createElectionStages(election2026RNConfig).filter(
    (stage) => stage.office === 'SENATOR',
  )
  assert.equal(election2026RNConfig.senatorSelections, 2)
  assert.deepEqual(senatorStages.map((stage) => stage.id), ['SENATOR-1', 'SENATOR-2'])
  const senatorIds = new Set(queryCandidates('SENATOR').map((candidate) => candidate.id))
  assert.equal(senatorIds.size, 14)
})