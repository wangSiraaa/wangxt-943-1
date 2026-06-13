import initSqlJs, { type Database } from 'sql.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_DIR = path.join(__dirname, '..', 'backend', 'data')
const DB_PATH = path.join(DB_DIR, 'fishing_port.db')

let db: Database | null = null

export async function getDb(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs()

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
    try {
      initSchema(db)
      seedData(db)
      persist(db)
      console.log('Database initialized and seeded successfully at', DB_PATH)
    } catch (err) {
      console.error('Database init/seed error:', err)
      throw err
    }
  }

  return db
}

export function all(database: Database, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const results: Record<string, unknown>[] = []
  while (stmt.step()) {
    const row: Record<string, unknown> = {}
    const columns = stmt.getColumnNames()
    const values = stmt.get()
    columns.forEach((col, i) => { row[col] = values[i] })
    results.push(row)
  }
  stmt.free()
  return results
}

export function get(database: Database, sql: string, params: unknown[] = []): Record<string, unknown> | null {
  const rows = all(database, sql, params)
  return rows.length > 0 ? rows[0] : null
}

export function run(database: Database, sql: string, params: unknown[] = []): void {
  database.run(sql, params)
}

export function persist(database: Database) {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }
  const data = database.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

function initSchema(database: Database) {
  database.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('captain','duty_officer','supervisor','admin')),
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE ships (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      tonnage REAL NOT NULL,
      length REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_port' CHECK(status IN ('in_port','at_sea','maintenance')),
      current_voyage_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE certificates (
      id TEXT PRIMARY KEY,
      ship_id TEXT NOT NULL REFERENCES ships(id),
      type TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      expire_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid','expiring_soon','expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE crew (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      qualification_type TEXT NOT NULL,
      qualification_expire_date TEXT NOT NULL,
      is_blacklisted INTEGER NOT NULL DEFAULT 0,
      ship_id TEXT REFERENCES ships(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE berths (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      occupied INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','occupied','reserved','maintenance'))
    );
  `)

  database.run(`
    CREATE TABLE plans (
      id TEXT PRIMARY KEY,
      ship_id TEXT NOT NULL REFERENCES ships(id),
      captain_id TEXT NOT NULL REFERENCES users(id),
      voyage_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','reviewing','inspecting','released','rejected','revoked','withdrawn')),
      departure_time TEXT NOT NULL,
      expected_return_time TEXT NOT NULL,
      route TEXT NOT NULL,
      route_risk_level TEXT NOT NULL DEFAULT 'low' CHECK(route_risk_level IN ('low','medium','high')),
      danger_goods_declared INTEGER NOT NULL DEFAULT 0,
      danger_goods_detail TEXT,
      fuel_remaining REAL NOT NULL DEFAULT 0,
      berth_id TEXT REFERENCES berths(id),
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE plan_crew (
      plan_id TEXT NOT NULL REFERENCES plans(id),
      crew_id TEXT NOT NULL REFERENCES crew(id),
      PRIMARY KEY (plan_id, crew_id)
    );
  `)

  database.run(`
    CREATE TABLE voyages (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      ship_id TEXT NOT NULL REFERENCES ships(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','returning','abnormal_return','closed')),
      departure_time TEXT NOT NULL,
      expected_return_time TEXT NOT NULL,
      actual_return_time TEXT,
      return_deviation TEXT,
      close_reason TEXT,
      closed_by TEXT REFERENCES users(id),
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE approval_records (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      node TEXT NOT NULL CHECK(node IN ('auto_check','duty_review','supervisor_inspect','dock_release')),
      action TEXT NOT NULL CHECK(action IN ('approved','rejected','revoked')),
      operator_id TEXT NOT NULL REFERENCES users(id),
      operator_role TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('weather','return_timeout','cert_expire','route_risk','abnormal_release')),
      level TEXT NOT NULL CHECK(level IN ('critical','warning','info')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_voyage_id TEXT REFERENCES voyages(id),
      related_ship_id TEXT REFERENCES ships(id),
      is_resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE release_logs (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      ship_id TEXT NOT NULL REFERENCES ships(id),
      operator_id TEXT NOT NULL REFERENCES users(id),
      released_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE revoke_logs (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      release_log_id TEXT NOT NULL REFERENCES release_logs(id),
      operator_id TEXT NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`CREATE INDEX idx_plans_status ON plans(status);`)
  database.run(`CREATE INDEX idx_plans_ship ON plans(ship_id);`)
  database.run(`CREATE INDEX idx_voyages_status ON voyages(status);`)
  database.run(`CREATE INDEX idx_voyages_ship ON voyages(ship_id);`)
  database.run(`CREATE INDEX idx_approval_plan ON approval_records(plan_id);`)
  database.run(`CREATE INDEX idx_alerts_type ON alerts(type);`)
  database.run(`CREATE INDEX idx_alerts_resolved ON alerts(is_resolved);`)
  database.run(`CREATE INDEX idx_certs_ship ON certificates(ship_id);`)
  database.run(`CREATE INDEX idx_certs_status ON certificates(status);`)
  database.run(`CREATE INDEX idx_crew_ship ON crew(ship_id);`)

  database.run(`
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      voyage_id TEXT NOT NULL REFERENCES voyages(id),
      ship_id TEXT NOT NULL REFERENCES ships(id),
      inspector_id TEXT NOT NULL REFERENCES users(id),
      inspection_type TEXT NOT NULL DEFAULT 'routine',
      inspection_result TEXT NOT NULL DEFAULT 'pending',
      certificate_check INTEGER NOT NULL DEFAULT 0,
      crew_check INTEGER NOT NULL DEFAULT 0,
      cargo_check INTEGER NOT NULL DEFAULT 0,
      findings TEXT,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS risk_change_logs (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      old_risk_level TEXT,
      new_risk_level TEXT,
      change_reason TEXT,
      changed_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.run(`CREATE INDEX IF NOT EXISTS idx_inspections_voyage ON inspections(voyage_id);`)
  database.run(`CREATE INDEX IF NOT EXISTS idx_inspections_ship ON inspections(ship_id);`)
  database.run(`CREATE INDEX IF NOT EXISTS idx_risk_logs_plan ON risk_change_logs(plan_id);`)
}

function seedData(database: Database) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const users = [
    ['u1', 'captain1', '123456', 'captain', '张船长'],
    ['u2', 'duty1', '123456', 'duty_officer', '李值班员'],
    ['u3', 'supervisor1', '123456', 'supervisor', '王监管员'],
    ['u4', 'admin', '123456', 'admin', '赵管理员'],
  ]
  const userStmt = database.prepare('INSERT INTO users (id, username, password, role, name, created_at) VALUES (?,?,?,?,?,?)')
  for (const u of users) {
    userStmt.bind([...u, now] as string[])
    userStmt.step()
    userStmt.reset()
  }
  userStmt.free()

  const ships = [
    ['s1', '闽连渔05001', '拖网渔船', 120, 28, 'in_port', null],
    ['s2', '闽连渔05002', '围网渔船', 95, 24, 'at_sea', 'v1'],
    ['s3', '闽连渔05003', '钓具渔船', 68, 18, 'in_port', null],
    ['s4', '闽连渔05004', '拖网渔船', 150, 32, 'in_port', null],
    ['s5', '闽连渔05005', '运输船', 200, 40, 'maintenance', null],
    ['s6', '闽连渔05006', '围网渔船', 85, 22, 'in_port', null],
  ]
  const shipStmt = database.prepare('INSERT INTO ships (id, name, type, tonnage, length, status, current_voyage_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
  for (const s of ships) {
    shipStmt.bind([...s, now, now] as string[])
    shipStmt.step()
    shipStmt.reset()
  }
  shipStmt.free()

  const soon = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  const past = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const future = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)

  const certs = [
    ['c1', 's1', '渔业捕捞许可证', '2024-01-01', future, 'valid'],
    ['c2', 's1', '船舶检验证书', '2024-03-15', soon, 'expiring_soon'],
    ['c3', 's2', '渔业捕捞许可证', '2024-02-01', future, 'valid'],
    ['c4', 's2', '船舶检验证书', '2023-06-01', past, 'expired'],
    ['c5', 's3', '渔业捕捞许可证', '2024-04-01', future, 'valid'],
    ['c6', 's3', '船舶检验证书', '2024-05-01', soon, 'expiring_soon'],
    ['c7', 's4', '渔业捕捞许可证', '2024-01-01', future, 'valid'],
    ['c8', 's4', '船舶检验证书', '2024-06-01', future, 'valid'],
    ['c9', 's5', '渔业捕捞许可证', '2023-01-01', past, 'expired'],
    ['c10', 's5', '船舶检验证书', '2024-07-01', future, 'valid'],
    ['c11', 's6', '渔业捕捞许可证', '2024-08-01', future, 'valid'],
    ['c12', 's6', '船舶检验证书', '2024-09-01', soon, 'expiring_soon'],
  ]
  const certStmt = database.prepare('INSERT INTO certificates (id, ship_id, type, issue_date, expire_date, status, created_at) VALUES (?,?,?,?,?,?,?)')
  for (const c of certs) {
    certStmt.bind([...c, now] as string[])
    certStmt.step()
    certStmt.reset()
  }
  certStmt.free()

  const crewData = [
    ['cr1', '张大海', '船长', '船长适任证书', future, 0, 's1'],
    ['cr2', '李二明', '大副', '大副适任证书', future, 0, 's1'],
    ['cr3', '王三强', '轮机长', '轮机长适任证书', soon, 0, 's1'],
    ['cr4', '赵四海', '水手', '基本安全培训', future, 0, 's2'],
    ['cr5', '钱五福', '船长', '船长适任证书', future, 1, 's2'],
    ['cr6', '孙六顺', '大副', '大副适任证书', future, 0, 's2'],
    ['cr7', '周七发', '水手', '基本安全培训', future, 0, 's3'],
    ['cr8', '吴八达', '船长', '船长适任证书', future, 0, 's3'],
    ['cr9', '郑九通', '轮机长', '轮机长适任证书', future, 0, 's4'],
    ['cr10', '冯十全', '船长', '船长适任证书', future, 0, 's4'],
    ['cr11', '陈十一', '水手', '基本安全培训', past, 1, null],
    ['cr12', '林十二', '水手', '基本安全培训', future, 0, 's6'],
    ['cr13', '黄十三', '大副', '大副适任证书', future, 0, 's6'],
    ['cr14', '杨十四', '船长', '船长适任证书', future, 0, 's4'],
    ['cr15', '许十五', '轮机长', '轮机长适任证书', future, 0, 's3'],
  ]
  const crewStmt = database.prepare('INSERT INTO crew (id, name, role, qualification_type, qualification_expire_date, is_blacklisted, ship_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
  for (const cr of crewData) {
    crewStmt.bind([...cr, now, now] as string[])
    crewStmt.step()
    crewStmt.reset()
  }
  crewStmt.free()

  const berths = [
    ['b1', 'A1号泊位', 5, 2, 'occupied'],
    ['b2', 'A2号泊位', 5, 0, 'available'],
    ['b3', 'A3号泊位', 3, 1, 'occupied'],
    ['b4', 'B1号泊位', 8, 3, 'occupied'],
    ['b5', 'B2号泊位', 8, 0, 'available'],
    ['b6', 'C1号泊位', 4, 0, 'reserved'],
    ['b7', 'C2号泊位', 4, 4, 'maintenance'],
    ['b8', 'D1号泊位', 6, 2, 'occupied'],
  ]
  const berthStmt = database.prepare('INSERT INTO berths (id, name, capacity, occupied, status) VALUES (?,?,?,?,?)')
  for (const b of berths) {
    berthStmt.bind(b as string[])
    berthStmt.step()
    berthStmt.reset()
  }
  berthStmt.free()

  const dep = new Date(Date.now() + 2 * 3600000).toISOString().replace('T', ' ').slice(0, 19)
  const ret = new Date(Date.now() + 48 * 3600000).toISOString().replace('T', ' ').slice(0, 19)

  const plansData = [
    ['p1', 's2', 'u1', 'v1', 'released', dep, ret, '东海渔场航线', 'medium', 0, null, '75.5', 'b1', null],
    ['p2', 's1', 'u1', null, 'reviewing', dep, ret, '近海作业区', 'low', 0, null, '90', 'b2', null],
    ['p3', 's4', 'u1', null, 'draft', dep, ret, '深海远洋航线', 'high', 1, '柴油500L', '60', 'b3', null],
  ]
  const planStmt = database.prepare('INSERT INTO plans (id, ship_id, captain_id, voyage_id, status, departure_time, expected_return_time, route, route_risk_level, danger_goods_declared, danger_goods_detail, fuel_remaining, berth_id, rejection_reason, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  for (const p of plansData) {
    planStmt.bind([...p, now, now] as string[])
    planStmt.step()
    planStmt.reset()
  }
  planStmt.free()

  const planCrewData = [
    ['p1', 'cr4'], ['p1', 'cr5'], ['p1', 'cr6'],
    ['p2', 'cr1'], ['p2', 'cr2'], ['p2', 'cr3'],
    ['p3', 'cr9'], ['p3', 'cr10'], ['p3', 'cr14'],
  ]
  const pcStmt = database.prepare('INSERT INTO plan_crew (plan_id, crew_id) VALUES (?,?)')
  for (const pc of planCrewData) {
    pcStmt.bind(pc as string[])
    pcStmt.step()
    pcStmt.reset()
  }
  pcStmt.free()

  const voyageData = [
    ['v1', 'p1', 's2', 'active', dep, ret],
  ]
  const vStmt = database.prepare('INSERT INTO voyages (id, plan_id, ship_id, status, departure_time, expected_return_time, actual_return_time, return_deviation, close_reason, closed_by, closed_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  for (const v of voyageData) {
    vStmt.bind([...v, null, null, null, null, null, now] as string[])
    vStmt.step()
    vStmt.reset()
  }
  vStmt.free()

  const approvalData = [
    ['ar1', 'p1', 'auto_check', 'approved', 'u2', 'duty_officer', '自动校验通过'],
    ['ar2', 'p1', 'duty_review', 'approved', 'u2', 'duty_officer', '船员名单确认无误'],
    ['ar3', 'p1', 'dock_release', 'approved', 'u2', 'duty_officer', '码头放行'],
  ]
  const aStmt = database.prepare('INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)')
  for (const a of approvalData) {
    aStmt.bind([...a, now] as string[])
    aStmt.step()
    aStmt.reset()
  }
  aStmt.free()

  const alertData = [
    ['al1', 'weather', 'warning', '海上大风预警', '预计今晚8级阵风，建议小型船舶避风', null, null, 0],
    ['al2', 'cert_expire', 'critical', '船舶检验证书过期', '闽连渔05002船舶检验证书已过期', null, 's2', 0],
    ['al3', 'return_timeout', 'warning', '返港超时预警', '闽连渔05002预计返港时间已过', 'v1', 's2', 0],
  ]
  const alStmt = database.prepare('INSERT INTO alerts (id, type, level, title, message, related_voyage_id, related_ship_id, is_resolved, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
  for (const al of alertData) {
    alStmt.bind([...al, now] as string[])
    alStmt.step()
    alStmt.reset()
  }
  alStmt.free()

  const releaseLogData = [
    ['rl1', 'p1', 's2', 'u2'],
  ]
  const rlStmt = database.prepare('INSERT INTO release_logs (id, plan_id, ship_id, operator_id, released_at) VALUES (?,?,?,?,?)')
  for (const rl of releaseLogData) {
    rlStmt.bind([...rl, now] as string[])
    rlStmt.step()
    rlStmt.reset()
  }
  rlStmt.free()
}
