import type { CandidateOffice } from '../candidates/types'

export type ElectionFlowConfig = {
  electionYear: number
  uf: string
  senatorSelections: number
  officeSequence: readonly CandidateOffice[]
}

export type ElectionStage = {
  id: string
  office: CandidateOffice
  label: string
}

export const officeLabels: Record<CandidateOffice, string> = {
  PRESIDENT: 'Presidente',
  GOVERNOR: 'Governador',
  SENATOR: 'Senador',
  FEDERAL_DEPUTY: 'Deputado Federal',
  STATE_DEPUTY: 'Deputado Estadual',
  DISTRICT_DEPUTY: 'Deputado Distrital',
}

export const brazilianStates = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
] as const

export type BrazilianUf = (typeof brazilianStates)[number]['uf']

export function createElection2026Config(uf: BrazilianUf): ElectionFlowConfig {
  return {
    electionYear: 2026,
    uf,
    senatorSelections: 2,
    officeSequence: [
      'FEDERAL_DEPUTY',
      uf === 'DF' ? 'DISTRICT_DEPUTY' : 'STATE_DEPUTY',
      'SENATOR',
      'GOVERNOR',
      'PRESIDENT',
    ],
  }
}

// Compatibilidade temporária com o fluxo atual.
// Será removida quando a seleção de UF estiver conectada à interface.
export const election2026RNConfig = createElection2026Config('RN')

export function createElectionStages(config: ElectionFlowConfig): ElectionStage[] {
  return config.officeSequence.flatMap((office): ElectionStage[] => {
    if (office !== 'SENATOR') {
      return [{ id: office, office, label: officeLabels[office] }]
    }

    return Array.from(
      { length: config.senatorSelections },
      (_, index): ElectionStage => ({
        id: `${office}-${index + 1}`,
        office,
        label: `${officeLabels[office]} — ${index + 1}ª escolha`,
      }),
    )
  })
}
