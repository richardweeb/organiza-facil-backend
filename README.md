# Organiza Fácil — Bot (Telegram) + API + Dashboard

Projeto full-stack “organizador pessoal” com:
- **Bot no Telegram** (Telegraf)
- **API em Node.js + TypeScript** (Express)
- **SQLite** (better-sqlite3)
- Base pronta para **WhatsApp** via `user_channels` (multi-canal)

## Principais ideias técnicas (padrão portfólio)
- **`users` (identidade interna)** desacoplada de IDs externos.
- **`user_channels`** vincula um usuário a múltiplos canais (Telegram / WhatsApp).
- **RBAC** (controle de acesso por cargo): `admin`, `moderador`, `membro`.
- **Planos**: `free` e `vip` (entitlements e limites).
- **Avisos / Changelog** com broadcast.

## Rodando localmente
1. Instale dependências:
   ```bash
   npm install
   ```

2. Crie seu `.env`:
   ```bash
   copy .env.example .env
   ```
   Ajuste `BOT_TOKEN` e `BOT_INTERNAL_TOKEN`.

3. Suba:
   ```bash
   npm run dev
   ```

Banco SQLite fica em `data/organiza.db`.

## Documentação da API (OpenAPI)
Com a API rodando, acesse:
- `http://localhost:3000/docs`

## Comandos do Bot (Telegram)
- Usuário:
  - `/plano` — mostra plano/cargo
  - `/beneficios` — mostra limites e perks do plano
- Admin:
  - `/poweradd ID` — dá admin (atalho)
  - `/powerrole <admin|moderador|membro> ID` — define cargo
  - `/powerremove ID` — volta pra membro
  - `/powerplan <free|vip> ID` — define plano
  - `/membros` — mostra total e lista por cargos/planos
  - `/stats` — estatísticas rápidas (usuários, bans ativos, planos, cargos)
  - `/admins` — lista admins
  - `/mods` — lista moderadores
  - `/banidos` — lista bans ativos
  - `/banidos todos` — lista bans ativos + expirados
  - `/aviso everyone ...` — aviso global (broadcast)
  - `/changelog ...` — changelog global

> Observação: por segurança, o modo `SAFE_ROLE_ASSIGN=1` só permite dar cargo/plano para usuários que já falaram com o bot (já existem em `user_channels`).

## Scripts (portfólio)
- `npm run build` — compila TypeScript
- `npm start` — roda `dist/`
- `npm run lint` — ESLint
- `npm run format` — Prettier

## Git (pontapé inicial)
1. Inicie o repositório:
   ```bash
   git init
   git add .
   git commit -m "chore: initial commit (portfolio-ready)"
   ```
2. Crie um repositório no GitHub e conecte:
   ```bash
   git branch -M main
   git remote add origin <URL_DO_REPO>
   git push -u origin main
   ```

## Estrutura de pastas
- `src/routes` — rotas Express
- `src/services` — regras de negócio
- `src/middlewares` — auth, admin, vip etc.
- `src/bot` — bot Telegram
- `src/config` — DB, env, entitlements
