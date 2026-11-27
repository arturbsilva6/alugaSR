// E2E (MVP-015) com Chromium/Playwright sobre API + PostgreSQL de teste isolado.
// Jornadas: visitante (busca, filtros, detalhe, voltar), parceiro (login, rascunho,
// erro de validação, foto, envio), moderação (aprovação) e checagens de
// responsividade (320/390/768/1440), teclado e privacidade do HTML público.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import sharp from "sharp";
import { fixtures, skipWithoutDb, testPrisma, PASSWORD } from "../tests/helpers/db.mjs";
import { startApi } from "../tests/helpers/http.mjs";

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")); } catch { /* opcional */ }
const skip = skipWithoutDb.skip || (!chromium && "Playwright indisponível");
const prisma = skip ? null : testPrisma();
const f = prisma && fixtures(prisma);
let api, browser, ctx;

test.before(async () => {
  if (skip) return;
  api = await startApi(prisma);
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const c = await f.catalog();
  const owner = await f.user();
  const agency = await f.agency(owner);
  await f.member(agency, owner, "responsavel");
  const moderator = await f.user({ roles: ["usuario", "moderador"] });
  const pubs = [];
  for (const [i, rent] of ["1200.00", "2400.00", "3100.00"].entries()) {
    pubs.push(await f.property({ owner: agency, creator: owner, bairro: c.bairro, tipo: c.tipo, rent, bedrooms: i + 1, publishedAt: new Date(Date.now() - (3 - i) * 1000) }));
  }
  ctx = { c, owner, agency, moderator, pubs };
});
test.after(async () => { await browser?.close(); await api?.close(); await prisma?.$disconnect(); });

async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

test("visitante busca sem login, filtra por bairro/quartos, abre detalhe e volta com filtros", { skip }, async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${api.url}/imoveis.html?regiao=${ctx.c.bairro.slug}&quartos=2`);
  await page.waitForSelector("#results-grid .property-card");
  const count = await page.textContent("#results-count");
  assert.match(count, /^2 imóvel\(is\) encontrado\(s\)/);
  assert.equal(await page.inputValue("#f-regiao"), ctx.c.bairro.slug, "bairro vindo do catálogo da API");
  assert.equal(await page.locator("#results-grid .property-card").count(), 2);
  await page.locator("#results-grid .property-card__link").first().click();
  await page.waitForSelector("#detail-root h1");
  const html = await page.content();
  assert.doesNotMatch(html, /Rua Sintética Privada|Casa 9|-23\.529/, "endereço privado não chega ao HTML público");
  assert.match(await page.textContent(".detail-cost"), /Total mensal estimado/);
  await page.locator("#detail-root a", { hasText: "Voltar aos resultados" }).click();
  await page.waitForSelector("#results-grid .property-card");
  assert.match(page.url(), new RegExp(`regiao=${ctx.c.bairro.slug}`));
  assert.match(page.url(), /quartos=2/);
  assert.deepEqual(errors, []);
  await page.close();
});

test("anúncio inexistente ou indisponível mostra estado claro", { skip }, async () => {
  const page = await browser.newPage();
  await page.goto(`${api.url}/imovel.html?id=${crypto.randomUUID()}`);
  await page.waitForSelector("#detail-root .empty-state h1");
  assert.match(await page.textContent("#detail-root h1"), /não encontrado/);
  await page.goto(`${api.url}/imoveis.html?regiao=${ctx.c.bairro.slug}&ate=100`);
  await page.waitForSelector("#results-grid .empty-state");
  await page.close();
});

test("responsividade 320/390/768/1440 sem rolagem horizontal e teclado com skip-link", { skip }, async () => {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const path of ["/index.html", `/imoveis.html?regiao=${ctx.c.bairro.slug}`, `/imovel.html?id=${ctx.pubs[0].id}`, "/entrar.html", "/parceiro.html", "/moderacao.html"]) {
      await page.goto(api.url + path);
      await page.waitForLoadState("networkidle");
      assert.ok(await noHorizontalScroll(page), `scroll horizontal em ${width}px: ${path}`);
      assert.equal(await page.locator("h1:visible").count() >= 1 || path.includes("parceiro") || path.includes("moderacao"), true);
      const unlabeled = await page.evaluate(() => [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
        .filter(n => n.offsetParent !== null && !n.labels?.length && !n.getAttribute("aria-label")).map(n => n.id));
      assert.deepEqual(unlabeled, [], `campo sem rótulo em ${path}`);
      const noAlt = await page.evaluate(() => [...document.images].filter(i => !i.hasAttribute("alt")).length);
      assert.equal(noAlt, 0, `imagem sem alt em ${path}`);
    }
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto(`${api.url}/index.html`);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.className), "skip-link");
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none" || getComputedStyle(document.activeElement).boxShadow !== "none"), true);
  await page.close();
});

test("parceiro: login, rascunho com erro preservado, foto, envio; moderação aprova; visitante vê", { skip }, async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${api.url}/parceiro.html`);
  await page.waitForSelector("#auth-box:not([hidden])");
  await page.click("#auth-box a");
  await page.fill("#login-email", ctx.owner.email);
  await page.fill("#login-password", "senha-errada-123");
  await page.click("#login-form button[type=submit]");
  await page.waitForSelector("#login-feedback.status-message--error");
  await page.fill("#login-password", PASSWORD);
  await page.click("#login-form button[type=submit]");
  await page.waitForURL(/parceiro\.html/);
  await page.waitForSelector("#panel:not([hidden])");
  await page.click("#pf-new");
  await page.fill("#pf-title", "Casa E2E sintética com quintal");
  await page.fill("#pf-rent", "abc");
  await page.click("#pf-save");
  await page.waitForSelector('#err-rent:not([hidden])');
  assert.equal(await page.inputValue("#pf-title"), "Casa E2E sintética com quintal", "dados preservados após erro");
  await page.fill("#pf-rent", "1.950,00");
  await page.fill("#pf-condominium", "0");
  await page.fill("#pf-iptu", "50");
  assert.match(await page.textContent("#pf-total"), /2\.000,00/);
  await page.fill("#pf-bedrooms", "2");
  await page.fill("#pf-description", "Descrição sintética do teste E2E com tamanho suficiente.");
  await page.selectOption("#pf-propertyTypeId", ctx.c.tipo.id);
  await page.selectOption("#pf-neighborhoodId", ctx.c.bairro.id);
  await page.fill("#pf-street", "Rua E2E Privada");
  await page.click("#pf-save");
  await page.waitForSelector("#photos:not([hidden])");
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#3366aa" } }).png().toBuffer();
  await page.setInputFiles("#photo-input", { name: "foto.png", mimeType: "image/png", buffer: png });
  await page.waitForSelector("#photo-list img");
  await page.click("#pf-cancel");
  const row = page.locator("#props-rows tr", { hasText: "Casa E2E sintética" });
  await row.locator("button", { hasText: "Enviar para análise" }).click();
  await page.waitForSelector("#panel-feedback.status-message--success");
  await row.getByText("Em análise").waitFor();
  assert.deepEqual(errors, []);
  await context.close();

  const mctx = await browser.newContext();
  const mod = await mctx.newPage();
  await mod.goto(`${api.url}/entrar.html?voltar=moderacao.html`);
  await mod.fill("#login-email", ctx.moderator.email);
  await mod.fill("#login-password", PASSWORD);
  await mod.click("#login-form button[type=submit]");
  await mod.waitForURL(/moderacao\.html/);
  await mod.locator("#mod-rows tr", { hasText: "Casa E2E sintética" }).locator("button").click();
  await mod.waitForSelector("#mod-detail:not([hidden])");
  assert.match(await mod.textContent("#mod-facts"), /Rua E2E Privada/, "moderação vê endereço para validação");
  await mod.click('[data-decision="reject"]');
  await mod.waitForSelector("#mod-feedback.status-message--error");
  await mod.click('[data-decision="approve"]');
  await mod.waitForSelector("#mod-feedback.status-message--success");
  await mctx.close();

  const visitor = await browser.newPage();
  await visitor.goto(`${api.url}/imoveis.html?regiao=${ctx.c.bairro.slug}`);
  await visitor.waitForSelector("#results-grid .property-card");
  const card = visitor.locator(".property-card", { hasText: "Casa E2E sintética" });
  assert.equal(await card.count(), 1);
  assert.doesNotMatch(await visitor.content(), /Rua E2E Privada/);
  const img = await card.locator("img").getAttribute("src");
  assert.match(img, /^\/api\/v1\/properties\/[0-9a-f-]{36}\/photos\/[0-9a-f-]{36}\/thumb$/);
  await visitor.close();
});
