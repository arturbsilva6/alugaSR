import { errors } from "../lib/errors.js";
import { createValidator, integer, rejectUnknownKeys, text, assertUuid, queryInteger } from "../lib/validation.js";
import { privateProperty } from "../lib/presenters.js";
import { formatDecimal } from "../lib/money.js";
import { submissionProblems } from "./partnerPropertyService.js";
import { VARIANTS } from "../media/imageProcessor.js";

// RN-P07 / MVP-013: decisão somente por moderador/administrador autorizado,
// sem vínculo com o titular (proíbe autoaprovação), com justificativa e auditoria.
const DECISIONS = Object.freeze({
  approve: { from: ["em_analise"], to: "publicado", action: "property.approve", reasonRequired: false },
  reject: { from: ["em_analise"], to: "rejeitado", action: "property.reject", reasonRequired: true },
  suspend: { from: ["em_analise", "publicado", "pausado"], to: "suspenso", action: "property.suspend", reasonRequired: true }
});

// Estados visíveis à moderação (rascunhos permanecem exclusivos do titular).
const REVIEWABLE = Object.freeze(["em_analise", "publicado", "pausado", "suspenso", "rejeitado"]);

export function createModerationService({ repository, partnerRepository, audit, storage }) {
  function parseDecision(body, reasonRequired) {
    const v = createValidator();
    rejectUnknownKeys(body ?? {}, ["revision", "reason"], v);
    const revision = integer(v, "revision", body?.revision, { min: 1, max: 2_000_000_000, nullable: false });
    if (body?.revision === undefined) v.fail("revision", "obrigatório para controle de concorrência");
    const reason = text(v, "reason", body?.reason, { min: reasonRequired ? 10 : 0, max: 1000, multiline: true });
    if (reasonRequired && !reason) v.fail("reason", "justificativa obrigatória (mínimo 10 caracteres)");
    v.throwIfInvalid();
    return { revision, reason: reason ?? null };
  }

  return {
    async queue(query) {
      const v = createValidator();
      for (const key of Object.keys(query)) if (!["page", "pageSize"].includes(key)) v.fail(key, "parâmetro não permitido");
      const page = queryInteger(v, "page", query.page, { min: 1, max: 10000 }) ?? 1;
      const pageSize = queryInteger(v, "pageSize", query.pageSize, { min: 1, max: 50 }) ?? 20;
      v.throwIfInvalid();
      const [rows, total] = await repository.queue({ take: pageSize, skip: (page - 1) * pageSize });
      return {
        data: rows.map(r => ({
          id: r.id, title: r.titulo, revision: r.revisao, rent: formatDecimal(r.valorAluguel),
          propertyType: r.tipoImovel?.nome ?? null, neighborhood: r.endereco?.bairro?.nome ?? null,
          advertiser: r.imobiliaria ? { type: "agency", name: r.imobiliaria.nomeComercial } : { type: "individual", name: r.anunciante?.nomeExibicao ?? null },
          submittedAt: r.atualizadoEm.toISOString()
        })),
        page: { page, pageSize, total, hasMore: page * pageSize < total }
      };
    },

    async submission(reviewer, idRaw) {
      const id = assertUuid(idRaw);
      const row = await repository.findForReview(id);
      if (!row || !REVIEWABLE.includes(row.status)) throw errors.notFound();
      const conflict = await repository.reviewerHasConflict(reviewer.id, row);
      // Acesso a dados de revisão (inclui endereço para validação geográfica) é auditado.
      await audit.record({ actorId: reviewer.id, action: "moderation.view", resourceType: "imovel", resourceId: id });
      return {
        ...privateProperty(row, `/api/v1/admin/property-submissions/${id}`),
        advertiser: row.imobiliaria
          ? { type: "agency", name: row.imobiliaria.nomeComercial, verificationStatus: row.imobiliaria.status }
          : { type: "individual", name: row.anunciante?.nomeExibicao ?? null, verificationStatus: row.anunciante?.statusVerificacao ?? null },
        reviewerConflict: conflict
      };
    },

    async decide(reviewer, idRaw, name, body) {
      const d = DECISIONS[name];
      if (!d) throw errors.notFound();
      const id = assertUuid(idRaw);
      const { revision, reason } = parseDecision(body, d.reasonRequired);
      await partnerRepository.transaction(async tx => {
        const locked = await tx.$queryRaw`SELECT id FROM imoveis WHERE id = ${id}::uuid FOR UPDATE`;
        if (!locked.length) throw errors.notFound();
        const row = await repository.findForReview(id, tx);
        if (await repository.reviewerHasConflict(reviewer.id, row)) {
          throw errors.forbidden("Conflito de interesse: o revisor não pode decidir sobre anúncio do qual é titular ou membro");
        }
        if (row.revisao !== revision) throw errors.conflict("O anúncio foi alterado desde a abertura da revisão. Recarregue antes de decidir.");
        if (!d.from.includes(row.status)) throw errors.invalidTransition();
        const data = { status: d.to, revisao: { increment: 1 }, atualizadoPorUsuarioId: reviewer.id };
        if (name === "approve") {
          const ownerOk = row.imobiliaria ? row.imobiliaria.status === "verificado" && !row.imobiliaria.excluidoEm : row.anunciante?.statusVerificacao === "verificado";
          if (!ownerOk) throw errors.invalidTransition("Titular não elegível: verificação ausente, suspensa ou revogada");
          const approved = row.fotos.filter(p => p.statusProcessamento === "aprovado");
          const problems = submissionProblems(row, approved.length);
          if (problems.length) throw errors.validation(problems, "O anúncio não atende aos requisitos de publicação");
          if (!approved.some(p => p.principal)) await tx.fotoImovel.update({ where: { id: approved[0].id }, data: { principal: true } });
          data.publicadoEm = new Date();
        }
        const { count } = await tx.imovel.updateMany({ where: { id, status: row.status, revisao: row.revisao }, data });
        if (count !== 1) throw errors.conflict();
        await audit.record({ actorId: reviewer.id, action: d.action, resourceType: "imovel", resourceId: id,
          metadata: { de: row.status, para: d.to, ...(reason ? { motivo: reason } : {}) } }, tx);
      });
      return this.submission(reviewer, id);
    },

    async photoStream(idRaw, photoIdRaw, variant) {
      if (!Object.hasOwn(VARIANTS, variant)) throw errors.notFound();
      const photo = await repository.findReviewPhoto(assertUuid(idRaw), assertUuid(photoIdRaw));
      if (!photo) throw errors.notFound();
      const key = `derived/${photo.id}/${variant}.webp`;
      if (!(await storage.exists(key))) throw errors.notFound();
      return storage.stream(key);
    }
  };
}
