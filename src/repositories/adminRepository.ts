import { db } from "../config/db";

export type AdminStats = {
  usersTotal: number;
  usersBannedActive: number;
  plans: Record<string, number>;
  roles: Record<string, number>;
  channelsActive: Record<string, number>;
};

export function getAdminStats(): AdminStats {
  const usersTotal = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c as number;

  const usersBannedActive = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM users WHERE banned_until IS NOT NULL AND banned_until > CURRENT_TIMESTAMP"
      )
      .get() as any
  ).c as number;

  const planRows = db.prepare("SELECT plan as k, COUNT(*) as c FROM users GROUP BY plan").all() as any[];
  const roleRows = db.prepare("SELECT role as k, COUNT(*) as c FROM users GROUP BY role").all() as any[];

  const channelRows = db
    .prepare(
      "SELECT channel as k, COUNT(*) as c FROM user_channels WHERE is_active=1 GROUP BY channel"
    )
    .all() as any[];

  const plans: Record<string, number> = {};
  for (const r of planRows) plans[String(r.k ?? "unknown")] = Number(r.c ?? 0);

  const roles: Record<string, number> = {};
  for (const r of roleRows) roles[String(r.k ?? "unknown")] = Number(r.c ?? 0);

  const channelsActive: Record<string, number> = {};
  for (const r of channelRows) channelsActive[String(r.k ?? "unknown")] = Number(r.c ?? 0);

  return { usersTotal, usersBannedActive, plans, roles, channelsActive };
}
