import { Router } from "express";
import { db } from "../config/db";
import { requireVip } from "../middlewares/requireVip";

export const exportRoutes = Router();

// VIP: export CSV de gastos
// Query opcional: ?from=YYYY-MM-DD&to=YYYY-MM-DD
exportRoutes.get("/export/gastos.csv", requireVip, (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).send("não autenticado");

  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;

  const rows = db
    .prepare(
      `
SELECT g.id, g.data, g.valor, g.descricao, c.nome as categoria
FROM gastos g
JOIN categorias c ON c.id = g.categoria_id
WHERE g.user_id = ?
  AND (? IS NULL OR g.data >= ?)
  AND (? IS NULL OR g.data <= ?)
ORDER BY g.data ASC, g.id ASC;
`
    )
    .all(userId, from, from, to, to) as Array<{ id: number; data: string; valor: number; descricao: string; categoria: string }>;

  const escape = (v: any) => {
    const s = String(v ?? "");
    const needs = /[\n\r,\"]/g.test(s);
    const out = s.replace(/\"/g, '""');
    return needs ? `"${out}"` : out;
  };

  const header = "id,data,valor,descricao,categoria";
  const lines = rows.map((r) => [r.id, r.data, r.valor, r.descricao, r.categoria].map(escape).join(","));
  const csv = [header, ...lines].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=gastos_user_${userId}.csv`);
  return res.send(csv);
});
