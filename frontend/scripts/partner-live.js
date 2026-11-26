import { api, loadSession, setCsrfToken } from "./api.js";
import { el, add, message, safePhotoUrl, loading } from "./dom.js";
import { allowedActions, ACTION_LABELS, statusLabel, formatBRL, toApiDecimal, fromApiDecimal } from "./live-catalog.js";

// Painel restrito conectado à API (MVP-010/011/012). O navegador apenas
// apresenta; titularidade, papel, estado e validação são decididos no servidor.
const ROLE_LABELS = Object.freeze({ responsavel: "responsável", gestor: "gestor", atendente: "atendente" });
const TEXT_FIELDS = ["title", "description"];
const MONEY_FIELDS = ["rent", "condominium", "iptu", "areaM2"];
const INT_FIELDS = ["bedrooms", "bathrooms", "parkingSpaces"];
const ADDRESS_FIELDS = ["cep", "street", "number", "complement"];

export async function initPartnerLive(doc, win) {
  const $ = id => doc.getElementById(id);
  const feedback = $("panel-feedback");
  const session = await loadSession();
  if (!session) { $("auth-box").hidden = false; return; }

  const state = { session, scopes: [], scope: null, catalogs: null, editing: null };
  $("panel").hidden = false;
  $("panel-user").textContent = session.user.name;
  $("panel-logout").addEventListener("click", async () => {
    await api("/auth/logout", { method: "POST", json: {} });
    setCsrfToken(null);
    win.location.assign("./entrar.html?voltar=parceiro.html");
  });

  const c = session.contexts;
  if (c.individual) state.scopes.push({ key: "individual", label: `Proprietário: ${c.individual.displayName}`, base: "/me/properties", canSubmit: c.individual.canSubmit, status: c.individual.verificationStatus });
  for (const a of c.agencies.filter(x => x.canManageProperties)) {
    state.scopes.push({ key: a.agencyId, label: `Imobiliária: ${a.name} (${ROLE_LABELS[a.role] ?? a.role})`, base: `/me/agencies/${a.agencyId}/properties`, canSubmit: a.canSubmit, status: a.verificationStatus });
  }
  if (!state.scopes.length) {
    message(doc, feedback, "Sua conta não possui perfil de anunciante nem vínculo de gestão com imobiliária.", "error");
    $("panel-work").hidden = true;
    return;
  }
  const select = $("ctx-select");
  select.replaceChildren(...state.scopes.map(s => el(doc, "option", "", s.label, { value: s.key })));
  select.addEventListener("change", () => switchScope(select.value));

  const [types, hoods, feats] = await Promise.all([api("/catalog/property-types"), api("/catalog/neighborhoods"), api("/catalog/features")]);
  state.catalogs = { types: types.data ?? [], hoods: hoods.data ?? [], feats: feats.data ?? [] };
  const typeSel = $("pf-propertyTypeId");
  typeSel.replaceChildren(el(doc, "option", "", "Selecione", { value: "" }), ...state.catalogs.types.map(t => el(doc, "option", "", t.name, { value: t.id })));
  const hoodSel = $("pf-neighborhoodId");
  hoodSel.replaceChildren(el(doc, "option", "", "Selecione", { value: "" }), ...state.catalogs.hoods.map(h => el(doc, "option", "", h.name, { value: h.id })));
  const featBox = $("pf-features");
  featBox.replaceChildren(...state.catalogs.feats.map(f => {
    const id = `feat-${f.id}`;
    const label = el(doc, "label", "check", null, { for: id });
    add(label, el(doc, "input", "", null, { type: "checkbox", id, name: "features", value: f.id }), el(doc, "span", "", f.name));
    return label;
  }));

  const form = $("prop-form");
  form.addEventListener("submit", e => { e.preventDefault(); save(); });
  $("pf-new").addEventListener("click", () => openForm(null));
  $("pf-cancel").addEventListener("click", () => closeForm());
  $("photo-input").addEventListener("change", e => uploadFiles([...e.target.files]));
  for (const id of ["pf-rent", "pf-condominium", "pf-iptu"]) $(id).addEventListener("input", previewTotal);

  await switchScope(state.scopes[0].key);

  async function switchScope(key) {
    state.scope = state.scopes.find(s => s.key === key);
    const elig = $("eligibility");
    elig.hidden = state.scope.canSubmit;
    elig.textContent = state.scope.canSubmit ? "" : `Verificação do titular: ${state.scope.status}. Você pode salvar rascunhos, mas o envio para análise fica bloqueado até a elegibilidade ser confirmada.`;
    closeForm();
    await refreshList();
  }

  async function refreshList() {
    const rows = $("props-rows");
    rows.replaceChildren(add(el(doc, "tr"), add(el(doc, "td", "", null, { colspan: 4 }), loading(doc))));
    const r = await api(`${state.scope.base}?pageSize=50`);
    rows.replaceChildren();
    if (!r.ok) return message(doc, feedback, r.error.message, "error");
    const counts = { all: r.page.total, rascunho: 0, em_analise: 0, publicado: 0 };
    for (const p of r.data) counts[p.status] = (counts[p.status] ?? 0) + 1;
    $("kpi-all").textContent = counts.all; $("kpi-drafts").textContent = counts.rascunho; $("kpi-pending").textContent = counts.em_analise; $("kpi-published").textContent = counts.publicado;
    if (!r.data.length) return add(rows, add(el(doc, "tr"), el(doc, "td", "", "Nenhum anúncio ainda. Use “Novo anúncio” para criar um rascunho.", { colspan: 4 })));
    for (const p of r.data) {
      const tr = el(doc, "tr");
      const title = add(el(doc, "td"), el(doc, "strong", "", p.title ?? "(sem título)"), el(doc, "br"), el(doc, "small", "text-muted", `${p.neighborhood?.name ?? "Bairro pendente"} · ${p.approvedPhotos} foto(s)`));
      const status = add(el(doc, "td"), el(doc, "span", "status-chip" + (p.status === "em_analise" ? " status-chip--pending" : ""), statusLabel(p.status)));
      const actions = el(doc, "td", "inline-items");
      for (const action of allowedActions(p.status)) {
        if (action === "submit" && !state.scope.canSubmit) continue;
        const b = el(doc, "button", "button button--ghost", ACTION_LABELS[action], { type: "button", "aria-label": `${ACTION_LABELS[action]}: ${p.title ?? "anúncio"}` });
        b.addEventListener("click", () => (action === "edit" ? openForm(p.id) : transition(p, action)));
        add(actions, b);
      }
      const view = el(doc, "button", "button button--ghost", "Detalhes", { type: "button" });
      view.addEventListener("click", () => openForm(p.id, { readOnly: !allowedActions(p.status).includes("edit") }));
      add(actions, view);
      add(rows, add(tr, title, status, add(el(doc, "td"), el(doc, "span", "", formatBRL(p.rent))), actions));
    }
  }

  async function transition(p, action) {
    if (action === "archive" && !win.confirm("Arquivar este anúncio? Ele deixa de aparecer e não poderá ser reenviado.")) return;
    const r = await api(`${state.scope.base}/${p.id}/${action}`, { method: "POST", json: { revision: p.revision } });
    if (!r.ok) return showErrors(r, `Não foi possível executar “${ACTION_LABELS[action]}”.`);
    message(doc, feedback, `${ACTION_LABELS[action]}: concluído. Novo estado: ${statusLabel(r.data.status)}.`, "success");
    await refreshList();
    if (state.editing?.id === p.id) await openForm(p.id);
  }

  function clearFieldErrors() {
    for (const n of form.querySelectorAll("[aria-invalid=true]")) n.removeAttribute("aria-invalid");
    for (const n of form.querySelectorAll(".field__error[data-for]")) { n.textContent = ""; n.hidden = true; }
  }

  function showErrors(r, fallback) {
    clearFieldErrors();
    let first = null;
    for (const f of r.error?.fields ?? []) {
      const input = form.querySelector(`[data-field="${CSS.escape(f.field)}"]`);
      const slot = form.querySelector(`.field__error[data-for="${CSS.escape(f.field)}"]`);
      if (input) { input.setAttribute("aria-invalid", "true"); first ??= input; }
      if (slot) { slot.textContent = f.reason; slot.hidden = false; }
    }
    const extra = (r.error?.fields ?? []).filter(f => !form.querySelector(`[data-field="${CSS.escape(f.field)}"]`)).map(f => `${f.field}: ${f.reason}`);
    message(doc, feedback, [r.error?.message ?? fallback, ...extra].join(" — "), "error");
    first?.focus();
  }

  function readForm() {
    const v = name => $(`pf-${name}`).value;
    const body = {};
    const local = [];
    for (const f of TEXT_FIELDS) { const s = v(f).trim(); body[f] = s === "" ? null : s; }
    body.propertyTypeId = v("propertyTypeId") || null;
    for (const f of MONEY_FIELDS) {
      const d = toApiDecimal(v(f));
      if (d === undefined) local.push({ field: f, reason: "use um valor como 1850 ou 1.850,00" });
      body[f] = d ?? null;
    }
    for (const f of INT_FIELDS) {
      const s = v(f).trim();
      if (s !== "" && !/^\d{1,2}$/.test(s)) local.push({ field: f, reason: "use um número inteiro" });
      body[f] = s === "" ? null : Number(s);
    }
    body.features = [...form.querySelectorAll("input[name=features]:checked")].map(i => i.value);
    const hood = v("neighborhoodId");
    if (hood) {
      body.address = { neighborhoodId: hood };
      for (const f of ADDRESS_FIELDS) { const s = v(f).trim(); body.address[f] = s === "" ? null : s; }
    }
    return { body, local };
  }

  function previewTotal() {
    const parts = ["rent", "condominium", "iptu"].map(f => toApiDecimal($(`pf-${f}`).value));
    let text = "A confirmar";
    if (parts.every(p => typeof p === "string")) {
      const cents = parts.reduce((s, p) => s + BigInt(p.replace(".", "")), 0n).toString().padStart(3, "0");
      text = formatBRL(`${cents.slice(0, -2)}.${cents.slice(-2)}`);
    }
    $("pf-total").textContent = text;
  }

  function fillForm(p) {
    const set = (f, val) => { $(`pf-${f}`).value = val ?? ""; };
    set("title", p?.title); set("description", p?.description); set("propertyTypeId", p?.propertyType?.id);
    set("rent", fromApiDecimal(p?.price?.rent)); set("condominium", fromApiDecimal(p?.price?.condominium)); set("iptu", fromApiDecimal(p?.price?.iptu));
    set("areaM2", fromApiDecimal(p?.areaM2)); set("bedrooms", p?.bedrooms); set("bathrooms", p?.bathrooms); set("parkingSpaces", p?.parkingSpaces);
    set("neighborhoodId", p?.address?.neighborhood?.id); set("cep", p?.address?.cep); set("street", p?.address?.street);
    set("number", p?.address?.number); set("complement", p?.address?.complement);
    const selected = new Set((p?.features ?? []).map(f => f.id));
    for (const box of form.querySelectorAll("input[name=features]")) box.checked = selected.has(box.value);
    previewTotal();
  }

  async function openForm(id, { readOnly = false } = {}) {
    clearFieldErrors();
    $("editor").hidden = false;
    let p = null;
    if (id) {
      const r = await api(`${state.scope.base}/${id}`);
      if (!r.ok) return message(doc, feedback, r.error.message, "error");
      p = r.data;
    }
    state.editing = p;
    $("editor-title").textContent = p ? `${readOnly ? "Detalhes" : "Editar"}: ${p.title ?? "anúncio"} (${statusLabel(p.status)})` : "Novo anúncio (rascunho)";
    fillForm(p);
    for (const n of form.elements) n.disabled = readOnly && n.id !== "pf-cancel";
    $("pf-save").hidden = readOnly;
    $("photos").hidden = !p;
    $("history").hidden = !p;
    if (p) { renderPhotos(p, readOnly); await renderHistory(p); }
    $("editor-title").focus();
  }

  function closeForm() { $("editor").hidden = true; state.editing = null; form.reset(); clearFieldErrors(); }

  async function save() {
    const { body, local } = readForm();
    if (local.length) return showErrors({ error: { message: "Corrija os campos destacados.", fields: local } });
    const p = state.editing;
    const r = p
      ? await api(`${state.scope.base}/${p.id}`, { method: "PATCH", json: { ...body, revision: p.revision } })
      : await api(state.scope.base, { method: "POST", json: body });
    if (!r.ok) {
      // Dados digitados são preservados no formulário em caso de erro (UX-002).
      return showErrors(r, r.status === 409 ? "O anúncio mudou desde que foi aberto. Recarregue os detalhes." : "Não foi possível salvar.");
    }
    message(doc, feedback, p ? "Alterações salvas." : "Rascunho criado. Agora você pode enviar fotos.", "success");
    await refreshList();
    await openForm(r.data.id);
  }

  function renderPhotos(p, readOnly) {
    const list = $("photo-list");
    $("photo-input").disabled = readOnly;
    list.replaceChildren();
    if (!p.photos.length) add(list, el(doc, "li", "text-muted", "Nenhuma foto. Envie ao menos uma para poder enviar à análise."));
    for (const photo of p.photos) {
      const li = el(doc, "li", "photo-item");
      const src = safePhotoUrl(photo.urls?.thumb);
      if (src) add(li, el(doc, "img", "", null, { src, alt: photo.alt || "Foto do anúncio", width: 160, height: 107, loading: "lazy" }));
      add(li, el(doc, "span", "chip", photo.isCover ? "Capa" : `Foto ${photo.order + 1}`));
      if (!readOnly) {
        const alt = el(doc, "input", "field__control", null, { type: "text", maxlength: 250, value: photo.alt, "aria-label": "Texto alternativo da foto" });
        const saveAlt = el(doc, "button", "button button--ghost", "Salvar descrição", { type: "button" });
        saveAlt.addEventListener("click", () => photoAction(photo, "PATCH", { alt: alt.value }));
        add(li, alt, saveAlt);
        if (!photo.isCover && photo.status === "aprovado") {
          const cover = el(doc, "button", "button button--ghost", "Definir como capa", { type: "button" });
          cover.addEventListener("click", () => photoAction(photo, "PATCH", { isCover: true }));
          add(li, cover);
        }
        const del = el(doc, "button", "button button--ghost", "Remover", { type: "button" });
        del.addEventListener("click", () => win.confirm("Remover esta foto?") && photoAction(photo, "DELETE"));
        add(li, del);
      }
      add(list, li);
    }
  }

  async function photoAction(photo, method, json) {
    const p = state.editing;
    const r = await api(`${state.scope.base}/${p.id}/photos/${photo.id}`, { method, json: method === "DELETE" ? undefined : json });
    if (!r.ok) return message(doc, feedback, r.error.message, "error");
    message(doc, feedback, "Foto atualizada.", "success");
    state.editing = r.data;
    renderPhotos(r.data, false);
    await refreshList();
  }

  async function uploadFiles(files) {
    const p = state.editing;
    const status = $("photo-status");
    for (const [i, file] of files.entries()) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { message(doc, status, `“${file.name}”: formato não aceito (use JPEG, PNG ou WebP).`, "error"); continue; }
      message(doc, status, `Enviando e processando foto ${i + 1} de ${files.length}...`);
      const r = await api(`${state.scope.base}/${p.id}/photos`, { method: "POST", body: file, contentType: file.type });
      if (!r.ok) { message(doc, status, `“${file.name}”: ${r.status === 413 ? "arquivo grande demais" : r.error.message}`, "error"); continue; }
      state.editing = r.data.property;
      message(doc, status, `Foto ${i + 1} processada (metadados de localização removidos).`, "success");
    }
    $("photo-input").value = "";
    renderPhotos(state.editing, false);
    await refreshList();
  }

  async function renderHistory(p) {
    const list = $("history-list");
    list.replaceChildren();
    const r = await api(`${state.scope.base}/${p.id}/history`);
    if (!r.ok) return;
    for (const h of r.data) {
      const when = new Date(h.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const li = el(doc, "li", "", `${when} — ${h.action}${h.to ? ` → ${statusLabel(h.to)}` : ""}${h.actor === "moderacao" ? " (moderação)" : ""}`);
      if (h.reason) add(li, el(doc, "br"), el(doc, "small", "", `Motivo: ${h.reason}`));
      add(list, li);
    }
  }
}

