import { sendImage } from "./streams.js";

export function createPublicController({ catalogService, publicPropertyService, config }) {
  const cachePublic = res => res.set("Cache-Control", "public, max-age=60");
  return {
    meta(_req, res) {
      res.set("Cache-Control", "no-store");
      res.json({ data: {
        apiVersion: "v1",
        // DEC-003/C0: em demonstração todos os anúncios são sintéticos e devem ser rotulados.
        demoData: config.demoMode,
        coverage: { municipality: "São Roque", state: "SP", neighborhoodsValidated: false },
        sorts: ["newest", "price_asc", "price_desc"],
        features: { ...config.features }
      } });
    },
    async neighborhoods(_req, res) { cachePublic(res); res.json({ data: await catalogService.neighborhoods() }); },
    async propertyTypes(_req, res) { cachePublic(res); res.json({ data: await catalogService.propertyTypes() }); },
    async features(_req, res) { cachePublic(res); res.json({ data: await catalogService.features() }); },
    async search(req, res) {
      res.set("Cache-Control", "no-store");
      res.json(await publicPropertyService.search(req.query));
    },
    async detail(req, res) {
      // Sem cache compartilhado: despublicação deve refletir imediatamente (API-CT13).
      res.set("Cache-Control", "no-cache");
      res.json({ data: await publicPropertyService.detail(req.params.id) });
    },
    async photo(req, res) {
      const stream = await publicPropertyService.photo(req.params.id, req.params.photoId, req.params.variant);
      sendImage(res, stream, { cache: "public, max-age=300, must-revalidate" });
    }
  };
}
