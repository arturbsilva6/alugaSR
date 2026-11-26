import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fixtures, skipWithoutDb, testPrisma, PASSWORD } from "./helpers/db.mjs";
import { startApi } from "./helpers/http.mjs";

// SEC-001/SEC-010/SEC-013, API-CT03/CT04, FT-009: sessão, CSRF, revogação e respostas neutras.
const prisma = skipWithoutDb.skip ? null : testPrisma();
const f = prisma && fixtures(prisma);
let api;
test.before(async () => { if (prisma) api = await startApi(prisma); });
test.after(async () => { await api?.close(); await prisma?.$disconnect(); });

test("login define cookie HttpOnly/SameSite=Strict; sessão guarda só o hash do token", skipWithoutDb, async () => {
  const u = await f.user();
  const c = api.client();
  const r = await c.login(u.email.toUpperCase(), PASSWORD);
  assert.equal(r.status, 200);
  assert.match(r.setCookie, /^alugasr_sid=[\w-]{43};/);
  assert.match(r.setCookie, /HttpOnly/i);
  assert.match(r.setCookie, /SameSite=Strict/i);
  assert.match(r.setCookie, /Path=\//);
  assert.doesNotMatch(JSON.stringify(r.body), /senha|hash|token_hash/i);
  assert.ok(r.body.data.csrfToken);
  const raw = r.setCookie.split(";")[0].split("=")[1];
  const stored = await prisma.sessao.findFirst({ where: { usuarioId: u.id } });
  assert.equal(stored.tokenHash, createHash("sha256").update(raw).digest("hex"));
  assert.notEqual(stored.tokenHash, raw);
  const s = await c.get("/api/v1/auth/session");
  assert.equal(s.status, 200);
  assert.equal(s.body.data.user.id, u.id);
  assert.equal(s.headers.get("cache-control"), "no-store");
});

test("cookie Secure e prefixo __Host- quando COOKIE_SECURE ativo", skipWithoutDb, async () => {
  const secureApi = await startApi(prisma, { cookieSecure: true });
  try {
    const u = await f.user();
    const r = await secureApi.client().login(u.email, PASSWORD);
    assert.match(r.setCookie, /^__Host-alugasr_sid=/);
    assert.match(r.setCookie, /Secure/);
  } finally { await secureApi.close(); }
});

test("credenciais inválidas, conta suspensa e e-mail inexistente têm a mesma resposta neutra", skipWithoutDb, async () => {
  const u = await f.user();
  const suspended = await f.user({ status: "suspenso" });
  const responses = [
    await api.client().login(u.email, "senha-errada-123456"),
    await api.client().login(`nao.existe.${Date.now()}@exemplo.test`, PASSWORD),
    await api.client().login(suspended.email, PASSWORD)
  ];
  for (const r of responses) {
    assert.equal(r.status, 401);
    assert.equal(r.body.error.code, "INVALID_CREDENTIALS");
    assert.equal(r.body.error.message, responses[0].body.error.message);
    assert.equal(r.setCookie, null);
  }
  const bad = await api.client().post("/api/v1/auth/login", { email: u.email, password: PASSWORD, role: "administrador" });
  assert.equal(bad.status, 422);
});

test("bloqueio progressivo por conta após falhas repetidas (429)", skipWithoutDb, async () => {
  const u = await f.user();
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await api.client().login(u.email, "senha-errada-xxxxx")).status);
  assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
  assert.equal(statuses[5], 429);
  assert.equal((await api.client().login(u.email, PASSWORD)).status, 429, "conta bloqueada temporariamente mesmo com senha correta");
});

test("sem sessão → 401; mutação sem CSRF → 403; token forjado → 403", skipWithoutDb, async () => {
  const anon = api.client();
  assert.equal((await anon.get("/api/v1/me")).status, 401);
  assert.equal((await anon.get("/api/v1/auth/session")).status, 401);
  assert.equal((await anon.post("/api/v1/me/properties", {})).status, 401);
  const u = await f.user();
  await f.advertiser(u);
  const c = api.client();
  await c.login(u.email, PASSWORD);
  const good = c.csrf;
  c.csrf = null;
  const r1 = await c.post("/api/v1/me/properties", { title: "Sem token de proteção" });
  assert.equal(r1.status, 403);
  assert.equal(r1.body.error.code, "CSRF_INVALID");
  const r2 = await c.post("/api/v1/me/properties", { title: "Token forjado aqui" }, { headers: { "x-csrf-token": good.slice(0, -2) + "xx" } });
  assert.equal(r2.status, 403);
  c.csrf = good;
  assert.equal((await c.post("/api/v1/me/properties", { title: "Com token de proteção" })).status, 201);
});

test("origem de terceiros e formulário não-JSON são recusados", skipWithoutDb, async () => {
  const u = await f.user();
  await f.advertiser(u);
  const c = api.client();
  await c.login(u.email, PASSWORD);
  const evil = await c.post("/api/v1/me/properties", { title: "Requisição cross-site" }, { headers: { origin: "https://site-malicioso.example" } });
  assert.equal(evil.status, 403);
  const allowed = await c.post("/api/v1/me/properties", { title: "Origem permitida ok" }, { headers: { origin: "http://app.alugasr.test" } });
  assert.equal(allowed.status, 201);
  const form = await c.request("POST", "/api/v1/me/properties", { body: "title=formulario+simples", headers: { "content-type": "application/x-www-form-urlencoded" } });
  assert.equal(form.status, 415);
  const loginEvil = await api.client().post("/api/v1/auth/login", { email: u.email, password: PASSWORD }, { headers: { origin: "https://site-malicioso.example" } });
  assert.equal(loginEvil.status, 403);
});

test("logout revoga a sessão; cookie antigo deixa de funcionar", skipWithoutDb, async () => {
  const u = await f.user();
  const c = api.client();
  await c.login(u.email, PASSWORD);
  const old = c.cookie;
  const r = await c.post("/api/v1/auth/logout", {});
  assert.equal(r.status, 204);
  assert.match(r.setCookie, /alugasr_sid=;/);
  const replay = api.client();
  replay.cookie = old;
  assert.equal((await replay.get("/api/v1/me")).status, 401);
  assert.equal((await api.client().post("/api/v1/auth/logout", {})).status, 204, "logout sem sessão é idempotente");
});

test("logout-all e troca de senha revogam outras sessões", skipWithoutDb, async () => {
  const u = await f.user();
  const a = api.client(); const b = api.client();
  await a.login(u.email, PASSWORD); await b.login(u.email, PASSWORD);
  const weak = await a.post("/api/v1/auth/password/change", { currentPassword: PASSWORD, newPassword: "curta" });
  assert.equal(weak.status, 422);
  const wrong = await a.post("/api/v1/auth/password/change", { currentPassword: "nao-e-a-senha-atual", newPassword: "nova-senha-sintetica-forte" });
  assert.equal(wrong.status, 401);
  const ok = await a.post("/api/v1/auth/password/change", { currentPassword: PASSWORD, newPassword: "nova-senha-sintetica-forte" });
  assert.equal(ok.status, 204);
  assert.equal((await a.get("/api/v1/me")).status, 200, "sessão atual preservada");
  assert.equal((await b.get("/api/v1/me")).status, 401, "outra sessão revogada");
  assert.equal((await api.client().login(u.email, PASSWORD)).status, 401);
  const c = api.client();
  assert.equal((await c.login(u.email, "nova-senha-sintetica-forte")).status, 200);
  assert.equal((await c.post("/api/v1/auth/logout-all", {})).status, 204);
  assert.equal((await a.get("/api/v1/me")).status, 401);
  assert.equal((await c.get("/api/v1/me")).status, 401);
});

test("expiração absoluta, inatividade e suspensão encerram a sessão", skipWithoutDb, async () => {
  const u = await f.user();
  const c = api.client();
  await c.login(u.email, PASSWORD);
  await prisma.sessao.updateMany({ where: { usuarioId: u.id }, data: { ultimoAcessoEm: new Date(Date.now() - 31 * 60_000) } });
  assert.equal((await c.get("/api/v1/me")).status, 401, "inatividade > 30 min");
  await c.login(u.email, PASSWORD);
  await prisma.sessao.updateMany({ where: { usuarioId: u.id, revogadaEm: null }, data: { expiraEm: new Date(Date.now() - 1000), criadoEm: new Date(Date.now() - 9 * 3600_000) } });
  assert.equal((await c.get("/api/v1/me")).status, 401, "expiração absoluta");
  await c.login(u.email, PASSWORD);
  await prisma.usuario.update({ where: { id: u.id }, data: { status: "suspenso" } });
  assert.equal((await c.get("/api/v1/me")).status, 401, "suspensão revoga na requisição seguinte");
  assert.equal(await prisma.sessao.count({ where: { usuarioId: u.id, revogadaEm: null } }), 0);
});

test("cadastro público desligado (Gate C1) e papéis não aceitos do cliente", skipWithoutDb, async () => {
  const r = await api.client().post("/api/v1/auth/register", { name: "x", email: "x@exemplo.test", password: "senha-sintetica-123" });
  assert.equal(r.status, 404);
  const u = await f.user();
  const c = api.client();
  await c.login(u.email, PASSWORD);
  const me = await c.get("/api/v1/me", { headers: { "x-user-role": "administrador" } });
  assert.deepEqual(me.body.data.roles, ["usuario"]);
  assert.equal((await c.get("/api/v1/admin/property-submissions")).status, 403);
});

test("auditoria de login não registra e-mail, senha nem token", skipWithoutDb, async () => {
  const u = await f.user();
  await api.client().login(u.email, "senha-errada-auditoria");
  await api.client().login(u.email, PASSWORD);
  const logs = await prisma.logAuditoria.findMany({ where: { atorId: u.id }, orderBy: { ocorridoEm: "asc" } });
  assert.ok(logs.some(l => l.acao === "auth.login.success"));
  const dump = JSON.stringify(await prisma.logAuditoria.findMany({ where: { acao: { startsWith: "auth." } }, take: 200, orderBy: { ocorridoEm: "desc" } }));
  assert.doesNotMatch(dump, new RegExp(u.email.replace(".", "\\.")));
  assert.doesNotMatch(dump, /senha-errada-auditoria|senha-sintetica-de-teste/);
});

test("limite de login por IP retorna 429 sem travar o serviço", skipWithoutDb, async () => {
  const limited = await startApi(prisma, { rateLimits: { ...api.config.rateLimits, loginPerIpPerMinute: 3 } });
  try {
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await limited.client().login(`ip.${i}@exemplo.test`, "x")).status);
    assert.deepEqual(statuses, [401, 401, 401, 429]);
    assert.equal((await limited.client().get("/api/v1/health")).status, 200);
  } finally { await limited.close(); }
});
