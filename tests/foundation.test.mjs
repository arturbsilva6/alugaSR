import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("fundação contém módulos planejados de frontend, API e Prisma", () => {
  for (const path of [
    "frontend/index.html", "frontend/styles/main.css", "frontend/scripts/main.js",
    "backend/src/app.js", "backend/src/server.js", "prisma/schema.prisma",
    "prisma.config.ts", ".env.example", "package-lock.json"
  ]) {
    assert.ok(existsSync(path), "Arquivo obrigatório ausente: " + path);
  }
});

test("página inicial declara estado de desenvolvimento sem anúncios reais", () => {
  const html = readFileSync("frontend/index.html", "utf8");
  assert.match(html, /lang="pt-BR"/);
  assert.match(html, /<main\s+id="conteudo"/);
  assert.match(html, /SIMULAÇÃO ACADÊMICA/);
  assert.match(html, /IMÓVEIS, PREÇOS E CONTATOS FICTÍCIOS/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /href="#conteudo"/);
});

test("versões do runtime e dependências estão explicitadas", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.private, true);
  assert.match(pkg.engines.node, /26/);
  assert.equal(pkg.dependencies.express, "5.3.0");
  assert.equal(pkg.devDependencies.prisma, "7.10.1");
});
