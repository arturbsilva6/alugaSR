// FE-003 — comportamento progressivo e exclusivo da vitrine de componentes.
// Não implementa login, favoritos, cadastro, sessão ou operações de negócio.
const registeredDialogs = new WeakSet();

export function initDemoDialogs(doc = document) {
  let bound = 0;
  const openerForDialog = new WeakMap();
  for (const trigger of doc.querySelectorAll("[data-dialog-target]")) {
    const id = trigger.getAttribute("data-dialog-target") || "";
    // Uma referência local por ID, sem aceitar URLs nem seletores arbitrários.
    if (!/^[a-z][a-z0-9-]*$/i.test(id)) continue;
    const dialog = doc.getElementById(id);
    if (!dialog || dialog.tagName !== "DIALOG" || typeof dialog.showModal !== "function") continue;

    trigger.addEventListener("click", () => {
      if (dialog.open) return;
      openerForDialog.set(dialog, trigger);
      dialog.showModal();
    });
    if (!registeredDialogs.has(dialog)) {
      dialog.addEventListener("close", () => {
        const opener = openerForDialog.get(dialog);
        if (opener?.isConnected) opener.focus();
      });
      registeredDialogs.add(dialog);
    }
    bound++;
  }
  return bound;
}
