export function createCatalogService(catalogRepository) {
  return {
    async neighborhoods() {
      const rows = await catalogRepository.neighborhoods();
      // EXT-01 pendente: a fonte é exposta para não sugerir cobertura oficial completa.
      return rows.map(r => ({ id: r.id, slug: r.slug, name: r.nome, source: r.fonteDados ?? null }));
    },
    async propertyTypes() {
      return (await catalogRepository.propertyTypes()).map(r => ({ id: r.id, slug: r.slug, name: r.nome }));
    },
    async features() {
      return (await catalogRepository.features()).map(r => ({ id: r.id, slug: r.slug, name: r.nome, category: r.categoria ?? null }));
    }
  };
}
