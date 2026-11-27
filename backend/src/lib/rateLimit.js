// Limitador em memória por janela fixa (RN-T07). Adequado a instância única de
// desenvolvimento/demonstração; produção exige armazenamento compartilhado (EXT-08).
export function createRateLimiter({ windowMs, max, maxKeys = 50_000 }) {
  const hits = new Map();
  function sweep(now) {
    if (hits.size < maxKeys) return;
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    if (hits.size >= maxKeys) hits.clear();
  }
  return {
    // Retorna false quando o limite foi excedido.
    consume(key, now = Date.now()) {
      sweep(now);
      const entry = hits.get(key);
      if (!entry || entry.reset <= now) { hits.set(key, { count: 1, reset: now + windowMs }); return true; }
      entry.count += 1;
      return entry.count <= max;
    },
    isBlocked(key, now = Date.now()) {
      const entry = hits.get(key);
      return Boolean(entry && entry.reset > now && entry.count >= max);
    },
    reset(key) { hits.delete(key); }
  };
}
