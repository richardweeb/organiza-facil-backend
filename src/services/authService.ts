import { db } from "../config/db";
import { buscarUserPorId as buscarUserPorIdV3, findOrCreateByChannel } from "./userService";

function nowISO() {
  return new Date().toISOString();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function criarLoginCode(ttlMinutes = 10) {
  for (let i = 0; i < 5; i++) {
    const code = randomCode(6);
    const createdAt = nowISO();
    const expiresAt = addMinutes(new Date(), ttlMinutes).toISOString();

    try {
      db.prepare(
        "INSERT INTO login_codes (code, created_at, expires_at) VALUES (?, ?, ?)"
      ).run(code, createdAt, expiresAt);

      return { code, expiresAt };
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("unique")) continue;
      throw e;
    }
  }
  throw new Error("NAO_FOI_POSSIVEL_GERAR_CODE");
}

export function consumirLoginCodeEConectarTelegram(params: {
  code: string;
  telegramUserId: number;
  telegramUsername?: string;
}) {
  const code = params.code.trim().toUpperCase();

  const row = db
    .prepare("SELECT code, expires_at, consumed_at FROM login_codes WHERE code = ?")
    .get(code) as { code: string; expires_at: string; consumed_at: string | null } | undefined;

  if (!row) throw new Error("CODE_INVALIDO");
  if (row.consumed_at) throw new Error("CODE_JA_USADO");
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("CODE_EXPIRADO");

  const user = findOrCreateByChannel({
    channel: "telegram",
    externalId: String(params.telegramUserId),
    username: params.telegramUsername ?? null,
    address: null,
  });

  db.prepare("UPDATE login_codes SET consumed_at = ?, user_id = ? WHERE code = ?").run(
    nowISO(),
    user.id,
    code
  );

  return { userId: user.id };
}

export function finalizarLoginWeb(codeInput: string) {
  const code = codeInput.trim().toUpperCase();

  const row = db
    .prepare("SELECT code, expires_at, consumed_at, user_id FROM login_codes WHERE code = ?")
    .get(code) as
      | { code: string; expires_at: string; consumed_at: string | null; user_id: number | null }
      | undefined;

  if (!row) throw new Error("CODE_INVALIDO");
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("CODE_EXPIRADO");
  if (!row.consumed_at || !row.user_id) throw new Error("CODE_AINDA_NAO_CONFIRMADO");

  db.prepare("DELETE FROM login_codes WHERE code = ?").run(code);

  return { userId: row.user_id };
}

export function buscarUserPorId(userId: number) {
  return buscarUserPorIdV3(userId);
}