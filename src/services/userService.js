"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateByChannel = findOrCreateByChannel;
exports.buscarUserPorId = buscarUserPorId;
exports.setPreferredChannel = setPreferredChannel;
exports.getUserFlags = getUserFlags;
exports.parseDurationToMs = parseDurationToMs;
exports.banUserById = banUserById;
exports.unbanUserById = unbanUserById;
exports.hasAnyActiveChannel = hasAnyActiveChannel;
exports.resolveUserIdByChannel = resolveUserIdByChannel;
exports.listUsersByRole = listUsersByRole;
exports.grantAdminByUserId = grantAdminByUserId;
exports.grantAdminByChannel = grantAdminByChannel;
exports.setRoleByUserId = setRoleByUserId;
exports.setRoleByChannel = setRoleByChannel;
exports.listMembersByRole = listMembersByRole;
exports.setPlanByUserId = setPlanByUserId;
exports.setPlanByChannel = setPlanByChannel;
exports.listMembersByRoleAndPlan = listMembersByRoleAndPlan;
const db_1 = require("../config/db");
function nowISO() {
    return new Date().toISOString();
}
function normalizePlan(raw) {
    const p = String(raw || "").trim().toLowerCase();
    if (p === "free" || p === "gratuito")
        return "free";
    if (p === "vip" || p === "premium" || p === "pro")
        return "vip";
    return null;
}
function normalizeRole(raw) {
    const r = String(raw || "").trim().toLowerCase();
    if (r === "admin" || r === "administrador")
        return "admin";
    if (r === "moderador" || r === "mod" || r === "moderator")
        return "moderador";
    if (r === "membro" || r === "member" || r === "user")
        return "membro";
    return null;
}
function findOrCreateByChannel(params) {
    const channel = params.channel;
    const externalId = String(params.externalId);
    const username = params.username ?? null;
    const address = params.address ?? null;
    const row = db_1.db
        .prepare("SELECT uc.user_id as user_id FROM user_channels uc WHERE uc.channel = ? AND uc.external_id = ? AND uc.is_active = 1")
        .get(channel, externalId);
    if (row?.user_id) {
        // refresh basic metadata
        db_1.db.prepare("UPDATE user_channels SET username = COALESCE(?, username), address = COALESCE(?, address), updated_at = ? WHERE channel = ? AND external_id = ?").run(username, address, nowISO(), channel, externalId);
        const user = db_1.db
            .prepare("SELECT id, is_admin, role, plan, preferred_channel, created_at FROM users WHERE id = ?")
            .get(row.user_id);
        return user;
    }
    // criar novo usuário
    const createdAt = nowISO();
    const info = db_1.db
        .prepare("INSERT INTO users (created_at, is_admin, role, plan, preferred_channel) VALUES (?, 0, 'membro', 'free', ?)")
        .run(createdAt, channel);
    const userId = Number(info.lastInsertRowid);
    // primeiro usuário vira admin (MVP)
    if (userId === 1) {
        db_1.db.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE id = 1").run();
    }
    db_1.db.prepare(`INSERT INTO user_channels (user_id, channel, external_id, username, address, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(channel, external_id) DO UPDATE SET
       user_id = excluded.user_id,
       username = COALESCE(excluded.username, user_channels.username),
       address = COALESCE(excluded.address, user_channels.address),
       is_active = 1,
       updated_at = excluded.updated_at`).run(userId, channel, externalId, username, address, createdAt, createdAt);
    const user = db_1.db
        .prepare("SELECT id, is_admin, role, plan, preferred_channel, created_at FROM users WHERE id = ?")
        .get(userId);
    return user;
}
function buscarUserPorId(userId) {
    const user = db_1.db
        .prepare("SELECT id, created_at, is_admin, role, plan, preferred_channel FROM users WHERE id = ?")
        .get(userId);
    if (!user)
        return null;
    const channels = db_1.db
        .prepare("SELECT channel, external_id, username, address, is_active, created_at, updated_at FROM user_channels WHERE user_id = ? ORDER BY id ASC")
        .all(userId);
    return { ...user, channels };
}
function setPreferredChannel(userId, preferred) {
    db_1.db.prepare("UPDATE users SET preferred_channel = ? WHERE id = ?").run(preferred, userId);
    return buscarUserPorId(userId);
}
function getUserFlags(userId) {
    const row = db_1.db
        .prepare("SELECT id, is_admin, role, plan, preferred_channel, banned_until, ban_reason FROM users WHERE id = ?")
        .get(userId);
    if (!row)
        return null;
    // Normaliza valores vindos do banco (podem variar por migração/edição manual).
    const role = normalizeRole(row.role ?? "") ?? (row.is_admin === 1 ? "admin" : "membro");
    const plan = normalizePlan(row.plan ?? "") ?? "free";
    const bannedUntil = row.banned_until ? new Date(row.banned_until).getTime() : null;
    const isBanned = typeof bannedUntil === "number" && Number.isFinite(bannedUntil) && bannedUntil > Date.now();
    return {
        isAdmin: row.is_admin === 1 || role === "admin",
        role,
        plan,
        preferredChannel: row.preferred_channel,
        isBanned,
        bannedUntil: row.banned_until,
        banReason: row.ban_reason,
    };
}
function parseDurationToMs(raw) {
    // aceita: 10m, 2h, 7d, 1w
    const s = String(raw || "").trim().toLowerCase();
    const m = s.match(/^([0-9]+)\s*(m|min|h|d|w)$/);
    if (!m)
        return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    const unit = m[2];
    const mult = unit === "m" || unit === "min" ? 60000 : unit === "h" ? 3600000 : unit === "d" ? 86400000 : 604800000;
    return n * mult;
}
function banUserById(params) {
    const until = params.durationMs && params.durationMs > 0 ? new Date(Date.now() + params.durationMs).toISOString() : new Date(Date.now() + 86400000).toISOString();
    const reason = params.reason ? String(params.reason).slice(0, 200) : null;
    db_1.db.prepare("UPDATE users SET banned_until = ?, ban_reason = ? WHERE id = ?").run(until, reason, params.targetUserId);
    // desativa todos os canais ativos
    db_1.db.prepare("UPDATE user_channels SET is_active = 0, updated_at = ? WHERE user_id = ?").run(nowISO(), params.targetUserId);
    return buscarUserPorId(params.targetUserId);
}
function unbanUserById(targetUserId) {
    db_1.db.prepare("UPDATE users SET banned_until = NULL, ban_reason = NULL WHERE id = ?").run(targetUserId);
    db_1.db.prepare("UPDATE user_channels SET is_active = 1, updated_at = ? WHERE user_id = ?").run(nowISO(), targetUserId);
    return buscarUserPorId(targetUserId);
}
function hasAnyActiveChannel(userId) {
    const row = db_1.db
        .prepare("SELECT COUNT(1) as c FROM user_channels WHERE user_id = ? AND is_active = 1")
        .get(userId);
    return Number(row?.c || 0) > 0;
}
function resolveUserIdByChannel(params) {
    const row = db_1.db
        .prepare("SELECT user_id FROM user_channels WHERE channel = ? AND external_id = ? AND is_active = 1")
        .get(params.channel, String(params.externalId));
    return row?.user_id ? Number(row.user_id) : null;
}
function listUsersByRole(role) {
    const rows = db_1.db
        .prepare(`
SELECT
  u.id as user_id,
  COALESCE(u.role, CASE WHEN u.is_admin = 1 THEN 'admin' ELSE 'membro' END) as role,
  u.created_at as created_at,
  COALESCE(u.plan, 'free') as plan,
  uc.external_id as telegram_id,
  uc.username as username,
  uc.is_active as is_active
FROM users u
LEFT JOIN user_channels uc
  ON uc.user_id = u.id AND uc.channel = 'telegram' AND uc.is_active = 1
WHERE COALESCE(u.role, CASE WHEN u.is_admin = 1 THEN 'admin' ELSE 'membro' END) = ?
ORDER BY u.id ASC;
`)
        .all(role);
    return rows;
}
function grantAdminByUserId(targetUserId) {
    db_1.db.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE id = ?").run(targetUserId);
    return buscarUserPorId(targetUserId);
}
function grantAdminByChannel(params) {
    const row = db_1.db
        .prepare("SELECT user_id FROM user_channels WHERE channel = ? AND external_id = ? AND is_active = 1")
        .get(params.channel, String(params.externalId));
    if (!row?.user_id)
        return null;
    db_1.db.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE id = ?").run(row.user_id);
    return buscarUserPorId(row.user_id);
}
function setRoleByUserId(targetUserId, roleRaw) {
    const role = normalizeRole(roleRaw);
    if (!role)
        return { ok: false, error: "Cargo inválido. Use: admin | moderador | membro" };
    // Mantém compatibilidade com flag antiga
    const isAdmin = role === "admin" ? 1 : 0;
    db_1.db.prepare("UPDATE users SET role = ?, is_admin = ? WHERE id = ?").run(role, isAdmin, targetUserId);
    const user = buscarUserPorId(targetUserId);
    if (!user)
        return { ok: false, error: "Usuário não encontrado" };
    return { ok: true, user, role };
}
function setRoleByChannel(params) {
    const role = normalizeRole(params.roleRaw);
    if (!role)
        return { ok: false, error: "Cargo inválido. Use: admin | moderador | membro" };
    const row = db_1.db
        .prepare("SELECT user_id FROM user_channels WHERE channel = ? AND external_id = ? AND is_active = 1")
        .get(params.channel, String(params.externalId));
    if (!row?.user_id)
        return { ok: false, error: "Usuário não encontrado" };
    return setRoleByUserId(row.user_id, role);
}
function listMembersByRole() {
    // Mantido por compatibilidade. Agora inclui contagem por plano também.
    return listMembersByRoleAndPlan();
}
function setPlanByUserId(targetUserId, planRaw) {
    const plan = normalizePlan(planRaw);
    if (!plan)
        return { ok: false, error: "Plano inválido. Use: free | vip" };
    db_1.db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(plan, targetUserId);
    const user = buscarUserPorId(targetUserId);
    if (!user)
        return { ok: false, error: "Usuário não encontrado" };
    return { ok: true, user, plan };
}
function setPlanByChannel(params) {
    const plan = normalizePlan(params.planRaw);
    if (!plan)
        return { ok: false, error: "Plano inválido. Use: free | vip" };
    const row = db_1.db
        .prepare("SELECT user_id FROM user_channels WHERE channel = ? AND external_id = ? AND is_active = 1")
        .get(params.channel, String(params.externalId));
    if (!row?.user_id)
        return { ok: false, error: "Usuário não encontrado" };
    return setPlanByUserId(row.user_id, plan);
}
function listMembersByRoleAndPlan() {
    const rows = db_1.db
        .prepare(`
SELECT
  u.id as user_id,
  COALESCE(u.role, CASE WHEN u.is_admin = 1 THEN 'admin' ELSE 'membro' END) as role,
  u.is_admin as is_admin,
  COALESCE(u.plan, 'free') as plan,
  u.created_at as created_at,
  uc.external_id as telegram_id,
  uc.username as username,
  uc.is_active as is_active
FROM users u
LEFT JOIN user_channels uc
  ON uc.user_id = u.id AND uc.channel = 'telegram' AND uc.is_active = 1
ORDER BY u.id ASC;
`)
        .all();
    const groups = { admin: [], moderador: [], membro: [] };
    const planCounts = { free: 0, vip: 0 };
    for (const r of rows) {
        const role = r.role || (r.is_admin === 1 ? "admin" : "membro");
        const plan = r.plan || "free";
        planCounts[plan] = (planCounts[plan] || 0) + 1;
        groups[role].push({ ...r, role, plan });
    }
    const counts = {
        admin: groups.admin.length,
        moderador: groups.moderador.length,
        membro: groups.membro.length,
        total: rows.length,
        plans: { free: planCounts.free, vip: planCounts.vip },
    };
    return { counts, groups };
}
