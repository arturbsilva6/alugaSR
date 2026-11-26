import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../backend/src/app.js";
import { readRuntimeConfig } from "../../backend/src/config/env.js";
import { createLocalStorage } from "../../backend/src/storage/localStorage.js";

// Sobe a API em porta efêmera, com armazenamento temporário isolado.
export async function startApi(prisma, overrides = {}) {
  const storageDir = await mkdtemp(join(tmpdir(), "alugasr-test-"));
  const base = readRuntimeConfig({ NODE_ENV: "test", SESSION_SECRET: "segredo-de-teste-sintetico-com-32-caracteres", APP_ORIGINS: "http://app.alugasr.test" });
  const config = { ...base, storage: { driver: "local", localDir: storageDir },
    rateLimits: { ...base.rateLimits, loginPerIpPer15Min: 10_000, loginPerIpPerMinute: 10_000 }, ...overrides };
  const storage = createLocalStorage(storageDir);
  const database = { prisma, ping: async () => true, close: async () => {} };
  const server = createApp({ database, config, storage }).listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url, config, storage, storageDir,
    client: () => createClient(url),
    async close() {
      await new Promise(resolve => server.close(resolve));
      await rm(storageDir, { recursive: true, force: true });
    }
  };
}

export function createClient(url) {
  let cookie = null;
  let csrf = null;
  async function request(method, path, { json, body, headers = {}, raw = false } = {}) {
    const h = { ...headers };
    if (cookie) h.cookie = cookie;
    if (csrf && !("x-csrf-token" in h) && method !== "GET") h["x-csrf-token"] = csrf;
    if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
    const res = await fetch(url + path, { method, headers: h, body, redirect: "manual" });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const pair = setCookie.split(";")[0];
      cookie = /=\s*$/.test(pair) || /Expires=Thu, 01 Jan 1970/i.test(setCookie) ? null : pair;
    }
    const type = res.headers.get("content-type") ?? "";
    const data = raw ? Buffer.from(await res.arrayBuffer()) : type.includes("json") ? await res.json() : await res.text();
    return { status: res.status, headers: res.headers, body: data, setCookie };
  }
  return {
    request,
    get: (p, o) => request("GET", p, o),
    post: (p, json, o = {}) => request("POST", p, { json, ...o }),
    patch: (p, json, o = {}) => request("PATCH", p, { json, ...o }),
    del: (p, o) => request("DELETE", p, o),
    async login(email, password) {
      const r = await request("POST", "/api/v1/auth/login", { json: { email, password } });
      if (r.status === 200) csrf = r.body.data.csrfToken;
      return r;
    },
    get csrf() { return csrf; },
    set csrf(v) { csrf = v; },
    get cookie() { return cookie; },
    set cookie(v) { cookie = v; }
  };
}
