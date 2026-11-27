// Consultas do painel restrito. TODA consulta recebe o filtro de titularidade
// (`ownerWhere`) derivado da sessão — nunca de um campo enviado pelo cliente.
export const PRIVATE_PROPERTY_SELECT = {
  id: true, status: true, revisao: true,
  titulo: true, descricao: true,
  valorAluguel: true, valorCondominio: true, valorIptu: true, areaM2: true,
  quartos: true, banheiros: true, vagasGaragem: true,
  publicadoEm: true, arquivadoEm: true, criadoEm: true, atualizadoEm: true,
  anuncianteId: true, imobiliariaId: true,
  tipoImovel: { select: { id: true, slug: true, nome: true, ativo: true } },
  endereco: {
    select: {
      id: true, cep: true, logradouro: true, numero: true, complemento: true, municipio: true, uf: true,
      bairro: { select: { id: true, slug: true, nome: true, ativo: true } }
    }
  },
  caracteristicas: { select: { caracteristica: { select: { id: true, slug: true, nome: true } } } },
  fotos: {
    where: { excluidoEm: null, statusProcessamento: { in: ["pendente", "aprovado"] } },
    orderBy: [{ principal: "desc" }, { ordem: "asc" }, { criadoEm: "asc" }, { id: "asc" }],
    select: { id: true, ordem: true, principal: true, textoAlternativo: true, statusProcessamento: true, criadoEm: true }
  }
};

export function createPartnerRepository(prisma) {
  return {
    findAdvertiser(usuarioId) {
      return prisma.anunciante.findUnique({ where: { usuarioId }, select: { id: true, statusVerificacao: true, nomeExibicao: true } });
    },
    findMembership(usuarioId, imobiliariaId) {
      return prisma.membroImobiliaria.findFirst({
        where: { usuarioId, imobiliariaId, status: "ativo", imobiliaria: { excluidoEm: null } },
        select: { papel: true, imobiliaria: { select: { id: true, status: true, nomeComercial: true } } }
      });
    },
    listProperties(ownerWhere, { status, take, skip }) {
      const where = { ...ownerWhere, ...(status ? { status } : {}) };
      return Promise.all([
        prisma.imovel.findMany({
          where, take, skip,
          orderBy: [{ atualizadoEm: "desc" }, { id: "desc" }],
          select: {
            id: true, status: true, revisao: true, titulo: true, valorAluguel: true, quartos: true, atualizadoEm: true, publicadoEm: true,
            tipoImovel: { select: { slug: true, nome: true } },
            endereco: { select: { bairro: { select: { slug: true, nome: true } } } },
            _count: { select: { fotos: { where: { excluidoEm: null, statusProcessamento: "aprovado" } } } }
          }
        }),
        prisma.imovel.count({ where })
      ]);
    },
    findProperty(ownerWhere, id, client = prisma) {
      return client.imovel.findFirst({ where: { ...ownerWhere, id }, select: PRIVATE_PROPERTY_SELECT });
    },
    findPhoto(ownerWhere, propertyId, photoId) {
      return prisma.fotoImovel.findFirst({
        where: { id: photoId, imovelId: propertyId, excluidoEm: null, imovel: { ...ownerWhere, id: propertyId } },
        select: { id: true, statusProcessamento: true, principal: true, chaveArmazenamento: true }
      });
    },
    countActivePhotos(propertyId, client = prisma) {
      return client.fotoImovel.count({ where: { imovelId: propertyId, excluidoEm: null, statusProcessamento: { in: ["pendente", "aprovado"] } } });
    },
    countApprovedPhotos(propertyId, client = prisma) {
      return client.fotoImovel.count({ where: { imovelId: propertyId, excluidoEm: null, statusProcessamento: "aprovado" } });
    },
    transaction(fn) {
      return prisma.$transaction(fn, { isolationLevel: "ReadCommitted", timeout: 10000 });
    }
  };
}
