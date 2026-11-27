export function createCatalogRepository(prisma) {
  return {
    neighborhoods() {
      return prisma.bairro.findMany({
        where: { ativo: true },
        select: { id: true, slug: true, nome: true, fonteDados: true },
        orderBy: [{ nome: "asc" }, { id: "asc" }]
      });
    },
    propertyTypes() {
      return prisma.tipoImovel.findMany({
        where: { ativo: true }, select: { id: true, slug: true, nome: true }, orderBy: [{ nome: "asc" }, { id: "asc" }]
      });
    },
    features() {
      return prisma.caracteristica.findMany({
        where: { ativo: true }, select: { id: true, slug: true, nome: true, categoria: true },
        orderBy: [{ nome: "asc" }, { id: "asc" }]
      });
    },
    async activeNeighborhood(id) {
      return prisma.bairro.findFirst({ where: { id, ativo: true }, select: { id: true } });
    },
    async activeType(id) {
      return prisma.tipoImovel.findFirst({ where: { id, ativo: true }, select: { id: true } });
    },
    async activeFeatureIds(ids) {
      const rows = await prisma.caracteristica.findMany({ where: { id: { in: ids }, ativo: true }, select: { id: true } });
      return rows.map(r => r.id);
    }
  };
}
