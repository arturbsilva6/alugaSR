import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fixtures, skipWithoutDb, testPrisma } from "./helpers/db.mjs";
import { startApi } from "./helpers/http.mjs";

// API-CT01/CT06/CT12, FT-001..FT-007, SEC-004: contrato público, filtros, paginação e privacidade.
const prisma = skipWithoutDb.skip ? null : testPrisma();
const f = prisma && fixtures(prisma);
let api, ctx;
const PRIVATE_KEYS = /"(logradouro|numero|complemento|cep|latitude|longitude|street|number|complement|address|enderecoId|email|telefone|senhaHash|revisao|revision|status|criadoPorUsuarioId|chaveArmazenamento)"/;

test.before(async () => {
  if (!prisma) return;
  api = await startApi(prisma);
  const u = await f.user();
  const agency = await f.agency(u);
  const adv = await f.advertiser(await f.user());
  const c = await f.catalog();
  const t0 = Date.now() - 100_000;
  const mk = (o) => f.property({ creator: u, bairro: c.bairro, tipo: c.tipo, owner: agency, ...o });
  ctx = { c, agency, adv, u,
    p1: await mk({ rent: "1000.00", bedrooms: 1, publishedAt: new Date(t0 + 1000), features: [c.carac] }),
    p2: await mk({ rent: "2000.00", bedrooms: 3, bathrooms: 2, publishedAt: new Date(t0 + 2000) }),
    p3: await mk({ rent: "2000.00", bedrooms: 2, publishedAt: new Date(t0 + 3000), tipo: c.tipo2, bairro: c.bairro2 }),
    p4: await mk({ rent: "3500.50", bedrooms: 4, publishedAt: new Date(t0 + 4000), owner: adv }),
    p5: await mk({ rent: "1500.00", bedrooms: 2, publishedAt: new Date(t0 + 5000) }),
    draft: await mk({ status: "rascunho" }),
    review: await mk({ status: "em_analise" }),
    paused: await mk({ status: "pausado" }),
    rented: await mk({ status: "alugado" }),
    rejected: await mk({ status: "rejeitado" }),
    suspended: await mk({ status: "suspenso" })
  };
  const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#aa3300" } }).png().toBuffer();
  for (const [name, p] of [["pub", ctx.p1], ["draft", ctx.draft]]) {
    const photo = await prisma.fotoImovel.create({ data: { imovelId: p.id, chaveArmazenamento: `originals/${crypto.randomUUID()}`, principal: true, statusProcessamento: "aprovado", textoAlternativo: "Foto sintética" } });
    await api.storage.put(`derived/${photo.id}/thumb.webp`, await sharp(png).webp().toBuffer());
    ctx[`photo_${name}`] = photo;
  }
});
test.after(async () => { await api?.close(); await prisma?.$disconnect(); });

const scoped = (q = "") => `/api/v1/properties?neighborhood=${ctx.c.bairro.slug}${q}`;
const ids = r => r.body.data.map(x => x.id);

test("lista somente publicados, sem campos privados, com envelope { data, page }", skipWithoutDb, async () => {
  const r = await api.client().get(scoped("&pageSize=48"));
  assert.equal(r.status, 200);
  assert.deepEqual(new Set(ids(r)), new Set([ctx.p1.id, ctx.p2.id, ctx.p4.id, ctx.p5.id]));
  assert.equal(r.body.page.total, 4);
  assert.doesNotMatch(JSON.stringify(r.body), PRIVATE_KEYS);
  assert.doesNotMatch(JSON.stringify(r.body), /Rua Sintética Privada|-23\.529|Casa 9/);
  const item = r.body.data.find(x => x.id === ctx.p1.id);
  assert.equal(item.price.rent, "1000.00");
  assert.equal(item.price.monthlyTotal, "1150.00");
  assert.equal(item.municipality, "São Roque");
  assert.equal(item.coverPhoto.urls.thumb, `/api/v1/properties/${ctx.p1.id}/photos/${ctx.photo_pub.id}/thumb`);
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("filtros combináveis: preço, quartos, banheiros, tipo e característica", skipWithoutDb, async () => {
  const c = api.client();
  assert.deepEqual(ids(await c.get(scoped("&minPrice=1500&maxPrice=2000.00"))).sort(), [ctx.p2.id, ctx.p5.id].sort());
  assert.deepEqual(ids(await c.get(scoped("&bedrooms=3"))).sort(), [ctx.p2.id, ctx.p4.id].sort());
  assert.deepEqual(ids(await c.get(scoped("&bedrooms=3&bathrooms=2&maxPrice=2500"))), [ctx.p2.id]);
  assert.deepEqual(ids(await c.get(scoped(`&features=${ctx.c.carac.slug}`))), [ctx.p1.id]);
  assert.deepEqual(ids(await c.get(`/api/v1/properties?propertyType=${ctx.c.tipo2.slug}`)), [ctx.p3.id]);
  assert.deepEqual(ids(await c.get(`/api/v1/properties?neighborhoodId=${ctx.c.bairro2.id}`)), [ctx.p3.id]);
  const empty = await c.get(scoped("&minPrice=900000.00"));
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data, []);
  assert.equal(empty.body.page.hasMore, false);
});

test("ordenação e paginação por cursor determinísticas, sem duplicar nem pular", skipWithoutDb, async () => {
  const c = api.client();
  for (const [sort, expected] of [
    ["newest", [ctx.p5, ctx.p4, ctx.p2, ctx.p1]],
    ["price_asc", [ctx.p1, ctx.p5, ctx.p2, ctx.p4]],
    ["price_desc", [ctx.p4, ctx.p2, ctx.p5, ctx.p1]]
  ]) {
    const seen = [];
    let cursor = null;
    do {
      const r = await c.get(scoped(`&sort=${sort}&pageSize=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`));
      assert.equal(r.status, 200, JSON.stringify(r.body));
      seen.push(...ids(r));
      cursor = r.body.page.nextCursor;
    } while (cursor);
    if (sort === "price_desc") assert.deepEqual(seen, expected.map(p => p.id));
    else assert.deepEqual(seen, expected.map(p => p.id), sort);
  }
  const first = await c.get(scoped("&sort=newest&pageSize=1"));
  const wrong = await c.get(scoped(`&sort=price_asc&cursor=${encodeURIComponent(first.body.page.nextCursor)}`));
  assert.equal(wrong.status, 422);
});

test("entrada inválida retorna 422 com envelope de erro e requestId", skipWithoutDb, async () => {
  const c = api.client();
  for (const q of ["?sort=popular", "?sort=distance", "?minPrice=1,500", "?minPrice=-1", "?bedrooms=abc", "?pageSize=0", "?status=rascunho",
    "?cursor=forjado", "?neighborhood=x'%20OR%201=1--", "?minPrice=2000&maxPrice=1000", "?neighborhoodId=1%20OR%201=1"]) {
    const r = await c.get("/api/v1/properties" + q);
    assert.equal(r.status, 422, q);
    assert.equal(r.body.error.code, "VALIDATION_ERROR");
    assert.ok(r.body.error.requestId);
    assert.doesNotMatch(JSON.stringify(r.body), /prisma|SELECT|stack/i);
  }
});

test("detalhe: publicado 200; indisponível 410; privado/oculto 404 sem vazar existência", skipWithoutDb, async () => {
  const c = api.client();
  const ok = await c.get(`/api/v1/properties/${ctx.p1.id}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.approximateLocation.level, "bairro");
  assert.equal(ok.body.data.features[0].slug, ctx.c.carac.slug);
  assert.equal(ok.body.data.photos.length, 1);
  assert.doesNotMatch(JSON.stringify(ok.body), PRIVATE_KEYS);
  for (const p of [ctx.paused, ctx.rented]) {
    const r = await c.get(`/api/v1/properties/${p.id}`);
    assert.equal(r.status, 410);
    assert.equal(r.body.error.code, "PROPERTY_UNAVAILABLE");
  }
  const missing = await c.get(`/api/v1/properties/${crypto.randomUUID()}`);
  for (const p of [ctx.draft, ctx.review, ctx.rejected, ctx.suspended]) {
    const r = await c.get(`/api/v1/properties/${p.id}`);
    assert.equal(r.status, 404);
    assert.deepEqual(Object.keys(r.body.error).sort(), Object.keys(missing.body.error).sort());
  }
  assert.equal((await c.get("/api/v1/properties/nao-e-uuid")).status, 404);
});

test("titular suspenso some da vitrine pública", skipWithoutDb, async () => {
  const c = api.client();
  await prisma.anunciante.update({ where: { id: ctx.adv.id }, data: { statusVerificacao: "suspenso" } });
  try {
    assert.ok(!ids(await c.get(scoped("&pageSize=48"))).includes(ctx.p4.id));
    assert.equal((await c.get(`/api/v1/properties/${ctx.p4.id}`)).status, 404);
  } finally {
    await prisma.anunciante.update({ where: { id: ctx.adv.id }, data: { statusVerificacao: "verificado" } });
  }
});

test("foto pública só de anúncio publicado; rascunho e variantes inválidas → 404", skipWithoutDb, async () => {
  const c = api.client();
  const ok = await c.get(`/api/v1/properties/${ctx.p1.id}/photos/${ctx.photo_pub.id}/thumb`, { raw: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/webp");
  assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await c.get(`/api/v1/properties/${ctx.draft.id}/photos/${ctx.photo_draft.id}/thumb`)).status, 404);
  assert.equal((await c.get(`/api/v1/properties/${ctx.p2.id}/photos/${ctx.photo_pub.id}/thumb`)).status, 404);
  assert.equal((await c.get(`/api/v1/properties/${ctx.p1.id}/photos/${ctx.photo_pub.id}/original`)).status, 404);
  assert.equal((await c.get(`/api/v1/properties/${ctx.p1.id}/photos/${ctx.photo_pub.id}/..%2F..%2Fetc`)).status, 404);
});

test("catálogos públicos e meta indicam dados sintéticos e cobertura não validada", skipWithoutDb, async () => {
  const c = api.client();
  const n = await c.get("/api/v1/catalog/neighborhoods");
  assert.equal(n.status, 200);
  assert.ok(n.body.data.some(x => x.slug === ctx.c.bairro.slug && x.source));
  assert.equal((await c.get("/api/v1/catalog/property-types")).status, 200);
  assert.equal((await c.get("/api/v1/catalog/features")).status, 200);
  const meta = await c.get("/api/v1/meta");
  assert.equal(meta.body.data.coverage.neighborhoodsValidated, false);
  assert.deepEqual(meta.body.data.sorts, ["newest", "price_asc", "price_desc"]);
});
