import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { initDemoDialogs } from "../frontend/scripts/ui.js";

const pages = [
  "frontend/index.html",
  "frontend/design-system.html",
  "frontend/componentes.html"
];
const htmls = pages.map(p => [p, readFileSync(p, "utf8")]);
const css = readFileSync("frontend/styles/components.css", "utf8");
const main = readFileSync("frontend/styles/main.css", "utf8");
const tokens = readFileSync("frontend/styles/tokens.css", "utf8");

test("shell semântico compartilhado em três páginas", () => {
  for (const [path, html] of htmls) {
    assert.match(html, /<html lang="pt-BR">/, path);
    assert.match(html, /<header class="site-header">/, path);
    assert.match(html, /<nav class="site-nav" aria-label="Navegação principal">/, path);
    assert.match(html, /<main id="conteudo"/, path);
    assert.match(html, /<footer class="site-footer">/, path);
    assert.match(html, /class="skip-link" href="#conteudo"/, path);
    assert.match(html, /name="robots" content="noindex, nofollow"/, path);
  }
});

test("links de páginas do shell apontam para arquivos presentes", () => {
  for (const [path, html] of htmls) {
    for (const [, href] of html.matchAll(/href="(\.\/[^"#?]+\.html)"/g)) {
      const fullPath = "frontend/" + href.slice(2);
      assert.ok(existsSync(fullPath), "Referência quebrada em " + path + ": " + href);
    }
  }
});

test("navegação usa aria-current apenas na página ativa", () => {
  for (const [path, html] of htmls) {
    const links = [...html.matchAll(/<a class="site-nav__link" href="([^"]+)"([^>]*)>/g)];
    assert.equal(links.length, 3, path);
    assert.equal(links.filter(x => x[2].includes('aria-current="page"')).length, 1, path);
    const active = links.find(x => x[2].includes('aria-current="page"'));
    assert.equal(active[1], "./" + path.split("/").at(-1));
  }
});

test("camada de componentes usa apenas tokens já declarados e sem hex isolado", () => {
  const declared = new Set([...tokens.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(x => x[1]));
  for (const [, name] of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
    assert.ok(declared.has(name), "Token desconhecido no CSS: " + name);
  }
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  assert.match(main, /@import url\("\.\/components\.css"\)/);
});

test("componentes possuem foco, toque, layout fluido e movimento reduzido", () => {
  assert.match(css, /\.site-nav__link\[aria-current="page"\]/);
  assert.match(css, /min-height:\s*var\(--control-min-height\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fit/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.modal::backdrop/);
  assert.match(css, /\.empty-state/);
});

test("vitrine mostra estados e controles rotulados sem formulário de envio", () => {
  const html = htmls.at(-1)[1];
  assert.match(html, /<dialog class="modal" id="exemplo-dialog"/);
  assert.match(html, /<form method="dialog"/);
  assert.match(html, /aria-labelledby="modal-titulo"/);
  assert.match(html, /for="bairro-demo"/);
  assert.match(html, /id="bairro-demo"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby="erro-demo"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /class="empty-state"/);
  assert.doesNotMatch(html, /<form[^>]+action=/);
  assert.doesNotMatch(html, /https?:\/\/(?:.+)\//);
});

class Trigger extends EventTarget {
  constructor(target) {
    super();
    this.target = target;
    this.isConnected = true;
    this.focused = 0;
  }
  getAttribute(name) { return name === "data-dialog-target" ? this.target : null; }
  focus() { this.focused++; }
  click() { this.dispatchEvent(new Event("click")); }
}
class Dialog extends EventTarget {
  constructor() { super(); this.tagName = "DIALOG"; this.open = false; this.openings = 0; }
  showModal() { this.open = true; this.openings++; }
  close() { this.open = false; this.dispatchEvent(new Event("close")); }
}

test("modal abre, ignora clique redundante, fecha e devolve foco ao acionador", () => {
  const trigger = new Trigger("demo-dialog");
  const dialog = new Dialog();
  const doc = { querySelectorAll: () => [trigger], getElementById: id => id === "demo-dialog" ? dialog : null };
  assert.equal(initDemoDialogs(doc), 1);
  trigger.click();
  assert.equal(dialog.open, true);
  trigger.click();
  assert.equal(dialog.openings, 1);
  dialog.close();
  assert.equal(dialog.open, false);
  assert.equal(trigger.focused, 1);
});

test("inicialização idempotente e múltiplos acionadores devolvem o foco correto", () => {
  const primeiro = new Trigger("dialog-shared");
  const segundo = new Trigger("dialog-shared");
  const dialog = new Dialog();
  const doc = {
    querySelectorAll: () => [primeiro, segundo],
    getElementById: id => id === "dialog-shared" ? dialog : null
  };
  assert.equal(initDemoDialogs(doc), 2);
  assert.equal(initDemoDialogs(doc), 0);
  primeiro.click();
  assert.equal(dialog.openings, 1);
  dialog.close();
  assert.equal(primeiro.focused, 1);
  segundo.click();
  assert.equal(dialog.openings, 2);
  dialog.close();
  assert.equal(segundo.focused, 1);
  assert.equal(primeiro.focused, 1);
});

test("referências inválidas de modal são ignoradas sem erros", () => {
  const invalid = new Trigger("../remote");
  const missing = new Trigger("nao-existe");
  const wrongTag = new Trigger("caixa");
  const doc = {
    querySelectorAll: () => [invalid, missing, wrongTag],
    getElementById: id => id === "caixa" ? { tagName: "DIV" } : null
  };
  assert.equal(initDemoDialogs(doc), 0);
  invalid.click(); missing.click(); wrongTag.click();
});

test("script de modal não usa innerHTML, eval, fetch ou credenciais", () => {
  const ui = readFileSync("frontend/scripts/ui.js", "utf8");
  assert.doesNotMatch(ui, /\.innerHTML|eval\(|\bfetch\(|localStorage|sessionStorage/);
  assert.match(ui, /dialog\.showModal\(\)/);
  assert.match(ui, /opener\.focus\(\)/);
});
