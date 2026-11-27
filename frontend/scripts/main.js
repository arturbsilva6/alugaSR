import { initDemoDialogs } from "./ui.js";
import { initHome, initResults, initDetail } from "./portal.js";
import { initPartner } from "./partner.js";
import { detectApi } from "./api.js";

// Modo conectado: quando a API /api/v1 responde (npm start), o portal usa dados
// do banco. Modo offline: na prévia estática (npm run preview) ou em file://,
// usa apenas as fixtures sintéticas segregadas em fixtures.js, sempre rotuladas.
const year = document.querySelector("#ano");
if (year) year.textContent = String(new Date().getFullYear());

const page = document.querySelector("main[data-page]")?.dataset.page;
const LIVE_PAGES = new Set(["home", "results", "detail", "login", "partner-live", "moderation"]);

function markOffline() {
  const ribbon = document.querySelector(".demo-ribbon .container");
  if (ribbon && !ribbon.querySelector("[data-offline]")) {
    const tag = document.createElement("span");
    tag.dataset.offline = "true";
    tag.textContent = " · MODO OFFLINE (fixtures locais, sem API)";
    ribbon.append(tag);
  }
}

async function start() {
  const meta = LIVE_PAGES.has(page) ? await detectApi() : null;
  if (meta) {
    if (page === "home") await (await import("./portal-live.js")).initHomeLive(document, meta);
    if (page === "results") await (await import("./portal-live.js")).initResultsLive(document, window, meta);
    if (page === "detail") await (await import("./portal-live.js")).initDetailLive(document, window, meta);
    if (page === "login") await (await import("./auth-page.js")).initLogin(document, window);
    if (page === "partner-live") await (await import("./partner-live.js")).initPartnerLive(document, window, meta);
    if (page === "moderation") await (await import("./moderation-live.js")).initModeration(document, window);
  } else {
    if (LIVE_PAGES.has(page)) markOffline();
    if (page === "home") initHome(document);
    if (page === "results") initResults(document, window);
    if (page === "detail") initDetail(document, window);
    if (["login", "partner-live", "moderation"].includes(page)) {
      const notice = document.getElementById("api-required");
      if (notice) notice.hidden = false;
    }
  }
  if (page === "partner") initPartner(document, window);
  initDemoDialogs(document);
}

start();
