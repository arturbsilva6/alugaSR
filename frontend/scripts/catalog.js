import { DEMO_LISTINGS } from "./fixtures.js";

export const ALLOWED_TYPES = Object.freeze(["casa", "apartamento", "sobrado"]);
export const ALLOWED_REGIONS = Object.freeze(["centro", "outras"]);
export const ALLOWED_SORTS = Object.freeze(["recentes", "menor-preco", "maior-preco"]);
export const PAGE_SIZE = 3;

export function currency(amount) {
  if (!Number.isFinite(amount)) return "A confirmar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(amount);
}

export function monthlyTotal(listing) {
  const { rent, condominium, iptu, feePeriod } = listing;
  if (feePeriod !== "mensal" || ![rent, condominium, iptu].every(v => Number.isFinite(v) && v >= 0)) {
    return null;
  }
  return Math.round((rent + condominium + iptu) * 100) / 100;
}

function boundedInteger(raw, { min, max, fallback }) {
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/.test(String(raw))) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
}

function enumerated(value, choices) {
  return choices.includes(value) ? value : "";
}

export function filtersFromSearch(search = "") {
  const params = new URLSearchParams(String(search).replace(/^\?/, ""));
  return {
    region: enumerated(params.get("regiao"), ALLOWED_REGIONS),
    type: enumerated(params.get("tipo"), ALLOWED_TYPES),
    maxRent: boundedInteger(params.get("ate"), { min: 500, max: 20000, fallback: 0 }),
    minRooms: boundedInteger(params.get("quartos"), { min: 1, max: 8, fallback: 0 }),
    sort: enumerated(params.get("ordem"), ALLOWED_SORTS) || "recentes",
    page: boundedInteger(params.get("pagina"), { min: 1, max: 20, fallback: 1 })
  };
}

export function queryForFilters(filters, { includePage = true } = {}) {
  const p = new URLSearchParams();
  if (ALLOWED_REGIONS.includes(filters.region)) p.set("regiao", filters.region);
  if (ALLOWED_TYPES.includes(filters.type)) p.set("tipo", filters.type);
  if (Number.isSafeInteger(filters.maxRent) && filters.maxRent >= 500 && filters.maxRent <= 20000) p.set("ate", String(filters.maxRent));
  if (Number.isSafeInteger(filters.minRooms) && filters.minRooms >= 1 && filters.minRooms <= 8) p.set("quartos", String(filters.minRooms));
  if (ALLOWED_SORTS.includes(filters.sort) && filters.sort !== "recentes") p.set("ordem", filters.sort);
  if (includePage && Number.isSafeInteger(filters.page) && filters.page > 1 && filters.page <= 20) p.set("pagina", String(filters.page));
  return p.toString();
}

export function filterAndSort(listings, filters) {
  const filtered = listings.filter(item =>
    (!filters.region || item.regionKey === filters.region) &&
    (!filters.type || item.type === filters.type) &&
    (!filters.maxRent || item.rent <= filters.maxRent) &&
    (!filters.minRooms || item.bedrooms >= filters.minRooms)
  );
  const sorted = [...filtered];
  if (filters.sort === "menor-preco") sorted.sort((a, b) => a.rent - b.rent || a.id.localeCompare(b.id));
  if (filters.sort === "maior-preco") sorted.sort((a, b) => b.rent - a.rent || a.id.localeCompare(b.id));
  return sorted;
}

export function paginate(listings, page = 1, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(listings.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return { items: listings.slice((current - 1) * pageSize, current * pageSize), current, totalPages, total: listings.length };
}

export function findDemoListing(id) {
  return DEMO_LISTINGS.find(item => item.id === id) || null;
}

export function detailLink(listing, search = "") {
  const p = new URLSearchParams();
  p.set("id", listing.id);
  const filters = filtersFromSearch(search);
  const q = queryForFilters(filters);
  if (q) p.set("voltar", q);
  return "./imovel.html?" + p.toString();
}

export function safeBackToResults(search = "") {
  const p = new URLSearchParams(String(search).replace(/^\?/, ""));
  const back = p.get("voltar") || "";
  const normalized = queryForFilters(filtersFromSearch(back));
  return "./imoveis.html" + (normalized ? "?" + normalized : "");
}

export function validateDemoDraft(input) {
  const title = String(input.title || "").trim();
  const type = String(input.type || "");
  const region = String(input.region || "");
  const description = String(input.description || "").trim();
  const rent = Number(input.rent);
  const errors = [];
  if (title.length < 8 || title.length > 100) errors.push("Informe um título entre 8 e 100 caracteres.");
  if (!ALLOWED_TYPES.includes(type)) errors.push("Selecione um tipo de imóvel.");
  if (!ALLOWED_REGIONS.includes(region)) errors.push("Selecione uma região ilustrativa.");
  if (!Number.isFinite(rent) || rent < 100 || rent > 50000) errors.push("Informe um aluguel mensal entre R$ 100 e R$ 50.000.");
  if (description.length < 20 || description.length > 1000) errors.push("Informe uma descrição entre 20 e 1.000 caracteres.");
  return { valid: errors.length === 0, errors };
}
