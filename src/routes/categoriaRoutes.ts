import { log } from "../lib/logger";
import { Router } from "express";
import { criarCategoria } from "../services/categoriaService";

export const categoriaRoutes = Router();

categoriaRoutes.post("/categoria", (req, res) => {
  const { nome } = req.body as { nome?: string };

  const userId = req.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "não autenticado" });

  if (typeof nome !== "string" || nome.trim().length < 2) {
    return res.status(400).json({ ok: false, error: "nome inválido" });
  }

  try {
    const id = criarCategoria(userId, nome);
    return res.json({ ok: true, id });
  } catch (e: any) {
    // UNIQUE(user_id, nome)
    if (String(e?.message || "").toLowerCase().includes("unique")) {
      return res.json({ ok: true, info: "categoria já existia" });
    }
    if (String(e?.message || "").toLowerCase().includes("limite do plano")) {
      return res.status(403).json({ ok: false, error: e.message });
    }
    log.error(e);
    return res.status(500).json({ ok: false, error: "erro ao criar categoria" });
  }
});
