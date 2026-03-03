"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ ok: false, error: "não autenticado" });
    }
    next();
}
