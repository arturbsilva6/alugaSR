// Verificação de segredos nos arquivos versionados (MVP-002 / SEC-011).
// Complementa — não substitui — o secret scanning do GitHub. Sem dependências.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const RULES = [
  ["chave privada", /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ["AWS access key", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["token GitHub", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ["token Slack", /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/],
  ["chave Stripe/OpenAI/Anthropic", /\b(sk_live_[A-Za-z0-9]{20,}|sk-(proj|ant)-[A-Za-z0-9_-]{20,})\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/]
];
// Senhas em URLs de conexão só são aceitas se forem os valores FICTÍCIOS documentados.
const FICTITIOUS = new Set(["senha-ficticia", "ci_ficticia_sem_dados_reais", "senha"]);
const DB_URL = /postgres(?:ql)?:\/\/[^:\s/]+:([^@\s]+)@/g;

const findings = [];
for (const file of files) {
  if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith(".env.example")) findings.push([file, "arquivo .env versionado"]);
  if (/package-lock\.json$|\.(png|jpe?g|webp|gif|ico|svg|woff2?|docx|zip)$/i.test(file)) continue;
  let text;
  try { if (statSync(file).size > 2_000_000) continue; text = readFileSync(file, "utf8"); } catch { continue; }
  for (const [name, re] of RULES) if (re.test(text)) findings.push([file, name]);
  for (const m of text.matchAll(DB_URL)) if (!FICTITIOUS.has(m[1]) && !m[1].startsWith("$")) findings.push([file, "senha não fictícia em URL de banco"]);
}
if (findings.length) {
  for (const [file, name] of findings) console.error(`Possível segredo: ${file} (${name})`);
  process.exit(1);
}
console.info(`Varredura de segredos: ${files.length} arquivos versionados, nenhum achado.`);
