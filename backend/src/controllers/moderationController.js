import { sendImage } from "./streams.js";

export function createModerationController({ moderationService }) {
  return {
    async queue(req, res) { res.json(await moderationService.queue(req.query)); },
    async submission(req, res) { res.json({ data: await moderationService.submission(req.auth.user, req.params.id) }); },
    async decide(req, res, decision) {
      res.json({ data: await moderationService.decide(req.auth.user, req.params.id, decision, req.body) });
    },
    async photo(req, res) {
      const stream = await moderationService.photoStream(req.params.id, req.params.photoId, req.params.variant);
      sendImage(res, stream, { cache: "private, no-store" });
    }
  };
}
