import { db } from "../config/db";
import { userRepository } from "../repositories/userRepository";
import type { BannedUserRow } from "../repositories/userRepository";
import { getAdminStats as repoGetAdminStats, type AdminStats } from "../repositories/adminRepository";

function nowISO() {
  return new Date().toISOString();
}

export type Channel = "telegram" | "whatsapp";

export type Role = "admin" | "moderador" | "membro";

export type Plan = "free" | "vip";

function normalizePlan(raw: string): Plan | null {
  const p = String(raw || "").trim().toLowerCase();
  if (p === "free" || p === "gratuito") return "free";
  if (p === "vip" || p === "premium" || p === "pro") return "vip";
  return null;
}


function normalizeRole(raw: string): Role | null {
  const r = String(raw || "").trim().toLowerCase();
  if (r === "admin" || r === "administrador") return "admin";
  if (r === "moderador" || r === "mod" || r === "moderator") return "moderador";
  if (r === "membro" || r === "member" || r === "user") return "membro";
  return null;
}

export function findOrCreateByChannel(params: {
  channel: Channel;
  externalId: string;
  username?: string | null;
  address?: string | null;
}) {
  const channel = params.channel;
  const externalId = String(params.externalId);
  const username = params.username ?? null;
  const address = params.address ?? null;

  const row = db
    .prepare(
      "SELECT uc.user_id as user_id FROM user_channels uc WHERE uc.channel = ? AND uc.external_id = ? AND uc.is_active = 1"
    )
    .get(channel, externalId) as { user_id: number } | undefined;

  if (row?.user_id) {
    // refresh basic metadata
    db.prepare(
      "UPDATE user_channels SET username = COALESCE(?, username), address = COALESCE(?, address), updated_at = ? WHERE channel = ? AND external_id = ?"
    ).run(username, address, nowISO(), channel, externalId);

    const user = db
      .prepare("SELECT id, is_admin, role, plan, preferred_channel, created_at FROM users WHERE id = ?")
      .get(row.user_id) as { id: number; is_admin: number; role: Role; plan: Plan; preferred_channel: string; created_at: string };
    return user;
  }

  // criar novo usuário
  const createdAt = nowISO();
  const info = db
    .prepare("INSERT INTO users (created_at, is_admin, role, plan, preferred_channel) VALUES (?, 0, 'membro', 'free', ?)")
    .run(createdAt, channel);

  const userId = Number(info.lastInsertRowid);

  // primeiro usuário vira admin (MVP)
  if (userId === 1) {
    db.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE id = 1").run();
  }

  db.prepare(
    `INSERT INTO user_channels (user_id, channel, external_id, username, address, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(channel, external_id) DO UPDATE SET
       user_id = excluded.user_id,
       username = COALESCE(excluded.username, user_channels.username),
       address = COALESCE(excluded.address, user_channels.address),
       is_active = 1,
       updated_at = excluded.updated_at`
  ).run(userId, channel, externalId, username, address, createdAt, createdAt);

  const user = db
    .prepare("SELECT id, is_admin, role, plan, preferred_channel, created_at FROM users WHERE id = ?")
    .get(userId) as { id: number; is_admin: number; role: Role; plan: Plan; preferred_channel: string; created_at: string };

  return user;
}

export function buscarUserPorId(userId: number) {
  const user = db
    .prepare("SELECT id, created_at, is_admin, role, plan, preferred_channel FROM users WHERE id = ?")
    .get(userId) as
      | { id: number; created_at: string; is_admin: number; role: Role; plan: Plan; preferred_channel: string }
      | undefined;

  if (!user) return null;

  const channels = db
    .prepare(
      "SELECT channel, external_id, username, address, is_active, created_at, updated_at FROM user_channels WHERE user_id = ? ORDER BY id ASC"
    )
    .all(userId) as Array<{
    channel: string;
    external_id: string;
    username: string | null;
    address: string | null;
    is_active: number;
    created_at: string;
    updated_at: string;
  }>;

  return { ...user, channels };
}

export function setPreferredChannel(userId: number, preferred: Channel) {
  db.prepare("UPDATE users SET preferred_channel = ? WHERE id = ?").run(preferred, userId);
  return buscarUserPorId(userId);
}

export function getUserFlags(userId: number) {
  const row = db
    .prepare("SELECT id, is_admin, role, plan, preferred_channel, banned_until, ban_reason FROM users WHERE id = ?")
    .get(userId) as
      | {
          id: number;
          is_admin: number;
          role: Role | null;
          plan: Plan | null;
          preferred_channel: string;
          banned_until: string | null;
          ban_reason: string | null;
        }
      | undefined;
  if (!row) return null;
  // Normaliza valores vindos do banco (podem variar por migração/edição manual).
  const role: Role = normalizeRole(row.role ?? "") ?? (row.is_admin === 1 ? "admin" : "membro");
  const plan: Plan = normalizePlan(row.plan ?? "") ?? "free";
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

export function parseDurationToMs(raw: string) {
  // aceita: 10m, 2h, 7d, 1w
  const s = String(raw || "").trim().toLowerCase();
  const m = s.match(/^([0-9]+)\s*(m|min|h|d|w)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2];
  const mult =
    unit === "m" || unit === "min" ? 60_000 : unit === "h" ? 3_600_000 : unit === "d" ? 86_400_000 : 604_800_000;
  return n * mult;
}

export function banUserById(params: { targetUserId: number; durationMs?: number | null; reason?: string | null }) {
  const until = params.durationMs && params.durationMs > 0 ? new Date(Date.now() + params.durationMs).toISOString() : new Date(Date.now() + 86_400_000).toISOString();
  const reason = params.reason ? String(params.reason).slice(0, 200) : null;
  db.prepare("UPDATE users SET banned_until = ?, ban_reason = ? WHERE id = ?").run(until, reason, params.targetUserId);
  // desativa todos os canais ativos
  db.prepare("UPDATE user_channels SET is_active = 0, updated_at = ? WHERE user_id = ?").run(nowISO(), params.targetUserId);
  return buscarUserPorId(params.targetUserId);
}

export function unbanUserById(targetUserId: number) {
  db.prepare("UPDATE users SET banned_until = NULL, ban_reason = NULL WHERE id = ?").run(targetUserId);
  db.prepare("UPDATE user_channels SET is_active = 1, updated_at = ? WHERE user_id = ?").run(nowISO(), targetUserId);
  return buscarUserPorId(targetUserId);
}

export function hasAnyActiveChannel(userId: number) {
  const row = db
    .prepare("SELECT COUNT(1) as c FROM user_channels WHERE user_id = ? AND is_active = 1")
    .get(userId) as { c: number };
  return Number(row?.c || 0) > 0;
}

export function resolveUserIdByChannel(params: { channel: Channel; externalId: string }) {
  const row = db
    .prepare("SELECT user_id FROM user_channels WHERE channel = ? AND external_id = ? AND is_active = 1")
    .get(params.channel, String(params.externalId)) as { user_id: number } | undefined;
  return row?.user_id ? Number(row.user_id) : null;
}

export function listUsersByRole(role: Role) {
  const rows = db
    .prepare(
      `
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
`
    )
    .all(role) as Array<{
    user_id: number;
    role: Role;
    created_at: string;
    plan: Plan;
    telegram_id: string | null;
    username: string | null;
    is_active: number | null;
  }>;
  return rows;
}


export function grantAdminByUserId(targetUserId: number) {
  db.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE id = ?").run(targetUserId);
  return buscarUserPorId(targetUserId);
}

export function grantAdminByChannel(params: { channel: Channel; externalId: string }) {
  const row = db
    .prepare("SELECT user_id FROM user_channels WHERE channel = ? AND external_id = ? AND is_active = 1")
    .get(params.channel, String(params.externalId)) as { user_id: number } | undefined;

  if (!row?.user_id) return null;

  db.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE id = ?").run(row.user_id);
  return buscarUserPorId(row.user_id);
}

export function setRoleByUserId(targetUserId: number, roleRaw: string) {
  const role = normalizeRole(roleRaw);
  if (!role) return { ok: false as const, error: "Cargo inválido. Use: admin | moderador | membro" };

  // Mantém compatibilidade com flag antiga
  const isAdmin = role === "admin" ? 1 : 0;
  db.prepare("UPDATE users SET role = ?, is_admin = ? WHERE id = ?").run(role, isAdmin, targetUserId);
  const user = buscarUserPorId(targetUserId);
  if (!user) return { ok: false as const, error: "Usuário não encontrado" };
  return { ok: true as const, user, role };
}

export function setRoleByChannel(params: { channel: Channel; externalId: string; roleRaw: string }) {
  const role = normalizeRole(params.roleRaw);
  if (!role) return { ok: false as const, error: "Cargo inválido. Use: admin | moderador | membro" };

  const row = db
    .prepare("SELECT user_id FROM user_channels WHERE channel = ? AND external_id = ? AND is_active = 1")
    .get(params.channel, String(params.externalId)) as { user_id: number } | undefined;

  if (!row?.user_id) return { ok: false as const, error: "Usuário não encontrado" };
  return setRoleByUserId(row.user_id, role);
}

export function listMembersByRole() {
  // Mantido por compatibilidade. Agora inclui contagem por plano também.
  return listMembersByRoleAndPlan();
}



export function setPlanByUserId(targetUserId: number, planRaw: string) {
  const plan = normalizePlan(planRaw);
  if (!plan) return { ok: false as const, error: "Plano inválido. Use: free | vip" };
  db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(plan, targetUserId);
  const user = buscarUserPorId(targetUserId);
  if (!user) return { ok: false as const, error: "Usuário não encontrado" };
  return { ok: true as const, user, plan };
}

export function setPlanByChannel(params: { channel: Channel; externalId: string; planRaw: string }) {
  const plan = normalizePlan(params.planRaw);
  if (!plan) return { ok: false as const, error: "Plano inválido. Use: free | vip" };

  const row = db
    .prepare("SELECT user_id FROM user_channels WHERE channel = ? AND external_id = ? AND is_active = 1")
    .get(params.channel, String(params.externalId)) as { user_id: number } | undefined;

  if (!row?.user_id) return { ok: false as const, error: "Usuário não encontrado" };
  return setPlanByUserId(row.user_id, plan);
}

export function listMembersByRoleAndPlan() {
  const rows = db
    .prepare(
      `
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
`
    )
    .all() as Array<{
    user_id: number;
    role: Role;
    is_admin: number;
    plan: Plan;
    created_at: string;
    telegram_id: string | null;
    username: string | null;
    is_active: number | null;
  }>;

  const groups: Record<Role, any[]> = { admin: [], moderador: [], membro: [] };
  const planCounts: Record<Plan, number> = { free: 0, vip: 0 };

  for (const r of rows) {
    const role: Role = (r.role as any) || (r.is_admin === 1 ? "admin" : "membro");
    const plan: Plan = (r.plan as any) || "free";
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

export function listBannedUsers(params?: { activeOnly?: boolean }) {
  const rows = userRepository.listBannedUsers(params);
  return rows.map((r: BannedUserRow) => {
    const role: Role = normalizeRole((r as any).role ?? "") ?? "membro";
    const plan: Plan = normalizePlan((r as any).plan ?? "") ?? "free";
    return { ...r, role, plan };
  });
}

export function getAdminStats(): AdminStats {
  return repoGetAdminStats();
}
