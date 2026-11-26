import { api, loadSession } from "./api.js";
import { el, add, message, safePhotoUrl } from "./dom.js";
import { formatBRL, statusLabel } from "./live-catalog.js";

// Fila de moderação (MVP-013). O servidor exige papel moderador/administrador,
// bloqueia conflito de interesse e registra cada decisão em auditoria.
export async function initModeration(doc, win) {
  const $ = id => doc.getElementById(id);
  const feedback = $("mod-feedback");
  const session = await loadSession();
  if (!session) { $("auth-box").hidden = false; return; }
  if (!session.user.roles.some(r => r === "moderador" || r === "administrador")) {
    message(doc, feedback, "Sua conta não possui papel de moderação.", "error");
    return;
  }
  $("mod-panel").hidden = false;
  let current = null;

  async function refresh() {
    const rows = $("mod-rows");
    const r = await api("/admin/property-submissions?pageSize=50");
    rows.replaceChildren();
    if (!r.ok) return message(doc, feedback, r.error.message, "error");
    $("mod-count").textContent = `${r.page.total} anúncio(s) aguardando análise`;
    if (!r.data.length) add(rows, add(el(doc, "tr"), el(doc, "td", "", "Fila vazia.", { colspan: 4 })));
    for (const item of r.data) {
      const open = el(doc, "button", "button button--ghost", "Analisar", { type: "button", "aria-label": `Analisar: ${item.title}` });
      open.addEventListener("click", () => show(item.id));
      add(rows, add(el(doc, "tr"),
        add(el(doc, "td"), el(doc, "strong", "", item.title), el(doc, "br"), el(doc, "small", "text-muted", `${item.propertyType ?? ""} · ${item.neighborhood ?? ""}`)),
        el(doc, "td", "", `${item.advertiser.name} (${item.advertiser.type === "agency" ? "imobiliária" : "proprietário"})`),
        el(doc, "td", "", formatBRL(item.rent)), add(el(doc, "td"), open)));
    }
  }

  async function show(id) {
    const r = await api(`/admin/property-submissions/${id}`);
    if (!r.ok) return message(doc, feedback, r.error.message, "error");
    current = r.data;
    const box = $("mod-detail");
    box.hidden = false;
    $("mod-detail-title").textContent = `${current.title} — ${statusLabel(current.status)}`;
    const facts = $("mod-facts");
    const a = current.address;
    facts.replaceChildren(...[
      ["Titular", `${current.advertiser.name} (verificação: ${current.advertiser.verificationStatus})`],
      ["Tipo", current.propertyType?.name ?? "—"], ["Bairro", a?.neighborhood?.name ?? "—"],
      ["Endereço (uso interno para validação geográfica)", a ? [a.street, a.number, a.complement, a.cep].filter(Boolean).join(", ") || "—" : "—"],
      ["Aluguel", formatBRL(current.price.rent)], ["Condomínio", formatBRL(current.price.condominium)], ["IPTU", formatBRL(current.price.iptu)],
      ["Quartos", current.bedrooms ?? "—"], ["Descrição", current.description ?? "—"]
    ].flatMap(([k, v]) => [el(doc, "dt", "", k), el(doc, "dd", "", v)]));
    const photos = $("mod-photos");
    photos.replaceChildren(...current.photos.filter(p => safePhotoUrl(p.urls?.thumb)).map(p =>
      el(doc, "img", "", null, { src: p.urls.thumb, alt: p.alt || "Foto enviada", width: 160, height: 107 })));
    const conflict = $("mod-conflict");
    conflict.hidden = !current.reviewerConflict;
    for (const b of box.querySelectorAll("[data-decision]")) b.disabled = current.reviewerConflict;
    $("mod-reason").value = "";
    $("mod-detail-title").focus();
  }

  for (const b of doc.querySelectorAll("[data-decision]")) {
    b.addEventListener("click", async () => {
      if (!current) return;
      const decision = b.dataset.decision;
      const reason = $("mod-reason").value.trim();
      if (decision !== "approve" && reason.length < 10) {
        message(doc, feedback, "Informe uma justificativa com ao menos 10 caracteres.", "error");
        return $("mod-reason").focus();
      }
      const r = await api(`/admin/properties/${current.id}/${decision}`, { method: "POST", json: { revision: current.revision, ...(reason ? { reason } : {}) } });
      if (!r.ok) return message(doc, feedback, [r.error.message, ...(r.error.fields ?? []).map(f => `${f.field}: ${f.reason}`)].join(" — "), "error");
      message(doc, feedback, `Decisão registrada: ${statusLabel(r.data.status)}.`, "success");
      $("mod-detail").hidden = true;
      current = null;
      await refresh();
    });
  }
  await refresh();
}
