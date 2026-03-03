import { Telegraf } from "telegraf";

type BotDeps = {
  apiBaseUrl: string;
  botInternalToken: string;
};

function formatBRL(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function postJSON(url: string, body: any, deps: BotDeps) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bot-token": deps.botInternalToken,
    },
    body: JSON.stringify(body),
  });
}

async function getJSON(url: string, deps: BotDeps) {
  return fetch(url, {
    method: "GET",
    headers: {
      "x-bot-token": deps.botInternalToken,
    },
  });
}

async function putJSON(url: string, body: any, deps: BotDeps) {
  return fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-bot-token": deps.botInternalToken,
    },
    body: JSON.stringify(body),
  });
}

export function createTelegramBot(token: string, deps: BotDeps) {
  const bot = new Telegraf(token);

  bot.start((ctx) => {
    ctx.reply(
      "✅ Bot online!\n\n" +
        "Comandos:\n" +
        "/salario 1900\n" +
        "/categoria add alimentacao\n" +
        "/gasto 35.90 mercado alimentacao\n" +
        "/resumo hoje\n" +
        "/login SEU_CODE\n" +
        "/id\n" +
        "/canal telegram|whatsapp\n" +
        "(admin) /aviso everyone SUA_MENSAGEM\n" +
        "(admin) /changelog SUA_MENSAGEM\n" +
        "(admin) /poweradd ID\n" +
        "(admin) /powerrole CARGO ID\n" +
        "(admin) /powerremove ID\n" +
        "(admin) /admins\n" +
        "(admin) /mods\n" +
        "(admin) /membros\n" +
        "(admin) /ban ID [7d|2h|30m] [motivo]\n" +
        "(admin) /unban ID\n" +
        "(admin) /banidos [todos]\n" +
        "/beneficios\n" +
        "(VIP) /export"
    );
  });

  bot.command("id", (ctx) => ctx.reply(`Seu Telegram ID: ${ctx.from?.id}`));

  bot.command("plano", async (ctx) => {
    try {
      const url = `${deps.apiBaseUrl}/api/user/me?telegramUserId=${encodeURIComponent(String(ctx.from?.id || ""))}`;
      const resp = await getJSON(url, deps);
      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || !body?.ok) {
        return ctx.reply(`❌ ${body?.error || "Falha ao buscar seu plano"}`);
      }

      const plan = (body.user?.plan || "free").toString().toUpperCase();
      const role = (body.user?.role || "membro").toString();
      return ctx.reply(`📦 Seu plano: ${plan}\n🏷️ Cargo: ${role} (user_id=${body.user?.id})`);
    } catch (e: any) {
      console.error(e);
      return ctx.reply("❌ Erro ao buscar seu plano");
    }
  });

  bot.command("beneficios", async (ctx) => {
    try {
      const url = `${deps.apiBaseUrl}/api/user/me?telegramUserId=${encodeURIComponent(String(ctx.from?.id || ""))}`;
      const resp = await getJSON(url, deps);
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) return ctx.reply(`❌ ${body?.error || "Falha ao buscar seu plano"}`);

      const plan = (body.user?.plan || "free").toString().toLowerCase();
      if (plan === "vip") {
        return ctx.reply(
          "💎 VIP ativado!\n\n" +
            "Você tem:\n" +
            "• Categorias ilimitadas\n" +
            "• Exportar gastos em CSV (/export)\n"
        );
      }

      return ctx.reply(
        "🆓 Plano FREE\n\n" +
          "Você tem:\n" +
          "• Até 20 categorias\n" +
          "• Export CSV: VIP\n\n" +
          "Se quiser virar VIP, um admin pode usar: /powerplan vip SEU_ID"
      );
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro ao mostrar benefícios");
    }
  });

  bot.command("export", async (ctx) => {
    try {
      // Apenas VIP (o endpoint já valida)
      const url = `${deps.apiBaseUrl}/api/export/gastos.csv?telegramUserId=${encodeURIComponent(String(ctx.from?.id || ""))}`;
      const resp = await getJSON(url, deps);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        let msg = "Recurso disponível apenas para VIP.";
        try {
          const j = JSON.parse(txt);
          if (j?.error) msg = j.error;
        } catch {}
        return ctx.reply(`❌ ${msg}`);
      }
      // Não vamos enviar o arquivo via bot (pode ser grande); mandamos link direto.
      return ctx.reply(`📤 Export pronto (CSV):\n${url}`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro ao exportar");
    }
  });


  bot.command("salario", async (ctx) => {
    try {
      const parts = ctx.message.text.split(" ").filter(Boolean);
      if (parts.length < 2) return ctx.reply("Use assim: /salario 1900");

      const valor = Number(parts[1].replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0) {
        return ctx.reply("Valor inválido. Ex: /salario 1900 ou /salario 1900,50");
      }

      const url = `${deps.apiBaseUrl}/api/salario`;
      const payload = { valor, data: todayISO(), telegramUserId: ctx.from?.id, telegramUsername: ctx.from?.username };

      let resp;
      try {
        resp = await postJSON(url, payload, deps);
      } catch (err) {
        console.error("❌ fetch salário:", err);
        return ctx.reply(`❌ Não consegui conectar na API: ${url}`);
      }

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) return ctx.reply(`❌ Erro ao salvar salário: ${body?.error || resp.status}`);

      return ctx.reply(`Salário registrado: ${formatBRL(valor)} ✅`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("categoria", async (ctx) => {
    try {
      const parts = ctx.message.text.split(" ").filter(Boolean);
      if (parts.length < 3 || parts[1].toLowerCase() !== "add") {
        return ctx.reply("Use assim: /categoria add alimentacao");
      }

      const nome = parts.slice(2).join(" ").trim();
      const url = `${deps.apiBaseUrl}/api/categoria`;

      let resp;
      try {
        resp = await postJSON(url, { nome, telegramUserId: ctx.from?.id, telegramUsername: ctx.from?.username }, deps);
      } catch (err) {
        console.error("❌ fetch categoria:", err);
        return ctx.reply(`❌ Não consegui conectar na API: ${url}`);
      }

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) return ctx.reply(`❌ Erro ao criar categoria: ${body?.error || resp.status}`);

      return ctx.reply("Categoria ok ✅");
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("gasto", async (ctx) => {
    try {
      const parts = ctx.message.text.split(" ").filter(Boolean);
      if (parts.length < 4) return ctx.reply("Use assim: /gasto 35.90 mercado alimentacao");

      const valor = Number(parts[1].replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0) {
        return ctx.reply("Valor inválido. Ex: /gasto 35.90 mercado alimentacao");
      }

      const categoria = parts[parts.length - 1];
      const descricao = parts.slice(2, parts.length - 1).join(" ").trim();

      const url = `${deps.apiBaseUrl}/api/gasto`;
      const payload = { valor, descricao, categoria, data: todayISO(), telegramUserId: ctx.from?.id, telegramUsername: ctx.from?.username };

      let resp;
      try {
        resp = await postJSON(url, payload, deps);
      } catch (err) {
        console.error("❌ fetch gasto:", err);
        return ctx.reply(`❌ Não consegui conectar na API: ${url}`);
      }

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) return ctx.reply(`❌ ${body?.error || "Erro ao salvar gasto"}`);

      return ctx.reply(`Gasto registrado: ${formatBRL(valor)} - ${descricao} (${categoria}) ✅`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("resumo", async (ctx) => {
    try {
      const parts = ctx.message.text.split(" ").filter(Boolean);
      const sub = (parts[1] || "").toLowerCase();
      if (sub !== "hoje") return ctx.reply("Use assim: /resumo hoje");

      const data = todayISO();
      const url = `${deps.apiBaseUrl}/api/resumo/hoje?data=${encodeURIComponent(data)}&telegramUserId=${encodeURIComponent(String(ctx.from?.id || ""))}`;

      let resp;
      try {
        resp = await getJSON(url, deps);
      } catch (err) {
        console.error("❌ fetch resumo:", err);
        return ctx.reply(`❌ Não consegui conectar na API: ${url}`);
      }

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) return ctx.reply(`❌ Erro no resumo: ${body?.error || resp.status}`);

      const r = body.resumo;
      const linhas = [
        `📅 Resumo de hoje (${r.data})`,
        `💰 Salários: ${formatBRL(r.totalSalarios)}`,
        `💸 Gastos: ${formatBRL(r.totalGastos)}`,
        `🧾 Saldo: ${formatBRL(r.saldo)}`,
        "",
        "Últimos gastos:",
      ];

      if (!r.ultimos?.length) linhas.push("- (nenhum)");
      else for (const g of r.ultimos) linhas.push(`- ${formatBRL(g.valor)} • ${g.descricao} • ${g.categoria}`);

      return ctx.reply(linhas.join("\n"));
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("login", async (ctx) => {
    try {
      const parts = ctx.message.text.split(" ").filter(Boolean);
      if (parts.length < 2) return ctx.reply("Use assim: /login SEU_CODIGO");

      const code = parts[1].trim().toUpperCase();
      const telegramUserId = ctx.from?.id;
      const telegramUsername = ctx.from?.username;

      if (!telegramUserId) return ctx.reply("❌ Não consegui ler seu ID do Telegram.");

      const base = deps.apiBaseUrl.replace(/\/+$/, "");
      const url = `${base}/api/auth/telegram-link`;

      console.log("LOGIN URL:", url);

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, telegramUserId, telegramUsername }),
      });

      const text = await resp.text();
      let body: any = {};
      try { body = JSON.parse(text); } catch {}

      if (!resp.ok || !body?.ok) {
        const msg = body?.error ? body.error : `HTTP ${resp.status} (sem JSON): ${text.slice(0, 120)}`;
        return ctx.reply(`❌ ${msg}`);
      }

      return ctx.reply("✅ Telegram conectado com sucesso! Pode voltar pro site.");
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("canal", async (ctx) => {
    try {
      const parts = ctx.message.text.split(" ").filter(Boolean);
      const canal = (parts[1] || "").toLowerCase();
      if (canal !== "telegram" && canal !== "whatsapp") {
        return ctx.reply("Use assim: /canal telegram  (ou /canal whatsapp)");
      }

      const url = `${deps.apiBaseUrl}/api/user/preferred-channel`;
      const payload = {
        preferredChannel: canal,
        telegramUserId: ctx.from?.id,
        telegramUsername: ctx.from?.username,
      };

      const resp = await putJSON(url, payload, deps);
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) return ctx.reply(`❌ ${body?.error || "Falha ao atualizar"}`);

      return ctx.reply(`✅ Canal preferido atualizado para: ${canal}`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  async function broadcastViaApi(ctx: any, message: string, title: string | null) {
    const url = `${deps.apiBaseUrl}/api/notices/broadcast`;
    const payload = {
      body: message,
      title,
      telegramUserId: ctx.from?.id,
      telegramUsername: ctx.from?.username,
    };

    const resp = await postJSON(url, payload, deps);
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || !body?.ok) {
      return { ok: false as const, error: body?.error || `HTTP ${resp.status}` };
    }
    return { ok: true as const, recipients: body.recipients as string[], noticeId: body.noticeId as number };
  }

  bot.command("aviso", async (ctx) => {
    try {
      const text = ctx.message.text || "";
      const parts = text.split(" ").filter(Boolean);

      if (parts.length < 2) {
        return ctx.reply("Use assim: /aviso everyone SUA_MENSAGEM\nOu: /aviso SUA_MENSAGEM");
      }

      let idx = 1;
      const first = (parts[1] || "").toLowerCase();
      if (first === "everyone" || first === "all") idx = 2;

      const msg = parts.slice(idx).join(" ").trim();
      if (!msg) return ctx.reply("Mensagem vazia.");

      const api = await broadcastViaApi(ctx, msg, null);
      if (!api.ok) return ctx.reply(`❌ ${api.error}`);

      const recipients = api.recipients;
      let sent = 0;
      let failed = 0;

      // dispara 1 a 1 pra evitar rate-limit chato
      for (const chatIdStr of recipients) {
        const chatId = Number(chatIdStr);
        if (!Number.isFinite(chatId) || chatId <= 0) continue;

        try {
          await ctx.telegram.sendMessage(chatId, `📣 Aviso\n\n${msg}`);
          sent++;
        } catch (e) {
          failed++;
        }

        // micro-pauda
        await new Promise((r) => setTimeout(r, 40));
      }

      return ctx.reply(`✅ Aviso enviado. Entregues: ${sent} | Falhas: ${failed}`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  
  bot.command("poweradd", async (ctx) => {
    try {
      const text = ctx.message.text || "";
      const parts = text.split(" ").filter(Boolean);
      const id = (parts[1] || "").trim();
      if (!id) {
        return ctx.reply("Use assim: /poweradd ID\n(ID pode ser o user_id interno ou seu Telegram ID)");
      }

      // Alias para: /powerrole admin ID
      const url = `${deps.apiBaseUrl}/api/user/role/set`;
      const payload = { id, role: "admin", telegramUserId: ctx.from?.id, telegramUsername: ctx.from?.username };

      const resp = await postJSON(url, payload, deps);
      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || !body?.ok) {
        return ctx.reply(`❌ ${body?.error || "Falha ao promover admin"}`);
      }

      const u = body.user;
      return ctx.reply(`✅ Cargo definido: admin para user_id=${u.id} (modo: ${body.mode}).`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("powerplan", async (ctx) => {
    try {
      const text = ctx.message.text || "";
      const parts = text.split(" ").filter(Boolean);
      const plan = (parts[1] || "").trim();
      const id = (parts[2] || "").trim();
      if (!plan || !id) {
        return ctx.reply("Use assim: /powerplan free|vip ID\n(ID pode ser user_id interno ou Telegram ID)");
      }

      const url = `${deps.apiBaseUrl}/api/user/plan/set`;
      const payload = { id, plan, telegramUserId: ctx.from?.id, telegramUsername: ctx.from?.username };

      const resp = await postJSON(url, payload, deps);
      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || !body?.ok) {
        return ctx.reply(`❌ ${body?.error || "Falha ao definir plano"}`);
      }

      const u = body.user;
      const p = String(body.plan || "").toUpperCase();
      return ctx.reply(`✅ Plano definido: ${p} para user_id=${u.id} (modo: ${body.mode})`);
    } catch (e: any) {
      console.error(e);
      return ctx.reply("❌ Erro ao definir plano");
    }
  });


  bot.command("powerrole", async (ctx) => {
    try {
      const text = ctx.message.text || "";
      const parts = text.split(" ").filter(Boolean);
      const role = (parts[1] || "").trim();
      const id = (parts[2] || "").trim();
      if (!role || !id) {
        return ctx.reply("Use assim: /powerrole admin|moderador|membro ID\n(ID pode ser user_id interno ou Telegram ID)");
      }

      const url = `${deps.apiBaseUrl}/api/user/role/set`;
      const payload = { id, role, telegramUserId: ctx.from?.id, telegramUsername: ctx.from?.username };

      const resp = await postJSON(url, payload, deps);
      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || !body?.ok) {
        return ctx.reply(`❌ ${body?.error || "Falha ao definir cargo"}`);
      }

      const u = body.user;
      return ctx.reply(`✅ Cargo definido: ${body.role} para user_id=${u.id} (modo: ${body.mode}).`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("powerremove", async (ctx) => {
    try {
      const text = ctx.message.text || "";
      const parts = text.split(" ").filter(Boolean);
      const id = (parts[1] || "").trim();
      if (!id) return ctx.reply("Use assim: /powerremove ID\n(ID pode ser user_id interno ou Telegram ID)");

      const url = `${deps.apiBaseUrl}/api/user/role/revoke`;
      const payload = { id, telegramUserId: ctx.from?.id, telegramUsername: ctx.from?.username };
      const resp = await postJSON(url, payload, deps);
      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || !body?.ok) {
        return ctx.reply(`❌ ${body?.error || "Falha ao remover poderes"}`);
      }

      const u = body.user;
      return ctx.reply(`✅ Poderes removidos. Agora user_id=${u.id} é membro (modo: ${body.mode}).`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("admins", async (ctx) => {
    try {
      const url = `${deps.apiBaseUrl}/api/user/members/admins?telegramUserId=${encodeURIComponent(String(ctx.from?.id || ""))}`;
      const resp = await getJSON(url, deps);
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) return ctx.reply(`❌ ${body?.error || "Falha ao buscar admins"}`);

      const admins = body.admins || [];
      const fmt = (u: any) => {
        const name = u.username ? `@${u.username}` : (u.telegram_id ? `tg:${u.telegram_id}` : "(sem telegram)");
        const plan = (u.plan || "free").toString().toUpperCase();
        const badge = plan === "VIP" ? " 💎VIP" : "";
        return `- user_id=${u.user_id} ${name}${badge}`;
      };

      const lines: string[] = [];
      lines.push(`🛡️ Admins (${admins.length})`);
      if (!admins.length) lines.push("- (nenhum)");
      else lines.push(...admins.map(fmt));
      return ctx.reply(lines.join("\n").slice(0, 3800));
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("mods", async (ctx) => {
    try {
      const url = `${deps.apiBaseUrl}/api/user/members/moderadores?telegramUserId=${encodeURIComponent(String(ctx.from?.id || ""))}`;
      const resp = await getJSON(url, deps);
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) return ctx.reply(`❌ ${body?.error || "Falha ao buscar moderadores"}`);

      const moderadores = body.moderadores || [];
      const fmt = (u: any) => {
        const name = u.username ? `@${u.username}` : (u.telegram_id ? `tg:${u.telegram_id}` : "(sem telegram)");
        const plan = (u.plan || "free").toString().toUpperCase();
        const badge = plan === "VIP" ? " 💎VIP" : "";
        return `- user_id=${u.user_id} ${name}${badge}`;
      };

      const lines: string[] = [];
      lines.push(`🧰 Moderadores (${moderadores.length})`);
      if (!moderadores.length) lines.push("- (nenhum)");
      else lines.push(...moderadores.map(fmt));
      return ctx.reply(lines.join("\n").slice(0, 3800));
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("membros", async (ctx) => {
    try {
      const url = `${deps.apiBaseUrl}/api/user/members/summary?telegramUserId=${encodeURIComponent(String(ctx.from?.id || ""))}`;
      const resp = await getJSON(url, deps);
      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || !body?.ok) {
        return ctx.reply(`❌ ${body?.error || "Falha ao buscar membros"}`);
      }

      const counts = body.counts;
      const groups = body.groups;

      const fmtUser = (u: any) => {
        const name = u.username ? `@${u.username}` : (u.telegram_id ? `tg:${u.telegram_id}` : "(sem telegram)");
        const plan = (u.plan || "free").toString().toUpperCase();
        const badge = plan === "VIP" ? " 💎VIP" : "";
        return `- user_id=${u.user_id} ${name}${badge}`;
      };

      const lines: string[] = [];
      lines.push(`👥 Membros: ${counts.total}`);
      lines.push(`🛡️ Admin: ${counts.admin} | 🧰 Moderador: ${counts.moderador} | 👤 Membro: ${counts.membro}`);
      if (counts.plans) {
        lines.push(`📦 Planos: FREE ${counts.plans.free ?? 0} | VIP ${counts.plans.vip ?? 0}`);
      }
      lines.push("");

      const order = ["admin", "moderador", "membro"];
      const labels: any = { admin: "🛡️ Admin", moderador: "🧰 Moderador", membro: "👤 Membro" };

      for (const r of order) {
        const arr = (groups && groups[r]) ? groups[r] : [];
        lines.push(`${labels[r]} (${arr.length})`);
        if (!arr.length) lines.push("- (nenhum)");
        else lines.push(...arr.map(fmtUser));
        lines.push("");
      }

      // evita estourar limite de mensagem
      const msg = lines.join("\n").trim();
      return ctx.reply(msg.slice(0, 3800));
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("stats", async (ctx) => {
    try {
      const url = `${deps.apiBaseUrl}/api/user/admin/stats?telegramUserId=${encodeURIComponent(
        String(ctx.from?.id || "")
      )}`;
      const resp = await getJSON(url, deps);
      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || !body?.ok) {
        return ctx.reply(`❌ ${body?.error || "Falha ao buscar stats"}`);
      }

      const s = body.stats;
      const lines: string[] = [];
      lines.push("📊 Estatísticas (admin)");
      lines.push(`👥 Usuários: ${s.usersTotal}`);
      lines.push(`⛔ Banidos ativos: ${s.usersBannedActive}`);

      const fmtKV = (obj: any) => Object.entries(obj || {}).map(([k, v]) => `${k}:${v}`).join(" | ");
      lines.push(`📦 Planos: ${fmtKV(s.plans) || "-"}`);
      lines.push(`🧰 Cargos: ${fmtKV(s.roles) || "-"}`);
      lines.push(`📡 Canais ativos: ${fmtKV(s.channelsActive) || "-"}`);
      return ctx.reply(lines.join("\n").slice(0, 3800));
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });

  bot.command("ban", async (ctx) => {
    try {
      const text = ctx.message.text || "";
      const parts = text.split(" ").filter(Boolean);
      const id = (parts[1] || "").trim();
      const duration = (parts[2] || "").trim();
      const reason = parts.slice(3).join(" ").trim();
      if (!id) return ctx.reply("Use assim: /ban ID [7d|2h|30m] [motivo]\n(ID pode ser user_id interno ou Telegram ID)");

      const url = `${deps.apiBaseUrl}/api/user/ban`;
      const payload: any = { id, telegramUserId: ctx.from?.id, telegramUsername: ctx.from?.username };
      if (duration) payload.duration = duration;
      if (reason) payload.reason = reason;

      const resp = await postJSON(url, payload, deps);
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) return ctx.reply(`❌ ${body?.error || "Falha ao banir"}`);

      const u = body.user;
      return ctx.reply(`⛔ Usuário banido: user_id=${u.id} (modo: ${body.mode}).`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro ao banir");
    }
  });

  bot.command("unban", async (ctx) => {
    try {
      const text = ctx.message.text || "";
      const parts = text.split(" ").filter(Boolean);
      const id = (parts[1] || "").trim();
      if (!id) return ctx.reply("Use assim: /unban ID\n(ID pode ser user_id interno ou Telegram ID)");

      const url = `${deps.apiBaseUrl}/api/user/unban`;
      const payload: any = { id, telegramUserId: ctx.from?.id, telegramUsername: ctx.from?.username };
      const resp = await postJSON(url, payload, deps);
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) return ctx.reply(`❌ ${body?.error || "Falha ao desbanir"}`);

      const u = body.user;
      return ctx.reply(`✅ Usuário reativado: user_id=${u.id} (modo: ${body.mode}).`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro ao desbanir");
    }
  });

  bot.command("banidos", async (ctx) => {
    try {
      const text = ctx.message.text || "";
      const parts = text.split(/\s+/).filter(Boolean);
      const all = (parts[1] || "").trim().toLowerCase() === "todos";

      // Por segurança, usa allowBotOrAuth via x-bot-token (admin required na API)
      const url = `${deps.apiBaseUrl}/api/user/banned?activeOnly=${all ? 0 : 1}&telegramUserId=${encodeURIComponent(
        String(ctx.from?.id || "")
      )}&telegramUsername=${encodeURIComponent(String(ctx.from?.username || ""))}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-bot-token": deps.botInternalToken,
        },
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) return ctx.reply(`❌ ${body?.error || "Falha ao listar banidos"}`);

      const list: any[] = Array.isArray(body.banned) ? body.banned : [];
      if (list.length === 0) return ctx.reply(all ? "✅ Nenhum ban encontrado." : "✅ Nenhum usuário banido no momento.");

      const title = all ? "📛 Banidos (inclui expirados)" : "📛 Banidos (ativos)";
      const lines = list.slice(0, 40).map((u) => {
        const ident = u.username ? `@${u.username}` : u.telegram_id ? `tg:${u.telegram_id}` : "(sem telegram)";
        const until = u.banned_until ? String(u.banned_until).replace("T", " ").replace("Z", "") : "?";
        const reason = u.ban_reason ? ` — ${u.ban_reason}` : "";
        return `• user_id=${u.user_id} ${ident} até ${until}${reason}`;
      });

      const more = list.length > 40 ? `\n… e mais ${list.length - 40}` : "";
      return ctx.reply(`${title}\n${lines.join("\n")}${more}`.slice(0, 3900));
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro ao listar banidos");
    }
  });

bot.command("changelog", async (ctx) => {
    try {
      const text = ctx.message.text || "";
      const parts = text.split(" ").filter(Boolean);
      const msg = parts.slice(1).join(" ").trim();
      if (!msg) return ctx.reply("Use assim: /changelog SUA_MENSAGEM");

      const api = await broadcastViaApi(ctx, msg, "changelog");
      if (!api.ok) return ctx.reply(`❌ ${api.error}`);

      const recipients = api.recipients;
      let sent = 0;
      let failed = 0;
      for (const chatIdStr of recipients) {
        const chatId = Number(chatIdStr);
        if (!Number.isFinite(chatId) || chatId <= 0) continue;
        try {
          await ctx.telegram.sendMessage(chatId, `🧩 Changelog\n\n${msg}`);
          sent++;
        } catch {
          failed++;
        }
        await new Promise((r) => setTimeout(r, 40));
      }

      return ctx.reply(`✅ Changelog enviado. Entregues: ${sent} | Falhas: ${failed}`);
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });


  bot.command("planos", async (ctx) => {
    try {
      const url = `${deps.apiBaseUrl}/api/user/members/summary?telegramUserId=${encodeURIComponent(String(ctx.from?.id || ""))}`;
      const resp = await getJSON(url, deps);
      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || !body?.ok) {
        return ctx.reply(`❌ ${body?.error || "Falha ao buscar planos"}`);
      }

      const groups = body.groups || {};
      const all: any[] = []
        .concat(groups.admin || [])
        .concat(groups.moderador || [])
        .concat(groups.membro || []);

      const vip = all.filter((u) => String(u.plan || "free").toLowerCase() === "vip");
      const free = all.filter((u) => String(u.plan || "free").toLowerCase() !== "vip");

      const fmt = (u: any) => {
        const name = u.username ? `@${u.username}` : (u.telegram_id ? `tg:${u.telegram_id}` : "(sem telegram)");
        return `- user_id=${u.user_id} ${name}`;
      };

      const lines: string[] = [];
      lines.push(`📦 Planos (total ${all.length})`);
      lines.push(`💎 VIP: ${vip.length} | 🆓 FREE: ${free.length}`);
      lines.push("");
      lines.push(`💎 VIP (${vip.length})`);
      if (!vip.length) lines.push("- (nenhum)");
      else lines.push(...vip.map(fmt));
      return ctx.reply(lines.join("\n").slice(0, 3800));
    } catch (e) {
      console.error(e);
      return ctx.reply("❌ Erro interno. Veja o terminal.");
    }
  });


  bot.launch();
  console.log("🤖 Bot Telegram iniciado!");
  console.log("🌐 API_BASE_URL do bot:", deps.apiBaseUrl);
  return bot;
}