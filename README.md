# AlugaSR

Plataforma web hiperlocal para busca e divulgação de imóveis para aluguel em **São Roque/SP**, desenvolvida como projeto de extensão acadêmica.

> **Status (26/11/2026):** MVP acadêmico **implementado em branch de revisão** com dados **sintéticos**: API Express + PostgreSQL/Prisma, busca pública conectada, login de parceiro, painel com rascunhos/fotos/envio para análise e moderação. Nada foi mesclado na `main` sem autorização, e o uso com dados reais (Gate C1) continua **bloqueado** por aprovações externas. Veja a [matriz de status](docs/development/STATUS_IMPLEMENTACAO.md).

## Escopo do MVP acadêmico
1. Home e pesquisa responsivas por valor de aluguel, cômodos e localização.
2. Modelo relacional com usuários, imóveis, imobiliárias e tabelas necessárias ao MVP.
3. Painel restrito do parceiro para criar descrição, inserir fotos e submeter anúncios à publicação autorizada.

Chat, favoritos, reputação, selos de verificação e mapa avançado não integram o MVP acadêmico atual. Não processamos pagamentos nem contratos locatícios.

## Stack prevista
HTML, CSS e JavaScript no frontend; Node.js + Express na API; PostgreSQL + Prisma para persistência. As versões exatas e os scripts de instalação serão definidos e testados em MVP-001/MVP-002.

## Documentação e contribuição
- [Documentação Mestre do AlugaSR (Google Docs)](https://docs.google.com/document/d/1VmYP60hxvBttjdqYjix0kIa2ybdb3GPq3oywSATzlPg/edit) — consultar principalmente as seções 33 e 37.
- [Guia de contribuição](CONTRIBUTING.md).
- [Política de segurança](SECURITY.md).
- [Plano de desenvolvimento do repositório](docs/development/README.md).
- [Issues e backlog](https://github.com/arturbsilva6/alugaSR/issues).

## Segurança e dados
Somente dados sintéticos nos protótipos e testes. Nunca fazer commit de credenciais, arquivos `.env` reais, documentos pessoais ou fotos privadas. A ativação com dados reais requer segurança, LGPD, backups/restauração e validações externas descritas na documentação mestre.

## Executar localmente

Guia completo (Windows/PowerShell e Linux): [docs/development/setup-local.md](docs/development/setup-local.md). Resumo:

```bash
npm ci
npm run db:migrate
npm run db:seed
npm start
```

Acesse <http://127.0.0.1:3000/>. Contas e senha **fictícias** de demonstração estão no guia; elas só existem no banco local criado pelo seed.

## Documentação técnica

- [Matriz de status da implementação](docs/development/STATUS_IMPLEMENTACAO.md)
- [Contrato da API /api/v1](docs/api/README.md)
- [Banco de dados, migrations e backup/restore](docs/database/README.md)
- [Segurança, privacidade e riscos](docs/development/seguranca-e-riscos.md)
- [ADR-010 — decisões de implementação (PROPOSTA)](docs/adr/ADR-010-decisoes-de-implementacao-mvp.md)
- [Roteiro de apresentação](docs/development/roteiro-apresentacao.md)

## Estado dos testes
CI (`node-foundation`): sintaxe, varredura de segredos, `npm audit` (produção), Prisma validate, `migrate deploy` em PostgreSQL 17 isolado, verificação de drift, seed sintético 2× e testes unitários/integração/contrato/autorização. Job adicional `e2e-browser`: Playwright/Chromium. **Aprovação do CI não equivale a testes de usabilidade, segurança de produção ou homologação acadêmica.**

## Referência visual em implementação (FE-002)

A branch de Design System propõe tokens CSS, estilos-base e uma [vitrine de componentes](frontend/design-system.html), com [decisões e pendências registradas](docs/development/design-system.md). Essa página é demonstrativa e não oferece busca de imóveis, autenticação ou anúncios reais. A identidade visual final depende da aprovação da paleta e da incorporação do logotipo original.

## Componentes de interface (FE-003)

A vitrine [componentes.html](frontend/componentes.html) demonstra cabeçalho, navegação, rodapé, campos e estados da interface. É **estática e sem dados reais**, não uma Home de anúncios. Veja os [critérios de implementação](docs/development/ui-components.md).

## Prévia integrada do MVP com dados fictícios

Sem a API (`npm run preview` ou arquivo aberto direto), as páginas públicas usam as fixtures sintéticas do PR #12 e exibem "MODO OFFLINE". Com `npm start`, as mesmas páginas consomem a API. `painel.html` permanece como **simulação** sem login; o painel real é `parceiro.html`. Não há pagamento, contrato ou análise de crédito. Leia [instruções e limites da demonstração](docs/development/integrated-demo.md).

### Abrir o protótipo no navegador

```bash
npm ci
npm run preview
```

Acesse **http://127.0.0.1:4173/**. O servidor serve apenas `frontend/` em localhost, sem iniciar a API ou acessar imóveis reais. Para encerrar, pressione Ctrl+C.
