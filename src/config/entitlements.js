"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTITLEMENTS = void 0;
exports.formatBenefits = formatBenefits;
// Regras de produto (MVP). Fácil de ajustar depois.
exports.ENTITLEMENTS = {
    free: {
        maxCategorias: 20,
        canExportCsv: false,
    },
    vip: {
        maxCategorias: null, // ilimitado
        canExportCsv: true,
    },
};
function formatBenefits(plan) {
    const e = exports.ENTITLEMENTS[plan];
    const linhas = [];
    linhas.push(`Plano atual: ${plan.toUpperCase()}`);
    linhas.push("");
    linhas.push("Benefícios:");
    linhas.push(`• Categorias: ${e.maxCategorias === null ? "ilimitadas" : `até ${e.maxCategorias}`}`);
    linhas.push(`• Exportar CSV: ${e.canExportCsv ? "liberado" : "VIP"}`);
    return linhas.join("\n");
}
