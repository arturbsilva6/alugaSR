import { AppError } from "../lib/errors.js";

export function notFound(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Recurso não encontrado", requestId: req.id }
  });
}

export function safeError(error, req, res, _next) {
  // Nunca incluir stack trace, SQL, senha ou detalhes internos.
  if (error instanceof AppError) {
    const body = { code: error.code, message: error.message, requestId: req.id };
    if (error.fields) body.fields = error.fields;
    if (error.status === 401 || error.status === 403) res.set("Cache-Control", "no-store");
    return res.status(error.status).json({ error: body });
  }
  // Violação de unicidade/integridade detectada pelo banco (ex.: corrida concorrente).
  if (error?.code === "P2002" || error?.code === "P2034") {
    return res.status(409).json({ error: { code: "CONFLICT", message: "Operação conflitante; tente novamente", requestId: req.id } });
  }
  const status = error?.type === "entity.parse.failed" ? 400
    : error?.type === "entity.too.large" ? 413 : 500;
  const code = status === 400 ? "INVALID_JSON" : status === 413 ? "PAYLOAD_TOO_LARGE" : "INTERNAL_ERROR";
  const message = status === 400 ? "JSON inválido"
    : status === 413 ? "Conteúdo muito grande" : "Erro interno";
  if (status === 500) {
    // Log técnico mínimo, sem payload, cookies ou mensagens do banco.
    console.error(JSON.stringify({ level: "error", requestId: req.id, method: req.method, route: req.route?.path ?? null, errorName: error?.name ?? "Error", prismaCode: error?.code ?? null }));
  }
  res.status(status).json({ error: { code, message, requestId: req.id } });
}
