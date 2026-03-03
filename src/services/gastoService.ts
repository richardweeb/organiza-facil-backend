import { db } from "../config/db";
import { pegarCategoriaId } from "./categoriaService";

export function inserirGasto(params: {
  userId: number;
  valor: number;
  descricao: string;
  data: string;
  categoriaNome: string;
}) {
  const categoriaId = pegarCategoriaId(params.userId, params.categoriaNome);
  if (!categoriaId) throw new Error("CATEGORIA_NAO_EXISTE");

  const stmt = db.prepare(`
    INSERT INTO gastos (user_id, valor, descricao, data, categoria_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    params.userId,
    params.valor,
    params.descricao,
    params.data,
    categoriaId
  );
  return Number(result.lastInsertRowid);
}

export function resumoHoje(userId: number, data: string) {
  const totalSalariosRow = db
    .prepare("SELECT COALESCE(SUM(valor), 0) as total FROM salarios WHERE user_id = ? AND data = ?")
    .get(userId, data) as { total: number };

  const totalGastosRow = db
    .prepare("SELECT COALESCE(SUM(valor), 0) as total FROM gastos WHERE user_id = ? AND data = ?")
    .get(userId, data) as { total: number };

  const ultimos = db
    .prepare(`
      SELECT g.valor, g.descricao, c.nome as categoria
      FROM gastos g
      JOIN categorias c ON c.id = g.categoria_id
      WHERE g.user_id = ? AND g.data = ?
      ORDER BY g.id DESC
      LIMIT 5
    `)
    .all(userId, data) as Array<{ valor: number; descricao: string; categoria: string }>;

  return {
    data,
    totalSalarios: totalSalariosRow.total,
    totalGastos: totalGastosRow.total,
    saldo: totalSalariosRow.total - totalGastosRow.total,
    ultimos,
  };
}
