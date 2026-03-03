import { db } from "../config/db";

export function inserirSalario(userId: number, valor: number, data: string) {
  const stmt = db.prepare("INSERT INTO salarios (user_id, valor, data) VALUES (?, ?, ?)");
  const result = stmt.run(userId, valor, data);
  return Number(result.lastInsertRowid);
}
