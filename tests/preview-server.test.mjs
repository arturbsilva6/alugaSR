import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewServer } from "../scripts/preview-frontend.mjs";

test("prévia atende somente arquivos do frontend, sem dados reais ou conteúdo de backend", async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = "http://127.0.0.1:" + address.port;
  try {
    for (const [path, expectedType] of [
      ["/", "text/html"], ["/imoveis.html", "text/html"],
      ["/painel.html", "text/html"], ["/styles/main.css", "text/css"],
      ["/scripts/catalog.js", "text/javascript"], ["/assets/casa.svg", "image/svg+xml"]
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.ok(response.headers.get("content-type").startsWith(expectedType));
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(response.headers.get("content-security-policy"), /script-src 'self'/);
      const body = await response.text();
      assert.ok(body.length > 0);
    }
    const home = await (await fetch(base + "/")).text();
    assert.match(home, /SIMULAÇÃO ACADÊMICA/);
    assert.match(home, /Encontre seu próximo/);
    const detail = await fetch(base + "/imovel.html?id=demo-001");
    assert.equal(detail.status, 200);

    const head = await fetch(base + "/index.html", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal((await head.text()).length, 0);

    const badPost = await fetch(base + "/", { method: "POST", body: "x" });
    assert.equal(badPost.status, 405);
    const traversal = await fetch(base + "/%2e%2e%2fREADME.md");
    assert.ok([400, 403, 404].includes(traversal.status));
    assert.doesNotMatch(await traversal.text(), /Plataforma web hiperlocal/);
    const backend = await fetch(base + "/backend/src/app.js");
    assert.equal(backend.status, 404);
    const missing = await fetch(base + "/nao-existe.html");
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
