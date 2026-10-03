# Dados de candidaturas TSE 2026

## Fonte inspecionada

Portal de Dados Abertos do TSE, conjunto [Candidatos - 2026](https://dadosabertos.tse.jus.br/dataset/candidatos-2026), licença Creative Commons Atribuição. O resource principal chama-se **Candidatos** e aponta para [`consulta_cand_2026.zip`](https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip); o ZIP contém CSVs por UF, `consulta_cand_2026_BR.csv`, `consulta_cand_2026_BRASIL.csv` e `leiame.pdf`. Os CSVs inspecionados têm 50 colunas e são separados por ponto e vírgula.

A descrição do conjunto informa atualização quatro vezes ao dia. O navegador não baixa nem processa CSVs em runtime. A prova atual prepara assets offline usando os arquivos oficiais fornecidos localmente ao importador.

## Mapeamento para Candidate

| Candidate | Coluna real do CSV `Candidatos` | Normalização |
| --- | --- | --- |
| `id` | `SQ_CANDIDATO` | Manter como string; identifica a candidatura e também participa da relação com foto. |
| `electionYear` | `ANO_ELEICAO` | Converter para inteiro. |
| `uf` | `SG_UF` | Manter em maiúsculas; o arquivo BR usa o valor `BR`. |
| `office` | `CD_CARGO` junto de `DS_CARGO` | Mapear somente pares código/descrição suportados e consistentes. |
| `number` | `NR_CANDIDATO` | Manter como string para não perder zeros à esquerda. |
| `ballotName` | `NM_URNA_CANDIDATO` | Texto de urna, sem substituir pelo nome civil `NM_CANDIDATO`. |
| `partyNumber` | `NR_PARTIDO` | Manter como string. |
| `partyAbbreviation` | `SG_PARTIDO` | Preservar sigla textual do arquivo. |
| `photoUrl` | Não há URL de foto no CSV principal | O normalizador deixa `null`. A relação produz o basename, não uma URL individual. |

O normalizador implementado está em `src/features/candidates/normalizeTseCandidate.ts`. Ele rejeita campos obrigatórios vazios/sentinela e cargos ausentes, não suportados ou com código e descrição inconsistentes. Campos não presentes em `Candidate`, inclusive situação, não são acrescentados nem encaminhados à UI.

## Cargos observados

Os códigos abaixo foram lidos nos CSVs oficiais de SP, DF e BR:

| Código `CD_CARGO` | `DS_CARGO` | Tipo interno |
| --- | --- | --- |
| `1` | `PRESIDENTE` | `PRESIDENT` |
| `3` | `GOVERNADOR` | `GOVERNOR` |
| `5` | `SENADOR` | `SENATOR` |
| `6` | `DEPUTADO FEDERAL` | `FEDERAL_DEPUTY` |
| `7` | `DEPUTADO ESTADUAL` | `STATE_DEPUTY` |
| `8` | `DEPUTADO DISTRITAL` | `DISTRICT_DEPUTY` |

No arquivo de SP, Estadual é código 7; no arquivo do DF, Distrital é código 8. O arquivo `BR` contém `PRESIDENTE` (código 1) e `VICE-PRESIDENTE` (código 2). O código 2, vice-cargos, suplentes e demais cargos são rejeitados por esta normalização focada no fluxo do produto.

O recurso BR registra as candidaturas presidenciais com `SG_UF=BR`. Por isso, consultas presidenciais feitas no contexto de uma UF devem aceitar registros nacionais BR; o `Candidate.uf` normalizado permanece fiel ao escopo da fonte.

## Fotos oficiais

O conjunto publica recursos ZIP separados por UF, além de [**BR - Fotos de candidatos**](https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_BR_div.zip), cuja descrição é Presidente; o resource paulista está em [`foto_cand2026_SP_div.zip`](https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_SP_div.zip). Os nomes observados seguem:

```text
F{SG_UF}{SQ_CANDIDATO}_div.jpg
```

O padrão foi cruzado contra os arquivos: os 2.630 identificadores distintos de SP do CSV aparecem no ZIP de fotos SP; os 14 registros `PRESIDENTE` do CSV BR aparecem no ZIP BR. `getTseCandidatePhotoFilename` deriva somente esse nome. Como os JPEGs são distribuídos dentro de ZIPs, o conjunto não fornece uma URL pública individual. Nesta prova, o importador extrai arquivos correspondentes para `public/candidates/2026/{RN,BR}` e define `Candidate.photoUrl` para o asset local; registros sem JPEG mantêm `null`. Não há scraping nem acesso remoto às fotografias pelo app.

## Situação da candidatura: campos encontrados

O CSV principal inclui `CD_SITUACAO_CANDIDATURA` e `DS_SITUACAO_CANDIDATURA`; também inclui `CD_SIT_TOT_TURNO` e `DS_SIT_TOT_TURNO`. O resource complementar [Candidatos - Informações complementares](https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand_complementar/consulta_cand_complementar_2026.zip), ligado pelo campo `SQ_CANDIDATO`, contém, entre outros:

- `CD_SITUACAO_CANDIDATO_PLEITO` / `DS_SITUACAO_CANDIDATO_PLEITO`;
- `CD_SITUACAO_CANDIDATO_URNA` / `DS_SITUACAO_CANDIDATO_URNA`;
- `CD_SITUACAO_CANDIDATO_TOT` / `DS_SITUACAO_CANDIDATO_TOT`;
- `CD_SITUACAO_JULGAMENTO`, `CD_SITUACAO_JULGAMENTO_PLEITO` e `CD_SITUACAO_JULGAMENTO_URNA`, cada um com seu campo `DS_...`;
- `CD_SITUACAO_CASSACAO` / `DS_SITUACAO_CASSACAO` e `CD_SITUACAO_CASSACAO_MIDIA` / `DS_SITUACAO_CASSACAO_MIDIA`;
- `CD_SITUACAO_DIPLOMA` / `DS_SITUACAO_DIPLOMA`;
- `ST_CANDIDATO_INSERIDO_URNA`, `ST_SUBSTITUIDO` e `SQ_SUBSTITUIDO`.

Foram observados valores `#NE`, `#NULO`, `DEFERIDO`, `Válido` e `SIM` nos diferentes campos. Eles pertencem a dimensões distintas; nenhum é interpretado aqui como critério de exibição. Antes de usar situação ou validade para filtrar, será necessário escolher com o responsável pelo produto qual dimensão e qual semântica oficial atendem ao objetivo, documentar o critério e validá-lo com as instruções do TSE. Até lá, não filtrar candidaturas por esses campos.

No snapshot importado de RN + Presidente BR, todos os 303 registros apresentam `CD_SITUACAO_CANDIDATURA` / `DS_SITUACAO_CANDIDATURA` como `-3` / `#NE` e `CD_SIT_TOT_TURNO` / `DS_SIT_TOT_TURNO` como `-1` / `#NULO`. Esses estados foram apenas contabilizados no provenance, sem interpretação ou filtro.

## Prova RN + BR gerada

O asset `src/data/candidates/2026-rn-br.json` inclui 303 candidaturas: 111 Deputados Federais, 154 Deputados Estaduais, 14 Senadores, 10 Governadores e 14 Presidentes. Foram extraídas 303 fotografias (289 RN + 14 BR); não houve registro sem foto neste snapshot. O JSON ocupa 86.528 bytes e os JPEGs totalizam 1.689.422 bytes.

O provenance em `src/data/candidates/2026-rn-br.provenance.json` registra URLs oficiais, SHA-256 dos três ZIPs, contagens e valores brutos de situação. Para repetir a importação, coloque os ZIPs oficiais em `data/tse/2026/` com os nomes `consulta_cand_2026.zip`, `foto_cand2026_RN_div.zip` e `foto_cand2026_BR_div.zip`, e execute `npm run prepare:tse:2026`. Esses ZIPs de entrada locais são ignorados pelo Git; os assets derivados são os consumidos pela aplicação.

## Pipeline

O pipeline implementado para a prova é `arquivos oficiais TSE → parser/importador → normalização para Candidate → assets RN+BR → candidateData → getCandidates → UI`. O script gera JSON normalizado, provenance com URLs/SHA-256 e fotografias locais. Os mocks não foram removidos e são usados exclusivamente fora do contexto oficial importado. Nenhum componente React conhece colunas CSV ou estrutura de arquivos TSE.