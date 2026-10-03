export type CandidateOffice =
  | 'PRESIDENT'
  | 'GOVERNOR'
  | 'SENATOR'
  | 'FEDERAL_DEPUTY'
  | 'STATE_DEPUTY'
  | 'DISTRICT_DEPUTY'

export type Candidate = {
  id: string
  electionYear: number
  uf: string
  office: CandidateOffice
  number: string
  ballotName: string
  partyNumber: string
  partyAbbreviation: string
  photoUrl: string | null
}