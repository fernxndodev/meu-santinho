import { useEffect, useMemo, useState } from 'react'
import { getCandidates } from './features/candidates/candidateData'
import { matchesCandidateQuery } from './features/candidates/candidateQuery'
import { loadBallot, removeBallot, saveBallot } from './features/ballot/ballotStorage'
import {
  brazilianStates,
  createElection2026Config,
  createElectionStages,
  officeLabels,
  type BrazilianUf,
  type ElectionStage,
} from './features/elections/electionConfig'
import {
  loadSelectedUf,
  removeSelectedUf,
  saveSelectedUf,
} from './features/elections/selectedUfStorage'
import type { Candidate, CandidateOffice } from './features/candidates/types'
import './App.css'

type CandidateLoad = {
  stageId: string
  candidates: Candidate[]
}

type ChoiceGroup = {
  office: CandidateOffice
  label: string
  stages: ElectionStage[]
}

type StorageMessage = 'idle' | 'saved' | 'restored' | 'cleared' | 'error'

function groupStagesByOffice(stages: ElectionStage[]): ChoiceGroup[] {
  const groups: ChoiceGroup[] = []

  for (const stage of stages) {
    const existingGroup = groups.find((group) => group.office === stage.office)
    if (existingGroup) {
      existingGroup.stages.push(stage)
    } else {
      groups.push({
        office: stage.office,
        label: officeLabels[stage.office],
        stages: [stage],
      })
    }
  }

  return groups
}

function App() {
  const [selectedUf, setSelectedUf] = useState<BrazilianUf | null>(() =>
    loadSelectedUf(),
  )
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [selections, setSelections] = useState<Record<string, Candidate>>({})
  const [candidateLoad, setCandidateLoad] = useState<CandidateLoad | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [storageMessage, setStorageMessage] = useState<StorageMessage>('idle')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [showAllCandidates, setShowAllCandidates] = useState(false)

  const electionConfig = useMemo(
    () => (selectedUf ? createElection2026Config(selectedUf) : null),
    [selectedUf],
  )

  const electionStages = useMemo(
    () => (electionConfig ? createElectionStages(electionConfig) : []),
    [electionConfig],
  )

  const reviewGroups = useMemo(
    () => groupStagesByOffice(electionStages),
    [electionStages],
  )

  const electionContext = useMemo(
    () =>
      electionConfig
        ? {
            electionYear: electionConfig.electionYear,
            uf: electionConfig.uf,
          }
        : null,
    [electionConfig],
  )

  const currentStage = electionStages[currentStageIndex]

  useEffect(() => {
    if (!currentStage || !electionContext) return

    let isActive = true

    void getCandidates({
      ...electionContext,
      office: currentStage.office,
    }).then((candidates) => {
      if (isActive) {
        setCandidateLoad({ stageId: currentStage.id, candidates })
      }
    })

    return () => {
      isActive = false
    }
  }, [currentStage, electionContext])

  useEffect(() => {
    if (!electionContext || electionStages.length === 0) return

    let isActive = true
    const context = electionContext

    async function restoreSelections(): Promise<Record<string, Candidate>> {
      const savedIds = loadBallot(
        context,
        electionStages.map((stage) => stage.id),
      )
      if (!savedIds) return {}

      const candidateRequests = new Map<CandidateOffice, Promise<Candidate[]>>()
      const resolvedSelections = await Promise.all(
        electionStages.map(async (stage) => {
          const candidateId = savedIds[stage.id]
          if (!candidateId) return null

          let candidatesRequest = candidateRequests.get(stage.office)
          if (!candidatesRequest) {
            candidatesRequest = getCandidates({
              ...context,
              office: stage.office,
            })
            candidateRequests.set(stage.office, candidatesRequest)
          }

          const candidates = await candidatesRequest
          const candidate = candidates.find(
            (item) =>
              item.id === candidateId &&
              matchesCandidateQuery(item, {
                ...context,
                office: stage.office,
              }),
          )
          return candidate ? { stage, candidate } : null
        }),
      )

      const restored: Record<string, Candidate> = {}
      const senatorIds = new Set<string>()
      for (const selection of resolvedSelections) {
        if (!selection) continue
        if (selection.stage.office === 'SENATOR') {
          if (senatorIds.has(selection.candidate.id)) continue
          senatorIds.add(selection.candidate.id)
        }
        restored[selection.stage.id] = selection.candidate
      }
      return restored
    }

    void restoreSelections()
      .then((restored) => {
        if (!isActive) return
        setSelections(restored)
        const firstIncompleteStage = electionStages.findIndex(
          (stage) => !restored[stage.id],
        )
        if (firstIncompleteStage === -1) {
          setCurrentStageIndex(electionStages.length)
          setIsComplete(true)
        } else {
          setCurrentStageIndex(firstIncompleteStage)
        }
        if (Object.keys(restored).length > 0) setStorageMessage('restored')
      })
      .catch(() => {
        if (isActive) setStorageMessage('error')
      })
      .finally(() => {
        if (isActive) setIsRestoring(false)
      })

    return () => {
      isActive = false
    }
  }, [electionContext, electionStages])

  const loadedCandidates =
    candidateLoad &&
    currentStage &&
    candidateLoad.stageId === currentStage.id
      ? candidateLoad.candidates
      : null
  const reservedSenatorIds = new Set(
    electionStages
      .filter((stage) => stage.office === 'SENATOR' && stage.id !== currentStage?.id)
      .map((stage) => selections[stage.id]?.id)
      .filter((id): id is string => id !== undefined),
  )
  const availableCandidates = loadedCandidates?.filter(
    (candidate) => !reservedSenatorIds.has(candidate.id),
  )
  const selectedCandidate = currentStage
    ? selections[currentStage.id]
    : undefined

  const normalizedCandidateSearch = candidateSearch
    .trim()
    .toLocaleLowerCase('pt-BR')

  const visibleCandidates = useMemo(() => {
    if (!availableCandidates) return null

    if (!normalizedCandidateSearch) {
      return showAllCandidates ? availableCandidates : []
    }

    return availableCandidates.filter((candidate) => {
      const candidateName = candidate.ballotName.toLocaleLowerCase('pt-BR')

      return (
        candidateName.includes(normalizedCandidateSearch) ||
        candidate.number.includes(normalizedCandidateSearch)
      )
    })
  }, [
    availableCandidates,
    normalizedCandidateSearch,
    showAllCandidates,
  ])

  function selectCandidate(candidate: Candidate) {
    if (!currentStage || !electionContext) return

    const repeatsSenator =
      currentStage.office === 'SENATOR' &&
      electionStages.some(
        (stage) =>
          stage.office === 'SENATOR' &&
          stage.id !== currentStage.id &&
          selections[stage.id]?.id === candidate.id,
      )
    if (repeatsSenator) return

    const nextSelections = { ...selections, [currentStage.id]: candidate }
    setSelections(nextSelections)
    const candidateIds = Object.fromEntries(
      Object.entries(nextSelections).map(([stageId, selected]) => [stageId, selected.id]),
    )
    setStorageMessage(
      saveBallot(electionContext, candidateIds) ? 'saved' : 'error',
    )
  }

  function continueToNextStage() {
    if (!selectedCandidate) return
    setCandidateSearch('')
    setShowAllCandidates(false)
    setCurrentStageIndex((index) => index + 1)
  }

  function editStage(stageId: string) {
    const stageIndex = electionStages.findIndex((stage) => stage.id === stageId)

    if (stageIndex !== -1) {
      setCandidateSearch('')
      setShowAllCandidates(false)
      setCurrentStageIndex(stageIndex)
    }
  }

  function clearCurrentBallot() {
    if (!electionContext) return
    const removed = removeBallot(electionContext)
    setSelections({})
    setCurrentStageIndex(0)
    setIsComplete(false)
    setStorageMessage(removed ? 'cleared' : 'error')
  }

  function chooseUf(uf: BrazilianUf) {
    setCandidateSearch('')
    setShowAllCandidates(false)
    saveSelectedUf(uf)
    setSelections({})
    setCandidateLoad(null)
    setCurrentStageIndex(0)
    setIsComplete(false)
    setStorageMessage('idle')
    setIsRestoring(true)
    setSelectedUf(uf)
  }

  function changeUf() {
    setCandidateSearch('')
    setShowAllCandidates(false)
    removeSelectedUf()
    setSelectedUf(null)
    setSelections({})
    setCandidateLoad(null)
    setCurrentStageIndex(0)
    setIsComplete(false)
    setIsRestoring(false)
    setStorageMessage('idle')
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <p className="privacy-note">
        Suas escolhas ficam salvas somente neste dispositivo.
      </p>
      <StorageFeedback message={storageMessage} />

      {!selectedUf ? (
        <StateSelectionScreen onSelect={chooseUf} />
      ) : isComplete ? (
        <CompletedBallot
          selections={selections}
          electionYear={electionConfig!.electionYear}
          uf={electionConfig!.uf}
          reviewGroups={reviewGroups}
          onReview={() => setIsComplete(false)}
          onClear={clearCurrentBallot}
          onChangeUf={changeUf}
        />
      ) : currentStage ? (
        <section className="candidate-selection-v2" aria-labelledby="page-title">
          <div className="candidate-topbar">
            <button
              className="candidate-back"
              type="button"
              disabled={isRestoring}
              onClick={
                currentStageIndex > 0
                  ? () => {
                      setCandidateSearch('')
                      setShowAllCandidates(false)
                      setCurrentStageIndex((index) => index - 1)
                    }
                  : changeUf
              }
              aria-label={currentStageIndex > 0 ? 'Voltar uma etapa' : 'Trocar estado'}
            >
              ←
            </button>

            <div className="candidate-location">
              <span>Eleições {electionConfig!.electionYear}</span>
              <strong>{electionConfig!.uf}</strong>
            </div>
          </div>

          <div className="candidate-progress-v2">
            <div className="candidate-progress-meta">
              <span>
                Etapa {currentStageIndex + 1} de {electionStages.length}
              </span>

              <strong>
                {Math.round(
                  ((currentStageIndex + 1) / electionStages.length) * 100,
                )}
                %
              </strong>
            </div>

            <div
              className="candidate-progress-track"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={electionStages.length}
              aria-valuenow={currentStageIndex + 1}
              aria-label={`Etapa ${currentStageIndex + 1} de ${electionStages.length}`}
            >
              <span
                style={{
                  width: `${((currentStageIndex + 1) / electionStages.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="candidate-intro-v2">
            <span className="candidate-stage-kicker">
              {currentStage.office === 'SENATOR'
                ? currentStage.label
                : 'Sua próxima escolha'}
            </span>

            <h1 id="page-title">
              Quem é seu
              <span>{currentStage.label}?</span>
            </h1>

            <p>
              Encontre a candidatura pelo nome usado na urna ou pelo número.
            </p>
          </div>

          <p className="candidate-motivation">
            {currentStageIndex === 0 && (
              <>
                <strong>Escolha com atenção.</strong>{' '}
                Consulte as informações antes de continuar.
              </>
            )}

            {currentStageIndex === 1 && (
              <>
                <strong>Uma escolha de cada vez.</strong>{' '}
                Confira nome e número com calma.
              </>
            )}

            {currentStageIndex === 2 && (
              <>
                <strong>Informação importa.</strong>{' '}
                Verifique os dados da candidatura antes de selecionar.
              </>
            )}

            {currentStageIndex === 3 && (
              <>
                <strong>Continue com atenção.</strong>{' '}
                Confira esta escolha antes de avançar.
              </>
            )}

            {currentStageIndex === 4 && (
              <>
                <strong>Estamos quase lá.</strong>{' '}
                Revise nome e número antes de continuar.
              </>
            )}

            {currentStageIndex === 5 && (
              <>
                <strong>Última etapa.</strong>{' '}
                Depois desta escolha, você poderá revisar toda a sua cola.
              </>
            )}
          </p>

          <div className="candidate-search-panel">
            <label className="candidate-search-v2">
              <span className="candidate-search-symbol" aria-hidden="true">
                ⌕
              </span>

              <span className="sr-only">
                Buscar candidatura por nome ou número
              </span>

              <input
                type="search"
                value={candidateSearch}
                onChange={(event) => {
                  setCandidateSearch(event.target.value)
                  setShowAllCandidates(false)
                }}
                placeholder="Digite o nome ou número"
                autoComplete="off"
                disabled={isRestoring || loadedCandidates === null}
              />

              {candidateSearch && (
                <button
                  type="button"
                  className="candidate-search-clear"
                  onClick={() => setCandidateSearch('')}
                  aria-label="Limpar busca"
                >
                  ×
                </button>
              )}
            </label>

            {!normalizedCandidateSearch && !showAllCandidates && (
              <div className="candidate-search-empty">
                <span className="candidate-search-icon-large" aria-hidden="true">
                  ⌕
                </span>

                <strong>Encontre sua candidatura</strong>

                <p>
                  Digite o nome ou o número no campo acima.
                </p>

                <button
                  className="show-all-candidates"
                  type="button"
                  disabled={isRestoring || loadedCandidates === null}
                  onClick={() => setShowAllCandidates(true)}
                >
                  Ver todas as candidaturas
                </button>
              </div>
            )}

            {(normalizedCandidateSearch || showAllCandidates) && (
              <div className="candidate-results">
                <div className="candidate-results-heading">
                  <strong>
                    {normalizedCandidateSearch
                      ? 'Resultados da busca'
                      : 'Todas as candidaturas'}
                  </strong>

                  <span>
                    {visibleCandidates?.length ?? 0}{' '}
                    {visibleCandidates?.length === 1
                      ? 'resultado'
                      : 'resultados'}
                  </span>
                </div>

                <div
                  className="candidate-list-v2"
                  aria-busy={isRestoring || loadedCandidates === null}
                >
                  {isRestoring ? (
                    <p className="candidate-list-message" role="status">
                      Verificando suas escolhas...
                    </p>
                  ) : loadedCandidates === null ? (
                    <p className="candidate-list-message" role="status">
                      Carregando candidaturas...
                    </p>
                  ) : visibleCandidates?.length ? (
                    visibleCandidates.map((candidate) => (
                      <CandidateOption
                        key={candidate.id}
                        candidate={candidate}
                        roleLabel={currentStage.label}
                        selected={candidate.id === selectedCandidate?.id}
                        onSelect={() => selectCandidate(candidate)}
                      />
                    ))
                  ) : (
                    <div className="candidate-no-results">
                      <strong>Nenhuma candidatura encontrada</strong>
                      <span>
                        Confira o nome ou número informado e tente novamente.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedCandidate && (
            <div className="selected-candidate-summary">
              <div>
                <span>Sua escolha</span>
                <strong>{selectedCandidate.ballotName}</strong>
              </div>

              <span className="selected-candidate-number">
                {selectedCandidate.number}
              </span>
            </div>
          )}

          <div className="candidate-footer-v2">
            <p>
              Dados das candidaturas provenientes da Justiça Eleitoral/TSE.
            </p>

            <button
              className="continue-v2"
              type="button"
              disabled={isRestoring || !selectedCandidate}
              onClick={continueToNextStage}
            >
              <span>
                {currentStageIndex === electionStages.length - 1
                  ? 'Revisar escolhas'
                  : 'Continuar'}
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="candidate-secondary-controls">
            <ClearChoicesButton
              onClear={clearCurrentBallot}
              disabled={isRestoring}
            />

            <button
              className="change-uf"
              type="button"
              disabled={isRestoring}
              onClick={changeUf}
            >
              Trocar estado
            </button>
          </div>
        </section>
      ) : (
        <ReviewScreen
          selections={selections}
          electionYear={electionConfig!.electionYear}
          uf={electionConfig!.uf}
          electionStages={electionStages}
          reviewGroups={reviewGroups}
          onEdit={editStage}
          onBack={() => setCurrentStageIndex(electionStages.length - 1)}
          onComplete={() => setIsComplete(true)}
          onClear={clearCurrentBallot}
          onChangeUf={changeUf}
        />
      )}
    </main>
  )
}

type StateSelectionScreenProps = {
  onSelect: (uf: BrazilianUf) => void
}

function StateSelectionScreen({ onSelect }: StateSelectionScreenProps) {
  const [search, setSearch] = useState('')

  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')

  const filteredStates = brazilianStates.filter((state) => {
    if (!normalizedSearch) return true

    return (
      state.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
      state.uf.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
    )
  })

  return (
    <section className="state-selection-v2" aria-labelledby="state-title">
      <div className="state-hero">
        <div className="state-brand">
          <img
            className="state-brand-logo"
            src="/brand/logo-meu-santinho.png"
            alt="Meu Santinho"
          />
        </div>

        <div className="state-heading">
          <span className="state-step">Primeiro passo</span>

          <h1 id="state-title">
            Onde você{" "}
            <br />
            <span>vota?</span>
          </h1>

          <p>
            Escolha seu estado para mostrarmos os candidatos
            correspondentes à sua região.
          </p>
        </div>
      </div>

      <div className="state-glass-panel">
        <label className="state-search">
          <span className="state-search-icon" aria-hidden="true">
            ⌕
          </span>

          <span className="sr-only">Buscar estado ou UF</span>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar estado ou UF"
            autoComplete="off"
          />
        </label>

        <div className="state-list-header">
          <span>Estados</span>
          <span>
            {filteredStates.length}{' '}
            {filteredStates.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>

        <div className="state-grid-v2">
          {filteredStates.map((state) => (
            <button
              className="state-option-v2"
              type="button"
              key={state.uf}
              onClick={() => onSelect(state.uf)}
            >
              <span className="state-uf">{state.uf}</span>

              <span className="state-name">{state.name}</span>

              <span className="state-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>

        {filteredStates.length === 0 && (
          <div className="state-empty">
            <strong>Nenhum estado encontrado</strong>
            <span>Tente buscar pelo nome ou pela sigla.</span>
          </div>
        )}

        <p className="state-privacy">
          Sua escolha fica salva somente neste dispositivo.
        </p>
      </div>
    </section>
  )
}

function AppHeader() {
  return (
    <header className="site-header">
      <span className="election-header-title">ELEIÇÕES 2026</span>
    </header>
  )
}

function StorageFeedback({ message }: { message: StorageMessage }) {
  if (message === 'idle') return null

  const messages: Record<Exclude<StorageMessage, 'idle'>, string> = {
    saved: 'Escolhas salvas neste dispositivo.',
    restored: 'Escolhas recuperadas deste dispositivo.',
    cleared: 'Escolhas removidas deste dispositivo.',
    error: 'Não foi possível atualizar as escolhas salvas neste dispositivo.',
  }

  return (
    <p className="storage-feedback" role="status" aria-live="polite">
      {messages[message]}
    </p>
  )
}

function ClearChoicesButton({
  onClear,
  disabled = false,
}: {
  onClear: () => void
  disabled?: boolean
}) {
  return (
    <button
      className="clear-ballot"
      type="button"
      disabled={disabled}
      onClick={onClear}
    >
      Limpar minhas escolhas
    </button>
  )
}

type CandidateOptionProps = {
  candidate: Candidate
  roleLabel: string
  selected: boolean
  onSelect: () => void
}

function CandidateOption({
  candidate,
  roleLabel,
  selected,
  onSelect,
}: CandidateOptionProps) {
  return (
    <label className={`candidate-card${selected ? ' is-selected' : ''}`}>
      <input
        className="candidate-radio"
        type="radio"
        name="candidate"
        value={candidate.id}
        checked={selected}
        onChange={onSelect}
      />
      <img className="candidate-photo" src={candidate.photoUrl ?? undefined} alt="" />
      <CandidateInformation candidate={candidate} roleLabel={roleLabel} />
      <span className="candidate-state">
        {selected ? 'Selecionado' : 'Selecionar'}
      </span>
    </label>
  )
}

type CandidateInformationProps = {
  candidate: Candidate
  roleLabel?: string
}

function CandidateInformation({ candidate, roleLabel }: CandidateInformationProps) {
  return (
    <span className="candidate-details">
      {roleLabel && <span className="candidate-office">{roleLabel}</span>}
      <span className="candidate-name">{candidate.ballotName}</span>
      <span className="candidate-number">
        <span className="number-label">Número</span>{' '}
        <span className="number-value">{candidate.number}</span>
      </span>
      <span className="candidate-party">
        Partido {candidate.partyAbbreviation} · legenda {candidate.partyNumber}
      </span>
    </span>
  )
}

type ReviewScreenProps = {
  selections: Record<string, Candidate>
  electionYear: number
  uf: string
  electionStages: ElectionStage[]
  reviewGroups: ChoiceGroup[]
  onEdit: (stageId: string) => void
  onBack: () => void
  onComplete: () => void
  onClear: () => void
  onChangeUf: () => void
}

function ReviewScreen({
  selections,
  electionYear,
  uf,
  electionStages,
  reviewGroups,
  onEdit,
  onBack,
  onComplete,
  onClear,
  onChangeUf,
}: ReviewScreenProps) {
  return (
    <section className="review-screen" aria-labelledby="page-title">
      <p className="eyebrow">
        Eleições {electionYear} • UF {uf}
      </p>
      <h1 id="page-title">Revise suas escolhas</h1>
      <progress
        className="selection-progress"
        max={electionStages.length}
        value={electionStages.length}
        aria-label="Revisão das escolhas"
      />
      <p className="review-instruction">
        Confira sua cola. Você ainda pode alterar qualquer escolha.
      </p>

      <div className="review-groups">
        {reviewGroups.map((group) => (
          <section className="review-group" key={group.office}>
            <h2>{group.label}</h2>
            {group.stages.map((stage) => {
              const candidate = selections[stage.id]
              if (!candidate) return null

              return (
                <article className="review-choice" key={stage.id}>
                  <img
                    className="review-photo"
                    src={candidate.photoUrl ?? undefined}
                    alt=""
                  />
                  <CandidateInformation
                    candidate={candidate}
                    roleLabel={stage.label}
                  />
                  <button
                    className="edit-choice"
                    type="button"
                    aria-label={`Alterar ${stage.label}`}
                    onClick={() => onEdit(stage.id)}
                  >
                    Alterar
                  </button>
                </article>
              )
            })}
          </section>
        ))}
      </div>

      <div className="flow-actions">
        <button className="secondary-action" type="button" onClick={onBack}>
          Voltar
        </button>
        <button className="primary-action" type="button" onClick={onComplete}>
          Concluir cola
        </button>
      </div>
      <ClearChoicesButton onClear={onClear} />
      <button className="change-uf" type="button" onClick={onChangeUf}>
        Trocar estado
      </button>
    </section>
  )
}

type CompletedBallotProps = {
  selections: Record<string, Candidate>
  electionYear: number
  uf: string
  reviewGroups: ChoiceGroup[]
  onReview: () => void
  onClear: () => void
  onChangeUf: () => void
}

function BallotDigits({ number }: { number: string }) {
  return (
    <div className="digital-ballot-digits" aria-label={`Número ${number}`}>
      {number.split('').map((digit, index) => (
        <span className="digital-ballot-digit" key={`${digit}-${index}`}>
          {digit}
        </span>
      ))}
    </div>
  )
}

function CompletedBallot({
  selections,
  electionYear,
  uf,
  reviewGroups,
  onReview,
  onClear,
  onChangeUf,
}: CompletedBallotProps) {
  return (
    <section className="completed-v2" aria-labelledby="completed-title">
      <div className="completed-heading">
        <span className="completed-badge">Cola concluída ✓</span>

        <h1 id="completed-title">Seu Santinho</h1>

        <p>
          Eleições {electionYear} • {uf}
        </p>
      </div>

      <article className="digital-ballot">
        <header className="digital-ballot-header">
          <div className="digital-ballot-brand">
            <img
              className="digital-ballot-logo-image"
              src="/brand/logo-meu-santinho.png"
              alt="Meu Santinho"
            />
          </div>

          <span className="digital-ballot-uf">{uf}</span>
        </header>

        <div className="digital-ballot-divider" />

        <div className="digital-ballot-choices">
          {reviewGroups.flatMap((group) =>
            group.stages.map((stage) => {
              const candidate = selections[stage.id]
              if (!candidate) return null

              const displayLabel =
                group.office === 'SENATOR'
                  ? stage.label
                  : group.label

              return (
                <section className="digital-ballot-choice" key={stage.id}>
                  <span className="digital-ballot-office">
                    {displayLabel}
                  </span>

                  <BallotDigits number={candidate.number} />

                  <strong className="digital-ballot-name">
                    {candidate.ballotName}
                  </strong>

                  <span className="digital-ballot-party">
                    {candidate.partyAbbreviation}
                  </span>
                </section>
              )
            }),
          )}
        </div>

        <div className="digital-ballot-message">
          <strong>SEU VOTO É IMPORTANTE.</strong>

          <p>
            <b>VOCÊ</b> faz parte das escolhas que definem o futuro da nossa{' '}
            <b>NAÇÃO</b>.
          </p>
        </div>

        <footer className="digital-ballot-footer">
          <span>Eleições {electionYear}</span>
          <span>•</span>
          <span>{uf}</span>
        </footer>
      </article>

      <p className="completed-saved">
        ✓ Sua cola está salva neste dispositivo.
      </p>

      <div className="completed-actions">
        <button
          className="primary-action completed-edit"
          type="button"
          onClick={onReview}
        >
          Editar minhas escolhas
        </button>

        <button
          className="secondary-action completed-state"
          type="button"
          onClick={onChangeUf}
        >
          Trocar estado
        </button>
      </div>

      <ClearChoicesButton onClear={onClear} />
    </section>
  )
}

export default App
