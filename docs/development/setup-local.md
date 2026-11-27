# Executar o AlugaSR localmente (Windows/PowerShell e Linux/macOS)

Somente dados **sintéticos**. Nunca use dados pessoais, endereços ou fotos reais.

## 1. Pré-requisitos

- **Node.js 26 LTS** (o projeto exige `>=26 <27`; ver `.nvmrc`). No Windows: instalador oficial ou `nvm-windows` (`nvm install 26` e `nvm use 26`).
- **PostgreSQL 16 ou 17** instalado localmente (o CI usa 17). Alternativa: Docker Desktop com a imagem `postgres:17`.
- Git.

Verifique:

```powershell
node -v
npm -v
psql --version
```

## 2. Bancos de desenvolvimento e de teste (separados)

Com o `psql` como superusuário local (`postgres`), crie um usuário e **dois** bancos — o de teste é apagado/reutilizado pelos testes e nunca deve ser o de desenvolvimento:

```powershell
psql -U postgres -c "CREATE ROLE alugasr_dev LOGIN PASSWORD 'senha-ficticia' CREATEDB;"
```

```powershell
psql -U postgres -c "CREATE DATABASE alugasr_dev OWNER alugasr_dev;"
```

```powershell
psql -U postgres -c "CREATE DATABASE alugasr_test OWNER alugasr_dev;"
```

Opcional com Docker (sem PostgreSQL instalado):

```powershell
docker run --name alugasr-pg -e POSTGRES_USER=alugasr_dev -e POSTGRES_PASSWORD=senha-ficticia -e POSTGRES_DB=alugasr_dev -p 5432:5432 -d postgres:17
```

```powershell
docker exec alugasr-pg psql -U alugasr_dev -d alugasr_dev -c "CREATE DATABASE alugasr_test;"
```

## 3. Variáveis de ambiente

```powershell
Copy-Item .env.example .env
```

Edite `.env` e gere um `SESSION_SECRET` aleatório:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`.env` é ignorado pelo Git. Nunca versione credenciais.

## 4. Instalar, migrar e popular

```powershell
npm ci
```

```powershell
npm run db:migrate
```

```powershell
npm run db:seed
```

`npm ci` gera o Prisma Client (`postinstall`). `db:migrate` usa `prisma migrate deploy` (mesmo comando do CI). Para **criar** uma nova migration durante o desenvolvimento use `npm run db:migrate:dev -- --name descricao` e revise o SQL gerado. Nunca use `prisma db push` como substituto de migration.

## 5. Executar

```powershell
npm start
```

Abra <http://127.0.0.1:3000/>. A API e o frontend são servidos pela mesma origem (necessário para o cookie de sessão `SameSite=Strict`).

Contas **fictícias** criadas pelo seed (senha de demonstração: `AlugaSR-demo-2026`, configurável por `SEED_DEMO_PASSWORD`):

| E-mail | Papel |
|---|---|
| `imobiliaria@alugasr.test` | responsável da "Imobiliária Exemplo (fictícia)" |
| `atendente@alugasr.test` | atendente (não gerencia anúncios — útil para testar negação) |
| `proprietario@alugasr.test` | proprietário individual verificado (status interno sintético) |
| `proprietario.pendente@alugasr.test` | proprietário pendente (salva rascunho, não envia) |
| `moderador@alugasr.test` | moderação |
| `admin@alugasr.test` | administração |

Essas credenciais existem apenas no banco local criado pelo seed. O seed recusa execução com `NODE_ENV=production`.

Prévia estática sem API (modo offline, fixtures do PR #12): `npm run preview` → <http://127.0.0.1:4173/>.

## 6. Testes

No PowerShell, defina o banco de teste para a sessão e execute:

```powershell
$env:TEST_DATABASE_URL = "postgresql://alugasr_dev:senha-ficticia@127.0.0.1:5432/alugasr_test"
```

```powershell
$env:DATABASE_URL = $env:TEST_DATABASE_URL; npm run db:migrate
```

```powershell
npm run check
```

E2E com navegador (requer Playwright instalado na máquina):

```powershell
npm install --no-save playwright@1.63.0; npx playwright install chromium
```

```powershell
npm run test:e2e
```

No Linux/macOS, use `export TEST_DATABASE_URL=...` no lugar de `$env:`.

Sem `TEST_DATABASE_URL`, os testes de banco/API são marcados como ignorados (skip) — isso **não** é aprovação.

## 7. Problemas comuns

- `SESSION_SECRET ausente`: em desenvolvimento a API usa um segredo efêmero e as sessões expiram ao reiniciar.
- `Origem não permitida` (403): acesse pelo mesmo host/porta configurados em `APP_ORIGINS` (padrão: `127.0.0.1` e `localhost` na porta `PORT`).
- Fotos sumiram após apagar `.storage/`: rode `npm run db:seed` novamente (ele recria os derivados sintéticos).
