import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Argon2id nativo do Node.js 26 (crypto.argon2), sem dependência externa.
// Parâmetros mínimos recomendados pela OWASP (m=19 MiB, t=2, p=1); calibrar
// em homologação conforme hardware (DEC-009). Formato PHC para portabilidade.
const argon2Async = promisify(argon2);
export const ARGON2_PARAMS = Object.freeze({ memory: 19456, passes: 2, parallelism: 1, tagLength: 32 });

export async function hashPassword(password, params = ARGON2_PARAMS) {
  const nonce = randomBytes(16);
  const tag = await argon2Async("argon2id", { message: password, nonce, ...params });
  return `$argon2id$v=19$m=${params.memory},t=${params.passes},p=${params.parallelism}$${nonce.toString("base64url")}$${tag.toString("base64url")}`;
}

export async function verifyPassword(password, encoded) {
  const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([\w-]+)\$([\w-]+)$/.exec(encoded ?? "");
  if (!m) return false;
  const expected = Buffer.from(m[5], "base64url");
  const tag = await argon2Async("argon2id", {
    message: password, nonce: Buffer.from(m[4], "base64url"),
    memory: Number(m[1]), passes: Number(m[2]), parallelism: Number(m[3]), tagLength: expected.length
  });
  return tag.length === expected.length && timingSafeEqual(tag, expected);
}

// Hash fixo usado para equalizar o tempo de resposta quando o e-mail não existe.
let dummyHash;
export async function dummyVerify(password) {
  dummyHash ??= await hashPassword("alugasr-dummy-password-never-valid");
  await verifyPassword(password, dummyHash);
  return false;
}

// Política mínima: 12–128 caracteres; bloqueia senhas triviais conhecidas.
// A verificação contra bases de senhas vazadas (RN-A03) fica PENDENTE (EXT-08).
const COMMON = new Set(["123456789012", "senha1234567", "password1234", "qwertyuiop12", "alugasr12345"]);
export function passwordProblems(password) {
  if (typeof password !== "string") return ["deve ser texto"];
  const problems = [];
  if (password.length < 12 || password.length > 128) problems.push("deve ter entre 12 e 128 caracteres");
  if (COMMON.has(password.toLowerCase())) problems.push("senha muito comum");
  if (/^(.)\1+$/.test(password)) problems.push("senha muito fraca");
  return problems;
}
