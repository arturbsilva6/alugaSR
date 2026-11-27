import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readdir } from "node:fs/promises";
import { fixtures, skipWithoutDb, testPrisma, PASSWORD } from "./helpers/db.mjs";
import { startApi } from "./helpers/http.mjs";

// CT-07, SEC-007/008, API-CT07, FT-013/015, RN-P07, ARQ-CT06, CT-12, API-CT11.
const prisma = skipWithoutDb.skip ? null : testPrisma();
const f = prisma && fixtures(prisma);
let api, cat;
test.before(async () => { if (prisma) { api = await startApi(prisma, { upload: { maxBytes: 300_000, maxPhotosPerProperty: 3, maxInputPixels: 40_000_000 } }); cat = await f.catalog(); } });
test.after(async () => { await api?.close(); await prisma?.$disconnect(); });

async function loggedIn(user) { const c = api.client(); assert.equal((await c.login(user.email, PASSWORD)).status, 200); return c; }
async function agencyDraft() {
  const u = await f.user(); const ag = await f.agency(u); await f.member(ag, u, "responsavel");
  const c = await loggedIn(u);
  const base = `/api/v1/me/agencies/${ag.id}/properties`;
  const r = await c.post(base, {
    title: "Imóvel sintético para fotos", description: "Descrição sintética com tamanho suficiente para análise.",
    propertyTypeId: cat.tipo.id, rent: "1700.00", condominium: "0.00", iptu: "0.00", bedrooms: 2,
    address: { neighborhoodId: cat.bairro.id, street: "Rua Privada Sintética", number: "77" }
  });
  return { u, ag, c, base, id: r.body.data.id, path: `${base}/${r.body.data.id}` };
}
const upload = (c, path, body, type) => c.request("POST", `${path}/photos`, { body, headers: { "content-type": type } });
const jpegWithGps = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#884422" } }).jpeg()
  .withExif({ IFD0: { Copyright: "EXIF-PRIVADO-SINTETICO" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 31/1 45/1" } }).toBuffer();

test("upload válido: derivado sem EXIF/GPS, original privado, foto não pública antes da publicação", skipWithoutDb, async () => {
  const d = await agencyDraft();
  const jpg = await jpegWithGps();
  const r = await upload(d.c, d.path, jpg, "image/jpeg");
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const photo = r.body.data.photo;
  assert.equal(photo.status, "aprovado");
  assert.equal(photo.isCover, true);
  assert.doesNotMatch(JSON.stringify(r.body), /originals\/|quarantine|chave/);
  const priv = await d.c.get(`${d.path}/photos/${photo.id}/detail`, { raw: true });
  assert.equal(priv.status, 200);
  assert.equal(priv.headers.get("cache-control"), "private, no-store");
  const meta = await sharp(priv.body).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.exif, undefined);
  assert.equal(priv.body.includes(Buffer.from("EXIF-PRIVADO-SINTETICO")), false);
  assert.equal((await api.client().get(`/api/v1/properties/${d.id}/photos/${photo.id}/detail`)).status, 404, "rascunho: foto não pública");
  assert.equal((await api.client().get(`${d.path}/photos/${photo.id}/detail`)).status, 401);
  const quarantine = await readdir(`${api.storageDir}/quarantine`).catch(() => []);
  assert.deepEqual(quarantine, [], "quarentena limpa após processamento");
  const row = await prisma.fotoImovel.findUnique({ where: { id: photo.id } });
  assert.equal(row.mimeTypeValidado, "image/jpeg");
  assert.equal(row.chaveArmazenamento, `originals/${photo.id}`);
});

test("uploads maliciosos ou inválidos são recusados e nada fica disponível (CT-07/SEC-007)", skipWithoutDb, async () => {
  const d = await agencyDraft();
  const png = await sharp({ create: { width: 400, height: 400, channels: 3, background: "#123456" } }).png().toBuffer();
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><script>alert(1)</script></svg>');
  const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(2000, 1)]);
  const html = Buffer.from("<html><script>alert(document.cookie)</script></html>" + " ".repeat(500));
  const cases = [
    [png, "image/jpeg", 415, "MIME declarado divergente do conteúdo"],
    [svg, "image/svg+xml", 415, "SVG não aceito"],
    [svg, "image/png", 415, "SVG disfarçado de PNG"],
    [exe, "image/jpeg", 415, "executável disfarçado"],
    [html, "image/webp", 415, "HTML disfarçado"],
    [Buffer.alloc(400_000, 0xff), "image/jpeg", 413, "arquivo acima do limite"],
    [await sharp({ create: { width: 64, height: 64, channels: 3, background: "#000" } }).png().toBuffer(), "image/png", 422, "dimensões insuficientes"],
    [Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3000, 7)]), "image/jpeg", 422, "JPEG corrompido"],
    [png, "text/plain", 415, "content-type não permitido"]
  ];
  for (const [body, type, expected, label] of cases) {
    const r = await upload(d.c, d.path, body, type);
    assert.equal(r.status, expected, `${label}: ${JSON.stringify(r.body)}`);
  }
  const detail = await d.c.get(d.path);
  assert.equal(detail.body.data.photos.length, 0);
  const derived = await readdir(`${api.storageDir}/derived`).catch(() => []);
  const quarantine = await readdir(`${api.storageDir}/quarantine`).catch(() => []);
  const approved = await prisma.fotoImovel.count({ where: { imovelId: d.id, statusProcessamento: "aprovado" } });
  assert.equal(approved, 0);
  assert.deepEqual(quarantine, []);
  for (const dir of derived) assert.notEqual(await prisma.fotoImovel.findFirst({ where: { id: dir, imovelId: d.id } })?.statusProcessamento, "rejeitado");
  assert.ok(await prisma.logAuditoria.count({ where: { acao: "photo.reject", metadados: { path: ["imovel"], equals: d.id } } }) >= 3);
});

test("limite de fotos, capa única, texto alternativo e remoção", skipWithoutDb, async () => {
  const d = await agencyDraft();
  const img = color => sharp({ create: { width: 300, height: 300, channels: 3, background: color } }).png().toBuffer();
  const ids = [];
  for (const color of ["#111111", "#222222", "#333333"]) ids.push((await upload(d.c, d.path, await img(color), "image/png")).body.data.photo.id);
  const over = await upload(d.c, d.path, await img("#444444"), "image/png");
  assert.equal(over.status, 422);
  let r = await d.c.patch(`${d.path}/photos/${ids[2]}`, { isCover: true, alt: "Fachada sintética" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.photos.filter(p => p.isCover).map(p => p.id), [ids[2]]);
  assert.equal(r.body.data.photos.find(p => p.id === ids[2]).alt, "Fachada sintética");
  assert.equal((await d.c.patch(`${d.path}/photos/${ids[0]}`, { alt: "<script>x</script>\u0000" })).status, 422);
  r = await d.c.del(`${d.path}/photos/${ids[2]}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.photos.length, 2);
  assert.equal(r.body.data.photos.filter(p => p.isCover).length, 1, "nova capa atribuída");
  assert.equal((await d.c.get(`${d.path}/photos/${ids[2]}/thumb`)).status, 404);
});

test("moderação: só papel autorizado; sem autoaprovação; aprova, publica e audita", skipWithoutDb, async () => {
  const d = await agencyDraft();
  const up = await upload(d.c, d.path, await jpegWithGps(), "image/jpeg");
  const sub = await d.c.post(`${d.path}/submit`, { revision: up.body.data.property.revision });
  assert.equal(sub.status, 200, JSON.stringify(sub.body));
  const rev = sub.body.data.revision;

  // Titular sem papel de moderação não acessa a fila.
  assert.equal((await d.c.get("/api/v1/admin/property-submissions")).status, 403);
  assert.equal((await d.c.post(`/api/v1/admin/properties/${d.id}/approve`, { revision: rev })).status, 403);

  // Moderador que também é membro da imobiliária titular: conflito de interesse.
  const conflicted = await f.user({ roles: ["usuario", "moderador"] });
  await f.member(d.ag, conflicted, "gestor");
  const cc = await loggedIn(conflicted);
  const view = await cc.get(`/api/v1/admin/property-submissions/${d.id}`);
  assert.equal(view.body.data.reviewerConflict, true);
  const self = await cc.post(`/api/v1/admin/properties/${d.id}/approve`, { revision: rev });
  assert.equal(self.status, 403);
  assert.match(self.body.error.message, /Conflito de interesse/);

  const mod = await f.user({ roles: ["usuario", "moderador"] });
  const mc = await loggedIn(mod);
  const queue = await mc.get("/api/v1/admin/property-submissions?pageSize=50");
  assert.ok(queue.body.data.some(x => x.id === d.id));
  assert.doesNotMatch(JSON.stringify(queue.body), /Rua Privada Sintética|email/);
  const review = await mc.get(`/api/v1/admin/property-submissions/${d.id}`);
  assert.equal(review.body.data.reviewerConflict, false);
  const photoId = review.body.data.photos[0].id;
  assert.equal((await mc.get(`/api/v1/admin/property-submissions/${d.id}/photos/${photoId}/thumb`, { raw: true })).status, 200);
  assert.equal((await mc.post(`/api/v1/admin/properties/${d.id}/approve`, { revision: rev - 1 })).status, 409, "revisão desatualizada");
  const ok = await mc.post(`/api/v1/admin/properties/${d.id}/approve`, { revision: rev });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.status, "publicado");
  assert.equal((await mc.post(`/api/v1/admin/properties/${d.id}/approve`, { revision: ok.body.data.revision })).status, 409, "segunda aprovação");

  const pub = await api.client().get(`/api/v1/properties/${d.id}`);
  assert.equal(pub.status, 200);
  assert.doesNotMatch(JSON.stringify(pub.body), /Rua Privada Sintética|"77"/);
  const pubPhoto = await api.client().get(pub.body.data.photos[0].urls.detail, { raw: true });
  assert.equal(pubPhoto.status, 200);
  assert.equal((await sharp(pubPhoto.body).metadata()).exif, undefined);

  const logs = await prisma.logAuditoria.findMany({ where: { recursoId: d.id }, orderBy: { ocorridoEm: "asc" } });
  const approve = logs.find(l => l.acao === "property.approve");
  assert.equal(approve.atorId, mod.id);
  assert.deepEqual(approve.metadados, { de: "em_analise", para: "publicado" });
  assert.ok(logs.some(l => l.acao === "moderation.view" && l.atorId === mod.id));
  assert.doesNotMatch(JSON.stringify(logs), /Rua Privada|senha|token|@exemplo/);

  // Pausa pelo titular retira a foto da área pública imediatamente.
  const paused = await d.c.post(`${d.path}/pause`, { revision: ok.body.data.revision });
  assert.equal(paused.status, 200);
  assert.equal((await api.client().get(pub.body.data.photos[0].urls.detail)).status, 404);
});

test("rejeição exige justificativa e o motivo aparece no histórico do titular (sem identificar revisor)", skipWithoutDb, async () => {
  const d = await agencyDraft();
  const up = await upload(d.c, d.path, await sharp({ create: { width: 300, height: 300, channels: 3, background: "#999" } }).png().toBuffer(), "image/png");
  const sub = await d.c.post(`${d.path}/submit`, { revision: up.body.data.property.revision });
  const mc = await loggedIn(await f.user({ roles: ["usuario", "administrador"] }));
  assert.equal((await mc.post(`/api/v1/admin/properties/${d.id}/reject`, { revision: sub.body.data.revision })).status, 422);
  assert.equal((await mc.post(`/api/v1/admin/properties/${d.id}/reject`, { revision: sub.body.data.revision, reason: "curto" })).status, 422);
  const rej = await mc.post(`/api/v1/admin/properties/${d.id}/reject`, { revision: sub.body.data.revision, reason: "Foto não corresponde ao tipo de imóvel informado." });
  assert.equal(rej.status, 200);
  assert.equal(rej.body.data.status, "rejeitado");
  const hist = await d.c.get(`${d.path}/history`);
  const entry = hist.body.data.find(h => h.action === "reject");
  assert.equal(entry.reason, "Foto não corresponde ao tipo de imóvel informado.");
  assert.equal(entry.actor, "moderacao");
  assert.doesNotMatch(JSON.stringify(hist.body), /atorId|@exemplo/);
  const edited = await d.c.patch(d.path, { title: "Imóvel corrigido após rejeição", revision: rej.body.data.revision });
  assert.equal(edited.body.data.status, "rascunho");
  assert.equal((await d.c.post(`${d.path}/submit`, { revision: edited.body.data.revision })).body.data.status, "em_analise");
  const susp = await mc.post(`/api/v1/admin/properties/${d.id}/suspend`, { revision: edited.body.data.revision + 1, reason: "Suspensão sintética para teste de fluxo." });
  assert.equal(susp.body.data.status, "suspenso");
  assert.equal((await d.c.post(`${d.path}/archive`, { revision: susp.body.data.revision })).status, 409, "titular não sai de suspenso");
});

test("produção sem MFA bloqueia moderação (RN-A04)", skipWithoutDb, async () => {
  const locked = await startApi(prisma, { requireMfaForModeration: true });
  try {
    const u = await f.user({ roles: ["usuario", "moderador"] });
    const c = locked.client();
    await c.login(u.email, PASSWORD);
    const r = await c.get("/api/v1/admin/property-submissions");
    assert.equal(r.status, 403);
    assert.match(r.body.error.message, /MFA/);
  } finally { await locked.close(); }
});
