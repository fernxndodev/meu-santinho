import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getTseCandidatePhotoFilename,
  normalizeTseCandidate,
} from '../src/features/candidates/normalizeTseCandidate.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const inputDirectory = path.join(projectRoot, 'data/tse/2026')
const candidatesArchive = path.join(
  inputDirectory,
  'consulta_cand_2026.zip',
)

const outputDirectory = path.join(
  projectRoot,
  'src/data/candidates/2026',
)

const photosRoot = path.join(
  projectRoot,
  'public/candidates/2026',
)

const provenancePath = path.join(
  outputDirectory,
  'provenance.json',
)

const candidateSourceUrl =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip'

const photoSourceBaseUrl =
  'https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos'

const ufs = [
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
]

const allPhotoUfs = [...ufs, 'BR']

const stateOfficeCodes = new Set(['3', '5', '6', '7'])
const districtOfficeCodes = new Set(['3', '5', '6', '8'])

function readZipMember(archivePath, memberPath) {
  return execFileSync(
    'unzip',
    ['-p', archivePath, memberPath],
    {
      encoding: 'buffer',
      maxBuffer: 256 * 1024 * 1024,
    },
  )
}

function listZipMembers(archivePath) {
  return execFileSync(
    'unzip',
    ['-Z1', archivePath],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  )
    .split(/\r?\n/)
    .filter(Boolean)
}

function photoMemberByFilename(archivePath) {
  const members = new Map()

  for (const member of listZipMembers(archivePath)) {
    const filename = path.posix.basename(member)

    if (!filename) {
      continue
    }

    members.set(filename, member)
  }

  return members
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
    } else if (
      (character === '\n' || character === '\r') &&
      !insideQuotes
    ) {
      if (
        character === '\r' &&
        text[index + 1] === '\n'
      ) {
        index += 1
      }

      record.push(field)

      if (record.some((value) => value.length > 0)) {
        records.push(record)
      }

      record = []
      field = ''
    } else {
      field += character
    }
  }

  if (insideQuotes) {
    throw new Error(
      'CSV termina dentro de um campo entre aspas.',
    )
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  const headers = records
    .shift()
    ?.map((header) =>
      header.replace(/^\uFEFF/, '').trim(),
    )

  if (!headers?.length) {
    throw new Error('CSV oficial sem cabeçalho.')
  }

  return records.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `Linha CSV ${index + 2} tem ${values.length} campos; ` +
          `esperado ${headers.length}.`,
      )
    }

    return Object.fromEntries(
      headers.map((header, column) => [
        header,
        values[column],
      ]),
    )
  })
}

function sha256(filePath) {
  return createHash('sha256')
    .update(readFileSync(filePath))
    .digest('hex')
}

function readCsv(memberPath) {
  const bytes = readZipMember(
    candidatesArchive,
    memberPath,
  )

  const text = new TextDecoder(
    'windows-1252',
  ).decode(bytes)

  return parseSemicolonCsv(text)
}

function normalizeRows(rows, expectedUf, officeCodes) {
  const entries = []
  const ids = new Set()

  for (const [index, row] of rows.entries()) {
    if (row.ANO_ELEICAO !== '2026') {
      continue
    }

    if (row.SG_UF !== expectedUf) {
      throw new Error(
        `UF inesperada em ${expectedUf}, linha ${
          index + 2
        }: ${row.SG_UF}`,
      )
    }

    const officeCode = String(
      row.CD_CARGO,
    ).trim()

    if (!officeCodes.has(officeCode)) {
      continue
    }

    const candidate = normalizeTseCandidate(row)

    if (!candidate) {
      throw new Error(
        `Registro não normalizável: UF=${expectedUf}, ` +
          `linha=${index + 2}, ` +
          `SQ_CANDIDATO=${row.SQ_CANDIDATO}, ` +
          `CD_CARGO=${row.CD_CARGO}.`,
      )
    }

    if (ids.has(candidate.id)) {
      throw new Error(
        `SQ_CANDIDATO duplicado em ${expectedUf}: ` +
          candidate.id,
      )
    }

    ids.add(candidate.id)

    entries.push({
      candidate,
      row,
    })
  }

  return entries
}

function candidateCounts(candidates) {
  const counts = {}

  for (const candidate of candidates) {
    counts[candidate.office] =
      (counts[candidate.office] ?? 0) + 1
  }

  return Object.fromEntries(
    Object.entries(counts).sort(
      ([left], [right]) =>
        left.localeCompare(right),
    ),
  )
}

function photoArchiveForUf(uf) {
  return path.join(
    inputDirectory,
    `foto_cand2026_${uf}_div.zip`,
  )
}

function preparePhotos(uf, entries) {
  const archivePath = photoArchiveForUf(uf)

  try {
    readFileSync(archivePath)
  } catch {
    throw new Error(
      `ZIP de fotos ausente para ${uf}: ${archivePath}`,
    )
  }

  const members = photoMemberByFilename(archivePath)

  const destinationDirectory = path.join(
    photosRoot,
    uf,
  )

  mkdirSync(destinationDirectory, {
    recursive: true,
  })

  const missingPhotos = []
  let extractedPhotos = 0

  const candidates = entries.map(({ candidate, row }) => {
    const filename =
      getTseCandidatePhotoFilename(row)

    const member = members.get(filename)

    if (!member) {
      missingPhotos.push({
        id: candidate.id,
        office: candidate.office,
        ballotName: candidate.ballotName,
        expectedFilename: filename,
      })

      return {
        ...candidate,
        photoUrl: null,
      }
    }

    const bytes = readZipMember(
      archivePath,
      member,
    )

    writeFileSync(
      path.join(destinationDirectory, filename),
      bytes,
    )

    extractedPhotos += 1

    return {
      ...candidate,
      photoUrl:
        `/candidates/2026/${uf}/${filename}`,
    }
  })

  return {
    candidates,
    extractedPhotos,
    missingPhotos,
    photoArchiveSha256: sha256(archivePath),
  }
}

try {
  readFileSync(candidatesArchive)
} catch {
  throw new Error(
    `Arquivo oficial ausente: ${candidatesArchive}`,
  )
}

for (const uf of allPhotoUfs) {
  const archive = photoArchiveForUf(uf)

  try {
    readFileSync(archive)
  } catch {
    throw new Error(
      `Arquivo de fotos ausente para ${uf}: ${archive}`,
    )
  }
}

mkdirSync(outputDirectory, {
  recursive: true,
})

mkdirSync(photosRoot, {
  recursive: true,
})

const summary = {}
let nationalTotal = 0
let nationalPhotos = 0
let nationalMissingPhotos = 0

for (const uf of ufs) {
  const member =
    `consulta_cand_2026_${uf}.csv`

  const rows = readCsv(member)

  const officeCodes =
    uf === 'DF'
      ? districtOfficeCodes
      : stateOfficeCodes

  const entries = normalizeRows(
    rows,
    uf,
    officeCodes,
  )

  const photoResult = preparePhotos(
    uf,
    entries,
  )

  const candidates = photoResult.candidates

  writeFileSync(
    path.join(outputDirectory, `${uf}.json`),
    `${JSON.stringify(candidates, null, 2)}\n`,
  )

  summary[uf] = {
    total: candidates.length,
    candidateCounts:
      candidateCounts(candidates),
    extractedPhotos:
      photoResult.extractedPhotos,
    missingPhotos:
      photoResult.missingPhotos,
    photoSource: {
      url:
        `${photoSourceBaseUrl}/foto_cand2026_${uf}_div.zip`,
      sha256:
        photoResult.photoArchiveSha256,
    },
  }

  nationalTotal += candidates.length
  nationalPhotos +=
    photoResult.extractedPhotos
  nationalMissingPhotos +=
    photoResult.missingPhotos.length

  console.log(
    `${uf}: candidatos=${candidates.length} | ` +
      `fotos=${photoResult.extractedPhotos} | ` +
      `faltando=${photoResult.missingPhotos.length}`,
  )
}

// Presidente é nacional.
const presidentRows = readCsv(
  'consulta_cand_2026_BR.csv',
)

const presidentEntries = normalizeRows(
  presidentRows,
  'BR',
  new Set(['1']),
)

const presidentPhotoResult = preparePhotos(
  'BR',
  presidentEntries,
)

const presidents =
  presidentPhotoResult.candidates

writeFileSync(
  path.join(outputDirectory, 'BR.json'),
  `${JSON.stringify(presidents, null, 2)}\n`,
)

summary.BR = {
  total: presidents.length,
  candidateCounts:
    candidateCounts(presidents),
  extractedPhotos:
    presidentPhotoResult.extractedPhotos,
  missingPhotos:
    presidentPhotoResult.missingPhotos,
  photoSource: {
    url:
      `${photoSourceBaseUrl}/foto_cand2026_BR_div.zip`,
    sha256:
      presidentPhotoResult.photoArchiveSha256,
  },
}

nationalTotal += presidents.length
nationalPhotos +=
  presidentPhotoResult.extractedPhotos
nationalMissingPhotos +=
  presidentPhotoResult.missingPhotos.length

console.log(
  `BR: candidatos=${presidents.length} | ` +
    `fotos=${presidentPhotoResult.extractedPhotos} | ` +
    `faltando=${presidentPhotoResult.missingPhotos.length}`,
)

const provenance = {
  dataset: 'Candidatos - 2026',
  datasetUrl:
    'https://dadosabertos.tse.jus.br/dataset/candidatos-2026',
  license: 'Creative Commons Atribuição',
  generatedAt: new Date().toISOString(),
  candidateSource: {
    url: candidateSourceUrl,
    sha256: sha256(candidatesArchive),
  },
  ufs,
  summary,
  totals: {
    candidates: nationalTotal,
    photos: nationalPhotos,
    missingPhotos: nationalMissingPhotos,
  },
}

writeFileSync(
  provenancePath,
  `${JSON.stringify(provenance, null, 2)}\n`,
)

console.log('')
console.log('Importação nacional concluída.')
console.log(`UFs: ${ufs.length}`)
console.log(`Candidatos: ${nationalTotal}`)
console.log(`Fotos: ${nationalPhotos}`)
console.log(
  `Fotos faltantes: ${nationalMissingPhotos}`,
)
console.log(`JSON: ${outputDirectory}`)
console.log(`Fotos: ${photosRoot}`)
