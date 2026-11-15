import test from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "../backend/src/repositories/database.js";
import { createApp } from "../backend/src/app.js";

test("PostgreSQL real responde à verificação de prontidão", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const db = createDatabase(process.env.TEST_DATABASE_URL);
  assert.ok(db);
  try {
    assert.equal(await db.ping(), true);
    const app = createApp({ database: db });
    const server = app.listen(0, "127.0.0.1");
    try {
      await new Promise((resolve, reject) => {
        if (server.listening) resolve();
        else { server.once("listening", resolve); server.once("error", reject); }
      });
      const { port } = server.address();
      const response = await fetch("http://127.0.0.1:" + port + "/api/v1/ready");
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { data: { status: "ready" } });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally {
    await db.close();
  }
});
