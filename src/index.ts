import "dotenv/config";
import { createServer } from "./server";
import { createTelegramBot } from "./bot/telegrambot";
import { log } from "./lib/logger";

const token = process.env.BOT_TOKEN;
const apiBaseUrl = process.env.API_BASE_URL;
const port = Number(process.env.PORT || 3000);
const botInternalToken = process.env.BOT_INTERNAL_TOKEN || "";

if (!token) throw new Error("BOT_TOKEN não encontrado no .env");
if (!apiBaseUrl) throw new Error("API_BASE_URL não encontrado no .env");
if (!botInternalToken) throw new Error("BOT_INTERNAL_TOKEN não encontrado no .env");

const app = createServer();

app.listen(port, "0.0.0.0", () => {
  log.info(`🌐 API rodando em http://localhost:${port} (bind 0.0.0.0)`);
});

const apiBaseUrlClean = apiBaseUrl.replace(/\/+$/, "");
const bot = createTelegramBot(token, { apiBaseUrl: apiBaseUrlClean, botInternalToken });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));