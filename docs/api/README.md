# API REST `/api/v1` — contrato implementado (MVP)

Referência normativa: Documentação Mestre, seções 26, 30.5, 30.10 e 31.11. Este arquivo descreve **o que está implementado** nesta branch. Um OpenAPI formal (MD-16) ainda não foi produzido.

## Convenções

- Sucesso: `{ "data": ... }`; listagens: `{ "data": [...], "page": { ... } }`.
- Erro: `{ "error": { "code", "message", "requestId", "fields?": [{ "field", "reason" }] } }`. Nunca contém SQL, stack trace ou valores enviados.
- Dinheiro: string decimal com duas casas (`"1850.00"`). Nulo = desconhecido ("a confirmar"), nunca zero.
- Datas: ISO 8601 UTC.
- Códigos: 400 JSON inválido · 401 sem sessão · 403 sem permissão/CSRF/origem · 404 inexistente **ou oculto** · 409 conflito de revisão/estado · 410 anúncio indisponível · 413 arquivo grande · 415 formato · 422 validação · 429 limite · 503 indisponível.
- Parâmetros e campos desconhecidos são recusados (422) — proteção contra mass assignment.
- Cabeçalho `X-Request-Id` em todas as respostas.

## Público (sem login)

| Método e rota | Descrição |
|---|---|
| `GET /health`, `GET /ready` | liveness/readiness (inalterados do MVP-001) |
| `GET /meta` | versão, `demoData`, ordenações disponíveis, cobertura (`neighborhoodsValidated: false`) e flags |
| `GET /catalog/neighborhoods` | bairros ativos com `source` (EXT-01 pendente) |
| `GET /catalog/property-types`, `GET /catalog/features` | catálogos ativos |
| `GET /properties` | busca de **publicados**. Filtros: `neighborhood`/`neighborhoodId`, `propertyType`/`propertyTypeId`, `minPrice`, `maxPrice`, `bedrooms` (mínimo), `bathrooms` (mínimo), `features` (slugs; todos exigidos). `sort=newest\|price_asc\|price_desc` (sem `popular`/`distance`). `pageSize` 1–48 (padrão 12). `cursor` opaco assinado. Resposta `page: { pageSize, total, hasMore, nextCursor }` |
| `GET /properties/{id}` | detalhe público; 410 para pausado/alugado/arquivado; 404 para rascunho/análise/rejeitado/suspenso/inexistente |
| `GET /properties/{id}/photos/{photoId}/{thumb\|detail}` | derivado WebP sem metadados, somente se o anúncio estiver publicado |

Campos públicos: id, título, descrição, tipo, bairro, município/UF, preço (aluguel, condomínio, IPTU, total quando conhecido), quartos, banheiros, vagas, área, características, fotos derivadas, anunciante resumido (nome e tipo), `approximateLocation` em nível de bairro. **Nunca**: logradouro, número, complemento, CEP, coordenadas, e-mail, telefone, estado interno, revisão.

## Autenticação

| Rota | Observações |
|---|---|
| `POST /auth/login` `{ email, password }` | define cookie `alugasr_sid` (ou `__Host-alugasr_sid` com HTTPS) HttpOnly, SameSite=Strict; retorna `csrfToken`. Erro neutro 401; 429 após falhas repetidas |
| `GET /auth/session` | usuário, papéis efetivos, `csrfToken`, contextos de anúncio |
| `POST /auth/logout` · `POST /auth/logout-all` | revogação; 204 |
| `POST /auth/password/change` `{ currentPassword, newPassword }` | revoga as outras sessões |
| `POST /auth/register` | **desligado** (404) até o Gate C1 |

Mutações autenticadas exigem o cabeçalho `X-CSRF-Token` e corpo `application/json` (exceto upload). Requisições com `Origin`/`Referer` fora de `APP_ORIGINS` recebem 403.

## Painel do titular

Base individual: `/me/properties`. Base de imobiliária: `/me/agencies/{agencyId}/properties` (exige vínculo **ativo** como `responsavel` ou `gestor`).

| Rota | Descrição |
|---|---|
| `GET /me` | perfil e contextos |
| `GET {base}?status=&page=&pageSize=` | anúncios do titular |
| `POST {base}` | cria rascunho (campos opcionais) |
| `GET {base}/{id}` | detalhe privado (inclui endereço protegido) |
| `PATCH {base}/{id}` | exige `revision`; editável em rascunho/rejeitado/pausado (rejeitado e pausado voltam a rascunho) |
| `POST {base}/{id}/submit\|pause\|resume\|mark-rented\|archive` `{ revision }` | transições do titular. Não existe rota de publicação para o titular |
| `GET {base}/{id}/history` | histórico de estados, com motivo de rejeição/suspensão (sem identificar o revisor) |
| `POST {base}/{id}/photos` | corpo binário `image/jpeg\|png\|webp`, até 5 MB (configurável) |
| `PATCH {base}/{id}/photos/{photoId}` `{ alt?, isCover?: true, order? }` | |
| `DELETE {base}/{id}/photos/{photoId}` | remoção lógica; derivados apagados |
| `GET {base}/{id}/photos/{photoId}/{thumb\|detail}` | prévia privada (`no-store`) |

Campos do anúncio: `title`, `description`, `propertyTypeId`, `rent`, `condominium`, `iptu`, `areaM2`, `bedrooms`, `bathrooms`, `parkingSpaces`, `features[]`, `address { neighborhoodId, cep, street, number, complement }`. Município e UF são fixos (São Roque/SP).

Requisitos para `submit`: título ≥ 8, descrição ≥ 20, tipo e bairro ativos, aluguel > 0, quartos informados, ≥ 1 foto processada e titular com verificação interna `verificado`.

## Moderação (papéis `moderador` ou `administrador`)

| Rota | Descrição |
|---|---|
| `GET /admin/property-submissions` | fila `em_analise` |
| `GET /admin/property-submissions/{id}` | dados de revisão (auditado como `moderation.view`), `reviewerConflict` |
| `GET /admin/property-submissions/{id}/photos/{photoId}/{variant}` | prévia |
| `POST /admin/properties/{id}/approve` `{ revision, reason? }` | publica |
| `POST /admin/properties/{id}/reject` `{ revision, reason }` | justificativa ≥ 10 caracteres |
| `POST /admin/properties/{id}/suspend` `{ revision, reason }` | |

Revisor com vínculo ao titular (criador, anunciante, membro da imobiliária) recebe 403. Em `NODE_ENV=production`, todas as rotas `/admin` respondem 403 até haver MFA (RN-A04).
