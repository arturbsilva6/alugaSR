// Utilitários de DOM sem innerHTML: todo texto vindo da API usa textContent.
export function el(doc, tag, className = "", text = null, attrs = {}) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = String(text);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : String(v));
  return node;
}
export function add(parent, ...children) { parent.append(...children); return parent; }

// Só aceita URLs de imagem servidas pela própria API (derivados autorizados).
const PHOTO_URL = /^\/api\/v1\/(properties|me\/properties|me\/agencies\/[0-9a-f-]{36}\/properties|admin\/property-submissions)\/[0-9a-f-]{36}\/photos\/[0-9a-f-]{36}\/(thumb|detail)$/;
export const safePhotoUrl = url => (typeof url === "string" && PHOTO_URL.test(url) ? url : null);

export function message(doc, target, text, kind = "info") {
  if (!target) return;
  target.textContent = text;
  target.className = "status-message" + (kind === "error" ? " status-message--error" : kind === "success" ? " status-message--success" : "");
  target.hidden = !text;
}

export function loading(doc, text = "Carregando...") {
  const box = el(doc, "div", "loading-indicator", null, { role: "status" });
  add(box, el(doc, "span", "loading-indicator__spinner", null, { "aria-hidden": "true" }), el(doc, "span", "", text));
  return box;
}
