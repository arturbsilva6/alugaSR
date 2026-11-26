import { api, loadSession, setCsrfToken } from "./api.js";
import { message } from "./dom.js";
import { safeReturnPage } from "./live-catalog.js";

// Login de contas SINTÉTICAS de parceiro/moderação. O cadastro público está
// desligado até o Gate C1; nenhuma credencial é guardada no navegador.
export async function initLogin(doc, win) {
  const form = doc.getElementById("login-form");
  const feedback = doc.getElementById("login-feedback");
  const target = safeReturnPage(new URLSearchParams(win.location.search).get("voltar"));
  const session = await loadSession();
  const already = doc.getElementById("login-already");
  if (session && already) {
    already.hidden = false;
    doc.getElementById("login-already-name").textContent = session.user.name;
    const go = doc.getElementById("login-continue");
    go.href = target;
    form.hidden = true;
  }
  doc.getElementById("logout-button")?.addEventListener("click", async () => {
    await api("/auth/logout", { method: "POST", json: {} });
    setCsrfToken(null);
    win.location.reload();
  });
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (!email || !password) return message(doc, feedback, "Informe e-mail e senha.", "error");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    message(doc, feedback, "Entrando...");
    const r = await api("/auth/login", { method: "POST", json: { email, password } });
    button.disabled = false;
    form.querySelector("#login-password").value = "";
    if (!r.ok) {
      const text = r.status === 429 ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        : r.status === 401 ? "E-mail ou senha inválidos." : r.error.message;
      message(doc, feedback, text, "error");
      return form.querySelector("#login-email").focus();
    }
    setCsrfToken(r.data.csrfToken);
    message(doc, feedback, "Login realizado. Redirecionando...", "success");
    win.location.assign(target);
  });
}
