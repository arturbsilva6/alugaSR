// Funções puras do modo conectado à API (sem DOM): filtros de URL, mapeamento
// para a API /api/v1, formatação monetária e regras de interface do painel.
// Toda entrada vinda da URL é normalizada por listas/padrões permitidos.
export const LIVE_SORTS = Object.freeze({ recentes: "newest", "menor-preco": "price_asc", "maior-preco": "price_desc" });
export const PAGE_SIZE = 9;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CURSOR = /^[A-Za-z0-9_-]{1,400}\.[A-Za-z0-9_-]{10,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = v => typeof v === "string" && UUID.test(v);
const slugOr = v => (typeof v === "string" && v.length <= 160 && SLUG.test(v) ? v : "");
function boundedInt(raw, min, max) {
  if (raw === null || !/^\d{1,6}$/.test(raw)) return 0;
  const n = Number(raw);
  return n >= min && n <= max ? n : 0;
}

export function liveFiltersFromSearch(search = "") {
  const p = new URLSearchParams(String(search).replace(/^\?/, ""));
  const sort = p.get("ordem");
  const cursor = p.get("cursor");
  return {
    region: slugOr(p.get("regiao")),
    type: slugOr(p.get("tipo")),
    maxRent: boundedInt(p.get("ate"), 100, 1_000_000),
    minRooms: boundedInt(p.get("quartos"), 1, 20),
    sort: Object.hasOwn(LIVE_SORTS, sort ?? "") ? sort : "recentes",
    cursor: cursor && CURSOR.test(cursor) ? cursor : ""
  };
}

export function liveQuery(f, { includeCursor = true } = {}) {
  const p = new URLSearchParams();
  if (slugOr(f.region)) p.set("regiao", f.region);
  if (slugOr(f.type)) p.set("tipo", f.type);
  if (f.maxRent) p.set("ate", String(f.maxRent));
  if (f.minRooms) p.set("quartos", String(f.minRooms));
  if (f.sort && f.sort !== "recentes" && Object.hasOwn(LIVE_SORTS, f.sort)) p.set("ordem", f.sort);
  if (includeCursor && f.cursor && CURSOR.test(f.cursor)) p.set("cursor", f.cursor);
  return p.toString();
}

export function apiSearchQuery(f, pageSize = PAGE_SIZE) {
  const p = new URLSearchParams();
  if (f.region) p.set("neighborhood", f.region);
  if (f.type) p.set("propertyType", f.type);
  if (f.maxRent) p.set("maxPrice", `${f.maxRent}.00`);
  if (f.minRooms) p.set("bedrooms", String(f.minRooms));
  p.set("sort", LIVE_SORTS[f.sort] ?? "newest");
  p.set("pageSize", String(pageSize));
  if (f.cursor) p.set("cursor", f.cursor);
  return p.toString();
}

export function liveDetailLink(id, search = "") {
  const p = new URLSearchParams();
  p.set("id", isUuid(id) ? id : "");
  const back = liveQuery(liveFiltersFromSearch(search));
  if (back) p.set("voltar", back);
  return "./imovel.html?" + p.toString();
}

export function liveBack(search = "") {
  const back = new URLSearchParams(String(search).replace(/^\?/, "")).get("voltar") || "";
  const q = liveQuery(liveFiltersFromSearch(back));
  return "./imoveis.html" + (q ? "?" + q : "");
}

// Exibição pt-BR de string decimal da API ("1850.00"). Number() é usado apenas
// para formatar a exibição; nenhum cálculo monetário é feito no navegador.
export function formatBRL(decimal) {
  if (typeof decimal !== "string" || !/^\d+\.\d{2}$/.test(decimal)) return "A confirmar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(decimal));
}

// Converte entrada do formulário (pt-BR ou ponto) para string decimal da API.
// Retorna null para vazio e undefined para inválido.
export function toApiDecimal(raw) {
  const s = String(raw ?? "").trim().replace(/^R\$\s*/, "");
  if (s === "") return null;
  let normalized = s;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d{1,2})?$/.test(s)) normalized = s.replace(",", ".");
  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(normalized)) return undefined;
  const [i, d = ""] = normalized.split(".");
  return `${i}.${d.padEnd(2, "0")}`;
}

export function fromApiDecimal(decimal) {
  return typeof decimal === "string" ? decimal.replace(".", ",") : "";
}

export const STATUS_LABELS = Object.freeze({
  rascunho: "Rascunho", em_analise: "Em análise", publicado: "Publicado", rejeitado: "Rejeitado",
  pausado: "Pausado", alugado: "Alugado", arquivado: "Arquivado", suspenso: "Suspenso pela moderação"
});
export const statusLabel = s => STATUS_LABELS[s] ?? "Desconhecido";

// Espelha o grafo do backend apenas para decidir quais botões exibir; a
// autorização e a validação de estado continuam exclusivamente no servidor.
const ACTIONS = Object.freeze({
  rascunho: ["edit", "submit", "archive"], rejeitado: ["edit", "submit", "archive"],
  em_analise: [], publicado: ["pause", "mark-rented", "archive"],
  pausado: ["edit", "resume", "mark-rented", "archive"], alugado: ["archive"], arquivado: [], suspenso: []
});
export const allowedActions = status => ACTIONS[status] ?? [];
export const ACTION_LABELS = Object.freeze({
  edit: "Editar", submit: "Enviar para análise", pause: "Pausar", resume: "Retomar",
  "mark-rented": "Marcar como alugado", archive: "Arquivar"
});

// Destinos pós-login permitidos (evita redirecionamento aberto).
const RETURN_PAGES = new Set(["parceiro.html", "moderacao.html"]);
export function safeReturnPage(raw) {
  const page = String(raw ?? "").replace(/^\.\//, "");
  return "./" + (RETURN_PAGES.has(page) ? page : "parceiro.html");
}
