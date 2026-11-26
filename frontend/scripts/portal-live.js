import { api } from "./api.js";
import { el, add, safePhotoUrl, loading } from "./dom.js";
import { liveFiltersFromSearch, liveQuery, apiSearchQuery, liveDetailLink, liveBack, formatBRL, isUuid } from "./live-catalog.js";

function liveCard(doc, item, search, demoData) {
  const card = el(doc, "article", "property-card");
  const link = el(doc, "a", "property-card__link", null, { href: liveDetailLink(item.id, search) });
  link.setAttribute("aria-label", "Ver detalhes: " + item.title);
  const photo = el(doc, "div", "property-card__photo");
  const src = safePhotoUrl(item.coverPhoto?.urls?.thumb);
  add(photo, el(doc, "img", "", null, { src: src ?? "./assets/casa.svg", alt: src ? (item.coverPhoto.alt || "Foto do imóvel") : "Imóvel sem foto disponível", loading: "lazy", width: 480, height: 320 }));
  if (demoData) add(photo, el(doc, "span", "property-card__tag", "EXEMPLO FICTÍCIO"));
  const body = el(doc, "div", "property-card__body");
  const rooms = [item.bedrooms != null && `${item.bedrooms} quarto(s)`, item.bathrooms != null && `${item.bathrooms} banheiro(s)`, item.parkingSpaces != null && `${item.parkingSpaces} vaga(s)`].filter(Boolean).join(" · ");
  add(body,
    el(doc, "strong", "property-card__price", formatBRL(item.price?.rent) + "/mês"),
    el(doc, "h3", "property-card__title", item.title),
    el(doc, "p", "property-card__meta", `${item.neighborhood?.name ?? "Bairro a confirmar"} · ${item.type?.name ?? ""} · São Roque/SP`),
    el(doc, "p", "property-card__features", rooms || "Cômodos a confirmar"),
    el(doc, "span", "property-card__hint", "Ver detalhes"));
  add(link, photo, body);
  return add(card, link);
}

function emptyState(doc, title, text, action) {
  const box = el(doc, "div", "empty-state page-empty");
  add(box, el(doc, "h3", "", title), el(doc, "p", "", text));
  if (action) add(box, el(doc, "a", "button button--secondary", action.label, { href: action.href }));
  return box;
}

function fillSelect(doc, select, items, { emptyLabel, selected }) {
  if (!select) return;
  select.replaceChildren(el(doc, "option", "", emptyLabel, { value: "" }));
  for (const item of items) add(select, el(doc, "option", "", item.name, { value: item.slug, selected: item.slug === selected }));
}

// Catálogo de bairros e tipos vem da API; nada de lista fixa no frontend (EXT-01).
async function hydrateSearchForm(doc, filters, ids) {
  const [hoods, types] = await Promise.all([api("/catalog/neighborhoods"), api("/catalog/property-types")]);
  if (hoods.ok) fillSelect(doc, doc.getElementById(ids.region), hoods.data, { emptyLabel: "Todos os bairros", selected: filters.region });
  if (types.ok) fillSelect(doc, doc.getElementById(ids.type), types.data, { emptyLabel: "Todos os tipos", selected: filters.type });
}

export async function initHomeLive(doc, meta) {
  await hydrateSearchForm(doc, {}, { region: "home-regiao", type: "home-tipo" });
  const grid = doc.getElementById("featured-grid");
  if (!grid) return;
  grid.replaceChildren(loading(doc, "Carregando anúncios..."));
  const r = await api("/properties?sort=newest&pageSize=3");
  grid.replaceChildren();
  if (!r.ok) return add(grid, emptyState(doc, "Não foi possível carregar os anúncios", "Tente novamente em instantes.", { label: "Ver todos", href: "./imoveis.html" }));
  if (!r.data.length) return add(grid, emptyState(doc, "Nenhum anúncio publicado ainda", "Volte mais tarde.", null));
  for (const item of r.data) add(grid, liveCard(doc, item, "", meta.demoData));
}

export async function initResultsLive(doc, win, meta) {
  const grid = doc.getElementById("results-grid");
  if (!grid) return;
  const filters = liveFiltersFromSearch(win.location.search);
  await hydrateSearchForm(doc, filters, { region: "f-regiao", type: "f-tipo" });
  const set = (id, value) => { const n = doc.getElementById(id); if (n) n.value = String(value || ""); };
  set("f-quartos", filters.minRooms); set("f-ordem", filters.sort);
  const price = doc.getElementById("f-preco");
  if (price && filters.maxRent && ![...price.options].some(o => o.value === String(filters.maxRent))) {
    add(price, el(doc, "option", "", "Até " + formatBRL(`${filters.maxRent}.00`), { value: filters.maxRent }));
  }
  set("f-preco", filters.maxRent);
  const count = doc.getElementById("results-count");
  grid.replaceChildren(loading(doc, "Buscando imóveis..."));
  const r = await api("/properties?" + apiSearchQuery(filters));
  grid.replaceChildren();
  const pagination = doc.getElementById("results-pagination");
  pagination?.replaceChildren();
  if (!r.ok) {
    if (count) count.textContent = "Erro ao buscar imóveis.";
    const retry = emptyState(doc, r.status === 422 ? "Filtros inválidos" : "Não foi possível carregar os resultados",
      r.status === 422 ? "Revise os filtros selecionados." : "Verifique sua conexão e tente novamente.", { label: "Limpar filtros", href: "./imoveis.html" });
    return add(grid, retry);
  }
  if (count) count.textContent = `${r.page.total} imóvel(is) encontrado(s)${meta.demoData ? " — dados fictícios de demonstração" : ""}`;
  if (!r.data.length) {
    return add(grid, emptyState(doc, "Nenhum imóvel corresponde aos filtros", "Tente remover um filtro ou ampliar a faixa de preço.", { label: "Limpar filtros", href: "./imoveis.html" }));
  }
  for (const item of r.data) add(grid, liveCard(doc, item, win.location.search, meta.demoData));
  if (pagination) {
    if (filters.cursor) add(pagination, el(doc, "a", "button button--secondary", "Primeira página", { href: "./imoveis.html?" + liveQuery(filters, { includeCursor: false }) }));
    if (r.page.hasMore && r.page.nextCursor) add(pagination, el(doc, "a", "button button--secondary", "Próxima página", { href: "./imoveis.html?" + liveQuery({ ...filters, cursor: r.page.nextCursor }), rel: "next" }));
  }
  doc.getElementById("f-ordem")?.addEventListener("change", e => {
    win.location.assign("./imoveis.html?" + liveQuery({ ...filters, sort: e.target.value, cursor: "" }));
  });
}

function costRow(doc, parent, name, value, extra = "") {
  add(parent, add(el(doc, "div", "cost-row " + extra), el(doc, "span", "", name), el(doc, "strong", "", value)));
}

function gallery(doc, photos, title) {
  const figure = el(doc, "figure", "detail-photo gallery");
  const main = el(doc, "img", "", null, { width: 1280, height: 853 });
  const caption = el(doc, "figcaption", "visual-label");
  add(figure, main, caption);
  const valid = photos.filter(p => safePhotoUrl(p.urls?.detail));
  const show = i => {
    main.src = valid[i].urls.detail;
    main.alt = valid[i].alt || `Foto ${i + 1} do imóvel ${title}`;
    caption.textContent = `Foto ${i + 1} de ${valid.length}`;
    thumbs.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
  };
  const thumbs = el(doc, "div", "gallery__thumbs", null, { role: "group", "aria-label": "Miniaturas das fotos" });
  if (!valid.length) {
    main.src = "./assets/casa.svg"; main.alt = "Imóvel sem fotos disponíveis"; caption.textContent = "Sem fotos aprovadas";
    return figure;
  }
  valid.forEach((p, i) => {
    const b = el(doc, "button", "gallery__thumb", null, { type: "button", "aria-label": `Ver foto ${i + 1} de ${valid.length}` });
    add(b, el(doc, "img", "", null, { src: safePhotoUrl(p.urls.thumb) ?? "", alt: "", loading: "lazy", width: 120, height: 80 }));
    b.addEventListener("click", () => show(i));
    add(thumbs, b);
  });
  if (valid.length > 1) add(figure, thumbs);
  show(0);
  return figure;
}

export async function initDetailLive(doc, win, meta) {
  const root = doc.getElementById("detail-root");
  if (!root) return;
  const back = liveBack(win.location.search);
  const top = doc.getElementById("detail-back-top");
  if (top) top.href = back;
  const id = new URLSearchParams(win.location.search).get("id");
  root.replaceChildren(loading(doc, "Carregando anúncio..."));
  const r = isUuid(id) ? await api(`/properties/${id}`) : { ok: false, status: 404 };
  root.replaceChildren();
  if (!r.ok) {
    const title = r.status === 410 ? "Este anúncio não está mais disponível" : r.status === 404 ? "Anúncio não encontrado" : "Não foi possível carregar o anúncio";
    const text = r.status === 410 ? "O anunciante pausou, arquivou ou marcou o imóvel como alugado." : r.status === 404 ? "O endereço pode estar incorreto ou o anúncio não é público." : "Verifique sua conexão e tente novamente.";
    const box = el(doc, "div", "empty-state");
    return add(root, add(box, el(doc, "h1", "", title), el(doc, "p", "", text), el(doc, "a", "button button--primary", "Voltar aos resultados", { href: back })));
  }
  const p = r.data;
  doc.title = `${p.title} — AlugaSR`;
  const intro = add(el(doc, "section", "page-intro"),
    el(doc, "p", "eyebrow", (meta.demoData ? "ANÚNCIO FICTÍCIO · " : "") + "SÃO ROQUE/SP"),
    el(doc, "h1", "", p.title),
    el(doc, "p", "section-description", `${p.approximateLocation?.neighborhood ?? "Bairro a confirmar"} · localização pública aproximada (bairro)`));
  const left = el(doc, "div", "detail-body");
  add(left, gallery(doc, p.photos ?? [], p.title));
  const chips = el(doc, "div", "detail-features");
  for (const t of [p.type?.name, p.bedrooms != null && `${p.bedrooms} quarto(s)`, p.bathrooms != null && `${p.bathrooms} banheiro(s)`,
    p.parkingSpaces != null && `${p.parkingSpaces} vaga(s)`, p.areaM2 && `${p.areaM2.replace(".", ",")} m²`].filter(Boolean)) add(chips, el(doc, "span", "chip", t));
  add(left, chips);
  const copy = add(el(doc, "section", "card detail-copy"), el(doc, "h2", "", "Descrição"), el(doc, "p", "", p.description));
  if (p.features?.length) {
    const ul = el(doc, "ul");
    for (const f of p.features) add(ul, el(doc, "li", "", f.name));
    add(copy, el(doc, "h3", "", "Características"), ul);
  }
  add(left, copy, add(el(doc, "div", "notice"), el(doc, "strong", "", "Localização preservada"),
    el(doc, "p", "", "Exibimos apenas o bairro. Endereço completo e coordenadas não são públicos.")));
  const side = el(doc, "aside", "card detail-cost", null, { "aria-label": "Resumo mensal dos custos" });
  add(side, el(doc, "p", "eyebrow", "CUSTOS MENSAIS DECLARADOS"), el(doc, "strong", "detail-cost__price", formatBRL(p.price.rent) + "/mês"));
  costRow(doc, side, "Aluguel", formatBRL(p.price.rent));
  costRow(doc, side, "Condomínio", formatBRL(p.price.condominium));
  costRow(doc, side, "IPTU (referência mensal)", formatBRL(p.price.iptu));
  costRow(doc, side, "Total mensal estimado", formatBRL(p.price.monthlyTotal), "cost-total");
  add(side, el(doc, "p", "detail-disclaimer", p.price.monthlyTotal === null ? "Encargos desconhecidos não são somados como zero." : "Soma dos valores declarados pelo anunciante; confirme antes de negociar."));
  if (p.advertiser) add(side, el(doc, "p", "text-muted", `Anunciado por: ${p.advertiser.name} (${p.advertiser.type === "agency" ? "imobiliária" : "proprietário"})`));
  const contact = el(doc, "button", "button button--primary button--block", "Como entrar em contato?", { type: "button", "data-dialog-target": "contact-info-dialog" });
  add(side, contact, el(doc, "a", "button button--secondary button--block", "Voltar aos resultados", { href: back }));
  add(root, intro, add(el(doc, "div", "detail-layout"), left, side));
}
