"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriaRoutes = void 0;
const logger_1 = require("../lib/logger");
const express_1 = require("express");
const categoriaService_1 = require("../services/categoriaService");
exports.categoriaRoutes = (0, express_1.Router)();
exports.categoriaRoutes.post("/categoria", (req, res) => {
    const { nome } = req.body;
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "não autenticado" });
    if (typeof nome !== "string" || nome.trim().length < 2) {
        return res.status(400).json({ ok: false, error: "nome inválido" });
    }
    try {
        const id = (0, categoriaService_1.criarCategoria)(userId, nome);
        return res.json({ ok: true, id });
    }
    catch (e) {
        // UNIQUE(user_id, nome)
        if (String(e?.message || "").toLowerCase().includes("unique")) {
            return res.json({ ok: true, info: "categoria já existia" });
        }
        if (String(e?.message || "").toLowerCase().includes("limite do plano")) {
            return res.status(403).json({ ok: false, error: e.message });
        }
        logger_1.log.error(e);
        return res.status(500).json({ ok: false, error: "erro ao criar categoria" });
    }
});
