import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DEMO_LISTINGS } from "../frontend/scripts/fixtures.js";
import {
  currency, monthlyTotal, filtersFromSearch, queryForFilters, filterAndSort,
  paginate, detailLink, safeBackToResults, findDemoListing, validateDemoDraft
} from "../frontend/scripts/catalog.js";
import { estimatedDemoCost } from "../frontend/scripts/partner.js";

test("toda a amostra é fictícia, finita e sem endereço completo, coordenadas ou contatos", () => {
  assert.ok(DEMO_LISTINGS.length >= 6);
  for (const item of DEMO_LISTINGS) {
    assert.match(item.id, /^demo-\d{3}$/);
    assert.ok(Number.isSafeInteger(item.rent));
    assert.ok(item.rent > 0);
    assert.ok(["centro", "outras"].includes(item.regionKey));
    assert.ok(["casa.svg", "apartamento.svg", "sobrado.svg"].includes(item.image));
    assert.ok(existsSync("frontend/assets/" + item.image));
    for (const key of ["address", "street", "latitude", "longitude", "phone", "email", "ownerId"]) {
      assert.equal(item[key], undefined, "Dado privado não permitido em " + item.id + ": " + key);
    }
  }
});

test("total mensal soma taxas conhecidas sem converter desconhecidas em zero", () => {
  assert.equal(monthlyTotal({ rent: 1850, condominium: 0, iptu: 95, feePeriod: "mensal" }), 1945);
  assert.equal(monthlyTotal({ rent: 1850, condominium: null, iptu: 95, feePeriod: "mensal" }), null);
  assert.equal(monthlyTotal({ rent: 1850, condominium: 0, iptu: null, feePeriod: "mensal" }), null);
  assert.equal(monthlyTotal({ rent: 1850, condominium: 0, iptu: 95, feePeriod: "anual" }), null);
  assert.equal(monthlyTotal({ rent: 1850, condominium: -1, iptu: 95, feePeriod: "mensal" }), null);
  assert.match(currency(1945), /1\.945/);
  assert.equal(currency(NaN), "A confirmar");
});

test("URL inválida não injeta filtros desconhecidos nem converte números negativos", () => {
  const f = filtersFromSearch("?tipo=carro&regiao=http://evil&ate=-100&quartos=999&pagina=-9&ordem=script");
  assert.deepEqual(f, { region: "", type: "", maxRent: 0, minRooms: 0, sort: "recentes", page: 1 });
  assert.equal(queryForFilters(f), "");
  assert.equal(filtersFromSearch("?regiao=centro&tipo=casa&ate=2000&quartos=2&pagina=3").page, 3);
});

test("filtros combinados, ordenação e paginação são determinísticos", () => {
  const f = filtersFromSearch("?regiao=centro&tipo=casa&ate=2000&quartos=1");
  const result = filterAndSort(DEMO_LISTINGS, f);
  assert.equal(result.length, 2);
  assert.ok(result.every(x => x.regionKey === "centro" && x.type === "casa" && x.rent <= 2000));
  const cheap = filterAndSort(DEMO_LISTINGS, { ...filtersFromSearch(), sort: "menor-preco" });
  const expensive = filterAndSort(DEMO_LISTINGS, { ...filtersFromSearch(), sort: "maior-preco" });
  assert.ok(cheap[0].rent <= cheap.at(-1).rent);
  assert.ok(expensive[0].rent >= expensive.at(-1).rent);
  const first = paginate(DEMO_LISTINGS, 1);
  const second = paginate(DEMO_LISTINGS, 2);
  assert.equal(first.items.length, 3);
  assert.equal(second.items.length, 3);
  assert.notEqual(first.items[0].id, second.items[0].id);
  assert.equal(paginate(DEMO_LISTINGS, 999).current, 2);
  assert.equal(filterAndSort(DEMO_LISTINGS, { ...f, maxRent: 100 }).length, 0);
});

test("detalhe preserva filtros sem permitir redirecionamento externo", () => {
  const listing = DEMO_LISTINGS[0];
  const link = detailLink(listing, "?regiao=centro&tipo=casa&pagina=2");
  assert.match(link, /imovel\.html\?id=demo-001/);
  const url = new URL(link, "https://alugasr.example/frontend/");
  assert.match(safeBackToResults(url.search), /regiao=centro/);
  assert.equal(safeBackToResults("?voltar=https%3A%2F%2Fevil.test%2Fphishing"), "./imoveis.html");
  assert.equal(findDemoListing("demo-does-not-exist"), null);
});

test("formulário sintético diferencia rascunho de envio para análise", () => {
  const valid = {
    title: "Casa fictícia para teste", type: "casa", region: "centro",
    rent: "1800", description: "Descrição totalmente artificial e sem informações privadas."
  };
  assert.equal(validateDemoDraft(valid).valid, true);
  assert.equal(validateDemoDraft({ ...valid, title: "" }).valid, false);
  assert.equal(validateDemoDraft({ ...valid, type: "moderador" }).valid, false);
  assert.equal(validateDemoDraft({ ...valid, rent: "-1" }).valid, false);
  assert.equal(validateDemoDraft({ ...valid, description: "curta" }).valid, false);
  assert.equal(estimatedDemoCost({ rent: "2200", condominium: "0", iptu: "120" }), 2320);
  assert.equal(estimatedDemoCost({ rent: "2200", condominium: "", iptu: "120" }), null);
  assert.equal(estimatedDemoCost({ rent: "", condominium: "0", iptu: "120" }), null);
});

test("páginas públicas e painel existem e são rotulados como demonstração", () => {
  for (const file of ["index", "imoveis", "imovel", "como-anunciar", "painel", "seguranca"]) {
    const html = readFileSync("frontend/" + file + ".html", "utf8");
    assert.match(html, /noindex, nofollow/);
    assert.match(html, /SIMULAÇÃO ACADÊMICA/);
    assert.match(html, /FICTÍCIOS/);
    assert.match(html, /class="skip-link" href="#conteudo"/);
  }
  const partner = readFileSync("frontend/painel.html", "utf8");
  assert.match(partner, /Fotos \(desativado na demonstração\)/);
  assert.match(partner, /id="partner-feedback" class="feedback" role="status"/);
  assert.doesNotMatch(partner, /<form[^>]*action="/);
  const detail = readFileSync("frontend/imovel.html", "utf8");
  assert.match(detail, /contact-info-dialog/);
  assert.doesNotMatch(detail, /Reservar|Pagar agora/);
});

test("modelo não promove publicação automática nem autorização no cliente", () => {
  const js = readFileSync("frontend/scripts/partner.js", "utf8");
  assert.match(js, /sem autenticação, localStorage, upload ou API/);
  assert.match(js, /"Em análise"/);
  assert.doesNotMatch(js, /fetch\(|localStorage|sessionStorage/);
  assert.doesNotMatch(js, /\.innerHTML\s*=/);
});
