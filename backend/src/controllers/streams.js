// Envia derivado de imagem com cabeçalhos seguros (seção 19.2): tipo correto,
// nosniff e exibição inline; cache conforme o escopo (público ou privado).
export function sendImage(res, stream, { cache }) {
  res.set({
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Cache-Control": cache,
    "Cross-Origin-Resource-Policy": "same-origin"
  });
  stream.on("error", () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
  stream.pipe(res);
}
