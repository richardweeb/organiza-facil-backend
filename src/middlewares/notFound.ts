import type { RequestHandler } from "express";
import { AppError } from "../lib/errors/AppError";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.path}`, 404, { code: "NOT_FOUND" }));
};
