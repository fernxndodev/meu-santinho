# Contexto do projeto

## Produto

Meu Santinho é um PWA mobile-first para a pessoa montar no próprio dispositivo uma lista pessoal de candidatos e consultá-la depois. É uma ferramenta de organização, não um serviço de recomendação eleitoral.

## Fluxo previsto para o MVP

1. Tela inicial.
2. Seleção da UF.
3. Escolha de uma candidatura a Deputado Federal.
4. Escolha de uma candidatura a Deputado Estadual ou Distrital, conforme a UF.
5. Escolha para a primeira vaga do Senado.
6. Escolha para a segunda vaga do Senado.
7. Escolha de uma candidatura a Governador.
8. Escolha de uma candidatura a Presidente.
9. Revisão das escolhas e conclusão da cola eleitoral.
10. Consulta posterior do "Meu Santinho".

Para as Eleições 2026, a configuração do fluxo define duas escolhas para Senador por UF/DF. As escolhas devem ser candidaturas diferentes; selecionar a mesma candidatura nas duas posições torna nulo o segundo voto, conforme Resolução TSE nº 23.751/2026, art. 142, § 1º, e art. 206, § 2º. Esta quantidade pertence à configuração do pleito de 2026, não ao cargo `SENATOR` como regra universal. Outros pleitos exigem configuração própria validada.

## Dados e neutralidade

O modelo previsto para candidato inclui: identificador, nome, nome de urna, número, cargo, nome e sigla do partido, UF, URL ou caminho da foto e situação da candidatura quando aplicável. Campos condicionais devem poder estar ausentes; os significados e identificadores oficiais ainda precisam ser definidos junto à fonte de dados.

Os dados eleitorais reais deverão vir da Justiça Eleitoral/TSE. A integração e a escolha do conjunto de dados oficial não fazem parte desta etapa.

Todos os candidatos do mesmo cargo devem receber apresentação equivalente. Uma ordenação inicial simples e verificável é por número de urna em ordem crescente; em caso de empate ou número ausente, usar nome de urna em ordem alfabética pt-BR, sem diferenciar acentos, e identificador como desempate. Não ordenar por partido, popularidade ou preferências inferidas.

## Escopo atual e limites

O scaffold existente é React + TypeScript + Vite. `package.json` já declara React Router, Tailwind CSS, `@tailwindcss/vite` e `vite-plugin-pwa`; isso não significa que roteamento, estilos Tailwind ou comportamento PWA já estejam configurados ou implementados.

O fluxo em implementação está configurado para 2026 e RN. `getCandidates` usa candidaturas oficiais importadas para RN e candidaturas presidenciais do escopo BR; os mocks permanecem para outros contextos ainda não importados. As escolhas são salvas localmente no dispositivo para restauração. A aplicação é instalável e o shell, dados normalizados e fotos importadas ficam disponíveis offline após a primeira visita online.

Não há conta, sincronização entre dispositivos, envio das escolhas para servidor, consulta TSE em runtime, backend ou banco de dados. A persistência continua na camada `localStorage`; o service worker não acessa as escolhas. Exportação e compartilhamento não estão implementados.

## Regras de trabalho

- Leia `AGENTS.md`, `CONTEXT.md` e `docs/architecture.md` antes de futuras implementações.
- Preserve arquitetura simples e dependências existentes; adicione bibliotecas somente quando houver necessidade concreta.
- Use Conventional Commits em inglês, mas não faça commit, push ou PR sem autorização explícita.