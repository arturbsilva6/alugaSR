import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { errors } from "../lib/errors.js";
import { createValidator, rejectUnknownKeys } from "../lib/validation.js";
import { dummyVerify, hashPassword, passwordProblems, verifyPassword } from "../lib/password.js";
import { createRateLimiter } from "../lib/rateLimit.js";

const sha256 = value => createHash("sha256").update(value).digest("hex");
export const normalizeEmail = email => String(email).normalize("NFC").trim().toLowerCase();

// ADR-006/DEC-009: sessão de primeira parte com token opaco aleatório (256 bits).
// Só o hash SHA-256 é persistido; o token bruto existe apenas no cookie HttpOnly.
export function createAuthService({ repository, audit, config, now = () => new Date() }) {
  const loginByIp = createRateLimiter({ windowMs: 15 * 60_000, max: config.rateLimits.loginPerIpPer15Min });
  const failuresByAccount = createRateLimiter({ windowMs: 15 * 60_000, max: config.rateLimits.loginFailuresPerAccount });

  function csrfFor(tokenHash) {
    return createHmac("sha256", config.sessionSecret).update(`csrf:${tokenHash}`).digest("base64url");
  }

  async function issueSession(userId) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256(token);
    const created = now();
    const expiraEm = new Date(created.getTime() + config.sessionAbsoluteMinutes * 60_000);
    await repository.createSession({ usuarioId: userId, tokenHash, expiraEm, criadoEm: created, ultimoAcessoEm: created });
    return { token, csrfToken: csrfFor(tokenHash), expiresAt: expiraEm };
  }

  return {
    csrfFor,

    async login(body, { ip }) {
      const v = createValidator();
      rejectUnknownKeys(body, ["email", "password"], v);
      if (typeof body?.email !== "string" || body.email.length > 254) v.fail("email", "obrigatório");
      if (typeof body?.password !== "string" || body.password.length === 0 || body.password.length > 128) v.fail("password", "obrigatório");
      v.throwIfInvalid();

      const email = normalizeEmail(body.email);
      const accountKey = sha256(`acct:${email}`);
      if (!loginByIp.consume(`ip:${ip}`) || failuresByAccount.isBlocked(accountKey)) throw errors.rateLimited();

      const user = await repository.findUserForLogin(email);
      const account = user?.contas?.[0];
      const valid = account?.senhaHash
        ? await verifyPassword(body.password, account.senhaHash)
        : await dummyVerify(body.password);

      // Resposta neutra: não revela se o e-mail existe nem se a conta está suspensa.
      if (!valid || user.status !== "ativo") {
        failuresByAccount.consume(accountKey);
        await audit.record({ actorId: valid ? user.id : null, action: "auth.login.failure", resourceType: "sessao",
          metadata: { motivo: valid ? "conta_inativa" : "credenciais" } });
        throw errors.invalidCredentials();
      }
      failuresByAccount.reset(accountKey);
      const session = await issueSession(user.id);
      await audit.record({ actorId: user.id, action: "auth.login.success", resourceType: "sessao" });
      return session;
    },

    // Valida o cookie a cada requisição: expiração absoluta, inatividade, revogação
    // e situação atual da conta (suspensão revoga o acesso na requisição seguinte).
    async resolveSession(token) {
      if (typeof token !== "string" || !/^[\w-]{43}$/.test(token)) return null;
      const tokenHash = sha256(token);
      const session = await repository.findSessionByHash(tokenHash);
      if (!session || session.revogadaEm) return null;
      const at = now();
      const idleLimit = new Date((session.ultimoAcessoEm ?? session.criadoEm).getTime() + config.sessionIdleMinutes * 60_000);
      if (session.expiraEm <= at || idleLimit <= at) {
        await repository.revokeSession(session.id, at);
        return null;
      }
      const user = session.usuario;
      if (user.status !== "ativo" || user.excluidoEm) {
        await repository.revokeSession(session.id, at);
        return null;
      }
      if (!session.ultimoAcessoEm || at - session.ultimoAcessoEm > 60_000) await repository.touchSession(session.id, at);
      return {
        sessionId: session.id,
        tokenHash,
        user: { id: user.id, name: user.nome, email: user.email, roles: user.papeis.map(p => p.papel).sort() }
      };
    },

    verifyCsrf(tokenHash, provided) {
      if (typeof provided !== "string" || provided.length > 128) return false;
      const expected = Buffer.from(csrfFor(tokenHash));
      const received = Buffer.from(provided);
      return expected.length === received.length && timingSafeEqual(expected, received);
    },

    async logout(auth) {
      await repository.revokeSession(auth.sessionId, now());
      await audit.record({ actorId: auth.user.id, action: "auth.logout", resourceType: "sessao", resourceId: auth.sessionId });
    },

    async logoutAll(auth) {
      const { count } = await repository.revokeAllForUser(auth.user.id, now());
      await audit.record({ actorId: auth.user.id, action: "auth.logout_all", resourceType: "sessao", metadata: { sessoes: count } });
    },

    // Troca de senha exige a senha atual e revoga as demais sessões (seção 18.2).
    async changePassword(auth, body) {
      const v = createValidator();
      rejectUnknownKeys(body, ["currentPassword", "newPassword"], v);
      if (typeof body?.currentPassword !== "string" || body.currentPassword.length > 128) v.fail("currentPassword", "obrigatório");
      for (const p of passwordProblems(body?.newPassword)) v.fail("newPassword", p);
      v.throwIfInvalid();
      const account = await repository.findLocalAccount(auth.user.id);
      if (!account || !(await verifyPassword(body.currentPassword, account.senhaHash))) throw errors.invalidCredentials();
      await repository.updatePasswordHash(account.id, await hashPassword(body.newPassword));
      await repository.revokeAllForUser(auth.user.id, now(), { exceptId: auth.sessionId });
      await audit.record({ actorId: auth.user.id, action: "auth.password.change", resourceType: "usuario", resourceId: auth.user.id });
    },

    async contexts(userId) {
      const data = await repository.listContexts(userId);
      return {
        individual: data?.anunciante ? {
          advertiserId: data.anunciante.id, displayName: data.anunciante.nomeExibicao,
          verificationStatus: data.anunciante.statusVerificacao,
          canSubmit: data.anunciante.statusVerificacao === "verificado"
        } : null,
        agencies: (data?.membros ?? []).map(m => ({
          agencyId: m.imobiliaria.id, name: m.imobiliaria.nomeComercial, role: m.papel,
          verificationStatus: m.imobiliaria.status,
          canManageProperties: ["responsavel", "gestor"].includes(m.papel),
          canSubmit: ["responsavel", "gestor"].includes(m.papel) && m.imobiliaria.status === "verificado"
        }))
      };
    }
  };
}
