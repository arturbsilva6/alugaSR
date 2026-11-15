import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tokens = readFileSync("frontend/styles/tokens.css", "utf8");
const base = readFileSync("frontend/styles/base.css", "utf8");
const main = readFileSync("frontend/styles/main.css", "utf8");
const preview = readFileSync("frontend/design-system.html", "utf8");
const placeholder = readFileSync("frontend/index.html", "utf8");

function color(name) {
  const m = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(m, `Token obrigatório ausente: ${name}`);
  return m[1];
}
function linear(c) {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const v = [1, 3, 5].map(i => linear(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

test("todos os tokens utilizados existem e não há nomes duplicados", () => {
  const names = [...tokens.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(x => x[1]);
  assert.ok(names.length > 35);
  assert.equal(new Set(names).size, names.length);
  for (const match of (base + main).matchAll(/var\(\s*(--[\w-]+)/g)) {
    assert.ok(names.includes(match[1]), `Token não declarado: ${match[1]}`);
  }
});

test("somente tokens.css define cores hexadecimais", () => {
  for (const [name, contents] of [["base.css", base], ["main.css", main]]) {
    assert.doesNotMatch(contents, /#[0-9a-fA-F]{3,8}\b/, `Cor isolada em ${name}`);
  }
  assert.match(main, /@import url\("\.\/tokens\.css"\)/);
  assert.match(main, /@import url\("\.\/base\.css"\)/);
});

test("cor da marca e cor de interface são tokens distintos e provisórios", () => {
  assert.equal(color("color-brand-red").toUpperCase(), "#E30613");
  assert.equal(color("color-action-primary").toUpperCase(), "#B42318");
  assert.notEqual(color("color-brand-red"), color("color-action-primary"));
  assert.match(tokens, /UI-02/);
});

test("pares críticos atendem no mínimo 4.5:1 para texto comum", () => {
  const combinations = [
    ["color-action-primary", "color-action-on-primary"],
    ["color-action-primary-hover", "color-action-on-primary"],
    ["color-text", "color-page"],
    ["color-text-muted", "color-page"],
    ["color-warning", "color-warning-surface"],
    ["color-danger", "color-danger-surface"],
    ["color-focus", "color-surface"]
  ];
  for (const [foreground, background] of combinations) {
    const ratio = contrast(color(foreground), color(background));
    assert.ok(ratio >= 4.5, `${foreground} sobre ${background}: ${ratio.toFixed(2)}:1`);
  }
});

test("fundamentos incluem foco, alvo mínimo e movimento reduzido", () => {
  assert.match(base, /:focus-visible/);
  assert.match(base, /prefers-reduced-motion:\s*reduce/);
  assert.match(base, /min-height:\s*var\(--control-min-height\)/);
  assert.match(tokens, /--control-min-height:\s*2\.75rem/);
  assert.match(base, /\.skip-link:focus/);
});

test("prévia é explicitamente demonstrativa e preserva semântica de campos", () => {
  assert.match(preview, /<html lang="pt-BR">/);
  assert.match(preview, /Ir para o conteúdo/);
  assert.match(preview, /não existem imóveis|não existem anúncios|Nenhuma oferta|Nenhuma informação é enviada/i);
  assert.match(preview, /<label[^>]+for="bairro-exemplo"/);
  assert.match(preview, /id="bairro-exemplo"/);
  assert.match(preview, /<h1>/);
  assert.match(placeholder, /design-system\.html/);
});

test("HTML continua noindex durante a fase de protótipo", () => {
  for (const html of [preview, placeholder]) {
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.match(html, /href="\.\/styles\/main\.css"/);
  }
});
