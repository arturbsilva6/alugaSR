export function createHealthService(database) {
  return {
    liveness() { return { status: "ok" }; },
    async readiness() {
      if (!database) return false;
      try { return await database.ping(); }
      catch { return false; }
    }
  };
}
