import { Router } from "express";
import {
  buscarUserPorId,
  setPreferredChannel,
  grantAdminByChannel,
  grantAdminByUserId,
  setRoleByChannel,
  setRoleByUserId,
  listMembersByRole,
  hasAnyActiveChannel,
  resolveUserIdByChannel,
  listUsersByRole,
  Role,
  setPlanByChannel,
  setPlanByUserId,
  banUserById,
  unbanUserById,
  parseDurationToMs,
  listBannedUsers,
  getAdminStats,
} from "../services/userService";
import { requireAdmin } from "../middlewares/requireAdmin";
import { env } from "../config/env";
import { asyncHandler } from "../lib/http/asyncHandler";
import { validate } from "../lib/http/validate";
import { AppError } from "../lib/errors/AppError";
import {
  preferredChannelSchema,
  roleSchema,
  planSchema,
  idSchema,
  banSchema,
  bannedQuerySchema,
  revokeRoleSchema,
} from "./schemas/userSchemas";

export const userRoutes = Router();

// Retorna usuário + canais (requer allowBotOrAuth)
userRoutes.get("/user/me", (req, res) => {
  const userId = req.userId as number;
  const user = buscarUserPorId(userId);
  if (!user) throw new AppError("usuário não encontrado", 404);
  return res.json({ ok: true, user });
});

// Atualiza canal preferido (telegram|whatsapp)
userRoutes.put(
  "/user/preferred-channel",
  validate(preferredChannelSchema),
  asyncHandler((req, res) => {
    const userId = req.userId as number;
    const { preferredChannel } = req.body as { preferredChannel: "telegram" | "whatsapp" };
    const user = setPreferredChannel(userId, preferredChannel);
    return res.json({ ok: true, user });
  })
);

// Promove usuário a admin (apenas admin)
userRoutes.post(
  "/user/admin/grant",
  requireAdmin,
  validate(idSchema),
  asyncHandler((req, res) => {
    const raw = String((req.body as any).id).trim();

  const n = Number(raw);
  // tenta como user_id interno primeiro
  if (Number.isFinite(n) && n > 0) {
    const user = grantAdminByUserId(n);
    if (user) return res.json({ ok: true, user, mode: "user_id" });
  }

  // fallback: trata como Telegram ID (external_id)
  const user = grantAdminByChannel({ channel: "telegram", externalId: raw });
    if (!user) throw new AppError("Usuário não encontrado", 404);
    return res.json({ ok: true, user, mode: "telegram_id" });
  })
);

// Define cargo (admin|moderador|membro) (apenas admin)
userRoutes.post(
  "/user/role/set",
  requireAdmin,
  validate(roleSchema),
  asyncHandler((req, res) => {
    const { id, role, force } = req.body as { id: string | number; role: string; force?: boolean };
    const rawId = String(id).trim();

  const safe = (env.SAFE_ROLE_ASSIGN || "1") !== "0" && (env.SAFE_ROLE_ASSIGN || "1").toLowerCase() !== "false";

  const n = Number(rawId);
  // tenta como user_id interno
  if (Number.isFinite(n) && n > 0) {
    if (safe && !force && !hasAnyActiveChannel(n)) {
      throw new AppError(
        "Modo seguro ativo: esse usuário ainda não tem canal registrado (ele precisa iniciar conversa com o bot antes). Para ignorar, envie force=true.",
        400
      );
    }
    const r = setRoleByUserId(n, role);
    if (!r.ok) throw new AppError(r.error || "Erro ao definir cargo", 400);
    return res.json({ ok: true, user: r.user, role: r.role, mode: "user_id" });
  }

  // fallback: Telegram ID
  const targetId = resolveUserIdByChannel({ channel: "telegram", externalId: rawId });
  if (safe && !force && (!targetId || !hasAnyActiveChannel(targetId))) {
    throw new AppError(
      "Modo seguro ativo: esse Telegram ID ainda não está registrado. Peça para a pessoa mandar /start no bot antes. Para ignorar, envie force=true.",
      400
    );
  }
  const r = setRoleByChannel({ channel: "telegram", externalId: rawId, roleRaw: role });
  if (!r.ok) throw new AppError(r.error || "Erro ao definir cargo", 400);
  return res.json({ ok: true, user: r.user, role: r.role, mode: "telegram_id" });
  })
);


// Define plano (free|vip) (apenas admin)
userRoutes.post(
  "/user/plan/set",
  requireAdmin,
  validate(planSchema),
  asyncHandler((req, res) => {
    const { id, plan, force } = req.body as { id: string | number; plan: string; force?: boolean };
    const rawId = String(id).trim();

  // reutiliza o mesmo modo seguro dos cargos (usuário precisa existir/ter canal ativo)
  const safe =
    (env.SAFE_ROLE_ASSIGN || "1") !== "0" &&
    (env.SAFE_ROLE_ASSIGN || "1").toLowerCase() !== "false";

  const n = Number(rawId);
  if (Number.isFinite(n) && n > 0) {
    if (safe && !force && !hasAnyActiveChannel(n)) {
      throw new AppError(
        "Modo seguro ativo: esse usuário ainda não tem canal registrado (ele precisa iniciar conversa com o bot antes). Para ignorar, envie force=true.",
        400
      );
    }
    const r = setPlanByUserId(n, plan);
    if (!r.ok) throw new AppError(r.error || "Erro ao definir plano", 400);
    return res.json({ ok: true, user: r.user, plan: r.plan, mode: "user_id" });
  }

  const targetId = resolveUserIdByChannel({ channel: "telegram", externalId: rawId });
  if (safe && !force && (!targetId || !hasAnyActiveChannel(targetId))) {
    throw new AppError(
      "Modo seguro ativo: esse Telegram ID ainda não está registrado. Peça para a pessoa mandar /start no bot antes. Para ignorar, envie force=true.",
      400
    );
  }

  const r = setPlanByChannel({ channel: "telegram", externalId: rawId, planRaw: plan });
  if (!r.ok) throw new AppError(r.error || "Erro ao definir plano", 400);
  return res.json({ ok: true, user: r.user, plan: r.plan, mode: "telegram_id" });
  })
);

// Revoga poderes (volta pra membro) (apenas admin)
userRoutes.post(
  "/user/role/revoke",
  requireAdmin,
  validate(revokeRoleSchema),
  asyncHandler((req, res) => {
    const { id, force } = req.body as { id: string | number; force?: boolean };
    const rawId = String(id).trim();

  const safe = (env.SAFE_ROLE_ASSIGN || "1") !== "0" && (env.SAFE_ROLE_ASSIGN || "1").toLowerCase() !== "false";

  const n = Number(rawId);
  if (Number.isFinite(n) && n > 0) {
    if (safe && !force && !hasAnyActiveChannel(n)) {
      throw new AppError("Modo seguro ativo: usuário sem canal registrado.", 400);
    }
    const r = setRoleByUserId(n, "membro");
    if (!r.ok) throw new AppError(r.error || "Erro ao revogar cargo", 400);
    return res.json({ ok: true, user: r.user, role: r.role, mode: "user_id" });
  }

  const targetId = resolveUserIdByChannel({ channel: "telegram", externalId: rawId });
  if (safe && !force && (!targetId || !hasAnyActiveChannel(targetId))) {
    throw new AppError("Modo seguro ativo: Telegram ID não registrado.", 400);
  }

  const r = setRoleByChannel({ channel: "telegram", externalId: rawId, roleRaw: "membro" });
  if (!r.ok) throw new AppError(r.error || "Erro ao revogar cargo", 400);
  return res.json({ ok: true, user: r.user, role: r.role, mode: "telegram_id" });
  })
);

// Lista membros agrupados por cargo + contagem (apenas admin)
userRoutes.get("/user/members/summary", requireAdmin, (req, res) => {
  const data = listMembersByRole();
  return res.json({ ok: true, ...data });
});

// Listas rápidas por cargo (apenas admin)
userRoutes.get("/user/members/admins", requireAdmin, (req, res) => {
  const admins = listUsersByRole("admin" as Role);
  return res.json({ ok: true, admins, count: admins.length });
});

userRoutes.get("/user/members/moderadores", requireAdmin, (req, res) => {
  const moderadores = listUsersByRole("moderador" as Role);
  return res.json({ ok: true, moderadores, count: moderadores.length });
});

// Lista usuários banidos + motivos (apenas admin)
// query: ?activeOnly=1 (padrão) | 0 para incluir bans expirados
userRoutes.get("/user/banned", requireAdmin, (req, res) => {
  const activeOnlyRaw = String(req.query?.activeOnly ?? "1").trim();
  const activeOnly = !(activeOnlyRaw === "0" || activeOnlyRaw.toLowerCase() === "false");
  const banned = listBannedUsers({ activeOnly });
  return res.json({ ok: true, activeOnly, count: banned.length, banned });
});

// Estatísticas rápidas de admin (apenas admin)
userRoutes.get("/user/admin/stats", requireAdmin, (_req, res) => {
  const stats = getAdminStats();
  return res.json({ ok: true, stats });
});

// Ban / Unban (apenas admin)
// body: { id: "2" | "telegramId", duration?: "7d" | "2h" | "30m", reason?: "..." }
userRoutes.post("/user/ban", requireAdmin, (req, res) => {
  const rawId = String(req.body?.id ?? req.body?.userId ?? req.body?.user_id ?? "").trim();
  const durationRaw = String(req.body?.duration ?? "").trim();
  const reason = req.body?.reason ? String(req.body.reason) : null;

  const durationMs = durationRaw ? parseDurationToMs(durationRaw) : null;
  if (durationRaw && !durationMs) {
    throw new AppError("Duração inválida. Ex.: 30m, 2h, 7d, 1w", 400);
  }

  const n = Number(rawId);
  if (Number.isFinite(n) && n > 0) {
    const user = banUserById({ targetUserId: n, durationMs, reason });
    if (!user) throw new AppError("Usuário não encontrado", 404);
    return res.json({ ok: true, user, mode: "user_id" });
  }

  const targetId = resolveUserIdByChannel({ channel: "telegram", externalId: rawId });
  if (!targetId) throw new AppError("Usuário não encontrado", 404);
  const user = banUserById({ targetUserId: targetId, durationMs, reason });
  return res.json({ ok: true, user, mode: "telegram_id" });
});

userRoutes.post("/user/unban", requireAdmin, (req, res) => {
  const rawId = String(req.body?.id ?? req.body?.userId ?? req.body?.user_id ?? "").trim();
  if (!rawId) throw new AppError("Informe um id", 400);

  const n = Number(rawId);
  if (Number.isFinite(n) && n > 0) {
    const user = unbanUserById(n);
    if (!user) throw new AppError("Usuário não encontrado", 404);
    return res.json({ ok: true, user, mode: "user_id" });
  }

  const targetId = resolveUserIdByChannel({ channel: "telegram", externalId: rawId });
  if (!targetId) throw new AppError("Usuário não encontrado", 404);
  const user = unbanUserById(targetId);
  return res.json({ ok: true, user, mode: "telegram_id" });
});