import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../backend/src/app.js";
import { readRuntimeConfig } from "../backend/src/config/env.js";

async function request(app, path, init) {
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => {
      if (server.listening) resolve();
      else { server.once("listening", resolve); server.once("error", reject); }
    });
    const { port } = server.address();
    const response = await fetch("http://127.0.0.1:" + port + path, init);
    return { status: response.status, headers: response.headers, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
}

test("GET /api/v1/health retorna 200 sem depender do banco", async () => {
  const r = await request(createApp(), "/api/v1/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, "ok");
  assert.match(r.headers.get("x-request-id"), /^[\da-f-]{36}$/);
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("GET /api/v1/ready retorna 503 sem conexão", async () => {
  const r = await request(createApp(), "/api/v1/ready");
  assert.equal(r.status, 503);
  assert.equal(r.body.error.code, "SERVICE_UNAVAILABLE");
  assert.ok(r.body.error.requestId);
});

test("GET /api/v1/ready retorna 200 com conexão válida", async () => {
  const r = await request(createApp({ database: { ping: async () => true } }), "/api/v1/ready");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, "ready");
});

test("Falha de banco retorna erro genérico sem vazar segredo", async () => {
  const r = await request(createApp({ database: { ping: async () => {
    throw new Error("password: super-secreto-host-interno");
  } } }), "/api/v1/ready");
  assert.equal(r.status, 503);
  assert.doesNotMatch(JSON.stringify(r.body), /super-secreto|password|host-interno/);
});

test("Rota inexistente retorna 404 estruturado", async () => {
  const r = await request(createApp(), "/api/v1/nao-existe");
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, "NOT_FOUND");
});

test("Porta inválida falha explicitamente", () => {
  for (const PORT of ["0", "65536", "foo", "-1", "80.5"]) {
    assert.throws(() => readRuntimeConfig({ PORT }), /PORT inválida/);
  }
  assert.equal(readRuntimeConfig({ PORT: "3000" }).port, 3000);
});

test("Produção sem banco não inicializa silenciosamente", () => {
  assert.throws(() => readRuntimeConfig({ NODE_ENV: "production" }), /DATABASE_URL obrigatória/);
});
