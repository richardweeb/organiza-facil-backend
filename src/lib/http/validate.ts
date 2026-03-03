import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../errors/AppError";

type Source = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, source: Source = "body"): RequestHandler {
  return (req, _res, next) => {
    const data = source === "body" ? req.body : source === "query" ? req.query : req.params;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      return next(
        new AppError("Dados inválidos", 400, {
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
        })
      );
    }
    if (source === "body") req.body = parsed.data;
    if (source === "query") req.query = parsed.data;
    if (source === "params") req.params = parsed.data;
    return next();
  };
}
