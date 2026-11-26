export function createAuthRepository(prisma) {
  return {
    findUserForLogin(email) {
      return prisma.usuario.findFirst({
        where: { email, excluidoEm: null },
        select: {
          id: true, status: true,
          contas: { where: { provedor: "local" }, select: { id: true, senhaHash: true } }
        }
      });
    },
    findLocalAccount(userId) {
      return prisma.contaAutenticacao.findFirst({ where: { usuarioId: userId, provedor: "local" }, select: { id: true, senhaHash: true } });
    },
    updatePasswordHash(accountId, senhaHash) {
      return prisma.contaAutenticacao.update({ where: { id: accountId }, data: { senhaHash } });
    },
    createSession(data) {
      return prisma.sessao.create({ data, select: { id: true, expiraEm: true } });
    },
    findSessionByHash(tokenHash) {
      return prisma.sessao.findUnique({
        where: { tokenHash },
        select: {
          id: true, usuarioId: true, expiraEm: true, revogadaEm: true, ultimoAcessoEm: true, criadoEm: true,
          usuario: {
            select: {
              id: true, nome: true, email: true, status: true, excluidoEm: true,
              papeis: { select: { papel: true } }
            }
          }
        }
      });
    },
    touchSession(id, at) {
      return prisma.sessao.update({ where: { id }, data: { ultimoAcessoEm: at } });
    },
    revokeSession(id, at) {
      return prisma.sessao.updateMany({ where: { id, revogadaEm: null }, data: { revogadaEm: at } });
    },
    revokeAllForUser(usuarioId, at, { exceptId } = {}) {
      return prisma.sessao.updateMany({
        where: { usuarioId, revogadaEm: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
        data: { revogadaEm: at }
      });
    },
    listContexts(usuarioId) {
      return prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          anunciante: { select: { id: true, nomeExibicao: true, statusVerificacao: true } },
          membros: {
            where: { status: "ativo", imobiliaria: { excluidoEm: null } },
            select: { papel: true, imobiliaria: { select: { id: true, nomeComercial: true, status: true } } },
            orderBy: { criadoEm: "asc" }
          }
        }
      });
    }
  };
}
