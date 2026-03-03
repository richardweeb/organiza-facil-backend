import { Request, Response, NextFunction } from "express";
import { getUserFlags } from "../services/userService";

export function requireVip(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "não autenticado" });

  const flags = getUserFlags(userId);
  if (!flags) return res.status(401).json({ ok: false, error: "não autenticado" });

  if (flags.plan !== "vip") {
    return res.status(403).json({ ok: false, error: "Recurso disponível apenas para VIP." });
  }
  return next();
}
