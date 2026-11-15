import { createApp } from "./app.js";
import { readRuntimeConfig } from "./config/env.js";
import { createDatabase } from "./repositories/database.js";

const config = readRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const app = createApp({ database });
const server = app.listen(config.port, config.host, () => {
  console.info("API AlugaSR iniciada (/api/v1/health, /api/v1/ready)");
});

async function shutdown(signal) {
  console.info("Encerrando API", signal);
  server.close(async (error) => {
    try { await database?.close(); }
    finally { process.exitCode = error ? 1 : 0; }
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
