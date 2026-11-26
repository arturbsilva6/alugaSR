import { errors } from "./errors.js";
import { parseMoney } from "./money.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Controles C0/C1 exceto \t \n \r; evita caracteres invisíveis de controle em textos.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const isUuid = v => typeof v === "string" && UUID.test(v);
export const isSlug = v => typeof v === "string" && v.length <= 160 && SLUG.test(v);

export function assertUuid(value) {
  if (!isUuid(value)) throw errors.notFound();
  return value.toLowerCase();
}

// Coletor de erros de validação por campo: mensagens genéricas, sem eco de valores.
export function createValidator() {
  const fields = [];
  return {
    fields,
    fail(field, reason) { fields.push({ field, reason }); },
    throwIfInvalid(message) { if (fields.length) throw errors.validation(fields, message); }
  };
}

export function rejectUnknownKeys(body, allowed, v, prefix = "") {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    v.fail(prefix || "body", "deve ser um objeto JSON");
    return false;
  }
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) v.fail(prefix + key, "campo não permitido");
  }
  return true;
}

export function text(v, field, value, { min = 0, max, nullable = true, multiline = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null) { if (!nullable) v.fail(field, "obrigatório"); return null; }
  if (typeof value !== "string") { v.fail(field, "deve ser texto"); return undefined; }
  const normalized = value.normalize("NFC").trim();
  if (CONTROL.test(normalized) || (!multiline && /[\r\n]/.test(normalized))) { v.fail(field, "contém caracteres não permitidos"); return undefined; }
  if (normalized.length < min || normalized.length > max) { v.fail(field, `deve ter entre ${min} e ${max} caracteres`); return undefined; }
  if (normalized.length === 0) return nullable ? null : (v.fail(field, "obrigatório"), undefined);
  return normalized;
}

export function integer(v, field, value, { min = 0, max = 50, nullable = true } = {}) {
  if (value === undefined) return undefined;
  if (value === null) { if (!nullable) v.fail(field, "obrigatório"); return null; }
  if (!Number.isSafeInteger(value) || value < min || value > max) { v.fail(field, `deve ser inteiro entre ${min} e ${max}`); return undefined; }
  return value;
}

export function money(v, field, value, { nullable = true } = {}) {
  if (value === undefined) return undefined;
  if (value === null) { if (!nullable) v.fail(field, "obrigatório"); return null; }
  const parsed = parseMoney(value);
  if (!parsed.ok) { v.fail(field, "use string decimal com até duas casas, ex.: \"1500.00\""); return undefined; }
  return parsed.value;
}

export function uuidField(v, field, value, { nullable = true } = {}) {
  if (value === undefined) return undefined;
  if (value === null) { if (!nullable) v.fail(field, "obrigatório"); return null; }
  if (!isUuid(value)) { v.fail(field, "identificador inválido"); return undefined; }
  return value.toLowerCase();
}

export function queryInteger(v, field, raw, { min, max }) {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || !/^\d{1,6}$/.test(raw)) { v.fail(field, `deve ser inteiro entre ${min} e ${max}`); return undefined; }
  const n = Number(raw);
  if (n < min || n > max) { v.fail(field, `deve ser inteiro entre ${min} e ${max}`); return undefined; }
  return n;
}
