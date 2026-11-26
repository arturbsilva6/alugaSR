// Feature flags — TODAS desligadas por padrão. Recursos que dependem de
// aprovações externas pendentes (seção 33.5) não podem ser ligados em produção
// sem o aceite formal correspondente; a ativação é apenas técnica/sintética.
export const FEATURE_CATALOG = Object.freeze({
  publicRegistration: { env: "FEATURE_PUBLIC_REGISTRATION", blockedBy: "Gate C1 / EXT-04 / EXT-08 (cadastro de pessoas reais)" },
  favorites: { env: "FEATURE_FAVORITES", blockedBy: "Fora do MVP (seção 37.1); exige priorização formal" },
  chat: { env: "FEATURE_CHAT", blockedBy: "EXT-09 e política de retenção (EXT-04)" },
  reviews: { env: "FEATURE_REVIEWS", blockedBy: "EXT-07 (elegibilidade/moderação de avaliações)" },
  popularSort: { env: "FEATURE_POPULAR_SORT", blockedBy: "ADR-007 / DEC-006 (métrica antifraude inexistente)" }
});

export function readFeatureFlags(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const flags = {};
  for (const [name, { env: variable, blockedBy }] of Object.entries(FEATURE_CATALOG)) {
    const enabled = env[variable] === "true";
    if (enabled && isProduction) {
      throw new Error(`${variable} não pode ser ativada em produção: bloqueada por ${blockedBy}`);
    }
    flags[name] = enabled;
  }
  return Object.freeze(flags);
}
