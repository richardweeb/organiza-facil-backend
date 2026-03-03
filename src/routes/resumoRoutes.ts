import { Router } from "express";
import { resumoHoje } from "../services/gastoService";

export const resumoRoutes = Router();

resumoRoutes.get("/resumo/hoje", (req, res) => {
  const data = String(req.query.data || "");

  const userId = req.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "não autenticado" });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ ok: false, error: "data inválida (YYYY-MM-DD)" });
  }

  const resumo = resumoHoje(userId, data);
  return res.json({ ok: true, resumo });
});
