import express from "express";
import cors from "cors";
import session from "express-session";

import { authRoutes } from "./routes/authRoutes";
import { salarioRoutes } from "./routes/salarioRoutes";
import { gastoRoutes } from "./routes/gastoRoutes";
import { categoriaRoutes } from "./routes/categoriaRoutes";
import { resumoRoutes } from "./routes/resumoRoutes";
import { userRoutes } from "./routes/userRoutes";
import { noticeRoutes } from "./routes/noticeRoutes";
import { exportRoutes } from "./routes/exportRoutes";
import { allowBotOrAuth } from "./middlewares/allowBotOrAuth";
import swaggerUi from "swagger-ui-express";
import { notFound } from "./middlewares/notFound";
import { errorHandler } from "./middlewares/errorHandler";

import openapi from "../docs/openapi.json";

export function createServer() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json());

  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET faltando no .env");

  app.use(
    session({
      secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Docs (OpenAPI)
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  // Auth público (login / request-code etc.)
  app.use("/api", authRoutes);

  // Bot (x-bot-token) OU Web logada (cookie)
  app.use("/api", allowBotOrAuth, salarioRoutes);
  app.use("/api", allowBotOrAuth, gastoRoutes);
  app.use("/api", allowBotOrAuth, categoriaRoutes);
  app.use("/api", allowBotOrAuth, resumoRoutes);
  app.use("/api", allowBotOrAuth, userRoutes);
  app.use("/api", allowBotOrAuth, noticeRoutes);
  app.use("/api", allowBotOrAuth, exportRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}