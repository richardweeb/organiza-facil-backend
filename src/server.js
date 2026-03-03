"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const authRoutes_1 = require("./routes/authRoutes");
const salarioRoutes_1 = require("./routes/salarioRoutes");
const gastoRoutes_1 = require("./routes/gastoRoutes");
const categoriaRoutes_1 = require("./routes/categoriaRoutes");
const resumoRoutes_1 = require("./routes/resumoRoutes");
const userRoutes_1 = require("./routes/userRoutes");
const noticeRoutes_1 = require("./routes/noticeRoutes");
const exportRoutes_1 = require("./routes/exportRoutes");
const allowBotOrAuth_1 = require("./middlewares/allowBotOrAuth");
function createServer() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: true,
        credentials: true,
    }));
    app.use(express_1.default.json());
    const secret = process.env.SESSION_SECRET;
    if (!secret)
        throw new Error("SESSION_SECRET faltando no .env");
    app.use((0, express_session_1.default)({
        secret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    }));
    app.get("/health", (_req, res) => res.json({ ok: true }));
    // Auth público (login / request-code etc.)
    app.use("/api", authRoutes_1.authRoutes);
    // Bot (x-bot-token) OU Web logada (cookie)
    app.use("/api", allowBotOrAuth_1.allowBotOrAuth, salarioRoutes_1.salarioRoutes);
    app.use("/api", allowBotOrAuth_1.allowBotOrAuth, gastoRoutes_1.gastoRoutes);
    app.use("/api", allowBotOrAuth_1.allowBotOrAuth, categoriaRoutes_1.categoriaRoutes);
    app.use("/api", allowBotOrAuth_1.allowBotOrAuth, resumoRoutes_1.resumoRoutes);
    app.use("/api", allowBotOrAuth_1.allowBotOrAuth, userRoutes_1.userRoutes);
    app.use("/api", allowBotOrAuth_1.allowBotOrAuth, noticeRoutes_1.noticeRoutes);
    app.use("/api", allowBotOrAuth_1.allowBotOrAuth, exportRoutes_1.exportRoutes);
    return app;
}
