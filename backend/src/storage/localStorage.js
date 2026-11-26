import { mkdir, readFile, rename, rm, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, resolve, sep } from "node:path";

// Adaptador de armazenamento LOCAL — somente desenvolvimento e testes (DEC-011).
// Chaves são geradas pelo servidor; nomes enviados pelo cliente nunca são usados.
// Áreas lógicas: quarantine/ (recebido, não processado), originals/ (privado),
// derived/ (derivados reprocessados; servidos apenas via API com autorização).
const KEY = /^(quarantine|originals|derived)\/[0-9a-f-]{36}(\/(thumb|detail)\.webp)?$/;

export function createLocalStorage(rootDir) {
  const root = resolve(rootDir);
  function pathFor(key) {
    if (!KEY.test(key)) throw new Error("Chave de armazenamento inválida");
    const full = resolve(root, key);
    if (!full.startsWith(root + sep)) throw new Error("Chave fora da raiz de armazenamento");
    return full;
  }
  return {
    async put(key, buffer) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, buffer, { mode: 0o600, flag: "wx" });
    },
    async move(fromKey, toKey) {
      const to = pathFor(toKey);
      await mkdir(dirname(to), { recursive: true, mode: 0o700 });
      await rename(pathFor(fromKey), to);
    },
    async get(key) { return readFile(pathFor(key)); },
    async exists(key) {
      try { return (await stat(pathFor(key))).isFile(); } catch { return false; }
    },
    stream(key) { return createReadStream(pathFor(key)); },
    async remove(key) { await rm(pathFor(key), { force: true }); },
    async removePrefix(prefix) {
      if (!/^derived\/[0-9a-f-]{36}$/.test(prefix)) throw new Error("Prefixo inválido");
      await rm(resolve(root, prefix), { recursive: true, force: true });
    }
  };
}
