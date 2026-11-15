import { initDemoDialogs } from "./ui.js";
import { initHome, initResults, initDetail } from "./portal.js";
import { initPartner } from "./partner.js";

// Nenhuma conta, anúncio ou dado pessoal é enviado; somente exemplos locais.
const year = document.querySelector("#ano");
if (year) year.textContent = String(new Date().getFullYear());

const page = document.querySelector("main[data-page]")?.dataset.page;
if (page === "home") initHome(document);
if (page === "results") initResults(document, window);
if (page === "detail") initDetail(document, window);
if (page === "partner") initPartner(document, window);
initDemoDialogs(document);
