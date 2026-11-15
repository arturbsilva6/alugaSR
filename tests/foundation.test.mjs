import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("fundação contém módulos planejados sem presumir backend ativo", () => {
  for (const path of ["frontend/index.html", "frontend/styles/main.css", "frontend/scripts/main.js", "backend/README.md", "prisma/README.md", ".env.example"]) {
    assert.ok(existsSync(path), `Arquivo obrigatório ausente: ${path}`);
  }
});

test("página inicial deixa explícito que não há anúncios nem login reais", () => {
  const html = readFileSync("frontend/index.html", "utf8");
  assert.match(html, /lang="pt-BR"/);
  assert.match(html, /<main\s+id="conteudo"/);
  assert.match(html, /Ainda não há anúncios, pesquisa, login ou serviços disponíveis/);
  assert.match(html, /href="#conteudo"/);
});

test("primeira etapa não declara dependências externas não instaladas", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.private, true);
  assert.equal(pkg.dependencies, undefined);
  assert.match(pkg.engines.node, /26/);
});
