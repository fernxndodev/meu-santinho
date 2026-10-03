# Instruções para agentes

## Antes de implementar

- Leia `AGENTS.md`, `CONTEXT.md` e `docs/architecture.md` antes de qualquer implementação.
- Confirme o escopo pedido e inspecione o código existente antes de propor mudanças.
- Preserve a estrutura simples do projeto; prefira soluções explícitas e locais.
- Não implemente funcionalidades futuras nem adicione dependências sem necessidade demonstrável.

## Produto e neutralidade

- O Meu Santinho é uma ferramenta pessoal de organização e consulta de escolhas eleitorais.
- Não recomende candidatos, crie rankings, sinalize preferências políticas nem favoreça partidos.
- Apresente candidatos do mesmo cargo com tratamento visual equivalente.
- Use uma ordenação neutra, determinística e documentada. Não use popularidade ou dados de engajamento.
- Use dados eleitorais reais somente de fontes oficiais da Justiça Eleitoral/TSE quando a integração for autorizada.
- Não invente candidatos nem use dados fictícios como se fossem reais.

## Implementação e contribuição

- Stack do projeto: React, TypeScript, Vite, React Router, Tailwind CSS e `vite-plugin-pwa`.
- Mantenha a experiência mobile-first, acessível e compreensível para pessoas com pouca familiaridade tecnológica.
- Não crie backend, autenticação ou banco de dados para este MVP.
- A persistência no dispositivo, o suporte offline e a exportação de imagem estão fora da implementação atual até serem solicitados.
- Escreva mensagens e documentação do produto em português. Use Conventional Commits em inglês quando commits forem autorizados.
- Nunca faça commit, push ou abra PR sem solicitação explícita do usuário.
- Execute uma verificação adequada ao escopo depois de alterar código ou configuração e relate limitações de validação.