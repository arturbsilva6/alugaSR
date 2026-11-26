import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  liveFiltersFromSearch, liveQuery, apiSearchQuery, liveDetailLink, liveBack, formatBRL,
  toApiDecimal, fromApiDecimal, allowedActions, safeReturnPage, statusLabel
} from "../frontend/scripts/live-catalog.js";
import { safePhotoUrl } from "../frontend/scripts/dom.js";

const ID = "0e7bcb9a-c041-526b-820b-d466b55dc4b9";

test("filtros de URL são normalizados por padrões permitidos", () => {
  const f = liveFiltersFromSearch("?regiao=centro-exemplo&tipo=casa&ate=2000&quartos=2&ordem=menor-preco&cursor=abc.defghijklmnop");
  assert.deepEqual(f, { region: "centro-exemplo", type: "casa", maxRent: 2000, minRooms: 2, sort: "menor-preco", cursor: "abc.defghijklmnop" });
  const bad = liveFiltersFromSearch("?regiao=<script>&tipo=../x&ate=-1&quartos=99&ordem=popular&cursor=javascript:alert(1)");
  assert.deepEqual(bad, { region: "", type: "", maxRent: 0, minRooms: 0, sort: "recentes", cursor: "" });
  assert.equal(liveQuery(f, { includeCursor: false }), "regiao=centro-exemplo&tipo=casa&ate=2000&quartos=2&ordem=menor-preco");
});

test("consulta à API usa nomes do contrato e dinheiro como string decimal", () => {
  const q = new URLSearchParams(apiSearchQuery(liveFiltersFromSearch("?regiao=centro-exemplo&ate=1500&quartos=3&ordem=maior-preco")));
  assert.equal(q.get("neighborhood"), "centro-exemplo");
  assert.equal(q.get("maxPrice"), "1500.00");
  assert.equal(q.get("bedrooms"), "3");
  assert.equal(q.get("sort"), "price_desc");
  assert.equal(q.get("sort") === "popular", false);
});

test("links de detalhe preservam filtros e voltar não aceita URL externa", () => {
  const link = liveDetailLink(ID, "?regiao=centro-exemplo&quartos=2");
  assert.match(link, /^\.\/imovel\.html\?id=0e7bcb9a/);
  assert.equal(liveBack(new URL(link, "http://x/").search), "./imoveis.html?regiao=centro-exemplo&quartos=2");
  assert.equal(liveBack("?voltar=https://malicioso.example"), "./imoveis.html");
  assert.equal(liveDetailLink("javascript:alert(1)").includes("javascript"), false);
});

test("formatação e conversão monetária sem cálculo em ponto flutuante", () => {
  assert.match(formatBRL("1850.00"), /R\$\s1\.850,00/);
  assert.equal(formatBRL(null), "A confirmar");
  assert.equal(formatBRL("NaN"), "A confirmar");
  assert.equal(toApiDecimal("1.850,50"), "1850.50");
  assert.equal(toApiDecimal("1850,5"), "1850.50");
  assert.equal(toApiDecimal("1850"), "1850.00");
  assert.equal(toApiDecimal("R$ 950"), "950.00");
  assert.equal(toApiDecimal(""), null);
  for (const bad of ["abc", "-10", "1,2,3", "1e3"]) assert.equal(toApiDecimal(bad), undefined, bad);
  assert.equal(fromApiDecimal("1850.50"), "1850,50");
});

test("ações exibidas espelham o grafo do servidor e não incluem publicação", () => {
  assert.deepEqual(allowedActions("rascunho"), ["edit", "submit", "archive"]);
  assert.deepEqual(allowedActions("em_analise"), []);
  assert.deepEqual(allowedActions("suspenso"), []);
  for (const s of ["rascunho", "rejeitado", "publicado", "pausado", "alugado"]) assert.ok(!allowedActions(s).includes("publish"));
  assert.equal(statusLabel("xyz"), "Desconhecido");
});

test("redirecionamento pós-login restrito e URLs de foto apenas da própria API", () => {
  assert.equal(safeReturnPage("moderacao.html"), "./moderacao.html");
  assert.equal(safeReturnPage("https://malicioso.example"), "./parceiro.html");
  assert.equal(safeReturnPage("//malicioso.example"), "./parceiro.html");
  assert.equal(safePhotoUrl(`/api/v1/properties/${ID}/photos/${ID}/thumb`), `/api/v1/properties/${ID}/photos/${ID}/thumb`);
  assert.equal(safePhotoUrl("https://cdn.malicioso.example/x.png"), null);
  assert.equal(safePhotoUrl("javascript:alert(1)"), null);
  assert.equal(safePhotoUrl(`/api/v1/properties/${ID}/photos/${ID}/original`), null);
});

test("scripts conectados não usam innerHTML nem guardam sessão no navegador", () => {
  for (const f of ["api.js", "dom.js", "portal-live.js", "partner-live.js", "moderation-live.js", "auth-page.js", "main.js"]) {
    const js = readFileSync(`frontend/scripts/${f}`, "utf8");
    assert.doesNotMatch(js, /\.innerHTML\s*=|insertAdjacentHTML|document\.write|eval\(/, f);
    assert.doesNotMatch(js, /\b(localStorage|sessionStorage)\s*\.|document\.cookie/, f);
  }
  const api = readFileSync("frontend/scripts/api.js", "utf8");
  assert.match(api, /credentials: "same-origin"/);
  assert.match(api, /X-CSRF-Token/);
});

test("páginas restritas existem, são noindex e não oferecem cadastro público", () => {
  for (const file of ["entrar", "parceiro", "moderacao"]) {
    const html = readFileSync(`frontend/${file}.html`, "utf8");
    assert.match(html, /noindex, nofollow/);
    assert.match(html, /class="skip-link" href="#conteudo"/);
    assert.match(html, /id="api-required"/);
    assert.doesNotMatch(html, /Pagar|Contrato|Análise de crédito|Cadastre-se/i);
  }
  const partner = readFileSync("frontend/parceiro.html", "utf8");
  assert.match(partner, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(partner, /Localização \(privada\)/);
  for (const m of partner.matchAll(/<(input|select|textarea)\b[^>]*\bid="([^"]+)"/g)) {
    assert.match(partner, new RegExp(`for="${m[2]}"|aria-label`), `campo sem rótulo: ${m[2]}`);
  }
});
