# Matriz de status da implementação — AlugaSR

**Atualizado em:** 26/11/2026 · **Branch:** `claude/alugasr-implementation-u13lbc` (baseada no PR #12, sem merge na `main`)

Legenda de estado (sem inflar maturidade):

- **documentado** — existe apenas na Documentação Mestre.
- **protótipo** — demonstração com dados sintéticos, sem backend real.
- **implementado** — código real na branch, integrado à API/banco.
- **testado** — implementado **e** coberto por teste automatizado executado com sucesso (evidência abaixo).
- **bloqueado** — depende de decisão/aprovação externa; o código, se existe, está desligado.

`testado` refere-se a testes automatizados com dados sintéticos em ambiente local/CI. **Não** significa homologação acadêmica (C2), aprovação para dados reais (C1) nem lançamento (C3).

## Estado antes deste ciclo (diagnóstico)

| Item | Estado em 26/11/2026, antes das alterações |
|---|---|
| `main` | PRs #5, #6 e #8 integrados: governança, Express 5.3.0 + `/health` `/ready`, Prisma sem models, design system CSS. 20 testes. |
| PR #12 (aberto, sem merge) | Home, resultados, detalhe e painel **100% sintéticos** (fixtures em JS), prévia estática. 39 testes passando localmente. |
| Banco | Nenhuma tabela/migration de domínio. |
| API de domínio, login, upload, moderação | Inexistentes. |

## Matriz REQUISITO × ESTADO REAL

| Requisito | Estado real | Arquivos principais | Testes | Pendência | Fase |
|---|---|---|---|---|---|
| MVP-001 Fundação Node/Express/Prisma | testado | `backend/src/app.js`, `server.js`, `config/env.js` | `tests/backend.test.mjs`, `foundation.test.mjs` | — | A |
| MVP-002 CI: sintaxe, testes, Prisma, migrations, drift, seed, audit, secrets | implementado (local verificado; CI depende da execução no PR) | `.github/workflows/foundation.yml`, `scripts/scan-secrets.mjs` | execução local de cada passo | Formatter/ESLint não adotado (evita dependência); CodeQL/Dependabot a decidir | B |
| MVP-003 Design system | testado (herdado do PR #8) | `frontend/styles/*.css` | `design-system.test.js` | UI-01 logo original, UI-02 paleta final | F |
| MVP-004 Home pública conectada | testado | `frontend/index.html`, `scripts/portal-live.js` | E2E `e2e/portal.e2e.test.mjs` | Fotos reais licenciadas (UI-03) | F |
| MVP-005 Resultados e filtros (bairro, tipo, preço, quartos, banheiros, características, ordenação, cursor) | testado | `services/publicPropertyService.js`, `frontend/imoveis.html` | `api-public.test.mjs`, `frontend-live.test.mjs`, E2E | Lista oficial de bairros (EXT-01) | D/F |
| MVP-006 Detalhe + galeria autorizada, 410/404 | testado | `presenters.js`, `portal-live.js` | `api-public.test.mjs`, E2E | Regra de periodicidade dos encargos (UI-05) | D/F |
| MVP-007 Modelo relacional mínimo (15 tabelas), CHECK, índices parciais, auditoria append-only | testado | `prisma/schema.prisma`, `prisma/migrations/…/migration.sql` | `db-integrity.test.mjs` | Contas de banco separadas (runtime/migração/backup) em ambiente real | C |
| Seed sintético idempotente | testado | `prisma/seed.mjs` | executado 2× local; passo de CI | — | C |
| MVP-008 API pública `/api/v1` (envelope, 422, paginação, sem campo privado) | testado | `routes/publicRoutes.js`, `repositories/publicPropertyRepository.js` | `api-public.test.mjs` | OpenAPI formal (MD-16) | D |
| MVP-009 Sessão (Argon2id, cookie HttpOnly/SameSite/Secure, CSRF, revogação, limites) | testado | `services/authService.js`, `middlewares/auth.js`, `lib/password.js` | `api-auth.test.mjs` | MFA (RN-A04), limites compartilhados multi-instância, verificação de senhas vazadas (EXT-08) | E |
| Cadastro público | bloqueado (rota responde 404) | `routes/authRoutes.js`, `config/features.js` | `api-auth.test.mjs` | Gate C1 / EXT-04 / EXT-08 | E |
| MVP-010 Painel restrito (titular individual ou imobiliária, papel e vínculo ativos) | testado | `services/authorization.js`, `frontend/parceiro.html`, `scripts/partner-live.js` | `api-partner.test.mjs`, E2E | Gestão de membros/convites (pós-MVP) | E/F |
| MVP-011 Rascunho, edição com revisão otimista, envio à análise, pausar/retomar/alugado/arquivar | testado | `services/partnerPropertyService.js` | `api-partner.test.mjs`, `unit-domain.test.mjs`, E2E | Política fina de reanálise (RN-I06) — adotada a conservadora | E |
| MVP-012 Upload seguro de fotos (assinatura real, sem SVG, limite de pixels, WebP sem EXIF/GPS, quarentena, originais privados) | testado (adaptador **local de desenvolvimento**) | `media/imageProcessor.js`, `storage/localStorage.js` | `api-photos-moderation.test.mjs`, `unit-domain.test.mjs` | Storage de produção, antivírus, retenção (DEC-011, EXT-05, DEC-016) | E |
| MVP-013 Moderação (papel, sem conflito de interesse, justificativa, auditoria) | testado | `services/moderationService.js`, `frontend/moderacao.html` | `api-photos-moderation.test.mjs`, E2E | MFA obrigatório: moderação **bloqueada em produção** até implementação | E/F |
| MVP-014 Segurança/privacidade/logs/backup | implementado parcialmente | `docs/development/seguranca-e-riscos.md`, `docs/database/README.md` | testes negativos acima; restore **local** executado 1× | Backup real, RPO/RTO, incidentes, LGPD (EXT-04/05/06) | G |
| MVP-015 E2E, acessibilidade, responsividade | testado (automático, parcial) | `e2e/portal.e2e.test.mjs` | 4 cenários E2E | Testes com leitor de tela, zoom 200% e usuários reais (UI-07) — **não executados** | G |
| Favoritos, chat, avaliações, denúncias, mapa, "mais vistos", CSV, múltiplos membros | documentado; flags existem e estão **desligadas** | `config/features.js` | `unit-domain.test.mjs` (flags) | Fora do MVP (37.1); EXT-07/EXT-09; ADR-007 | H |
| Pagamentos, contratos, crédito, documentação locatícia | **fora do produto** — não implementado | — | `frontend-live.test.mjs` verifica ausência de textos | — | — |

## Evidências locais desta execução (26/11/2026)

- `npm ci` (Node 26.13.1, npm 11.20.0): OK; `postinstall` gera o Prisma Client 7.10.1.
- `npm run lint`: 75 arquivos com sintaxe válida.
- `npm run security:secrets`: nenhum achado; detecção validada com segredo plantado (removido).
- `npm run security:audit`: 0 vulnerabilidades em dependências de produção.
- `npm run db:validate` / `db:migrate` / `db:drift`: válido, aplicado, sem diferença.
- `npm run db:seed` executado 2×: mesmas contagens (idempotente).
- `npm test` com PostgreSQL 16 local isolado: **106 testes, 106 aprovados, 0 falhas, 0 ignorados**.
- `npm run test:e2e` (Chromium/Playwright 1.63): **4 cenários aprovados**.
- Ensaio de backup/restore **local** (pg_dump/pg_restore + cópia do diretório de fotos): contagens idênticas, trigger de auditoria e CHECKs preservados, todos os derivados de fotos presentes. Não é evidência de backup de produção (EXT-06).

O CI do GitHub roda PostgreSQL 17; o resultado deve ser conferido no PR antes de qualquer merge.

## Gates

| Gate | Situação |
|---|---|
| C0 — protótipo com dados sintéticos | atendido para desenvolvimento local/CI |
| C1 — piloto com dados reais | **bloqueado**: EXT-04/05/06/08, MFA, storage de produção, backup real |
| C2 — aceite acadêmico | **aguarda** EXT-02 (professor/Escola do Futuro/parceiro) |
| C3 — lançamento público | **bloqueado** |
