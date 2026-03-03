"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const authService_1 = require("../services/authService");
exports.authRoutes = (0, express_1.Router)();
exports.authRoutes.post("/auth/request-code", (_req, res) => {
    const { code, expiresAt } = (0, authService_1.criarLoginCode)(10);
    return res.json({ ok: true, code, expiresAt });
});
exports.authRoutes.post("/auth/telegram-link", (req, res) => {
    const { code, telegramUserId, telegramUsername } = req.body;
    if (typeof code !== "string" || code.trim().length < 4) {
        return res.status(400).json({ ok: false, error: "code inválido" });
    }
    if (typeof telegramUserId !== "number" || !Number.isFinite(telegramUserId)) {
        return res.status(400).json({ ok: false, error: "telegramUserId inválido" });
    }
    try {
        const { userId } = (0, authService_1.consumirLoginCodeEConectarTelegram)({
            code,
            telegramUserId,
            telegramUsername,
        });
        return res.json({ ok: true, userId });
    }
    catch (e) {
        const msg = String(e?.message || "ERRO");
        const map = {
            CODE_INVALIDO: "Código inválido.",
            CODE_EXPIRADO: "Código expirado. Gere outro no site.",
            CODE_JA_USADO: "Esse código já foi usado. Gere outro no site.",
        };
        return res.status(400).json({ ok: false, error: map[msg] || "Falha ao vincular" });
    }
});
exports.authRoutes.post("/auth/web-login", (req, res) => {
    const { code } = req.body;
    if (typeof code !== "string" || code.trim().length < 4) {
        return res.status(400).json({ ok: false, error: "code inválido" });
    }
    try {
        const { userId } = (0, authService_1.finalizarLoginWeb)(code);
        req.session.userId = userId;
        return res.json({ ok: true });
    }
    catch (e) {
        const msg = String(e?.message || "ERRO");
        const map = {
            CODE_INVALIDO: "Código inválido.",
            CODE_EXPIRADO: "Código expirado. Gere outro no site.",
            CODE_AINDA_NAO_CONFIRMADO: "Ainda não foi confirmado no Telegram. Use /login CODIGO.",
        };
        return res.status(400).json({ ok: false, error: map[msg] || "Erro ao logar." });
    }
});
exports.authRoutes.get("/auth/me", (req, res) => {
    const userId = req.session.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "não autenticado" });
    const user = (0, authService_1.buscarUserPorId)(userId);
    if (!user)
        return res.status(401).json({ ok: false, error: "sessão inválida" });
    return res.json({ ok: true, user });
});
exports.authRoutes.post("/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});
