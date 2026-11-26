import { errors } from "../lib/errors.js";
import { compareMoney } from "../lib/money.js";
import { createValidator, isSlug, isUuid, money, queryInteger, assertUuid } from "../lib/validation.js";
import { publicPropertyDetail, publicPropertySummary } from "../lib/presenters.js";
import { PUBLIC_WHERE } from "../repositories/publicPropertyRepository.js";
import { VARIANTS } from "../media/imageProcessor.js";

// sort=popular e sort=distance NÃO são oferecidos (ADR-007/DEC-006; FE-019).
export const SORTS = Object.freeze({
  newest: { orderBy: [{ publicadoEm: "desc" }, { id: "desc" }], key: r => r.publicadoEm.toISOString(), field: "publicadoEm", dir: "lt" },
  price_asc: { orderBy: [{ valorAluguel: "asc" }, { id: "asc" }], key: r => r.valorAluguel.toFixed(2), field: "valorAluguel", dir: "gt" },
  price_desc: { orderBy: [{ valorAluguel: "desc" }, { id: "desc" }], key: r => r.valorAluguel.toFixed(2), field: "valorAluguel", dir: "lt" }
});
const ALLOWED_QUERY = ["neighborhood", "neighborhoodId", "propertyType", "propertyTypeId", "minPrice", "maxPrice",
  "bedrooms", "bathrooms", "features", "sort", "cursor", "pageSize"];
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

function single(v, field, raw) {
  if (raw === undefined) return undefined;
  if (Array.isArray(raw) || typeof raw !== "string") { v.fail(field, "informe um único valor"); return undefined; }
  return raw;
}

export function parseSearchQuery(query, cursorCodec) {
  const v = createValidator();
  for (const key of Object.keys(query)) if (!ALLOWED_QUERY.includes(key)) v.fail(key, "parâmetro não permitido");

  const out = {};
  const neighborhood = single(v, "neighborhood", query.neighborhood);
  if (neighborhood !== undefined && !isSlug(neighborhood)) v.fail("neighborhood", "slug inválido"); else out.neighborhood = neighborhood;
  const neighborhoodId = single(v, "neighborhoodId", query.neighborhoodId);
  if (neighborhoodId !== undefined && !isUuid(neighborhoodId)) v.fail("neighborhoodId", "identificador inválido"); else out.neighborhoodId = neighborhoodId?.toLowerCase();
  const propertyType = single(v, "propertyType", query.propertyType);
  if (propertyType !== undefined && !isSlug(propertyType)) v.fail("propertyType", "slug inválido"); else out.propertyType = propertyType;
  const propertyTypeId = single(v, "propertyTypeId", query.propertyTypeId);
  if (propertyTypeId !== undefined && !isUuid(propertyTypeId)) v.fail("propertyTypeId", "identificador inválido"); else out.propertyTypeId = propertyTypeId?.toLowerCase();

  out.minPrice = money(v, "minPrice", single(v, "minPrice", query.minPrice));
  out.maxPrice = money(v, "maxPrice", single(v, "maxPrice", query.maxPrice));
  if (out.minPrice && out.maxPrice && compareMoney(out.minPrice, out.maxPrice) > 0) v.fail("minPrice", "deve ser menor ou igual a maxPrice");
  out.bedrooms = queryInteger(v, "bedrooms", single(v, "bedrooms", query.bedrooms), { min: 0, max: 20 });
  out.bathrooms = queryInteger(v, "bathrooms", single(v, "bathrooms", query.bathrooms), { min: 0, max: 20 });

  if (query.features !== undefined) {
    const list = (Array.isArray(query.features) ? query.features : String(query.features).split(","))
      .map(s => String(s).trim()).filter(Boolean);
    if (list.length > 10 || list.some(s => !isSlug(s))) v.fail("features", "lista de até 10 slugs válidos");
    else out.features = [...new Set(list)];
  }

  const sort = single(v, "sort", query.sort) ?? "newest";
  if (!Object.hasOwn(SORTS, sort)) v.fail("sort", "use newest, price_asc ou price_desc"); else out.sort = sort;
  out.pageSize = queryInteger(v, "pageSize", single(v, "pageSize", query.pageSize), { min: 1, max: MAX_PAGE_SIZE }) ?? DEFAULT_PAGE_SIZE;

  const rawCursor = single(v, "cursor", query.cursor);
  if (rawCursor !== undefined) {
    const decoded = cursorCodec.decode(rawCursor);
    if (!decoded || decoded.s !== out.sort || typeof decoded.k !== "string" || !isUuid(decoded.id)) v.fail("cursor", "cursor inválido ou de outra ordenação");
    else out.cursor = decoded;
  }
  v.throwIfInvalid("Parâmetros de busca inválidos");
  return out;
}

export function buildSearchWhere(f) {
  const and = [PUBLIC_WHERE];
  const bairro = { ativo: true };
  if (f.neighborhood) bairro.slug = f.neighborhood;
  if (f.neighborhoodId) bairro.id = f.neighborhoodId;
  and.push({ endereco: { is: { bairro: { is: bairro } } } });
  const tipo = { ativo: true };
  if (f.propertyType) tipo.slug = f.propertyType;
  if (f.propertyTypeId) tipo.id = f.propertyTypeId;
  and.push({ tipoImovel: { is: tipo } });
  if (f.minPrice) and.push({ valorAluguel: { gte: f.minPrice } });
  if (f.maxPrice) and.push({ valorAluguel: { lte: f.maxPrice } });
  if (f.bedrooms !== undefined) and.push({ quartos: { gte: f.bedrooms } });
  if (f.bathrooms !== undefined) and.push({ banheiros: { gte: f.bathrooms } });
  for (const slug of f.features ?? []) and.push({ caracteristicas: { some: { caracteristica: { slug, ativo: true } } } });
  return { AND: and };
}

function cursorCondition(sort, cursor) {
  const { field, dir } = SORTS[sort];
  const key = field === "publicadoEm" ? new Date(cursor.k) : cursor.k;
  return { OR: [{ [field]: { [dir]: key } }, { [field]: key, id: { [dir]: cursor.id } }] };
}

export function createPublicPropertyService({ repository, storage, cursorCodec }) {
  return {
    async search(query) {
      const filters = parseSearchQuery(query, cursorCodec);
      const where = buildSearchWhere(filters);
      const pageWhere = filters.cursor ? { AND: [...where.AND, cursorCondition(filters.sort, filters.cursor)] } : where;
      const [rows, total] = await Promise.all([
        repository.search({ where: pageWhere, orderBy: SORTS[filters.sort].orderBy, take: filters.pageSize + 1 }),
        repository.count(where)
      ]);
      const hasMore = rows.length > filters.pageSize;
      const items = rows.slice(0, filters.pageSize);
      const last = items.at(-1);
      return {
        data: items.map(publicPropertySummary),
        page: {
          pageSize: filters.pageSize, total, hasMore,
          nextCursor: hasMore && last ? cursorCodec.encode({ s: filters.sort, k: SORTS[filters.sort].key(last), id: last.id }) : null
        }
      };
    },
    async detail(idRaw) {
      const id = assertUuid(idRaw);
      const row = await repository.findPublished(id);
      if (row) return publicPropertyDetail(row);
      // RN-I08/FT-007: link antigo de anúncio pausado/alugado/arquivado indica
      // indisponibilidade; rascunho, análise, rejeição ou suspensão ficam ocultos (404).
      const status = await repository.findStatus(id);
      if (status && ["pausado", "alugado", "arquivado"].includes(status.status)) throw errors.gone();
      throw errors.notFound();
    },
    async photo(propertyIdRaw, photoIdRaw, variant) {
      const propertyId = assertUuid(propertyIdRaw);
      const photoId = assertUuid(photoIdRaw);
      if (!Object.hasOwn(VARIANTS, variant)) throw errors.notFound();
      const photo = await repository.findPublicPhoto(propertyId, photoId);
      if (!photo) throw errors.notFound();
      const key = `derived/${photo.id}/${variant}.webp`;
      if (!(await storage.exists(key))) throw errors.notFound();
      return storage.stream(key);
    }
  };
}
