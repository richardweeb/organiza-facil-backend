"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gastoRoutes = void 0;
const logger_1 = require("../lib/logger");
const express_1 = require("express");
const gastoService_1 = require("../services/gastoService");
exports.gastoRoutes = (0, express_1.Router)();
exports.gastoRoutes.post("/gasto", (req, res) => {
    const { valor, data, descricao, categoria, telegramUserId, telegramUsername } = req.body;
    // req.userId é definido no allowBotOrAuth
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "não autenticado" });
    if (typeof valor !== "number" || Number.isNaN(valor) || valor <= 0) {
        return res.status(400).json({ ok: false, error: "valor inválido" });
    }
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({ ok: false, error: "data inválida (YYYY-MM-DD)" });
    }
    if (typeof descricao !== "string" || descricao.trim().length < 2) {
        return res.status(400).json({ ok: false, error: "descricao inválida" });
    }
    if (typeof categoria !== "string" || categoria.trim().length < 2) {
        return res.status(400).json({ ok: false, error: "categoria inválida" });
    }
    try {
        const id = (0, gastoService_1.inserirGasto)({
            userId,
            valor,
            descricao: descricao.trim(),
            data,
            categoriaNome: categoria.trim(),
        });
        return res.json({ ok: true, id });
    }
    catch (e) {
        if (String(e?.message) === "CATEGORIA_NAO_EXISTE") {
            const cat = categoria.trim();
            return res.status(400).json({
                ok: false,
                error: `categoria "${cat}" não existe. Use /categoria add ${cat}`,
            });
        }
        logger_1.log.error(e);
        return res.status(500).json({ ok: false, error: "erro ao salvar gasto" });
    }
});
