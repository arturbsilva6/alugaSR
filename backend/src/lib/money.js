// ADR-005: valores monetários trafegam como string decimal com duas casas
// ("1500.00"), sem separador de milhar, prefixo ou notação científica.
const DECIMAL = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

export function parseMoney(value) {
  if (typeof value !== "string" || !DECIMAL.test(value)) return { ok: false };
  const [int, frac = ""] = value.split(".");
  return { ok: true, value: `${int}.${frac.padEnd(2, "0")}` };
}

export function formatDecimal(value) {
  if (value === null || value === undefined) return null;
  // Prisma Decimal (decimal.js) preserva precisão; nunca converte para float.
  return typeof value === "string" ? value : value.toFixed(2);
}

// Soma exata em centavos (inteiros), somente para valores conhecidos.
export function sumMoney(values) {
  if (values.some(v => v === null || v === undefined)) return null;
  let cents = 0n;
  for (const v of values) {
    const [int, frac = "00"] = formatDecimal(v).split(".");
    cents += BigInt(int) * 100n + BigInt(frac.padEnd(2, "0").slice(0, 2));
  }
  const s = cents.toString().padStart(3, "0");
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

export function compareMoney(a, b) {
  const toCents = v => { const [i, f] = v.split("."); return BigInt(i) * 100n + BigInt(f); };
  const x = toCents(a), y = toCents(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
