import { errors } from "../lib/errors.js";
import { assertUuid } from "../lib/validation.js";

// Autorização = sessão válida + papel contextual + vínculo ativo + titularidade
// do recurso + estado permitido (seção 31.9). O papel nunca vem do navegador.
export const MANAGER_ROLES = Object.freeze(["responsavel", "gestor"]);
export const MODERATION_ROLES = Object.freeze(["moderador", "administrador"]);

export function hasAnyRole(user, roles) {
  return user?.roles?.some(r => roles.includes(r)) ?? false;
}

export function createOwnerScopeResolver(partnerRepository) {
  return {
    // Contexto individual: o usuário precisa ter perfil de anunciante próprio.
    async individual(user) {
      const advertiser = await partnerRepository.findAdvertiser(user.id);
      if (!advertiser) throw errors.forbidden("Perfil de anunciante individual inexistente");
      return {
        kind: "individual",
        ownerWhere: { anuncianteId: advertiser.id },
        ownerData: { anuncianteId: advertiser.id },
        basePath: "/api/v1/me/properties",
        // CT-03: anunciante pendente pode criar rascunho, mas não enviar/publicar.
        eligible: advertiser.statusVerificacao === "verificado",
        blocked: advertiser.statusVerificacao === "suspenso" || advertiser.statusVerificacao === "rejeitado"
      };
    },
    // Contexto de imobiliária: vínculo ATIVO e papel responsável/gestor (ADR-002).
    // Atendente e membros removidos/suspensos não gerenciam anúncios (ARQ-CT03).
    async agency(user, agencyIdRaw) {
      const agencyId = assertUuid(agencyIdRaw);
      const membership = await partnerRepository.findMembership(user.id, agencyId);
      if (!membership) throw errors.notFound();
      if (!MANAGER_ROLES.includes(membership.papel)) throw errors.forbidden("Papel sem permissão para gerenciar anúncios");
      return {
        kind: "agency",
        ownerWhere: { imobiliariaId: agencyId },
        ownerData: { imobiliariaId: agencyId },
        basePath: `/api/v1/me/agencies/${agencyId}/properties`,
        eligible: membership.imobiliaria.status === "verificado",
        blocked: membership.imobiliaria.status === "suspenso" || membership.imobiliaria.status === "rejeitado"
      };
    }
  };
}
