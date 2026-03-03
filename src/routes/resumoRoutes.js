"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumoRoutes = void 0;
const express_1 = require("express");
const gastoService_1 = require("../services/gastoService");
exports.resumoRoutes = (0, express_1.Router)();
exports.resumoRoutes.get("/resumo/hoje", (req, res) => {
    const data = String(req.query.data || "");
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "não autenticado" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({ ok: false, error: "data inválida (YYYY-MM-DD)" });
    }
    const resumo = (0, gastoService_1.resumoHoje)(userId, data);
    return res.json({ ok: true, resumo });
});
