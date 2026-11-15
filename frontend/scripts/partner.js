import { currency, monthlyTotal, validateDemoDraft } from "./catalog.js";

// Simulação acadêmica: estado efêmero, sem autenticação, localStorage, upload ou API.
function make(doc, tag, className = "", text = "") {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  el.textContent = String(text);
  return el;
}

function draftFromForm(form) {
  const data = new FormData(form);
  return {
    title: String(data.get("title") || "").trim(),
    type: String(data.get("type") || ""),
    region: String(data.get("region") || ""),
    rent: String(data.get("rent") || ""),
    condominium: String(data.get("condominium") || ""),
    iptu: String(data.get("iptu") || ""),
    description: String(data.get("description") || "").trim()
  };
}

export function estimatedDemoCost(fields) {
  const value = raw => raw === "" || raw === undefined || raw === null ? null : Number(raw);
  const rent = value(fields.rent);
  const condominium = value(fields.condominium);
  const iptu = value(fields.iptu);
  if (rent === null || rent <= 0 || [condominium, iptu].some(v => v !== null && v < 0)) return null;
  return monthlyTotal({ rent, condominium, iptu, feePeriod: "mensal" });
}

export function initPartner(doc = document, win = window) {
  const form = doc.getElementById("partner-form");
  if (!form) return false;

  const params = new URLSearchParams(win.location.search);
  const isAgency = params.get("perfil") === "imobiliaria";
  const title = doc.getElementById("partner-title");
  if (title) title.textContent = isAgency ? "Painel da imobiliária · simulação" : "Painel do proprietário · simulação";

  const rows = doc.getElementById("partner-rows");
  const feedback = doc.getElementById("partner-feedback");
  const total = doc.getElementById("partner-total");
  const records = [
    { id: 1, title: "Casa de exemplo em rascunho", type: "casa", region: "centro", rent: "1850", condominium: "0", iptu: "95", description: "Descrição inteiramente fictícia para ilustrar o fluxo de cadastro.", status: "Rascunho" },
    { id: 2, title: "Apartamento ilustrativo em revisão", type: "apartamento", region: "outras", rent: "1650", condominium: "", iptu: "", description: "Simulação de anúncio submetido à análise interna, sem publicar nada.", status: "Em análise" }
  ];
  let editingId = null;
  let nextId = 3;

  function notify(message, isError = false) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = "feedback " + (isError ? "field__error" : "text-muted");
  }
  function preview() {
    if (!total) return;
    const cost = estimatedDemoCost(draftFromForm(form));
    total.textContent = cost === null ? "A confirmar" : currency(cost);
  }
  function render() {
    rows.replaceChildren();
    for (const item of records) {
      const tr = doc.createElement("tr");
      const name = doc.createElement("td");
      const strong = make(doc, "strong", "", item.title || "Rascunho sem título");
      name.append(strong, make(doc, "small", "text-muted", "Registro fictício #" + item.id));
      const state = doc.createElement("td");
      state.append(make(doc, "span", "status-chip" + (item.status === "Em análise" ? " status-chip--pending" : ""), item.status));
      const actions = doc.createElement("td");
      const edit = make(doc, "button", "button button--secondary", "Editar");
      edit.type = "button";
      edit.addEventListener("click", () => {
        editingId = item.id;
        for (const field of ["title", "type", "region", "rent", "condominium", "iptu", "description"]) {
          form.elements.namedItem(field).value = String(item[field] ?? "");
        }
        preview();
        notify("Editando o registro fictício #" + item.id + ". As mudanças não serão publicadas.");
        form.elements.namedItem("title").focus();
      });
      actions.append(edit);
      tr.append(name, state, actions);
      rows.append(tr);
    }
    doc.getElementById("kpi-all").textContent = String(records.length);
    doc.getElementById("kpi-drafts").textContent = String(records.filter(x => x.status === "Rascunho").length);
    doc.getElementById("kpi-pending").textContent = String(records.filter(x => x.status === "Em análise").length);
  }

  function save(status) {
    const input = draftFromForm(form);
    if (status === "Em análise") {
      const validation = validateDemoDraft(input);
      if (!validation.valid) {
        notify(validation.errors.join(" "), true);
        return;
      }
    }
    // Nenhum dado é persistido ou enviado ao servidor.
    const payload = { ...input, title: input.title || "Rascunho sem título", status };
    const old = records.find(item => item.id === editingId);
    if (old) Object.assign(old, payload);
    else records.unshift({ id: nextId++, ...payload });
    const verb = status === "Em análise" ? "Enviado apenas para a fila simulada." : "Rascunho registrado só nesta página.";
    editingId = null;
    form.reset();
    preview();
    render();
    notify(verb + " Nada foi publicado.");
  }

  form.addEventListener("submit", e => e.preventDefault());
  form.addEventListener("input", preview);
  form.addEventListener("change", preview);
  doc.getElementById("save-draft").addEventListener("click", () => save("Rascunho"));
  doc.getElementById("submit-review").addEventListener("click", () => save("Em análise"));
  preview();
  render();
  return true;
}
