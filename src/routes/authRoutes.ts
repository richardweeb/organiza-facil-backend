import { Router } from "express";
import {
  buscarUserPorId,
  criarLoginCode,
  consumirLoginCodeEConectarTelegram,
  finalizarLoginWeb,
} from "../services/authService";

export const authRoutes = Router();

authRoutes.post("/auth/request-code", (_req, res) => {
  const { code, expiresAt } = criarLoginCode(10);
  return res.json({ ok: true, code, expiresAt });
});

authRoutes.post("/auth/telegram-link", (req, res) => {
  const { code, telegramUserId, telegramUsername } = req.body as {
    code?: string;
    telegramUserId?: number;
    telegramUsername?: string;
  };

  if (typeof code !== "string" || code.trim().length < 4) {
    return res.status(400).json({ ok: false, error: "code inválido" });
  }
  if (typeof telegramUserId !== "number" || !Number.isFinite(telegramUserId)) {
    return res.status(400).json({ ok: false, error: "telegramUserId inválido" });
  }

  try {
    const { userId } = consumirLoginCodeEConectarTelegram({
      code,
      telegramUserId,
      telegramUsername,
    });

    return res.json({ ok: true, userId });
  } catch (e: any) {
    const msg = String(e?.message || "ERRO");
    const map: Record<string, string> = {
      CODE_INVALIDO: "Código inválido.",
      CODE_EXPIRADO: "Código expirado. Gere outro no site.",
      CODE_JA_USADO: "Esse código já foi usado. Gere outro no site.",
    };
    return res.status(400).json({ ok: false, error: map[msg] || "Falha ao vincular" });
  }
});

authRoutes.post("/auth/web-login", (req, res) => {
  const { code } = req.body as { code?: string };

  if (typeof code !== "string" || code.trim().length < 4) {
    return res.status(400).json({ ok: false, error: "code inválido" });
  }

  try {
    const { userId } = finalizarLoginWeb(code);
    req.session.userId = userId;
    return res.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || "ERRO");
    const map: Record<string, string> = {
      CODE_INVALIDO: "Código inválido.",
      CODE_EXPIRADO: "Código expirado. Gere outro no site.",
      CODE_AINDA_NAO_CONFIRMADO: "Ainda não foi confirmado no Telegram. Use /login CODIGO.",
    };
    return res.status(400).json({ ok: false, error: map[msg] || "Erro ao logar." });
  }
});

authRoutes.get("/auth/me", (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "não autenticado" });

  const user = buscarUserPorId(userId);
  if (!user) return res.status(401).json({ ok: false, error: "sessão inválida" });

  return res.json({ ok: true, user });
});

authRoutes.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});