import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.dirname(serverDir)
export const dataDir = path.resolve(projectDir, process.env.DATA_DIR || 'data')
export const signatureDir = path.join(dataDir, 'signatures')
export const postcardDir = path.join(dataDir, 'postcards')
mkdirSync(signatureDir, { recursive: true })
mkdirSync(postcardDir, { recursive: true })

const legacyDatabase = path.join(dataDir, 'signature-admin.sqlite')
const unifiedDatabase = path.join(dataDir, 'adminsystem.sqlite')
if (!existsSync(unifiedDatabase) && existsSync(legacyDatabase)) renameSync(legacyDatabase, unifiedDatabase)
export const db = new DatabaseSync(unifiedDatabase)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'auditor')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS terminals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'offline',
    last_seen_at TEXT,
    app_version TEXT,
    queue_count INTEGER NOT NULL DEFAULT 0,
    ip_address TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS signatures (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    trace_id TEXT,
    display_name TEXT,
    user_no TEXT,
    identity_type TEXT,
    class_name TEXT,
    template_id TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    stroke_count INTEGER NOT NULL DEFAULT 0,
    point_count INTEGER NOT NULL DEFAULT 0,
    path_length REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'deleted')),
    sync_state TEXT NOT NULL DEFAULT 'synced',
    archived_at TEXT,
    deleted_at TEXT,
    raw_path TEXT NOT NULL,
    svg_path TEXT NOT NULL,
    display_path TEXT NOT NULL,
    print_path TEXT NOT NULL,
    thumbnail_path TEXT NOT NULL,
    jpg_path TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_signatures_created_at ON signatures(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_signatures_status ON signatures(status);
  CREATE INDEX IF NOT EXISTS idx_signatures_terminal ON signatures(terminal_id);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    detail_json TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS postcard_templates (
    id TEXT PRIMARY KEY,
    group_name TEXT NOT NULL,
    name TEXT NOT NULL,
    year_label TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    background TEXT NOT NULL,
    ink TEXT NOT NULL,
    accent TEXT NOT NULL,
    muted TEXT NOT NULL,
    motif TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    custom_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS postcards (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    trace_id TEXT,
    signature_id TEXT,
    template_id TEXT NOT NULL,
    sender TEXT,
    graduation_year TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'deleted')),
    png_path TEXT NOT NULL,
    jpg_path TEXT NOT NULL,
    thumbnail_path TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    archived_at TEXT,
    deleted_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_postcards_created_at ON postcards(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_postcards_status ON postcards(status);

  CREATE TABLE IF NOT EXISTS print_jobs (
    id TEXT PRIMARY KEY,
    postcard_id TEXT NOT NULL REFERENCES postcards(id),
    terminal_id TEXT NOT NULL,
    printer_name TEXT,
    status TEXT NOT NULL CHECK(status IN ('created', 'queued', 'processing', 'succeeded', 'failed', 'paused', 'cancelled', 'archived')),
    copies INTEGER NOT NULL DEFAULT 1,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status, created_at);
`)

function ensureColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
}

// 审核状态与档案生命周期彼此独立。ALTER TABLE 的默认值也确保历史记录
// 在升级后统一处于“待审核、未上墙”，不会未经人工确认直接公开。
ensureColumn('signatures', 'review_status', "TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending', 'approved', 'rejected'))")
ensureColumn('signatures', 'reviewed_at', 'TEXT')
ensureColumn('signatures', 'reviewed_by', 'TEXT')
ensureColumn('signatures', 'review_note', 'TEXT')
ensureColumn('signatures', 'wall_visible', 'INTEGER NOT NULL DEFAULT 0 CHECK(wall_visible IN (0, 1))')
ensureColumn('signatures', 'wall_published_at', 'TEXT')
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_signatures_review_status ON signatures(review_status);
  CREATE INDEX IF NOT EXISTS idx_signatures_wall ON signatures(wall_visible, wall_published_at DESC);
`)

// Older postcard terminal versions did not copy the selected signature owner's
// display name into postcards.sender. Repair those rows without exposing anonymous
// signatures or overwriting a manually entered sender.
db.exec(`
  UPDATE postcards
  SET sender = (
    SELECT s.display_name FROM signatures s
    WHERE s.id = postcards.signature_id
      AND s.status != 'deleted'
      AND COALESCE(s.identity_type, '') != 'anonymous'
      AND TRIM(COALESCE(s.display_name, '')) != ''
  )
  WHERE TRIM(COALESCE(sender, '')) = ''
    AND signature_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM signatures s
      WHERE s.id = postcards.signature_id
        AND s.status != 'deleted'
        AND COALESCE(s.identity_type, '') != 'anonymous'
        AND TRIM(COALESCE(s.display_name, '')) != ''
    );
`)

export function nowIso() {
  return new Date().toISOString()
}

export function hashText(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') }
}

export function verifyPassword(password, salt, expectedHash) {
  const actual = scryptSync(password, salt, 64).toString('hex')
  if (actual.length !== expectedHash.length) return false
  const actualBuffer = Buffer.from(actual, 'hex')
  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  return actualBuffer.length === expectedBuffer.length && cryptoTimingSafeEqual(actualBuffer, expectedBuffer)
}

function cryptoTimingSafeEqual(left, right) {
  let different = 0
  for (let i = 0; i < left.length; i += 1) different |= left[i] ^ right[i]
  return different === 0
}

export function audit({ userId = null, username, action, entityType, entityId = null, detail = {}, ip = null }) {
  db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, detail_json, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, username, action, entityType, entityId, JSON.stringify(detail), ip, nowIso())
}

function seed() {
  const now = nowIso()
  if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    const password = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123456'
    const { salt, hash } = hashPassword(password)
    db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, password_salt, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'admin', 'active', ?, ?)
    `).run(`USR-${randomBytes(6).toString('hex')}`, 'admin', '系统管理员', hash, salt, now, now)
  }

  if (!db.prepare("SELECT 1 FROM terminals WHERE id = 'Z1-01'").get()) {
    const apiKey = process.env.TERMINAL_API_KEY || 'dev-terminal-key-change-before-production'
    db.prepare(`
      INSERT INTO terminals (id, name, location, api_key_hash, status, created_at, updated_at)
      VALUES ('Z1-01', '入口触摸签名终端', '展厅入口 · 添砖加瓦互动墙', ?, 'offline', ?, ?)
    `).run(hashText(apiKey), now, now)
  }

  if (!db.prepare("SELECT 1 FROM terminals WHERE id = 'Z3-25'").get()) {
    const postcardApiKey = process.env.POSTCARD_TERMINAL_API_KEY || 'dev-postcard-key-change-before-production'
    db.prepare(`
      INSERT INTO terminals (id, name, location, api_key_hash, status, created_at, updated_at)
      VALUES ('Z3-25', '校友明信片制作终端', '展厅出口 · 校友明信片', ?, 'offline', ?, ?)
    `).run(hashText(postcardApiKey), now, now)
  }

  const defaults = {
    retention_days: 365,
    auto_archive_days: 90,
    online_threshold_seconds: 120,
    school_name: '淳安第三中学',
    wall_layout: 'brick',
    wall_title: '一笔一画，汇成三中记忆',
    wall_refresh_seconds: 5,
    wall_rotation_seconds: 20,
    postcard_session_timeout_seconds: 180,
    postcard_result_retention_days: 14,
    postcard_original_retention_hours: 24,
    postcard_max_print_copies: 2,
    postcard_min_print_interval_seconds: 15,
  }
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)')
  for (const [key, value] of Object.entries(defaults)) insertSetting.run(key, JSON.stringify(value), now)

  const postcardTemplates = [
    ['t-1950','校史年代','湖畔初声','1956','弦歌初起','一纸寄湖山 · 一念念三中','#e8ddc8','#3f3a31','#8c3028','#8b7a63','stamp',1],
    ['t-1960','校史年代','墨绿年华','1966','青葱岁月','那年教室 · 窗外有风','#d9dfd1','#29362e','#6d2d28','#708073','window',2],
    ['t-1970','校史年代','山乡课堂','1976','山水同窗','书声越过千岛湖的晨雾','#e5d7bd','#44382c','#8d3d2e','#8c745d','mountain',3],
    ['t-1980','校史年代','红砖记忆','1986','青春留影','旧操场 · 红砖墙 · 白衬衫','#ead9c8','#3f342e','#9f2925','#987b68','grid',4],
    ['t-1990','校史年代','千岛来信','1996','写给同桌','愿多年以后仍记得这页光阴','#dce2dc','#2f3a34','#8a342d','#748379','rings',5],
    ['t-2000','校史年代','新世纪','2006','向新而行','每一次出发都从这里开始','#e8e4d9','#31342f','#9f2925','#7d8076','window',6],
    ['t-2010','校史年代','湖光少年','2016','逐光而上','我们在湖光里长成自己的模样','#dce7e3','#263833','#9a332c','#6a827a','mountain',7],
    ['t-2020','校史年代','今日三中','2026','此刻正青春','让今天成为明日珍藏','#f0e8db','#30312d','#9f2925','#84786b','grid',8],
    ['t-campus','校园印象','校园四季','CAMPUS','风景正好','从春樱到冬雪 · 四季皆是来信','#e2e8db','#2f3d32','#8f302b','#718071','rings',9],
    ['t-anniversary','节庆纪念','校庆纪念','ANNIVERSARY','归来仍少年','淳安第三中学 · 欢迎回家','#efe2cf','#43362d','#9f2925','#937864','stamp',10],
  ]
  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO postcard_templates
    (id, group_name, name, year_label, title, subtitle, background, ink, accent, muted, motif, enabled, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `)
  for (const template of postcardTemplates) insertTemplate.run(...template, now, now)
}

seed()

export function getSettings() {
  return Object.fromEntries(db.prepare('SELECT key, value_json FROM settings').all().map((row) => [row.key, JSON.parse(row.value_json)]))
}

export function runMaintenance() {
  const settings = getSettings()
  const archiveDays = Number(settings.auto_archive_days || 0)
  if (archiveDays > 0) {
    const cutoff = new Date(Date.now() - archiveDays * 86400000).toISOString()
    const result = db.prepare(`
      UPDATE signatures SET status = 'archived', archived_at = ?
      WHERE status = 'active' AND created_at < ?
    `).run(nowIso(), cutoff)
    if (Number(result.changes) > 0) {
      audit({ username: 'system', action: 'signature.auto_archive', entityType: 'signature', detail: { count: Number(result.changes), autoArchiveDays: archiveDays } })
    }
  }
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso())
}

runMaintenance()
