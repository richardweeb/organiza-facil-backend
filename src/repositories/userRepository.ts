import { db } from "../config/db";
import type { Plan, Role } from "../services/userService";

export type BannedUserRow = {
  user_id: number;
  role: Role;
  plan: Plan;
  created_at: string;
  banned_until: string;
  ban_reason: string | null;
  telegram_id: string | null;
  username: string | null;
};

/**
 * Repositório de usuários.
 * Mantém SQL concentrado aqui para ficar mais "portfólio" (separação clara de responsabilidades).
 */
export const userRepository = {
  listBannedUsers(params?: { activeOnly?: boolean }) {
    const activeOnly = params?.activeOnly !== false;

    const where =
      activeOnly
        ? "u.banned_until IS NOT NULL AND julianday(u.banned_until) > julianday('now')"
        : "u.banned_until IS NOT NULL";

    const rows = db
      .prepare(
        `
SELECT
  u.id AS user_id,
  COALESCE(u.role, CASE WHEN u.is_admin = 1 THEN 'admin' ELSE 'membro' END) AS role,
  COALESCE(u.plan, 'free') AS plan,
  u.created_at AS created_at,
  u.banned_until AS banned_until,
  u.ban_reason AS ban_reason,
  (
    SELECT external_id
    FROM user_channels
    WHERE user_id = u.id AND channel = 'telegram'
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  ) AS telegram_id,
  (
    SELECT username
    FROM user_channels
    WHERE user_id = u.id AND channel = 'telegram'
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  ) AS username
FROM users u
WHERE ${where}
ORDER BY u.banned_until DESC, u.id ASC;
        `
      )
      .all() as BannedUserRow[];

    return rows;
  },
};
