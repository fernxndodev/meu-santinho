# Arquitetura inicial

## Estado do scaffold

O projeto parte do template React + TypeScript + Vite. A entrada atual é `src/main.tsx`, que monta `src/App.tsx`; este último ainda contém a tela demonstrativa do Vite. CSS inicial está em `src/index.css` e `src/App.css`.

As dependências de React Router, Tailwind CSS e `vite-plugin-pwa` estão declaradas. `vite.config.ts` registra React e configura o plugin PWA; `src/main.tsx` não configura um roteador; e os estilos usam CSS, sem diretivas Tailwind. Router e Tailwind permanecem disponíveis, mas não configurados.

## Direção arquitetural

- Aplicação cliente, sem servidor próprio, autenticação ou banco de dados.
- Componentes React e tipos de domínio em TypeScript; manter regras eleitorais explícitas e separadas da apresentação quando forem implementadas.
- Usar React Router para os destinos efetivamente necessários ao fluxo, sem criar uma camada de navegação adicional.
- Manter a origem oficial dos dados eleitorais identificável. A integração futura deverá documentar fonte, data/pleito, campos e tratamento de dados indisponíveis; não incluir dados de demonstração que possam ser confundidos com dados reais.
- `Candidate` é o modelo interno da aplicação. Formatos externos devem ser normalizados antes de chegar à interface; componentes de UI não devem depender do esquema do TSE.
- O adaptador `src/features/candidates/normalizeTseCandidate.ts` normaliza as colunas confirmadas do resource TSE 2026 para `Candidate`; `candidateData/getCandidates` continua sendo o contrato da UI.
- Tratar UF e pleito como contexto das escolhas. Regras variáveis, como quantidade de vagas ao Senado e cargo estadual/distrital, devem ser determinadas por configuração oficial do pleito, não por suposições espalhadas pela interface.
- Não introduzir gerenciamento global de estado ou abstrações de repositório enquanto estado local de tela e módulos simples forem suficientes.
- Acessibilidade, legibilidade em telas pequenas e equivalência visual entre candidaturas do mesmo cargo são requisitos da interface, não refinamentos opcionais.

## Estrutura mínima recomendada

Introduzir apenas os módulos necessários conforme as telas forem implementadas. Uma organização inicial suficiente:

```text
src/
  app/
    router.tsx
  pages/
    StartPage.tsx
    SelectionPage.tsx
    BallotPage.tsx
  components/
    CandidateOption.tsx
    StepIndicator.tsx
  features/
    ballot/
      types.ts
      rules.ts
      ordering.ts
  main.tsx
```

Os nomes são uma sugestão, não uma exigência para criar todos os arquivos de uma vez. `rules.ts` e `ordering.ts` só devem existir quando houver regras implementadas para manter ali. Não criar camadas `services`, `repositories`, `hooks` ou pastas por tela sem uma necessidade concreta.

## Modelo de domínio previsto

Um candidato deverá representar, no mínimo, identificador, nome, nome de urna, número, cargo, partido, sigla do partido, UF, referência de foto e situação da candidatura quando aplicável. Antes de integrar, confirmar o esquema e os identificadores publicados pela fonte oficial. Preservar valores originais relevantes e evitar converter ausência de informação em uma situação presumida.

As escolhas do santinho precisam estar associadas ao contexto eleitoral pertinente, incluindo UF e pleito. A regra de quantidade de escolhas para cada cargo deve vir desse contexto. A modelagem final pode ser definida junto com a fonte oficial; não duplicar informação de candidato sem necessidade.

## Dados TSE 2026: prova RN + BR

 O mapeamento e os campos oficiais inspecionados estão em `docs/tse-candidates-2026.md`. O importador local `scripts/prepare-tse-2026.mjs` lê ZIPs oficiais fornecidos em `data/tse/2026/`, normaliza e gera `src/data/candidates/2026-rn-br.json`, provenance com URLs/SHA-256 e fotografias extraídas em `public/candidates/2026/{RN,BR}`. Pipeline implementado: `arquivos oficiais TSE → parser/importador → normalizeTseCandidate → dados normalizados → candidateData → getCandidates → UI`. O navegador não baixa nem processa CSV do TSE; os ZIPs-fonte ficam fora do controle de versão.

Para ano 2026 e UF RN, os cargos do fluxo consultam exclusivamente o asset oficial RN; Presidente recebe candidaturas do resource nacional BR. `candidateSourceForQuery` seleciona uma só fonte por consulta; mocks permanecem para contextos ainda não importados e nunca são combinados com os registros reais. O contrato `getCandidates` não mudou. O contexto 2026 está centralizado como RN em `electionConfig.ts`; `senatorSelections: 2` permanece inalterado.

O importador não filtra situação. O snapshot desta prova inclui os registros técnicos do escopo, com os valores encontrados documentados em `docs/tse-candidates-2026.md`. A restauração local continua resolvendo IDs salvos por `getCandidates`; IDs antigos ou ausentes na fonte atual são ignorados pelo fluxo de restauração existente.

Os JPEGs correspondentes foram extraídos para assets locais, e `Candidate.photoUrl` aponta para eles; se uma foto não estiver no ZIP, permanece `null` e a UI usa seu fallback. Não há scraping nem acesso remoto a fotos no app.

## Navegação e fluxo

O fluxo deve permitir iniciar, escolher UF, percorrer as etapas de cargo na ordem prevista, revisar e consultar o santinho. O número de opções ao Senado e a diferença entre Deputado Estadual e Distrital variam conforme o pleito e a UF. Definir destinos e comportamento de voltar/continuar ao implementar as telas, mantendo rotas diretas simples e navegáveis.

## Configuração do fluxo eleitoral

O fluxo configurado para 2026 segue: Deputado Federal, Deputado Estadual/Distrital conforme a UF, Senador na primeira vaga, Senador na segunda vaga, Governador e Presidente. A configuração do pleito contém `senatorSelections: 2` e expande Senador em duas etapas identificadas separadamente. As escolhas para essas posições devem ser candidaturas distintas; a mesma candidatura nas duas vagas torna nulo o segundo voto conforme a Resolução TSE nº 23.751/2026, art. 142, § 1º, e art. 206, § 2º.

Essa quantidade é específica da configuração de 2026 e não deve ser generalizada para o cargo `SENATOR`. A quantidade e a sequência de outros pleitos devem ser definidas em suas próprias configurações validadas. As escolhas ficam em memória associadas às etapas do fluxo, permitindo duas posições do mesmo cargo sem impor uma relação universal de uma escolha por cargo.

## Persistência local

As escolhas são persistidas em `localStorage` por meio de `src/features/ballot/ballotStorage.ts`. A UI usa somente essa camada; não acessa `localStorage` diretamente.

Cada registro é escopado por ano da eleição e UF, com uma chave como `meu-santinho:ballot:2026:SP`. O conteúdo guarda o ano, a UF e um mapa de identificador de etapa para ID de candidatura; os objetos completos de candidato não são duplicados.

Na abertura, IDs de etapa desconhecidos e payloads inválidos são ignorados. IDs de candidatura são resolvidos novamente por `getCandidates` no contexto atual e verificados contra etapa, ano e UF. Candidaturas inexistentes ou repetidas entre as duas vagas do Senado são descartadas; a pessoa retoma na primeira etapa sem escolha válida. A limpeza remove somente a chave do contexto eleitoral atual.

Os dados permanecem no armazenamento local deste navegador/dispositivo. Nesta etapa não há conta, envio a servidor nem sincronização entre dispositivos.

## PWA e disponibilidade offline

`vite-plugin-pwa` usa a estratégia `generateSW` para gerar o service worker e o Web App Manifest na build. A aplicação declara nome, atalho, escopo, cores neutras e ícones rasterizados em 192×192 e 512×512, incluindo propósito maskable. O registro automático usa `autoUpdate`; caches antigos são limpos ao atualizar.

O service worker faz precache dos recursos estáticos da build, incluindo JPEGs (`jpg`/`jpeg`), e usa `index.html` como fallback de navegação offline. Não há cache runtime de APIs ou lógica eleitoral no worker. Depois de uma primeira visita online e do precache, o shell, o asset normalizado e as fotos importadas abrem offline; as escolhas continuam sob responsabilidade exclusiva de `ballotStorage.ts` em `localStorage`, e não são lidas ou alteradas pelo service worker.

Não há integração runtime com TSE nem sincronização remota. Exportação e compartilhamento também permanecem fora do escopo atual.

## Neutralidade e ordenação

Aplicar o mesmo layout, destaque, informação e interação a candidatos do mesmo cargo. Não usar cor, tamanho, posição privilegiada, recomendação, ranking ou ordenação personalizada para influenciar escolhas. A ordenação deve ser estável e documentada: número de urna crescente; depois nome de urna em pt-BR, sem diferenciar acentos; por fim identificador para desempate. A implementação deverá tratar número ou nome ausente sem erro e sem dar vantagem arbitrária.