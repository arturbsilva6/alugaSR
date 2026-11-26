// Erros de aplicação com mensagem pública segura. Detalhes internos nunca
// vão para a resposta; `fields` contém apenas nome do campo e motivo.
export class AppError extends Error {
  constructor(status, code, message, { fields } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    if (fields?.length) this.fields = fields;
  }
}

export const errors = {
  validation: (fields, message = "Dados inválidos") => new AppError(422, "VALIDATION_ERROR", message, { fields }),
  unauthenticated: () => new AppError(401, "UNAUTHENTICATED", "Autenticação necessária"),
  forbidden: (message = "Acesso negado") => new AppError(403, "FORBIDDEN", message),
  csrf: () => new AppError(403, "CSRF_INVALID", "Token de proteção ausente ou inválido"),
  notFound: () => new AppError(404, "NOT_FOUND", "Recurso não encontrado"),
  gone: () => new AppError(410, "PROPERTY_UNAVAILABLE", "Este anúncio não está mais disponível"),
  conflict: (message = "O recurso foi alterado ou está em estado incompatível") => new AppError(409, "CONFLICT", message),
  invalidTransition: (message = "Transição de estado não permitida") => new AppError(409, "INVALID_STATE_TRANSITION", message),
  tooLarge: () => new AppError(413, "PAYLOAD_TOO_LARGE", "Conteúdo muito grande"),
  unsupportedMedia: (message = "Formato não aceito") => new AppError(415, "UNSUPPORTED_MEDIA_TYPE", message),
  rateLimited: () => new AppError(429, "RATE_LIMITED", "Muitas tentativas. Aguarde e tente novamente."),
  invalidCredentials: () => new AppError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos"),
  featureDisabled: () => new AppError(404, "NOT_FOUND", "Recurso não encontrado"),
  unavailable: () => new AppError(503, "SERVICE_UNAVAILABLE", "Serviço temporariamente indisponível")
};
