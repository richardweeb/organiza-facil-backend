"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowBotOrAuth = allowBotOrAuth;
const requireAuth_1 = require("./requireAuth");
const userService_1 = require("../services/userService");
/**
 * Define req.userId para:
 * - Web logada (cookie session)
 * - Bot (x-bot-token) + telegramUserId no body/query
 */
function allowBotOrAuth(req, res, next) {
    const botToken = req.headers["x-bot-token"];
    const expected = process.env.BOT_INTERNAL_TOKEN;
    // Bot autenticado
    if (expected && botToken === expected) {
        const telegramUserIdRaw = (req.body && (req.body.telegramUserId ?? req.body.telegram_user_id)) ??
            (req.query && (req.query.telegramUserId ?? req.query.telegram_user_id));
        const telegramUserId = Number(telegramUserIdRaw);
        if (!Number.isFinite(telegramUserId) || telegramUserId <= 0) {
            return res.status(400).json({
                ok: false,
                error: "telegramUserId faltando/ inválido (o bot precisa enviar no body ou query)",
            });
        }
        const telegramUsername = (req.body && (req.body.telegramUsername ?? req.body.telegram_username)) ?? null;
        const user = (0, userService_1.findOrCreateByChannel)({
            channel: "telegram",
            externalId: String(telegramUserId),
            username: telegramUsername,
            address: null,
        });
        req.userId = user.id;
        // compat: is_admin antigo + role novo
        // @ts-ignore
        const role = user.role;
        req.isAdmin = user.is_admin === 1 || role === "admin";
        const flags = (0, userService_1.getUserFlags)(user.id);
        if (flags?.isBanned) {
            return res.status(403).json({
                ok: false,
                error: `Usuário suspenso até ${flags.bannedUntil}. ${flags.banReason ? `Motivo: ${flags.banReason}` : ""}`.trim(),
            });
        }
        return next();
    }
    // Web logada (sessão)
    // Se não estiver logado, requireAuth já responde 401
    (0, requireAuth_1.requireAuth)(req, res, () => {
        const userId = req.session.userId;
        req.userId = userId;
        const flags = (0, userService_1.getUserFlags)(userId);
        req.isAdmin = flags?.isAdmin ?? false;
        if (flags?.isBanned) {
            return res.status(403).json({
                ok: false,
                error: `Usuário suspenso até ${flags.bannedUntil}. ${flags.banReason ? `Motivo: ${flags.banReason}` : ""}`.trim(),
            });
        }
        next();
    });
}
