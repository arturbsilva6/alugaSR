export function notFound(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Recurso não encontrado", requestId: req.id }
  });
}

export function safeError(error, req, res, _next) {
  // Nunca incluir stack trace, SQL, senha ou detalhes internos.
  const status = error?.type === "entity.parse.failed" ? 400
    : error?.type === "entity.too.large" ? 413 : 500;
  const code = status === 400 ? "INVALID_JSON" : status === 413 ? "PAYLOAD_TOO_LARGE" : "INTERNAL_ERROR";
  const message = status === 400 ? "JSON inválido"
    : status === 413 ? "Conteúdo muito grande" : "Erro interno";
  res.status(status).json({ error: { code, message, requestId: req.id } });
}
