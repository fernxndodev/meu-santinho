import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getTseCandidatePhotoFilename, normalizeTseCandidate } from '../src/features/candidates/normalizeTseCandidate.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const inputDirectory = path.join(projectRoot, 'data/tse/2026')
function argumentPath(name, fallback) {
  const position = process.argv.indexOf(name)
  return position === -1 ? fallback : path.resolve(process.argv[position + 1])
}

const candidatesArchive = argumentPath(
  '--candidates',
  path.join(inputDirectory, 'consulta_cand_2026.zip'),
)
const rnPhotosArchive = argumentPath(
  '--rn-photos',
  path.join(inputDirectory, 'foto_cand2026_RN_div.zip'),
)
const brPhotosArchive = argumentPath(
  '--br-photos',
  path.join(inputDirectory, 'foto_cand2026_BR_div.zip'),
)
const outputDataPath = path.join(projectRoot, 'src/data/candidates/2026-rn-br.json')
const outputProvenancePath = path.join(
  projectRoot,
  'src/data/candidates/2026-rn-br.provenance.json',
)
const publicPhotosRoot = path.join(projectRoot, 'public/candidates/2026')
const rnPhotoOutput = path.join(publicPhotosRoot, 'RN')
const brPhotoOutput = path.join(publicPhotosRoot, 'BR')

const supportedRnOffices = new Set(['3', '5', '6', '7'])
const candidateSourceUrl =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip'
const rnPhotosSourceUrl =
  'https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_RN_div.zip'
const brPhotosSourceUrl =
  'https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_BR_div.zip'

function readZipMember(archivePath, memberPath) {
  return execFileSync('unzip', ['-p', archivePath, memberPath], {
    encoding: 'buffer',
    maxBuffer: 128 * 1024 * 1024,
  })
}

function listZipMembers(archivePath) {
  return execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
}

function parseSemicolonCsv(text) {
  const records = []
  let record = []
  let field = ''
  let insideQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === '"') {
      if (insideQuotes && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (character === ';' && !insideQuotes) {
      record.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !insideQuotes) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      record.push(field)
      if (record.some((value) => value.length > 0)) records.push(record)
      record = []
      field = ''
    } else {
      field += character
    }
  }

  if (insideQuotes) throw new Error('CSV termina dentro de um campo entre aspas.')
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  const headers = records.shift()?.map((header) => header.replace(/^\uFEFF/, '').trim())
  if (!headers?.length) throw new Error('CSV oficial sem cabeçalho.')

  return records.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `Linha CSV ${index + 2} tem ${values.length} campos; esperado ${headers.length}.`,
      )
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]))
  })
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function valuesCount(records, codeField, descriptionField) {
  const counts = new Map()
  for (const row of records) {
    const key = `${row[codeField]} | ${row[descriptionField]}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

function readCandidates(memberPath, expectedUf, selectRow) {
  const csvBytes = readZipMember(candidatesArchive, memberPath)
  const csvText = new TextDecoder('windows-1252').decode(csvBytes)
  const rows = parseSemicolonCsv(csvText)
  const selected = []

  for (const [index, row] of rows.entries()) {
    if (!selectRow(row)) continue
    if (row.ANO_ELEICAO !== '2026' || row.SG_UF !== expectedUf) {
      throw new Error(`Contexto inesperado na linha ${index + 2} de ${memberPath}.`)
    }

    const candidate = normalizeTseCandidate(row)
    if (!candidate) {
      throw new Error(
        `Registro não normalizável no escopo em ${memberPath}, linha ${index + 2}, ` +
          `SQ_CANDIDATO=${row.SQ_CANDIDATO}, CD_CARGO=${row.CD_CARGO}, DS_CARGO=${row.DS_CARGO}.`,
      )
    }
    selected.push({ candidate, row })
  }

  return selected
}

function photoMemberByFilename(archivePath) {
  const map = new Map()
  for (const member of listZipMembers(archivePath)) {
    map.set(path.posix.basename(member), member)
  }
  return map
}

for (const archive of [candidatesArchive, rnPhotosArchive, brPhotosArchive]) {
  try {
    readFileSync(archive)
  } catch {
    throw new Error(`Arquivo oficial ausente: ${archive}`)
  }
}

const rnRows = readCandidates('consulta_cand_2026_RN.csv', 'RN', (row) =>
  supportedRnOffices.has(String(row.CD_CARGO).replaceAll('"', '').trim()),
)
const presidentRows = readCandidates(
  'consulta_cand_2026_BR.csv',
  'BR',
  (row) => row.CD_CARGO === '1' && row.DS_CARGO === 'PRESIDENTE',
)
const selectedRows = [...rnRows, ...presidentRows]
const candidatesById = new Map()

for (const { candidate } of selectedRows) {
  if (candidatesById.has(candidate.id)) {
    throw new Error(`SQ_CANDIDATO duplicado no escopo: ${candidate.id}`)
  }
  candidatesById.set(candidate.id, candidate)
}

const rnPhotoMembers = photoMemberByFilename(rnPhotosArchive)
const brPhotoMembers = photoMemberByFilename(brPhotosArchive)
const photoMembersByUf = new Map([
  ['RN', rnPhotoMembers],
  ['BR', brPhotoMembers],
])
const copiedPhotoDestinations = new Set()
const missingPhotos = []

for (const [directory, prefix] of [
  [rnPhotoOutput, 'FRN'],
  [brPhotoOutput, 'FBR'],
]) {
  mkdirSync(directory, { recursive: true })
  for (const filename of readdirSync(directory)) {
    if (filename.startsWith(prefix) && /^F(?:RN|BR)\d+_div\.jpg$/.test(filename)) {
      unlinkSync(path.join(directory, filename))
    }
  }
}

for (const { candidate, row } of selectedRows) {
  const filename = getTseCandidatePhotoFilename(row)
  const memberPath = filename ? photoMembersByUf.get(candidate.uf)?.get(filename) : undefined

  if (!filename || !memberPath) {
    missingPhotos.push({ id: candidate.id, uf: candidate.uf, office: candidate.office })
    continue
  }

  const destination = path.join(publicPhotosRoot, candidate.uf, filename)
  mkdirSync(path.dirname(destination), { recursive: true })
  writeFileSync(destination, readZipMember(candidate.uf === 'RN' ? rnPhotosArchive : brPhotosArchive, memberPath))
  candidate.photoUrl = `/candidates/2026/${candidate.uf}/${filename}`
  copiedPhotoDestinations.add(destination)
}

const candidateCounts = Object.fromEntries(
  Object.entries(
    selectedRows.reduce((counts, { candidate }) => {
      counts[candidate.office] = (counts[candidate.office] ?? 0) + 1
      return counts
    }, {}),
  ).sort(([left], [right]) => left.localeCompare(right)),
)

mkdirSync(path.dirname(outputDataPath), { recursive: true })
writeFileSync(outputDataPath, `${JSON.stringify([...candidatesById.values()], null, 2)}\n`)

const provenance = {
  dataset: 'Candidatos - 2026',
  datasetUrl: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2026',
  license: 'Creative Commons Atribuição',
  inputs: [
    { url: candidateSourceUrl, sha256: sha256(candidatesArchive) },
    { url: rnPhotosSourceUrl, sha256: sha256(rnPhotosArchive) },
    { url: brPhotosSourceUrl, sha256: sha256(brPhotosArchive) },
  ],
  candidateCounts,
  totalCandidates: selectedRows.length,
  photoCount: copiedPhotoDestinations.size,
  missingPhotos,
  candidacyStatusValues: {
    CD_SITUACAO_CANDIDATURA_DS_SITUACAO_CANDIDATURA: valuesCount(
      selectedRows.map(({ row }) => row),
      'CD_SITUACAO_CANDIDATURA',
      'DS_SITUACAO_CANDIDATURA',
    ),
    CD_SIT_TOT_TURNO_DS_SIT_TOT_TURNO: valuesCount(
      selectedRows.map(({ row }) => row),
      'CD_SIT_TOT_TURNO',
      'DS_SIT_TOT_TURNO',
    ),
  },
}
writeFileSync(outputProvenancePath, `${JSON.stringify(provenance, null, 2)}\n`)

let photoBytes = 0
for (const photoPath of copiedPhotoDestinations) {
  photoBytes += readFileSync(photoPath).byteLength
}

console.log(
  JSON.stringify(
    {
      candidateCounts,
      totalCandidates: selectedRows.length,
      photoCount: copiedPhotoDestinations.size,
      missingPhotos,
      generatedDataBytes: readFileSync(outputDataPath).byteLength,
      provenanceBytes: readFileSync(outputProvenancePath).byteLength,
      photoBytes,
      candidacyStatusValues: provenance.candidacyStatusValues,
    },
    null,
    2,
  ),
)