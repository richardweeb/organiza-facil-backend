"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireVip = requireVip;
const userService_1 = require("../services/userService");
function requireVip(req, res, next) {
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ ok: false, error: "não autenticado" });
    const flags = (0, userService_1.getUserFlags)(userId);
    if (!flags)
        return res.status(401).json({ ok: false, error: "não autenticado" });
    if (flags.plan !== "vip") {
        return res.status(403).json({ ok: false, error: "Recurso disponível apenas para VIP." });
    }
    return next();
}
