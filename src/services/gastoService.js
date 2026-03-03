"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inserirGasto = inserirGasto;
exports.resumoHoje = resumoHoje;
const db_1 = require("../config/db");
const categoriaService_1 = require("./categoriaService");
function inserirGasto(params) {
    const categoriaId = (0, categoriaService_1.pegarCategoriaId)(params.userId, params.categoriaNome);
    if (!categoriaId)
        throw new Error("CATEGORIA_NAO_EXISTE");
    const stmt = db_1.db.prepare(`
    INSERT INTO gastos (user_id, valor, descricao, data, categoria_id)
    VALUES (?, ?, ?, ?, ?)
  `);
    const result = stmt.run(params.userId, params.valor, params.descricao, params.data, categoriaId);
    return Number(result.lastInsertRowid);
}
function resumoHoje(userId, data) {
    const totalSalariosRow = db_1.db
        .prepare("SELECT COALESCE(SUM(valor), 0) as total FROM salarios WHERE user_id = ? AND data = ?")
        .get(userId, data);
    const totalGastosRow = db_1.db
        .prepare("SELECT COALESCE(SUM(valor), 0) as total FROM gastos WHERE user_id = ? AND data = ?")
        .get(userId, data);
    const ultimos = db_1.db
        .prepare(`
      SELECT g.valor, g.descricao, c.nome as categoria
      FROM gastos g
      JOIN categorias c ON c.id = g.categoria_id
      WHERE g.user_id = ? AND g.data = ?
      ORDER BY g.id DESC
      LIMIT 5
    `)
        .all(userId, data);
    return {
        data,
        totalSalarios: totalSalariosRow.total,
        totalGastos: totalGastosRow.total,
        saldo: totalSalariosRow.total - totalGastosRow.total,
        ultimos,
    };
}
