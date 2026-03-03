import { Router } from "express";
import { inserirSalario } from "../services/salarioService";

export const salarioRoutes = Router();

salarioRoutes.post("/salario", (req, res) => {
  const { valor, data } = req.body as { valor?: number; data?: string };

  const userId = req.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "não autenticado" });

  if (typeof valor !== "number" || Number.isNaN(valor) || valor <= 0) {
    return res.status(400).json({ ok: false, error: "valor inválido" });
  }
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ ok: false, error: "data inválida (YYYY-MM-DD)" });
  }

  const id = inserirSalario(userId, valor, data);
  return res.json({ ok: true, id });
});
