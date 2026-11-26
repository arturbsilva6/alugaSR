import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { parseMoney, sumMoney, compareMoney, formatDecimal } from "../backend/src/lib/money.js";
import { createCursorCodec } from "../backend/src/lib/cursor.js";
import { hashPassword, verifyPassword, passwordProblems } from "../backend/src/lib/password.js";
import { pricing } from "../backend/src/lib/presenters.js";
import { detectImageType, processImage, ImageRejectedError } from "../backend/src/media/imageProcessor.js";
import { readFeatureFlags } from "../backend/src/config/features.js";
import { readRuntimeConfig } from "../backend/src/config/env.js";
import { parsePropertyInput, OWNER_TRANSITIONS, EDITABLE_STATUSES } from "../backend/src/services/partnerPropertyService.js";
import { parseSearchQuery } from "../backend/src/services/publicPropertyService.js";
import { createRateLimiter } from "../backend/src/lib/rateLimit.js";
import { parseCookies } from "../backend/src/middlewares/auth.js";

test("ADR-005: dinheiro como string decimal exata, sem float", () => {
  assert.deepEqual(parseMoney("1500"), { ok: true, value: "1500.00" });
  assert.deepEqual(parseMoney("1500.5"), { ok: true, value: "1500.50" });
  for (const bad of [1500, "1.500,00", "-1", "1e3", "NaN", "1500.001", " 10", "01", ""]) assert.equal(parseMoney(bad).ok, false, String(bad));
  assert.equal(sumMoney(["1850.00", "0.00", "95.00"]), "1945.00"); // QA-02
  assert.equal(sumMoney(["0.10", "0.20"]), "0.30");
  assert.equal(sumMoney(["1650.00", null, "0.00"]), null);
  assert.equal(compareMoney("10.00", "9.99"), 1);
  assert.equal(formatDecimal(null), null);
});

test("UI-05: total mensal só com encargos conhecidos; nulo não vira zero", () => {
  assert.equal(pricing({ valorAluguel: "1850.00", valorCondominio: "0.00", valorIptu: "95.00" }).monthlyTotal, "1945.00");
  assert.equal(pricing({ valorAluguel: "1650.00", valorCondominio: null, valorIptu: "0.00" }).monthlyTotal, null);
});

test("cursor opaco assinado rejeita adulteração", () => {
  const codec = createCursorCodec("segredo");
  const c = codec.encode({ s: "newest", k: "x", id: "1" });
  assert.deepEqual(codec.decode(c), { s: "newest", k: "x", id: "1" });
  const [payload] = c.split(".");
  const forged = Buffer.from(JSON.stringify({ s: "newest", k: "y", id: "1" })).toString("base64url") + "." + c.split(".")[1];
  assert.equal(codec.decode(forged), null);
  assert.equal(codec.decode(payload), null);
  assert.equal(createCursorCodec("outro").decode(c), null);
});

test("Argon2id: hash PHC, verificação e senha errada", async () => {
  const h = await hashPassword("uma-senha-sintetica-longa");
  assert.match(h, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verifyPassword("uma-senha-sintetica-longa", h), true);
  assert.equal(await verifyPassword("outra-senha-qualquer", h), false);
  assert.equal(await verifyPassword("x", "texto-invalido"), false);
  assert.notEqual(await hashPassword("a-mesma-senha-123"), await hashPassword("a-mesma-senha-123"));
  assert.ok(passwordProblems("curta").length > 0);
  assert.deepEqual(passwordProblems("frase-secreta-adequada"), []);
});

test("detecção de tipo real por assinatura (magic bytes)", async () => {
  const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#cc0000" } }).png().toBuffer();
  const jpg = await sharp(png).jpeg().toBuffer();
  const webp = await sharp(png).webp().toBuffer();
  assert.equal(detectImageType(png), "image/png");
  assert.equal(detectImageType(jpg), "image/jpeg");
  assert.equal(detectImageType(webp), "image/webp");
  assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(detectImageType(Buffer.from("GIF89a................")), null);
  assert.equal(detectImageType(Buffer.from("MZ\x90\x00executavel........")), null);
});

test("CT-07: reprocessamento remove EXIF/GPS e recusa MIME divergente", async () => {
  const jpg = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#336699" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "MARCA-EXIF-SINTETICA", Artist: "Pessoa Sintetica" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 31/1 0/1" } })
    .toBuffer();
  assert.ok((await sharp(jpg).metadata()).exif, "fixture deve conter EXIF");
  assert.ok(jpg.includes(Buffer.from("MARCA-EXIF-SINTETICA")));
  const out = await processImage(jpg, { declaredType: "image/jpeg" });
  for (const variant of Object.values(out.derived)) {
    const meta = await sharp(variant).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.exif, undefined);
    assert.equal(meta.xmp, undefined);
    assert.equal(variant.includes(Buffer.from("MARCA-EXIF-SINTETICA")), false);
  }
  await assert.rejects(processImage(jpg, { declaredType: "image/png" }), e => e instanceof ImageRejectedError && e.reason === "tipo_declarado_divergente");
  const tiny = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#000" } }).png().toBuffer();
  await assert.rejects(processImage(tiny, {}), e => e.reason === "dimensoes_insuficientes");
  const truncated = jpg.subarray(0, 200);
  await assert.rejects(processImage(truncated, { declaredType: "image/jpeg" }), e => e instanceof ImageRejectedError);
  const huge = await sharp({ create: { width: 4000, height: 4000, channels: 3, background: "#fff" } }).png().toBuffer();
  await assert.rejects(processImage(huge, { maxInputPixels: 1_000_000 }), e => e.reason === "imagem_invalida_ou_grande_demais");
});

test("feature flags desligadas por padrão e proibidas em produção", () => {
  const flags = readFeatureFlags({});
  assert.ok(Object.values(flags).every(v => v === false));
  assert.equal(readFeatureFlags({ FEATURE_FAVORITES: "true" }).favorites, true);
  assert.throws(() => readFeatureFlags({ NODE_ENV: "production", FEATURE_CHAT: "true" }), /não pode ser ativada em produção/);
});

test("configuração de produção falha fechada (segredo, cookie Secure, storage)", () => {
  const prod = { NODE_ENV: "production", DATABASE_URL: "postgresql://x" };
  assert.throws(() => readRuntimeConfig(prod), /SESSION_SECRET/);
  assert.throws(() => readRuntimeConfig({ ...prod, SESSION_SECRET: "x".repeat(40), COOKIE_SECURE: "false" }), /COOKIE_SECURE/);
  assert.throws(() => readRuntimeConfig({ ...prod, SESSION_SECRET: "x".repeat(40), APP_ORIGINS: "https://alugasr.example" }), /Storage de produção pendente/);
  const dev = readRuntimeConfig({});
  assert.equal(dev.cookieSecure, false);
  assert.equal(dev.demoMode, true);
  assert.equal(dev.features.publicRegistration, false);
});

test("validação de anúncio: allowlist (mass assignment) e limites", () => {
  assert.throws(() => parsePropertyInput({ status: "publicado" }, { requireRevision: false }), e => e.fields.some(f => f.field === "status"));
  assert.throws(() => parsePropertyInput({ anuncianteId: "x", imobiliariaId: "y" }, { requireRevision: false }), e => e.fields.length === 2);
  assert.throws(() => parsePropertyInput({ rent: -1 }, { requireRevision: false }), e => e.fields[0].field === "rent");
  assert.throws(() => parsePropertyInput({ rent: "-10.00" }, { requireRevision: false }));
  assert.throws(() => parsePropertyInput({ areaM2: "0" }, { requireRevision: false }));
  assert.throws(() => parsePropertyInput({ bedrooms: 2.5 }, { requireRevision: false }));
  assert.throws(() => parsePropertyInput({ title: "x" }, { requireRevision: true }), e => e.fields.some(f => f.field === "revision"));
  assert.throws(() => parsePropertyInput({ address: { neighborhoodId: "00000000-0000-4000-8000-000000000000", latitude: "-23.5" } }, { requireRevision: false }),
    e => e.fields.some(f => f.field === "address.latitude"));
  const ok = parsePropertyInput({ title: "  Casa de teste ok  ", rent: "1500", bedrooms: 0 }, { requireRevision: false });
  assert.equal(ok.title, "Casa de teste ok");
  assert.equal(ok.rent, "1500.00");
  assert.equal(ok.bedrooms, 0);
});

test("ADR-004: grafo de estados do titular não permite autopublicação", () => {
  for (const t of Object.values(OWNER_TRANSITIONS)) assert.notEqual(t.from.includes("em_analise") && t.to === "publicado", true);
  assert.deepEqual(OWNER_TRANSITIONS.submit.from, ["rascunho", "rejeitado"]);
  assert.equal(OWNER_TRANSITIONS.submit.to, "em_analise");
  assert.ok(!EDITABLE_STATUSES.includes("publicado"));
  assert.ok(!EDITABLE_STATUSES.includes("em_analise"));
  assert.ok(!Object.values(OWNER_TRANSITIONS).some(t => t.to === "suspenso" || t.from.includes("suspenso")));
});

test("busca: parâmetros desconhecidos, popular/distance e SQLi são recusados", () => {
  const codec = createCursorCodec("s");
  assert.throws(() => parseSearchQuery({ sort: "popular" }, codec), e => e.status === 422);
  assert.throws(() => parseSearchQuery({ sort: "distance" }, codec));
  assert.throws(() => parseSearchQuery({ neighborhood: "centro' OR '1'='1" }, codec));
  assert.throws(() => parseSearchQuery({ status: "rascunho" }, codec), e => e.fields[0].field === "status");
  assert.throws(() => parseSearchQuery({ pageSize: "1000" }, codec));
  assert.throws(() => parseSearchQuery({ minPrice: "3000.00", maxPrice: "1000.00" }, codec));
  assert.equal(parseSearchQuery({}, codec).pageSize, 12);
});

test("limitador e parser de cookies", () => {
  const l = createRateLimiter({ windowMs: 1000, max: 2 });
  assert.equal(l.consume("k", 0), true);
  assert.equal(l.consume("k", 1), true);
  assert.equal(l.consume("k", 2), false);
  assert.equal(l.consume("k", 2000), true);
  assert.deepEqual(parseCookies("a=1; b=2; a=3"), { a: "1", b: "2" });
});
