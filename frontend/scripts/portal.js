import { DEMO_LISTINGS } from "./fixtures.js";
import {
  currency, monthlyTotal, filtersFromSearch, queryForFilters, filterAndSort,
  paginate, findDemoListing, detailLink, safeBackToResults, validateDemoDraft
} from "./catalog.js";

const TYPE_LABELS = Object.freeze({ casa: "Casa", apartamento: "Apartamento", sobrado: "Sobrado" });
const KNOWN_IMAGES = new Set(["casa.svg", "apartamento.svg", "sobrado.svg"]);

function element(doc, tag, className = "", text = null) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
}
function appendText(doc, root, tag, className, value) {
  const node = element(doc, tag, className, value);
  root.append(node);
  return node;
}
function safeImagePath(image) {
  return "./assets/" + (KNOWN_IMAGES.has(image) ? image : "casa.svg");
}
function featuresText(listing) {
  return listing.bedrooms + " quartos · " + listing.bathrooms + " banheiros · " + listing.parking + " vagas";
}

export function makePropertyCard(doc, listing, search = "") {
  const card = element(doc, "article", "property-card");
  const link = element(doc, "a", "property-card__link");
  link.href = detailLink(listing, search);
  link.setAttribute("aria-label", "Ver detalhes do imóvel fictício: " + listing.title);

  const photo = element(doc, "div", "property-card__photo");
  const image = element(doc, "img");
  image.src = safeImagePath(listing.image);
  image.alt = "Ilustração de " + (TYPE_LABELS[listing.type] || "imóvel") + " fictício";
  image.loading = "lazy";
  image.width = 960;
  image.height = 640;
  photo.append(image);
  appendText(doc, photo, "span", "property-card__tag", "EXEMPLO FICTÍCIO");

  const body = element(doc, "div", "property-card__body");
  appendText(doc, body, "strong", "property-card__price", currency(listing.rent) + "/mês");
  appendText(doc, body, "h3", "property-card__title", listing.title);
  appendText(doc, body, "p", "property-card__meta", listing.region + " · São Roque/SP");
  appendText(doc, body, "p", "property-card__features", featuresText(listing));
  appendText(doc, body, "span", "property-card__hint", "Ver detalhes do exemplo");
  link.append(photo, body);
  card.append(link);
  return card;
}

export function initHome(doc = document) {
  const grid = doc.getElementById("featured-grid");
  if (!grid) return false;
  grid.replaceChildren();
  for (const item of DEMO_LISTINGS.slice(0, 3)) grid.append(makePropertyCard(doc, item));
  return true;
}

function fillFilters(doc, filters) {
  for (const [id, value] of [
    ["f-regiao", filters.region], ["f-tipo", filters.type],
    ["f-preco", filters.maxRent || ""], ["f-quartos", filters.minRooms || ""],
    ["f-ordem", filters.sort]
  ]) {
    const node = doc.getElementById(id);
    if (node) node.value = String(value);
  }
}

export function initResults(doc = document, win = window) {
  const grid = doc.getElementById("results-grid");
  if (!grid) return false;
  const filters = filtersFromSearch(win.location.search);
  fillFilters(doc, filters);
  const items = filterAndSort(DEMO_LISTINGS, filters);
  const paged = paginate(items, filters.page);

  grid.replaceChildren();
  if (!items.length) {
    const empty = element(doc, "div", "empty-state page-empty");
    appendText(doc, empty, "h3", "", "Nenhum imóvel de exemplo corresponde aos filtros");
    appendText(doc, empty, "p", "", "Tente remover um filtro ou buscar por outra faixa de preço.");
    const reset = appendText(doc, empty, "a", "button button--secondary", "Limpar filtros");
    reset.href = "./imoveis.html";
    grid.append(empty);
  } else {
    for (const item of paged.items) grid.append(makePropertyCard(doc, item, win.location.search));
  }

  const count = doc.getElementById("results-count");
  if (count) count.textContent = items.length + " imóvel(is) fictício(s) encontrado(s)";

  const pagination = doc.getElementById("results-pagination");
  if (pagination) {
    pagination.replaceChildren();
    if (paged.totalPages > 1) {
      for (let page = 1; page <= paged.totalPages; page++) {
        const nextFilters = { ...filters, page };
        const query = queryForFilters(nextFilters);
        const link = appendText(doc, pagination, "a", "button button--secondary", String(page));
        link.href = "./imoveis.html" + (query ? "?" + query : "");
        link.setAttribute("aria-label", "Página " + page);
        if (page === paged.current) link.setAttribute("aria-current", "page");
      }
    }
  }

  const sort = doc.getElementById("f-ordem");
  if (sort) sort.addEventListener("change", () => {
    const next = { ...filters, sort: sort.value, page: 1 };
    win.location.assign("./imoveis.html?" + queryForFilters(next));
  });
  return true;
}

function costRow(doc, parent, name, value, extraClass = "") {
  const row = element(doc, "div", "cost-row " + extraClass);
  appendText(doc, row, "span", "", name);
  appendText(doc, row, "strong", "", value);
  parent.append(row);
}

export function initDetail(doc = document, win = window) {
  const root = doc.getElementById("detail-root");
  if (!root) return false;
  const search = win.location.search;
  const listing = findDemoListing(new URLSearchParams(search).get("id"));
  const back = safeBackToResults(search);
  const backTop = doc.getElementById("detail-back-top");
  if (backTop) backTop.href = back;
  root.replaceChildren();
  if (!listing) {
    const empty = element(doc, "div", "empty-state");
    appendText(doc, empty, "h1", "", "Este imóvel de exemplo não foi encontrado");
    appendText(doc, empty, "p", "", "O endereço pode estar incorreto ou o exemplo foi removido.");
    const link = appendText(doc, empty, "a", "button button--primary", "Voltar aos resultados");
    link.href = back;
    root.append(empty);
    return true;
  }

  const introduction = element(doc, "section", "page-intro");
  appendText(doc, introduction, "p", "eyebrow", "ANÚNCIO FICTÍCIO · SÃO ROQUE/SP");
  appendText(doc, introduction, "h1", "", listing.title);
  appendText(doc, introduction, "p", "section-description", listing.region + " · localização pública aproximada e meramente ilustrativa");

  const layout = element(doc, "div", "detail-layout");
  const left = element(doc, "div", "detail-body");
  const photo = element(doc, "figure", "detail-photo");
  const image = element(doc, "img");
  image.src = safeImagePath(listing.image);
  image.alt = "Ilustração do imóvel fictício: " + listing.title;
  image.width = 960; image.height = 640;
  photo.append(image);
  const label = appendText(doc, photo, "figcaption", "visual-label", "Imagem ilustrativa — sem fotos reais");
  left.append(photo);

  const features = element(doc, "div", "detail-features");
  for (const line of [
    listing.bedrooms + " quartos", listing.bathrooms + " banheiros",
    listing.parking + " vagas", listing.area + " m² (fictício)"
  ]) appendText(doc, features, "span", "chip", line);
  left.append(features);

  const description = element(doc, "section", "card detail-copy");
  appendText(doc, description, "h2", "", "Sobre este exemplo");
  appendText(doc, description, "p", "", listing.description);
  const perks = element(doc, "ul");
  for (const feat of listing.features) appendText(doc, perks, "li", "", feat);
  description.append(perks); left.append(description);
  const privacy = element(doc, "div", "notice");
  appendText(doc, privacy, "strong", "", "Localização preservada");
  appendText(doc, privacy, "p", "", "Endereços completos, coordenadas privadas e documentos não fazem parte desta vitrine.");
  left.append(privacy);

  const side = element(doc, "aside", "card detail-cost");
  side.setAttribute("aria-label", "Resumo mensal dos custos do exemplo");
  appendText(doc, side, "p", "eyebrow", "CUSTOS MENSAIS SIMULADOS");
  appendText(doc, side, "strong", "detail-cost__price", currency(listing.rent) + "/mês");
  costRow(doc, side, "Aluguel", currency(listing.rent));
  costRow(doc, side, "Condomínio", listing.condominium === null ? "A confirmar" : currency(listing.condominium));
  costRow(doc, side, "IPTU (referência mensal)", listing.iptu === null ? "A confirmar" : currency(listing.iptu));
  const monthly = monthlyTotal(listing);
  costRow(doc, side, "Total mensal estimado", monthly === null ? "A confirmar" : currency(monthly), "cost-total");
  appendText(doc, side, "p", "detail-disclaimer",
    monthly === null ? "Não somamos encargos desconhecidos como zero." : "Estimativa demonstrativa; nenhum valor representa oferta real.");
  const button = appendText(doc, side, "button", "button button--primary button--block", "Como entrar em contato?");
  button.type = "button";
  button.setAttribute("data-dialog-target", "contact-info-dialog");
  const backLink = appendText(doc, side, "a", "button button--secondary button--block", "Voltar aos resultados");
  backLink.href = back;
  layout.append(left, side);
  root.append(introduction, layout);
  return true;
}
