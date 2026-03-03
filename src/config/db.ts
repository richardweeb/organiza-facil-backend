import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "organiza.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function nowISO() {
  return new Date().toISOString();
}

function tableExists(table: string) {
  const r = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as any;
  return !!r;
}

function tableHasColumn(table: string, column: string) {
  if (!tableExists(table)) return false;
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function safeExec(label: string, sql: string) {
  try {
    db.exec(sql);
  } catch (e: any) {
    // Ajuda MUITO quando SQLite reclama de "near X":
    // Mostra qual bloco falhou.
    console.error(`\n[DB] Falha no bloco: ${label}`);
    console.error(sql);
    throw e;
  }
}

// =============================
// Schema base (v3)
// =============================
// Importante: executar em blocos pequenos evita erros obscuros em SQLite
// (e facilita apontar exatamente onde quebrou).

safeExec(
  "schema:users",
  `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'membro',
  plan TEXT NOT NULL DEFAULT 'free',
  banned_until TEXT,
  ban_reason TEXT,
  preferred_channel TEXT NOT NULL DEFAULT 'telegram'
);
`
);

safeExec(
  "schema:user_channels",
  `
CREATE TABLE IF NOT EXISTS user_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  username TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(channel, external_id)
);
`
);

safeExec(
  "schema:login_codes",
  `
CREATE TABLE IF NOT EXISTS login_codes (
  code TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  user_id INTEGER
);
`
);

safeExec(
  "schema:salarios",
  `
CREATE TABLE IF NOT EXISTS salarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`
);

safeExec(
  "schema:categorias",
  `
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, nome)
);
`
);

safeExec(
  "schema:gastos",
  `
CREATE TABLE IF NOT EXISTS gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  valor REAL NOT NULL,
  descricao TEXT NOT NULL,
  data TEXT NOT NULL,
  categoria_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);
`
);

safeExec(
  "schema:notices",
  `
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by_user_id INTEGER NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  title TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
`
);

safeExec(
  "schema:notice_reads",
  `
CREATE TABLE IF NOT EXISTS notice_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notice_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at TEXT NOT NULL,
  FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(notice_id, user_id)
);
`
);

// =============================
// Migrações (v1/v2 -> v3)
// =============================
const migrate = db.transaction(() => {
  // v3 -> v4: adiciona coluna role
  if (tableExists("users") && !tableHasColumn("users", "role")) {
    safeExec(
      "migrate:users add role",
      `
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'membro';
UPDATE users SET role = 'admin' WHERE is_admin = 1;
`
    );
  }

  // v4/v5: adiciona coluna plan (free|vip)
  if (tableExists("users") && !tableHasColumn("users", "plan")) {
    safeExec(
      "migrate:users add plan",
      `
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
`
    );
  }

  // v7+: banimento (reversível)
  if (tableExists("users") && !tableHasColumn("users", "banned_until")) {
    safeExec(
      "migrate:users add banned_until",
      `
ALTER TABLE users ADD COLUMN banned_until TEXT;
`
    );
  }
  if (tableExists("users") && !tableHasColumn("users", "ban_reason")) {
    safeExec(
      "migrate:users add ban_reason",
      `
ALTER TABLE users ADD COLUMN ban_reason TEXT;
`
    );
  }


  // v2 -> v3: users tinha telegram_user_id
  if (tableExists("users") && tableHasColumn("users", "telegram_user_id")) {
    safeExec(
      "migrate:v2->v3 users/user_channels",
      `
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'membro',
  plan TEXT NOT NULL DEFAULT 'free',
  preferred_channel TEXT NOT NULL DEFAULT 'telegram'
);

CREATE TABLE user_channels_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  username TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users_new(id) ON DELETE CASCADE,
  UNIQUE(channel, external_id)
);

INSERT INTO users_new (id, created_at, is_admin, role, plan, preferred_channel)
  SELECT id, created_at,
         CASE WHEN id = 1 THEN 1 ELSE 0 END,
         CASE WHEN id = 1 THEN 'admin' ELSE 'membro' END,
         'free',
         'telegram'
  FROM users;

INSERT INTO user_channels_new (user_id, channel, external_id, username, address, is_active, created_at, updated_at)
  SELECT id, 'telegram', CAST(telegram_user_id AS TEXT), telegram_username, NULL, 1, created_at, created_at
  FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

DROP TABLE IF EXISTS user_channels;
ALTER TABLE user_channels_new RENAME TO user_channels;
`
    );
  }

  // v1 -> v2/v3: tabelas antigas sem user_id
  if (tableExists("salarios") && !tableHasColumn("salarios", "user_id")) {
    safeExec(
      "migrate:salarios add user_id",
      `
CREATE TABLE salarios_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO salarios_new (id, user_id, valor, data)
  SELECT id, 1, valor, data FROM salarios;
DROP TABLE salarios;
ALTER TABLE salarios_new RENAME TO salarios;
`
    );
  }

  if (tableExists("categorias") && !tableHasColumn("categorias", "user_id")) {
    safeExec(
      "migrate:categorias add user_id",
      `
CREATE TABLE categorias_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, nome)
);
INSERT INTO categorias_new (id, user_id, nome)
  SELECT id, 1, nome FROM categorias;
DROP TABLE categorias;
ALTER TABLE categorias_new RENAME TO categorias;
`
    );
  }

  if (tableExists("gastos") && !tableHasColumn("gastos", "user_id")) {
    safeExec(
      "migrate:gastos add user_id",
      `
CREATE TABLE gastos_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  valor REAL NOT NULL,
  descricao TEXT NOT NULL,
  data TEXT NOT NULL,
  categoria_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);
INSERT INTO gastos_new (id, user_id, valor, descricao, data, categoria_id)
  SELECT id, 1, valor, descricao, data, categoria_id FROM gastos;
DROP TABLE gastos;
ALTER TABLE gastos_new RENAME TO gastos;
`
    );
  }

  // Garante que exista pelo menos 1 usuário
  const anyUser = db.prepare("SELECT id FROM users LIMIT 1").get() as any;
  if (!anyUser) {
    db.prepare(
      "INSERT INTO users (created_at, is_admin, role, plan, preferred_channel) VALUES (?, ?, ?, ?, ?)"
    ).run(nowISO(), 1, "admin", "free", "telegram");
  }

  // Conveniência MVP
  db.prepare("UPDATE users SET is_admin = 1 WHERE id = 1").run();
  db.prepare("UPDATE users SET role = 'admin' WHERE id = 1").run();
});

migrate();

// =============================
// Índices (sempre depois)
// =============================
safeExec(
  "indexes",
  `
CREATE INDEX IF NOT EXISTS idx_salarios_user_data ON salarios(user_id, data);
CREATE INDEX IF NOT EXISTS idx_categorias_user_nome ON categorias(user_id, nome);
CREATE INDEX IF NOT EXISTS idx_gastos_user_data ON gastos(user_id, data);
CREATE INDEX IF NOT EXISTS idx_gastos_user_categoria ON gastos(user_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_user_channels_user ON user_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channels_channel ON user_channels(channel);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON notices(created_at);
CREATE INDEX IF NOT EXISTS idx_notice_reads_user ON notice_reads(user_id);
`
);
