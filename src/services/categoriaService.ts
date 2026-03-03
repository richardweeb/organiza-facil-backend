import { db } from "../config/db";
import { getUserFlags } from "./userService";
import { ENTITLEMENTS } from "../config/entitlements";

export function normalizarCategoria(nome: string) {
  return nome.trim().toLowerCase();
}

export function criarCategoria(userId: number, nome: string) {
  const flags = getUserFlags(userId);
  const plan = flags?.plan ?? "free";
  const max = ENTITLEMENTS[plan].maxCategorias;
  if (typeof max === "number") {
    const row = db
      .prepare("SELECT COUNT(1) as c FROM categorias WHERE user_id = ?")
      .get(userId) as { c: number };
    const count = Number(row?.c || 0);
    if (count >= max) {
      throw new Error(`Limite do plano FREE atingido: máximo de ${max} categorias. Use /powerplan vip (ou vire VIP) para liberar.`);
    }
  }

  const nomeNorm = normalizarCategoria(nome);
  const stmt = db.prepare("INSERT INTO categorias (user_id, nome) VALUES (?, ?)");
  const result = stmt.run(userId, nomeNorm);
  return Number(result.lastInsertRowid);
}

export function pegarCategoriaId(userId: number, nome: string) {
  const nomeNorm = normalizarCategoria(nome);

  const row = db
    .prepare("SELECT id FROM categorias WHERE user_id = ? AND nome = ?")
    .get(userId, nomeNorm) as { id: number } | undefined;

  return row?.id ?? null;
}
