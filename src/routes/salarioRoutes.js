"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salarioRoutes = void 0;
const express_1 = require("express");
const salarioService_1 = require("../services/salarioService");
exports.salarioRoutes = (0, express_1.Router)();
exports.salarioRoutes.post("/salario", (req, res) => {
    const { valor, data } = req.body;
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "não autenticado" });
    if (typeof valor !== "number" || Number.isNaN(valor) || valor <= 0) {
        return res.status(400).json({ ok: false, error: "valor inválido" });
    }
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({ ok: false, error: "data inválida (YYYY-MM-DD)" });
    }
    const id = (0, salarioService_1.inserirSalario)(userId, valor, data);
    return res.json({ ok: true, id });
});
