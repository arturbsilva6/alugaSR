import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Apenas prévia local. Não inicia a API nem disponibiliza acesso externo.
const MIME = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
});
const SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'"
});

export function createPreviewServer(rootDir = resolve("frontend")) {
  const root = resolve(rootDir);
  return createServer(async (req, res) => {
    for (const [key, val] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, val);
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      res.end("Método não permitido");
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url || "/", "http://127.0.0.1").pathname);
    } catch {
      res.writeHead(400);
      res.end("Requisição inválida");
      return;
    }
    if (pathname.includes("\0") || pathname.includes("\\")) {
      res.writeHead(400);
      res.end("Caminho inválido");
      return;
    }
    const requested = pathname === "/" ? "/index.html" : pathname;
    const target = resolve(root, "." + requested);
    if (!target.startsWith(root + sep) && target !== root) {
      res.writeHead(403);
      res.end("Acesso negado");
      return;
    }
    const mime = MIME[extname(target).toLowerCase()];
    if (!mime) {
      res.writeHead(404);
      res.end("Arquivo não encontrado");
      return;
    }
    try {
      const actualRoot = await realpath(root);
      const actualTarget = await realpath(target);
      if (!actualTarget.startsWith(actualRoot + sep) || actualTarget === actualRoot) {
        res.writeHead(403);
        res.end("Acesso negado");
        return;
      }
      const content = await readFile(actualTarget);
      res.writeHead(200, { "Content-Type": mime, "Content-Length": content.length });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      res.writeHead(error?.code === "ENOENT" || error?.code === "EISDIR" ? 404 : 500);
      res.end("Arquivo indisponível");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createPreviewServer();
  server.listen(4173, "127.0.0.1", () => {
    console.info("Prévia local AlugaSR: http://127.0.0.1:4173/");
    console.info("Somente dados demonstrativos. Não disponibilizar a porta na rede pública.");
  });
}
