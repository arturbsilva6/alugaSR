// Consultas PÚBLICAS: somente anúncios publicados, com seleção explícita de
// campos (nunca endereço, coordenadas, dados internos de titular ou moderação).
export const PUBLIC_PHOTO_WHERE = { statusProcessamento: "aprovado", excluidoEm: null };

// Titular suspenso não mantém anúncios na vitrine (RN-V05, política conservadora).
export const PUBLIC_WHERE = Object.freeze({
  status: "publicado",
  OR: [
    { anunciante: { is: { statusVerificacao: { not: "suspenso" } } } },
    { imobiliaria: { is: { status: { not: "suspenso" }, excluidoEm: null } } }
  ]
});

const PUBLIC_SELECT = {
  id: true, titulo: true, descricao: true,
  valorAluguel: true, valorCondominio: true, valorIptu: true, areaM2: true,
  quartos: true, banheiros: true, vagasGaragem: true, publicadoEm: true, atualizadoEm: true,
  tipoImovel: { select: { slug: true, nome: true } },
  endereco: { select: { bairro: { select: { slug: true, nome: true } } } },
  anunciante: { select: { id: true, nomeExibicao: true } },
  imobiliaria: { select: { id: true, nomeComercial: true } }
};

const PHOTO_ORDER = [{ principal: "desc" }, { ordem: "asc" }, { criadoEm: "asc" }, { id: "asc" }];

export function createPublicPropertyRepository(prisma) {
  return {
    search({ where, orderBy, take }) {
      return prisma.imovel.findMany({
        where, orderBy, take,
        select: {
          ...PUBLIC_SELECT,
          descricao: false,
          fotos: { where: PUBLIC_PHOTO_WHERE, orderBy: PHOTO_ORDER, take: 1, select: { id: true, textoAlternativo: true, principal: true } }
        }
      });
    },
    count(where) {
      return prisma.imovel.count({ where });
    },
    findPublished(id) {
      return prisma.imovel.findFirst({
        where: { ...PUBLIC_WHERE, id },
        select: {
          ...PUBLIC_SELECT,
          caracteristicas: { select: { caracteristica: { select: { slug: true, nome: true, ativo: true } } } },
          fotos: { where: PUBLIC_PHOTO_WHERE, orderBy: PHOTO_ORDER, select: { id: true, textoAlternativo: true, principal: true } }
        }
      });
    },
    findStatus(id) {
      return prisma.imovel.findUnique({ where: { id }, select: { status: true } });
    },
    findPublicPhoto(propertyId, photoId) {
      return prisma.fotoImovel.findFirst({
        where: { id: photoId, ...PUBLIC_PHOTO_WHERE, imovel: { ...PUBLIC_WHERE, id: propertyId } },
        select: { id: true }
      });
    }
  };
}
