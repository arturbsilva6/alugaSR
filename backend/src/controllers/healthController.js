export function createHealthController(service) {
  return {
    liveness(_req, res) {
      res.set("Cache-Control", "no-store");
      res.status(200).json({ data: service.liveness() });
    },
    async readiness(req, res) {
      res.set("Cache-Control", "no-store");
      const ready = await service.readiness();
      if (ready) return res.status(200).json({ data: { status: "ready" } });
      return res.status(503).json({
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Serviço temporariamente indisponível",
          requestId: req.id
        }
      });
    }
  };
}
