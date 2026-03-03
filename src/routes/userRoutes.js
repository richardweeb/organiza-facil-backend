"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const userService_1 = require("../services/userService");
const requireAdmin_1 = require("../middlewares/requireAdmin");
const env_1 = require("../config/env");
exports.userRoutes = (0, express_1.Router)();
// Retorna usuário + canais (requer allowBotOrAuth)
exports.userRoutes.get("/user/me", (req, res) => {
    const userId = req.userId;
    const user = (0, userService_1.buscarUserPorId)(userId);
    if (!user)
        return res.status(404).json({ ok: false, error: "usuário não encontrado" });
    return res.json({ ok: true, user });
});
// Atualiza canal preferido (telegram|whatsapp)
exports.userRoutes.put("/user/preferred-channel", (req, res) => {
    const userId = req.userId;
    const preferredChannel = String(req.body?.preferredChannel ?? req.body?.preferred_channel ?? "").trim();
    if (preferredChannel !== "telegram" && preferredChannel !== "whatsapp") {
        return res
            .status(400)
            .json({ ok: false, error: "preferredChannel deve ser 'telegram' ou 'whatsapp'" });
    }
    const user = (0, userService_1.setPreferredChannel)(userId, preferredChannel);
    return res.json({ ok: true, user });
});
// Promove usuário a admin (apenas admin)
exports.userRoutes.post("/user/admin/grant", requireAdmin_1.requireAdmin, (req, res) => {
    const raw = String(req.body?.id ?? req.body?.userId ?? req.body?.user_id ?? "").trim();
    if (!raw)
        return res.status(400).json({ ok: false, error: "Informe um id" });
    const n = Number(raw);
    // tenta como user_id interno primeiro
    if (Number.isFinite(n) && n > 0) {
        const user = (0, userService_1.grantAdminByUserId)(n);
        if (user)
            return res.json({ ok: true, user, mode: "user_id" });
    }
    // fallback: trata como Telegram ID (external_id)
    const user = (0, userService_1.grantAdminByChannel)({ channel: "telegram", externalId: raw });
    if (!user)
        return res.status(404).json({ ok: false, error: "Usuário não encontrado" });
    return res.json({ ok: true, user, mode: "telegram_id" });
});
// Define cargo (admin|moderador|membro) (apenas admin)
exports.userRoutes.post("/user/role/set", requireAdmin_1.requireAdmin, (req, res) => {
    const rawId = String(req.body?.id ?? req.body?.userId ?? req.body?.user_id ?? "").trim();
    const role = String(req.body?.role ?? "").trim();
    const force = Boolean(req.body?.force);
    if (!rawId)
        return res.status(400).json({ ok: false, error: "Informe um id" });
    if (!role)
        return res.status(400).json({ ok: false, error: "Informe um cargo (admin|moderador|membro)" });
    const safe = (env_1.env.SAFE_ROLE_ASSIGN || "1") !== "0" && (env_1.env.SAFE_ROLE_ASSIGN || "1").toLowerCase() !== "false";
    const n = Number(rawId);
    // tenta como user_id interno
    if (Number.isFinite(n) && n > 0) {
        if (safe && !force && !(0, userService_1.hasAnyActiveChannel)(n)) {
            return res.status(400).json({
                ok: false,
                error: "Modo seguro ativo: esse usuário ainda não tem canal registrado (ele precisa iniciar conversa com o bot antes). Para ignorar, envie force=true.",
            });
        }
        const r = (0, userService_1.setRoleByUserId)(n, role);
        if (!r.ok)
            return res.status(400).json({ ok: false, error: r.error });
        return res.json({ ok: true, user: r.user, role: r.role, mode: "user_id" });
    }
    // fallback: Telegram ID
    const targetId = (0, userService_1.resolveUserIdByChannel)({ channel: "telegram", externalId: rawId });
    if (safe && !force && (!targetId || !(0, userService_1.hasAnyActiveChannel)(targetId))) {
        return res.status(400).json({
            ok: false,
            error: "Modo seguro ativo: esse Telegram ID ainda não está registrado. Peça para a pessoa mandar /start no bot antes. Para ignorar, envie force=true.",
        });
    }
    const r = (0, userService_1.setRoleByChannel)({ channel: "telegram", externalId: rawId, roleRaw: role });
    if (!r.ok)
        return res.status(400).json({ ok: false, error: r.error });
    return res.json({ ok: true, user: r.user, role: r.role, mode: "telegram_id" });
});
// Define plano (free|vip) (apenas admin)
exports.userRoutes.post("/user/plan/set", requireAdmin_1.requireAdmin, (req, res) => {
    const rawId = String(req.body?.id ?? req.body?.userId ?? req.body?.user_id ?? "").trim();
    const plan = String(req.body?.plan ?? "").trim();
    const force = Boolean(req.body?.force);
    if (!rawId)
        return res.status(400).json({ ok: false, error: "Informe um id" });
    if (!plan)
        return res.status(400).json({ ok: false, error: "Informe um plano (free|vip)" });
    // reutiliza o mesmo modo seguro dos cargos (usuário precisa existir/ter canal ativo)
    const safe = (env_1.env.SAFE_ROLE_ASSIGN || "1") !== "0" &&
        (env_1.env.SAFE_ROLE_ASSIGN || "1").toLowerCase() !== "false";
    const n = Number(rawId);
    if (Number.isFinite(n) && n > 0) {
        if (safe && !force && !(0, userService_1.hasAnyActiveChannel)(n)) {
            return res.status(400).json({
                ok: false,
                error: "Modo seguro ativo: esse usuário ainda não tem canal registrado (ele precisa iniciar conversa com o bot antes). Para ignorar, envie force=true.",
            });
        }
        const r = (0, userService_1.setPlanByUserId)(n, plan);
        if (!r.ok)
            return res.status(400).json({ ok: false, error: r.error });
        return res.json({ ok: true, user: r.user, plan: r.plan, mode: "user_id" });
    }
    const targetId = (0, userService_1.resolveUserIdByChannel)({ channel: "telegram", externalId: rawId });
    if (safe && !force && (!targetId || !(0, userService_1.hasAnyActiveChannel)(targetId))) {
        return res.status(400).json({
            ok: false,
            error: "Modo seguro ativo: esse Telegram ID ainda não está registrado. Peça para a pessoa mandar /start no bot antes. Para ignorar, envie force=true.",
        });
    }
    const r = (0, userService_1.setPlanByChannel)({ channel: "telegram", externalId: rawId, planRaw: plan });
    if (!r.ok)
        return res.status(400).json({ ok: false, error: r.error });
    return res.json({ ok: true, user: r.user, plan: r.plan, mode: "telegram_id" });
});
// Revoga poderes (volta pra membro) (apenas admin)
exports.userRoutes.post("/user/role/revoke", requireAdmin_1.requireAdmin, (req, res) => {
    const rawId = String(req.body?.id ?? req.body?.userId ?? req.body?.user_id ?? "").trim();
    const force = Boolean(req.body?.force);
    if (!rawId)
        return res.status(400).json({ ok: false, error: "Informe um id" });
    const safe = (env_1.env.SAFE_ROLE_ASSIGN || "1") !== "0" && (env_1.env.SAFE_ROLE_ASSIGN || "1").toLowerCase() !== "false";
    const n = Number(rawId);
    if (Number.isFinite(n) && n > 0) {
        if (safe && !force && !(0, userService_1.hasAnyActiveChannel)(n)) {
            return res.status(400).json({ ok: false, error: "Modo seguro ativo: usuário sem canal registrado." });
        }
        const r = (0, userService_1.setRoleByUserId)(n, "membro");
        if (!r.ok)
            return res.status(400).json({ ok: false, error: r.error });
        return res.json({ ok: true, user: r.user, role: r.role, mode: "user_id" });
    }
    const targetId = (0, userService_1.resolveUserIdByChannel)({ channel: "telegram", externalId: rawId });
    if (safe && !force && (!targetId || !(0, userService_1.hasAnyActiveChannel)(targetId))) {
        return res.status(400).json({ ok: false, error: "Modo seguro ativo: Telegram ID não registrado." });
    }
    const r = (0, userService_1.setRoleByChannel)({ channel: "telegram", externalId: rawId, roleRaw: "membro" });
    if (!r.ok)
        return res.status(400).json({ ok: false, error: r.error });
    return res.json({ ok: true, user: r.user, role: r.role, mode: "telegram_id" });
});
// Lista membros agrupados por cargo + contagem (apenas admin)
exports.userRoutes.get("/user/members/summary", requireAdmin_1.requireAdmin, (req, res) => {
    const data = (0, userService_1.listMembersByRole)();
    return res.json({ ok: true, ...data });
});
// Listas rápidas por cargo (apenas admin)
exports.userRoutes.get("/user/members/admins", requireAdmin_1.requireAdmin, (req, res) => {
    const admins = (0, userService_1.listUsersByRole)("admin");
    return res.json({ ok: true, admins, count: admins.length });
});
exports.userRoutes.get("/user/members/moderadores", requireAdmin_1.requireAdmin, (req, res) => {
    const moderadores = (0, userService_1.listUsersByRole)("moderador");
    return res.json({ ok: true, moderadores, count: moderadores.length });
});
// Ban / Unban (apenas admin)
// body: { id: "2" | "telegramId", duration?: "7d" | "2h" | "30m", reason?: "..." }
exports.userRoutes.post("/user/ban", requireAdmin_1.requireAdmin, (req, res) => {
    const rawId = String(req.body?.id ?? req.body?.userId ?? req.body?.user_id ?? "").trim();
    const durationRaw = String(req.body?.duration ?? "").trim();
    const reason = req.body?.reason ? String(req.body.reason) : null;
    if (!rawId)
        return res.status(400).json({ ok: false, error: "Informe um id" });
    const durationMs = durationRaw ? (0, userService_1.parseDurationToMs)(durationRaw) : null;
    if (durationRaw && !durationMs) {
        return res.status(400).json({ ok: false, error: "Duração inválida. Ex.: 30m, 2h, 7d, 1w" });
    }
    const n = Number(rawId);
    if (Number.isFinite(n) && n > 0) {
        const user = (0, userService_1.banUserById)({ targetUserId: n, durationMs, reason });
        if (!user)
            return res.status(404).json({ ok: false, error: "Usuário não encontrado" });
        return res.json({ ok: true, user, mode: "user_id" });
    }
    const targetId = (0, userService_1.resolveUserIdByChannel)({ channel: "telegram", externalId: rawId });
    if (!targetId)
        return res.status(404).json({ ok: false, error: "Usuário não encontrado" });
    const user = (0, userService_1.banUserById)({ targetUserId: targetId, durationMs, reason });
    return res.json({ ok: true, user, mode: "telegram_id" });
});
exports.userRoutes.post("/user/unban", requireAdmin_1.requireAdmin, (req, res) => {
    const rawId = String(req.body?.id ?? req.body?.userId ?? req.body?.user_id ?? "").trim();
    if (!rawId)
        return res.status(400).json({ ok: false, error: "Informe um id" });
    const n = Number(rawId);
    if (Number.isFinite(n) && n > 0) {
        const user = (0, userService_1.unbanUserById)(n);
        if (!user)
            return res.status(404).json({ ok: false, error: "Usuário não encontrado" });
        return res.json({ ok: true, user, mode: "user_id" });
    }
    const targetId = (0, userService_1.resolveUserIdByChannel)({ channel: "telegram", externalId: rawId });
    if (!targetId)
        return res.status(404).json({ ok: false, error: "Usuário não encontrado" });
    const user = (0, userService_1.unbanUserById)(targetId);
    return res.json({ ok: true, user, mode: "telegram_id" });
});
