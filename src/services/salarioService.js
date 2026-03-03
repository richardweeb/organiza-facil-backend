"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inserirSalario = inserirSalario;
const db_1 = require("../config/db");
function inserirSalario(userId, valor, data) {
    const stmt = db_1.db.prepare("INSERT INTO salarios (user_id, valor, data) VALUES (?, ?, ?)");
    const result = stmt.run(userId, valor, data);
    return Number(result.lastInsertRowid);
}
