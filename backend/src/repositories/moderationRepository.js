import { PRIVATE_PROPERTY_SELECT } from "./partnerRepository.js";

export function createModerationRepository(prisma) {
  return {
    queue({ take, skip }) {
      const where = { status: "em_analise" };
      return Promise.all([
        prisma.imovel.findMany({
          where, take, skip, orderBy: [{ atualizadoEm: "asc" }, { id: "asc" }],
          select: {
            id: true, titulo: true, revisao: true, valorAluguel: true, atualizadoEm: true,
            tipoImovel: { select: { nome: true } },
            endereco: { select: { bairro: { select: { nome: true } } } },
            anunciante: { select: { nomeExibicao: true } },
            imobiliaria: { select: { nomeComercial: true } }
          }
        }),
        prisma.imovel.count({ where })
      ]);
    },
    findForReview(id, client = prisma) {
      return client.imovel.findUnique({
        where: { id },
        select: {
          ...PRIVATE_PROPERTY_SELECT,
          criadoPorUsuarioId: true,
          anunciante: { select: { id: true, nomeExibicao: true, statusVerificacao: true, usuarioId: true } },
          imobiliaria: { select: { id: true, nomeComercial: true, status: true, excluidoEm: true } }
        }
      });
    },
    // Conflito de interesse: o revisor não pode ter vínculo com o titular do anúncio.
    async reviewerHasConflict(reviewerId, property) {
      if (property.criadoPorUsuarioId === reviewerId) return true;
      if (property.anunciante?.usuarioId === reviewerId) return true;
      if (property.imobiliariaId) {
        const link = await prisma.membroImobiliaria.findFirst({
          where: { imobiliariaId: property.imobiliariaId, usuarioId: reviewerId, status: { not: "removido" } },
          select: { id: true }
        });
        if (link) return true;
      }
      return false;
    },
    findReviewPhoto(propertyId, photoId) {
      return prisma.fotoImovel.findFirst({
        where: { id: photoId, imovelId: propertyId, excluidoEm: null, statusProcessamento: "aprovado", imovel: { status: { in: ["em_analise", "publicado", "pausado", "suspenso"] } } },
        select: { id: true }
      });
    }
  };
}
