import { initDemoDialogs } from "./ui.js";

// Só a demonstração responde a cliques. Nenhuma ação de usuário é enviada à API.
const year = document.querySelector("#ano");
if (year) year.textContent = String(new Date().getFullYear());
initDemoDialogs(document);
