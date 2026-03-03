"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noticeRoutes = void 0;
const express_1 = require("express");
const noticeService_1 = require("../services/noticeService");
exports.noticeRoutes = (0, express_1.Router)();
// Listar avisos para o usuário atual
exports.noticeRoutes.get("/notices", (req, res) => {
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "Não autenticado" });
    const limit = Number(req.query.limit ?? 50);
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 50;
    const notices = (0, noticeService_1.listNoticesForUser)(userId, safeLimit);
    return res.json({ ok: true, notices });
});
// Marcar aviso como lido
exports.noticeRoutes.post("/notices/:id/read", (req, res) => {
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "Não autenticado" });
    const noticeId = Number(req.params.id);
    if (!Number.isFinite(noticeId) || noticeId <= 0) {
        return res.status(400).json({ ok: false, error: "ID inválido" });
    }
    const out = (0, noticeService_1.markNoticeRead)(userId, noticeId);
    return res.json(out);
});
// Criar aviso (web)
exports.noticeRoutes.post("/notices", (req, res) => {
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "Não autenticado" });
    if (!req.isAdmin)
        return res.status(403).json({ ok: false, error: "Apenas admin" });
    const body = String(req.body?.body ?? "").trim();
    const title = req.body?.title != null ? String(req.body.title).trim() : null;
    if (!body)
        return res.status(400).json({ ok: false, error: "body é obrigatório" });
    const notice = (0, noticeService_1.createNotice)({ createdByUserId: userId, body, title, audience: "all" });
    return res.json({ ok: true, notice });
});
// Broadcast (usado pelo bot): cria aviso e retorna lista de recipients telegram
exports.noticeRoutes.post("/notices/broadcast", (req, res) => {
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "Não autenticado" });
    if (!req.isAdmin)
        return res.status(403).json({ ok: false, error: "Apenas admin" });
    const body = String(req.body?.body ?? "").trim();
    const title = req.body?.title != null ? String(req.body.title).trim() : null;
    if (!body)
        return res.status(400).json({ ok: false, error: "body é obrigatório" });
    const notice = (0, noticeService_1.createNotice)({ createdByUserId: userId, body, title, audience: "all" });
    const recipients = (0, noticeService_1.listTelegramRecipients)();
    return res.json({ ok: true, noticeId: notice.id, recipients });
});
