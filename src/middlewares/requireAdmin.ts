import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAdmin) return next();
  return res.status(403).json({ ok: false, error: "Apenas admin" });
}
