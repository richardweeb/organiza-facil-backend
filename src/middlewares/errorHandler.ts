import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors/AppError";
import { log } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  log.error("Unhandled error", { err });
  return res.status(500).json({ ok: false, error: "Erro interno" });
};
