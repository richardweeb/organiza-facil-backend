export const env = {
  BOT_TOKEN: process.env.BOT_TOKEN ?? "",
  API_BASE_URL: process.env.API_BASE_URL ?? "",
  PORT: Number(process.env.PORT ?? 3000),
  // Se true, só permite dar cargo pra quem já tem canal ativo (já falou com o bot / já está registrado em user_channels)
  SAFE_ROLE_ASSIGN: (process.env.SAFE_ROLE_ASSIGN ?? "1").trim(),
};

if (!env.BOT_TOKEN) throw new Error("BOT_TOKEN faltando no .env");
if (!env.API_BASE_URL) throw new Error("API_BASE_URL faltando no .env");