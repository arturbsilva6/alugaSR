import { createHmac, timingSafeEqual } from "node:crypto";

// Cursor opaco assinado (HMAC) para paginação determinística por keyset.
// A assinatura impede adulteração para enumerar registros fora da ordenação.
export function createCursorCodec(secret) {
  const sign = payload => createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 22);
  return {
    encode(data) {
      const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
      return `${payload}.${sign(payload)}`;
    },
    decode(cursor) {
      if (typeof cursor !== "string" || cursor.length > 512) return null;
      const [payload, sig] = cursor.split(".");
      if (!payload || !sig) return null;
      const expected = Buffer.from(sign(payload));
      const received = Buffer.from(sig);
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
      try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
      catch { return null; }
    }
  };
}
