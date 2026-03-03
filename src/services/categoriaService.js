"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizarCategoria = normalizarCategoria;
exports.criarCategoria = criarCategoria;
exports.pegarCategoriaId = pegarCategoriaId;
const db_1 = require("../config/db");
const userService_1 = require("./userService");
const entitlements_1 = require("../config/entitlements");
function normalizarCategoria(nome) {
    return nome.trim().toLowerCase();
}
function criarCategoria(userId, nome) {
    const flags = (0, userService_1.getUserFlags)(userId);
    const plan = flags?.plan ?? "free";
    const max = entitlements_1.ENTITLEMENTS[plan].maxCategorias;
    if (typeof max === "number") {
        const row = db_1.db
            .prepare("SELECT COUNT(1) as c FROM categorias WHERE user_id = ?")
            .get(userId);
        const count = Number(row?.c || 0);
        if (count >= max) {
            throw new Error(`Limite do plano FREE atingido: máximo de ${max} categorias. Use /powerplan vip (ou vire VIP) para liberar.`);
        }
    }
    const nomeNorm = normalizarCategoria(nome);
    const stmt = db_1.db.prepare("INSERT INTO categorias (user_id, nome) VALUES (?, ?)");
    const result = stmt.run(userId, nomeNorm);
    return Number(result.lastInsertRowid);
}
function pegarCategoriaId(userId, nome) {
    const nomeNorm = normalizarCategoria(nome);
    const row = db_1.db
        .prepare("SELECT id FROM categorias WHERE user_id = ? AND nome = ?")
        .get(userId, nomeNorm);
    return row?.id ?? null;
}
