import { formatDecimal, sumMoney } from "./money.js";

// DTOs explícitos: somente campos permitidos chegam ao cliente (seção 26.2/31.8).
const iso = d => (d ? new Date(d).toISOString() : null);

// UI-05 (PENDENTE): condomínio e IPTU são tratados como valores MENSAIS declarados.
// O total só é calculado quando todos os encargos são conhecidos; nulo ≠ zero.
export function pricing(row) {
  const rent = formatDecimal(row.valorAluguel);
  const condominium = formatDecimal(row.valorCondominio);
  const iptu = formatDecimal(row.valorIptu);
  return {
    currency: "BRL", period: "mensal", rent, condominium, iptu,
    monthlyTotal: rent === null ? null : sumMoney([rent, condominium, iptu])
  };
}

function advertiserSummary(row) {
  if (row.imobiliaria) return { type: "agency", id: row.imobiliaria.id, name: row.imobiliaria.nomeComercial };
  if (row.anunciante) return { type: "individual", id: row.anunciante.id, name: row.anunciante.nomeExibicao };
  return null;
}

export function publicPhoto(propertyId, photo) {
  const base = `/api/v1/properties/${propertyId}/photos/${photo.id}`;
  return { id: photo.id, alt: photo.textoAlternativo ?? "", isCover: photo.principal, urls: { thumb: `${base}/thumb`, detail: `${base}/detail` } };
}

export function publicPropertySummary(row) {
  const cover = row.fotos?.[0];
  return {
    id: row.id,
    title: row.titulo,
    type: row.tipoImovel ? { slug: row.tipoImovel.slug, name: row.tipoImovel.nome } : null,
    neighborhood: row.endereco?.bairro ? { slug: row.endereco.bairro.slug, name: row.endereco.bairro.nome } : null,
    municipality: "São Roque", state: "SP",
    price: pricing(row),
    bedrooms: row.quartos, bathrooms: row.banheiros, parkingSpaces: row.vagasGaragem,
    areaM2: formatDecimal(row.areaM2),
    coverPhoto: cover ? publicPhoto(row.id, cover) : null,
    advertiser: advertiserSummary(row),
    publishedAt: iso(row.publicadoEm)
  };
}

export function publicPropertyDetail(row) {
  const { coverPhoto, ...summary } = publicPropertySummary({ ...row, fotos: row.fotos?.slice(0, 1) });
  return {
    ...summary,
    description: row.descricao,
    features: (row.caracteristicas ?? []).map(c => c.caracteristica).filter(c => c.ativo)
      .map(c => ({ slug: c.slug, name: c.nome })),
    photos: (row.fotos ?? []).map(p => publicPhoto(row.id, p)),
    // Localização pública sempre aproximada (bairro); nunca endereço/coordenadas.
    approximateLocation: { level: "bairro", neighborhood: summary.neighborhood?.name ?? null, municipality: "São Roque", state: "SP" },
    availability: "disponivel",
    updatedAt: iso(row.atualizadoEm)
  };
}

export function privatePhoto(basePath, photo) {
  return {
    id: photo.id, order: photo.ordem, isCover: photo.principal, alt: photo.textoAlternativo ?? "",
    status: photo.statusProcessamento, createdAt: iso(photo.criadoEm),
    urls: photo.statusProcessamento === "aprovado" ? { thumb: `${basePath}/photos/${photo.id}/thumb`, detail: `${basePath}/photos/${photo.id}/detail` } : null
  };
}

// Visão privada (titular/moderação): inclui endereço protegido, nunca dados de outro titular.
export function privateProperty(row, basePath) {
  return {
    id: row.id, status: row.status, revision: row.revisao,
    owner: row.imobiliariaId ? { type: "agency", id: row.imobiliariaId } : { type: "individual", id: row.anuncianteId },
    title: row.titulo, description: row.descricao,
    propertyType: row.tipoImovel ? { id: row.tipoImovel.id, slug: row.tipoImovel.slug, name: row.tipoImovel.nome } : null,
    address: row.endereco ? {
      neighborhood: { id: row.endereco.bairro.id, slug: row.endereco.bairro.slug, name: row.endereco.bairro.nome },
      cep: row.endereco.cep, street: row.endereco.logradouro, number: row.endereco.numero,
      complement: row.endereco.complemento, municipality: row.endereco.municipio, state: row.endereco.uf
    } : null,
    price: pricing(row),
    bedrooms: row.quartos, bathrooms: row.banheiros, parkingSpaces: row.vagasGaragem,
    areaM2: formatDecimal(row.areaM2),
    features: (row.caracteristicas ?? []).map(c => ({ id: c.caracteristica.id, slug: c.caracteristica.slug, name: c.caracteristica.nome })),
    photos: (row.fotos ?? []).map(p => privatePhoto(basePath, p)),
    publishedAt: iso(row.publicadoEm), archivedAt: iso(row.arquivadoEm),
    createdAt: iso(row.criadoEm), updatedAt: iso(row.atualizadoEm)
  };
}

export function privatePropertySummary(row) {
  return {
    id: row.id, status: row.status, revision: row.revisao, title: row.titulo,
    rent: formatDecimal(row.valorAluguel), bedrooms: row.quartos,
    propertyType: row.tipoImovel ? { slug: row.tipoImovel.slug, name: row.tipoImovel.nome } : null,
    neighborhood: row.endereco?.bairro ? { slug: row.endereco.bairro.slug, name: row.endereco.bairro.nome } : null,
    approvedPhotos: row._count?.fotos ?? 0,
    updatedAt: iso(row.atualizadoEm), publishedAt: iso(row.publicadoEm)
  };
}
