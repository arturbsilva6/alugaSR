import { clearSessionCookie, setSessionCookie } from "../middlewares/auth.js";

export function createAuthController({ authService, config }) {
  return {
    async login(req, res) {
      const session = await authService.login(req.body, { ip: req.ip });
      setSessionCookie(res, config, session.token, session.expiresAt);
      const auth = await authService.resolveSession(session.token);
      res.status(200).json({ data: { user: auth.user, csrfToken: session.csrfToken, expiresAt: session.expiresAt.toISOString() } });
    },
    async session(req, res) {
      res.json({ data: {
        user: req.auth.user,
        csrfToken: authService.csrfFor(req.auth.tokenHash),
        contexts: await authService.contexts(req.auth.user.id)
      } });
    },
    async logout(req, res) {
      if (req.auth) await authService.logout(req.auth);
      clearSessionCookie(res, config);
      res.status(204).end();
    },
    async logoutAll(req, res) {
      await authService.logoutAll(req.auth);
      clearSessionCookie(res, config);
      res.status(204).end();
    },
    async changePassword(req, res) {
      await authService.changePassword(req.auth, req.body);
      res.status(204).end();
    },
    async me(req, res) {
      res.json({ data: { ...req.auth.user, contexts: await authService.contexts(req.auth.user.id) } });
    }
  };
}
