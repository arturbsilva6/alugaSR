import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fixtures, skipWithoutDb, testPrisma, PASSWORD } from "./helpers/db.mjs";
import { startApi } from "./helpers/http.mjs";

// CT-02/03/04/06, FT-010..016, SEC-002/003, ARQ-CT02/03/04, API-CT02/05/06/08.
const prisma = skipWithoutDb.skip ? null : testPrisma();
const f = prisma && fixtures(prisma);
let api, cat;
test.before(async () => { if (prisma) { api = await startApi(prisma); cat = await f.catalog(); } });
test.after(async () => { await api?.close(); await prisma?.$disconnect(); });

async function loggedIn(user) { const c = api.client(); assert.equal((await c.login(user.email, PASSWORD)).status, 200); return c; }
async function agencyMember(papel = "responsavel", agencyStatus = "verificado") {
  const u = await f.user(); const ag = await f.agency(u, { status: agencyStatus }); await f.member(ag, u, papel);
  return { u, ag, c: await loggedIn(u), base: `/api/v1/me/agencies/${ag.id}/properties` };
}
const png = () => sharp({ create: { width: 640, height: 480, channels: 3, background: "#228844" } }).png().toBuffer();
const complete = () => ({
  title: "Casa sintética completa para teste", description: "Descrição sintética com mais de vinte caracteres para envio.",
  propertyTypeId: cat.tipo.id, rent: "1800.00", condominium: "0.00", iptu: "80.00", bedrooms: 2, bathrooms: 1, parkingSpaces: 1,
  areaM2: "70.50", features: [cat.carac.id], address: { neighborhoodId: cat.bairro.id, street: "Rua Sintética", number: "10" }
});

test("titular cria rascunho incompleto e completa depois, com revisão otimista", skipWithoutDb, async () => {
  const { c, base, ag } = await agencyMember();
  const r = await c.post(base, { title: "Rascunho bem parcial" });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.status, "rascunho");
  assert.equal(r.body.data.owner.id, ag.id);
  const id = r.body.data.id;
  const upd = await c.patch(`${base}/${id}`, { ...complete(), revision: 1 });
  assert.equal(upd.status, 200, JSON.stringify(upd.body));
  assert.equal(upd.body.data.revision, 2);
  assert.equal(upd.body.data.price.rent, "1800.00");
  assert.equal(upd.body.data.price.monthlyTotal, "1880.00");
  assert.equal(upd.body.data.areaM2, "70.50");
  assert.equal(upd.body.data.address.street, "Rua Sintética", "endereço visível apenas ao titular");
  const stale = await c.patch(`${base}/${id}`, { title: "Edição com revisão antiga", revision: 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, "CONFLICT");
  const list = await c.get(base);
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.page.total, 1);
});

test("mass assignment: status, titular e campos de controle são recusados (SEC-003/FT-016)", skipWithoutDb, async () => {
  const { c, base } = await agencyMember();
  const other = await agencyMember();
  for (const body of [{ status: "publicado" }, { imobiliariaId: other.ag.id }, { anuncianteId: crypto.randomUUID() }, { revisao: 99 }, { publicadoEm: new Date().toISOString() }]) {
    const r = await c.post(base, { title: "Tentativa de injeção", ...body });
    assert.equal(r.status, 422, JSON.stringify(body));
  }
  const id = (await c.post(base, { title: "Rascunho legítimo aqui" })).body.data.id;
  assert.equal((await c.patch(`${base}/${id}`, { revision: 1, status: "publicado" })).status, 422);
  assert.equal((await c.patch(`${base}/${id}`, { revision: 1, address: { neighborhoodId: cat.bairro.id, municipio: "Sorocaba" } })).status, 422);
  assert.equal((await c.patch(`${base}/${id}`, { revision: 1, propertyTypeId: crypto.randomUUID() })).status, 422);
  assert.equal((await c.patch(`${base}/${id}`, { revision: 1, rent: 1500.5 })).status, 422, "float não aceito");
});

test("isolamento entre imobiliárias e titulares (BOLA/IDOR) inclusive em listagens e fotos", skipWithoutDb, async () => {
  const a = await agencyMember();
  const b = await agencyMember();
  const id = (await a.c.post(a.base, complete())).body.data.id;
  // B tenta acessar o imóvel de A pela rota da própria organização e pela de A.
  assert.equal((await b.c.get(`${b.base}/${id}`)).status, 404);
  assert.equal((await b.c.patch(`${b.base}/${id}`, { revision: 1, title: "Invasão de outro titular" })).status, 404);
  assert.equal((await b.c.post(`${b.base}/${id}/submit`, { revision: 1 })).status, 404);
  assert.equal((await b.c.get(a.base)).status, 404, "não é membro da organização A");
  assert.equal((await b.c.get(`${a.base}/${id}`)).status, 404);
  assert.equal((await b.c.request("POST", `${b.base}/${id}/photos`, { body: await png(), headers: { "content-type": "image/png" } })).status, 404);
  assert.equal((await b.c.get(b.base)).body.page.total, 0);
  // Proprietário individual não enxerga imóveis de imobiliária pela rota /me/properties.
  const ind = await f.user(); await f.advertiser(ind);
  const ic = await loggedIn(ind);
  assert.equal((await ic.get(`/api/v1/me/properties/${id}`)).status, 404);
  assert.equal((await ic.get("/api/v1/me/properties")).body.page.total, 0);
});

test("atendente, membro removido e usuário sem perfil não gerenciam anúncios (ARQ-CT03)", skipWithoutDb, async () => {
  const a = await agencyMember();
  const att = await f.user(); await f.member(a.ag, att, "atendente");
  const ac = await loggedIn(att);
  assert.equal((await ac.get(a.base)).status, 403);
  const gestor = await f.user(); await f.member(a.ag, gestor, "gestor");
  const gc = await loggedIn(gestor);
  const id = (await gc.post(a.base, { title: "Criado por gestor ativo" })).body.data.id;
  const created = await prisma.imovel.findUnique({ where: { id } });
  assert.equal(created.imobiliariaId, a.ag.id, "titular é a imobiliária, não o gestor (ARQ-CT04)");
  assert.equal(created.anuncianteId, null);
  await prisma.membroImobiliaria.updateMany({ where: { usuarioId: gestor.id }, data: { status: "removido", removidoEm: new Date() } });
  assert.equal((await gc.get(`${a.base}/${id}`)).status, 404, "remoção revoga acesso na próxima requisição");
  assert.equal((await gc.get("/api/v1/me")).status, 200, "a conta pessoal continua válida");
  const nobody = await loggedIn(await f.user());
  assert.equal((await nobody.post("/api/v1/me/properties", { title: "Sem perfil de anunciante" })).status, 403);
});

test("anunciante pendente salva rascunho mas não envia; suspenso não cria (CT-03/API-CT05)", skipWithoutDb, async () => {
  const u = await f.user(); await f.advertiser(u, "pendente");
  const c = await loggedIn(u);
  const r = await c.post("/api/v1/me/properties", complete());
  assert.equal(r.status, 201);
  const sub = await c.post(`/api/v1/me/properties/${r.body.data.id}/submit`, { revision: 1 });
  assert.equal(sub.status, 403);
  assert.equal((await prisma.imovel.findUnique({ where: { id: r.body.data.id } })).status, "rascunho");
  const s = await f.user(); await f.advertiser(s, "suspenso");
  assert.equal((await (await loggedIn(s)).post("/api/v1/me/properties", { title: "Titular suspenso tentando" })).status, 403);
  const pendingAgency = await agencyMember("responsavel", "pendente");
  const pid = (await pendingAgency.c.post(pendingAgency.base, complete())).body.data.id;
  assert.equal((await pendingAgency.c.post(`${pendingAgency.base}/${pid}/submit`, { revision: 1 })).status, 403);
});

test("envio exige requisitos mínimos e foto; não publica; grafo de estados é respeitado", skipWithoutDb, async () => {
  const { c, base } = await agencyMember();
  const id = (await c.post(base, { title: "Incompleto para envio" })).body.data.id;
  const missing = await c.post(`${base}/${id}/submit`, { revision: 1 });
  assert.equal(missing.status, 422);
  for (const field of ["description", "propertyTypeId", "address.neighborhoodId", "rent", "bedrooms", "photos"]) {
    assert.ok(missing.body.error.fields.some(x => x.field === field), field);
  }
  const zero = await c.patch(`${base}/${id}`, { ...complete(), rent: "0.00", revision: 1 });
  assert.equal(zero.status, 200);
  const up = await c.request("POST", `${base}/${id}/photos`, { body: await png(), headers: { "content-type": "image/png" } });
  assert.equal(up.status, 201, JSON.stringify(up.body));
  const rev = up.body.data.property.revision;
  const zeroSub = await c.post(`${base}/${id}/submit`, { revision: rev });
  assert.ok(zeroSub.body.error.fields.some(x => x.field === "rent"), "aluguel zero não pode ser enviado (ARQ-CT07)");
  const fixed = await c.patch(`${base}/${id}`, { rent: "1800.00", revision: rev });
  const sub = await c.post(`${base}/${id}/submit`, { revision: fixed.body.data.revision });
  assert.equal(sub.status, 200);
  assert.equal(sub.body.data.status, "em_analise");
  assert.equal((await api.client().get(`/api/v1/properties/${id}`)).status, 404, "em análise não é público");
  const r2 = sub.body.data.revision;
  assert.equal((await c.patch(`${base}/${id}`, { title: "Editar durante análise", revision: r2 })).status, 409);
  assert.equal((await c.post(`${base}/${id}/pause`, { revision: r2 })).status, 409);
  assert.equal((await c.post(`${base}/${id}/resume`, { revision: r2 })).body.error.code, "INVALID_STATE_TRANSITION");
  assert.equal((await c.post(`${base}/${id}/publish`, { revision: r2 })).status, 404, "não existe rota de autopublicação");
  assert.equal((await c.post(`${base}/${id}/submit`, {})).status, 422, "revision obrigatória");
  const hist = await c.get(`${base}/${id}/history`);
  assert.deepEqual(hist.body.data.map(h => h.action).slice(0, 2), ["submit", "update"]);
});

test("pausar/retomar/alugado/arquivar após publicação; edição de pausado volta a rascunho", skipWithoutDb, async () => {
  const { u, ag, c, base } = await agencyMember();
  const p = await f.property({ owner: ag, creator: u, bairro: cat.bairro, tipo: cat.tipo, status: "publicado" });
  const get = async () => (await c.get(`${base}/${p.id}`)).body.data;
  assert.equal((await c.patch(`${base}/${p.id}`, { title: "Edição direta de publicado", revision: 1 })).status, 409);
  let r = await c.post(`${base}/${p.id}/pause`, { revision: 1 });
  assert.equal(r.body.data.status, "pausado");
  assert.equal((await api.client().get(`/api/v1/properties/${p.id}`)).status, 410);
  r = await c.post(`${base}/${p.id}/resume`, { revision: r.body.data.revision });
  assert.equal(r.body.data.status, "publicado");
  r = await c.post(`${base}/${p.id}/pause`, { revision: r.body.data.revision });
  r = await c.patch(`${base}/${p.id}`, { title: "Título alterado após pausa", revision: r.body.data.revision });
  assert.equal(r.body.data.status, "rascunho", "alteração material exige nova análise");
  r = await c.post(`${base}/${p.id}/archive`, { revision: (await get()).revision });
  assert.equal(r.body.data.status, "arquivado");
  assert.ok(r.body.data.archivedAt);
  assert.equal((await c.post(`${base}/${p.id}/submit`, { revision: r.body.data.revision })).status, 409);
  const p2 = await f.property({ owner: ag, creator: u, bairro: cat.bairro, tipo: cat.tipo, status: "publicado" });
  r = await c.post(`${base}/${p2.id}/mark-rented`, { revision: 1 });
  assert.equal(r.body.data.status, "alugado");
  assert.equal((await api.client().get(`/api/v1/properties/${p2.id}`)).status, 410);
});

test("requisições concorrentes de envio: apenas uma transição vence (CT-06)", skipWithoutDb, async () => {
  const { u, ag, c, base } = await agencyMember();
  const p = await f.property({ owner: ag, creator: u, bairro: cat.bairro, tipo: cat.tipo, status: "rascunho" });
  await prisma.fotoImovel.create({ data: { imovelId: p.id, chaveArmazenamento: `originals/${crypto.randomUUID()}`, statusProcessamento: "aprovado", principal: true } });
  const results = await Promise.all(Array.from({ length: 5 }, () => c.post(`${base}/${p.id}/submit`, { revision: 1 })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.ok(results.filter(r => r.status !== 200).every(r => r.status === 409));
  assert.equal(await prisma.logAuditoria.count({ where: { recursoId: p.id, acao: "property.submit" } }), 1);
});
