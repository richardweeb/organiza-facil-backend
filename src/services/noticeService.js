"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotice = createNotice;
exports.getNoticeById = getNoticeById;
exports.listNoticesForUser = listNoticesForUser;
exports.markNoticeRead = markNoticeRead;
exports.listTelegramRecipients = listTelegramRecipients;
const db_1 = require("../config/db");
function nowISO() {
    return new Date().toISOString();
}
function createNotice(params) {
    const createdAt = nowISO();
    const audience = params.audience ?? "all";
    const title = params.title ?? null;
    const info = db_1.db
        .prepare("INSERT INTO notices (created_by_user_id, audience, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(params.createdByUserId, audience, title, params.body, createdAt, createdAt);
    const id = Number(info.lastInsertRowid);
    return getNoticeById(id);
}
function getNoticeById(id) {
    const row = db_1.db
        .prepare("SELECT id, created_by_user_id, audience, title, body, created_at, updated_at FROM notices WHERE id = ?")
        .get(id);
    return row ?? null;
}
function listNoticesForUser(userId, limit = 50) {
    const rows = db_1.db
        .prepare(`
SELECT n.id, n.audience, n.title, n.body, n.created_at,
       CASE WHEN nr.read_at IS NULL THEN 0 ELSE 1 END as is_read,
       nr.read_at
FROM notices n
LEFT JOIN notice_reads nr
  ON nr.notice_id = n.id AND nr.user_id = ?
ORDER BY n.created_at DESC
LIMIT ?
`)
        .all(userId, limit);
    return rows;
}
function markNoticeRead(userId, noticeId) {
    const readAt = nowISO();
    db_1.db.prepare(`
INSERT INTO notice_reads (notice_id, user_id, read_at)
VALUES (?, ?, ?)
ON CONFLICT(notice_id, user_id) DO UPDATE SET read_at = excluded.read_at
`).run(noticeId, userId, readAt);
    return { ok: true, noticeId, userId, readAt };
}
function listTelegramRecipients() {
    const rows = db_1.db
        .prepare("SELECT external_id FROM user_channels WHERE channel = 'telegram' AND is_active = 1")
        .all();
    return rows.map((r) => r.external_id);
}
