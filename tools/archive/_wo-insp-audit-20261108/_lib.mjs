/**
 * _lib.mjs —— 2026-11-08 任务「5 张检验单据审核/反审核全流程验证」公共库
 *
 * 职责(只做验证工具事):
 *   · 测试账套(YJ_TEST → HSDZ_MES_TEST)登录 / API(callButton 带重试)
 *   · SQL Server 直连(默认 HSDZ_MES_TEST;写操作只允许测试账套)
 *   · 断言收集 Results + 证据 JSON 落盘
 *
 * ⚠ 两账套陷阱(2026-11-06 实测):/api/auth/login 的 factory 只认**代码**
 *   'YJ'(正式 HSDZ_MES)/'YJ_TEST'(测试 HSDZ_MES_TEST);显示名 'YINJIA-MES·测试库'
 *   传进去会被 AuthController 兜底成正式库(写操作就落到 HSDZ_MES 了!)。
 * ⚠ 本任务所有写库操作**钉死 HSDZ_MES_TEST**,清理/还原 SQL 带 DB_NAME() 硬闸门。
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

export const ROOT = 'D:/workspace/yinjia'
export const HARNESS = 'tools/archive/_wo-insp-audit-20261108'
export const ABS_HARNESS = ROOT + '/' + HARNESS
export const EVIDENCE = ABS_HARNESS + '/evidence'

export const requireE2E = createRequire(ROOT + '/tests/e2e/')

/* ───────────────────────── 账套 ───────────────────────── */
/** 显示名/代码 → 后端代码;含「测试」或 YJ_TEST ⇒ YJ_TEST,其余 ⇒ YJ */
export function normalizeFactory(factory) {
  const s = String(factory == null ? 'YJ' : factory).trim()
  if (s === 'YJ_TEST' || /测试/.test(s)) return 'YJ_TEST'
  return 'YJ'
}

/* ───────────────────────── 断言收集 ───────────────────────── */
export class Results {
  constructor(title) {
    this.title = title
    this.items = []
    this.startedAt = new Date().toISOString()
  }
  check(name, ok, detail = '') {
    const item = { name, ok: !!ok, detail: String(detail ?? '') }
    this.items.push(item)
    console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${name}${item.detail ? '  -- ' + item.detail : ''}`)
    return item.ok
  }
  /** 记录「事实/基线」,不计入 PASS/FAIL */
  fact(name, value) {
    this.items.push({ name, ok: null, detail: JSON.stringify(value) })
    console.log(`FACT  ${name}  = ${JSON.stringify(value).slice(0, 500)}`)
  }
  get failed() { return this.items.filter((i) => i.ok === false) }
  get passed() { return this.items.filter((i) => i.ok === true) }
  summary() {
    const s = {
      title: this.title, startedAt: this.startedAt, endedAt: new Date().toISOString(),
      pass: this.passed.length, fail: this.failed.length, items: this.items,
    }
    s.result = s.fail === 0 ? 'PASS' : 'FAIL'
    console.log(`\nRESULT: ${s.result}  (PASS ${s.pass} / FAIL ${s.fail})`)
    return s
  }
}

/* ───────────────────────── HTTP ───────────────────────── */
/** 登录。factory 必须传代码(YJ/YJ_TEST);返回 token 与 user(含 approvePanels 等权限清单) */
export async function login(base, { factory = 'YJ_TEST', userName = 'admin', password = '123456' } = {}) {
  const res = await fetch(base.replace(/\/$/, '') + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Connection: 'close' },
    body: JSON.stringify({ userName, password, factory: normalizeFactory(factory) }),
  })
  const raw = await res.text()
  let json
  try { json = JSON.parse(raw) } catch { throw new Error(`登录响应非 JSON: HTTP ${res.status} ${raw.slice(0, 200)}`) }
  const token = json?.data?.token
  if (!token) throw new Error(`登录失败(${userName}): ${JSON.stringify(json).slice(0, 300)}`)
  return { token, user: json.data.user || {}, raw: json }
}

export function api(base, token) {
  const B = base.replace(/\/$/, '')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, Connection: 'close' }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  async function postJsonRetry(p, body, { attempts = 3 } = {}) {
    let lastErr
    for (let i = 1; i <= attempts; i++) {
      try {
        const r = await fetch(B + p, { method: 'POST', headers: H, body: JSON.stringify(body ?? {}) })
        const t = await r.text()
        let json
        try { json = JSON.parse(t) } catch { json = { code: r.status, message: t.slice(0, 300) } }
        return { httpStatus: r.status, json }
      } catch (e) {
        lastErr = e
        if (i < attempts) await sleep(1500)
      }
    }
    throw lastErr
  }
  const getJson = async (p) => {
    const r = await fetch(B + p, { headers: H })
    const t = await r.text()
    if (!r.ok) throw new Error(`GET ${p} HTTP ${r.status}: ${t.slice(0, 300)}`)
    return JSON.parse(t)
  }
  /** callButton → { httpStatus, code, message, data } */
  const callButton = async (panelCode, buttonName, formData = {}, buttonParam = {}) => {
    const body = { panelCode, buttonName, formData: formData || {}, buttonParam: buttonParam || {} }
    const { httpStatus, json } = await postJsonRetry('/api/px/callButton', body)
    return { httpStatus, code: json.code, message: json.message || '', data: json.data }
  }
  return { getJson, postJsonRetry, callButton, B, H }
}

/** 后端动作成功码:200 / 0 */
export const okCall = (r) => !!r && (r.code === 200 || r.code === 0)

/* ───────────────────────── SQL Server ───────────────────────── */
export const DB_CONF = {
  server: '127.0.0.1', port: 1433,
  user: process.env.YJ_DB_USER || 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}
/** 只允许的写库账套(测试账套) */
export const WRITE_DB = 'HSDZ_MES_TEST'

export async function dbConnect(database = WRITE_DB) {
  const mssql = requireE2E('mssql')
  const pool = await new mssql.ConnectionPool({ ...DB_CONF, database }).connect()
  const q = async (sql) => (await pool.request().query(sql)).recordset
  const one = async (sql) => (await q(sql))[0] || null
  return { mssql, pool, q, one, database, close: () => pool.close() }
}

/** 连测试库并断言库名(写操作硬前提) */
export async function openTestDb() {
  const db = await dbConnect(WRITE_DB)
  const name = (await db.one('SELECT DB_NAME() AS db')).db
  if (name !== WRITE_DB) {
    await db.close()
    throw new Error(`拒绝: 当前库 ${name} != ${WRITE_DB}(写操作只允许测试账套)`)
  }
  return db
}

/** SQL 字符串字面量转义 */
export const qs = (s) => String(s == null ? '' : s).replace(/'/g, "''")
/** 值归一为字符串(去首尾空白) */
export const S = (v) => (v === null || v === undefined ? '' : String(v).trim())

/** 执行带 DB_NAME() 硬闸门的 SQL 脚本(仅 HSDZ_MES_TEST) */
export async function execGuarded(db, sql) {
  const tx = new db.mssql.Transaction(db.pool)
  await tx.begin()
  try {
    await new db.mssql.Request(tx).query(sql)
    await tx.commit()
  } catch (e) { try { await tx.rollback() } catch { /* ignore */ } throw e }
}

/* ───────────────────────── 证据落盘 ───────────────────────── */
export async function saveJson(file, obj) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, JSON.stringify(obj, null, 1) + '\n', 'utf8')
  console.log('[evidence]', file)
}
export async function saveText(file, text) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, text, 'utf8')
  console.log('[evidence]', file)
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export function nowStamp() {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`
}
export function evidenceDir(sub) {
  const d = path.join(EVIDENCE, sub)
  fs.mkdirSync(d, { recursive: true })
  return d
}
