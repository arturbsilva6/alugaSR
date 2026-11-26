// Auditoria append-only (trigger no banco impede UPDATE/DELETE).
// Metadados devem ser minimizados: nunca senha, token, cookie, endereço, e-mail.
export function createAuditRepository(prisma) {
  return {
    record(entry, client = prisma) {
      return client.logAuditoria.create({
        data: {
          atorId: entry.actorId ?? null,
          acao: entry.action,
          tipoRecurso: entry.resourceType,
          recursoId: entry.resourceId ?? null,
          metadados: entry.metadata ?? undefined
        },
        select: { id: true }
      });
    },
    listForResource(resourceType, resourceId, actions) {
      return prisma.logAuditoria.findMany({
        where: { tipoRecurso: resourceType, recursoId: resourceId, acao: { in: actions } },
        orderBy: [{ ocorridoEm: "desc" }, { id: "desc" }],
        take: 50,
        select: { acao: true, metadados: true, ocorridoEm: true, atorId: true }
      });
    }
  };
}
