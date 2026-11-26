import { errors } from "../lib/errors.js";
import { sendImage } from "./streams.js";

export function createPartnerController({ partnerPropertyService: svc, scopes }) {
  // O escopo de titularidade é resolvido no servidor a partir da sessão e da rota.
  const scopeOf = req => (req.params.agencyId ? scopes.agency(req.auth.user, req.params.agencyId) : scopes.individual(req.auth.user));
  return {
    async list(req, res) { res.json(await svc.list(await scopeOf(req), req.query)); },
    async create(req, res) { res.status(201).json({ data: await svc.create(await scopeOf(req), req.auth.user, req.body) }); },
    async get(req, res) { res.json({ data: await svc.get(await scopeOf(req), req.params.id) }); },
    async update(req, res) { res.json({ data: await svc.update(await scopeOf(req), req.auth.user, req.params.id, req.body) }); },
    async transition(req, res, action) {
      res.json({ data: await svc.transition(await scopeOf(req), req.auth.user, req.params.id, action, req.body) });
    },
    async history(req, res) { res.json({ data: await svc.history(await scopeOf(req), req.params.id) }); },
    async uploadPhoto(req, res) {
      if (!Buffer.isBuffer(req.body)) throw errors.unsupportedMedia("Envie a imagem como image/jpeg, image/png ou image/webp");
      const result = await svc.uploadPhoto(await scopeOf(req), req.auth.user, req.params.id, req.body, req.get("content-type")?.split(";")[0].trim().toLowerCase());
      res.status(201).json({ data: result });
    },
    async updatePhoto(req, res) {
      res.json({ data: await svc.updatePhoto(await scopeOf(req), req.auth.user, req.params.id, req.params.photoId, req.body) });
    },
    async removePhoto(req, res) {
      res.json({ data: await svc.removePhoto(await scopeOf(req), req.auth.user, req.params.id, req.params.photoId) });
    },
    async photo(req, res) {
      const stream = await svc.photoStream(await scopeOf(req), req.params.id, req.params.photoId, req.params.variant);
      sendImage(res, stream, { cache: "private, no-store" });
    }
  };
}
