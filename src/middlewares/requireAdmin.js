"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
function requireAdmin(req, res, next) {
    if (req.isAdmin)
        return next();
    return res.status(403).json({ ok: false, error: "Apenas admin" });
}
