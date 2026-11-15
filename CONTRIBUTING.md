# Contribuindo para o AlugaSR

Este projeto está em preparação. Não use dados pessoais reais em testes, issues, PRs ou commits.

## Referência e fluxo
A [Documentação Mestre](https://docs.google.com/document/d/1VmYP60hxvBttjdqYjix0kIa2ybdb3GPq3oywSATzlPg/edit) (seção 37) é a referência de escopo, segurança, arquitetura e aceite. Antes de codificar, abra ou selecione uma issue. Registre requisitos, dependências, decisões, critérios de aceite e testes.

1. Crie branch curta a partir de `main`: `feat/MVP-004-home`, `fix/MVP-005-filtros`, `chore/GIT-06-ci` ou `docs/ENG-06-adr`.
2. Use Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`, `test(scope): ...`, `chore(scope): ...`, `ci(scope): ...`.
3. Abra Pull Request vinculado à issue, detalhe riscos e testes e solicite revisão.
4. Mantenha a branch `main` estável; não faça push direto ou merge sem os checks exigidos.
5. Migrations e alterações de segurança exigem revisão explícita; não use `prisma db push` em produção.

## Checklist de conclusão
Critérios de aceite atendidos; testes positivos/negativos e de autorização quando aplicáveis; lint/build/checks verdes; documentação atualizada; nenhuma credencial ou dado pessoal exposto; revisão registrada. Não marque teste ou aprovação como concluído antes da execução.

## Ambiente
Versões de Node.js/PostgreSQL/Prisma, scripts de instalação e CI de aplicação serão definidas na issue MVP-001. Atualmente o repositório não contém código de aplicação nem teste de aplicação.
