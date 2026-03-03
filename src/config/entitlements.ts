import { Plan } from "../services/userService";

// Regras de produto (MVP). Fácil de ajustar depois.
export const ENTITLEMENTS: Record<Plan, {
  maxCategorias: number | null;
  canExportCsv: boolean;
}> = {
  free: {
    maxCategorias: 20,
    canExportCsv: false,
  },
  vip: {
    maxCategorias: null, // ilimitado
    canExportCsv: true,
  },
};

export function formatBenefits(plan: Plan) {
  const e = ENTITLEMENTS[plan];
  const linhas: string[] = [];
  linhas.push(`Plano atual: ${plan.toUpperCase()}`);
  linhas.push("");
  linhas.push("Benefícios:");
  linhas.push(`• Categorias: ${e.maxCategorias === null ? "ilimitadas" : `até ${e.maxCategorias}`}`);
  linhas.push(`• Exportar CSV: ${e.canExportCsv ? "liberado" : "VIP"}`);
  return linhas.join("\n");
}
