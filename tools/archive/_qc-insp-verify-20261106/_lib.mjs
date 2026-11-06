/**
 * _lib.mjs —— 制程/首件/出厂检验报告 2026-11-06 三项需求 独立验证公共库
 *
 * 职责(只做验证工具事):
 *   · 8091 并行实例的登录 / API 调用(callButton 带重试)/ 二进制导出落盘
 *   · 自签 JWT(默认密钥,jwt secret 见 backend/src/main/resources/application.yml)
 *   · SQL Server 直连(默认 HSDZ_MES_TEST;写操作只允许测试账套)
 *   · PDF 文本层抽取(与后端同一 openpdf + tools/_PdfText.java)
 *   · XLSX 文本抽取(无第三方依赖 ZIP 解析)
 *   · 断言收集 Results + 证据 JSON/TXT 落盘
 *
 * ⚠ 两账套陷阱(2026-11-06 实测):/api/auth/login 的 factory 只认**代码**
 *   'YJ'(正式 HSDZ_MES)/'YJ_TEST'(测试 HSDZ_MES_TEST);显示名 'YINJIA-MES·测试库'
 *   传进去会被 AuthController 兜底成正式库(写操作就落到 HSDZ_MES 了!)。本库统一
 *   normalizeFactory():含「测试」⇒ 'YJ_TEST',否则非 'YJ_TEST' 一律 'YJ'。
 * ★ 本目录所有会写库的脚本,DB 连接**钉死 HSDZ_MES_TEST**,且清理/删除带 DB_NAME() 硬闸门。
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

export const ROOT = 'D:/workspace/yinjia'
export const TOOLS = ROOT + '/tools'
export const HARNESS = 'tools/archive/_qc-insp-verify-20261106'
export const WORK_REL = '.tmp/qc-insp-verify'
export const ABS_WORK = ROOT + '/' + WORK_REL
export const ABS_HARNESS = ROOT + '/' + HARNESS
export const EVIDENCE = ABS_HARNESS + '/evidence'
export const JAVA = 'C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe'
export const JAVAC = 'C:/Users/vigna/.jdks/ms-25.0.4/bin/javac.exe'
export const OPENPDF = ROOT + '/.m2-repo/com/github/librepdf/openpdf/1.3.32/openpdf-1.3.32.jar'
export const JWT_SECRET = process.env.YINJIA_JWT_SECRET
  || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'

export const requireE2E = createRequire(ROOT + '/tests/e2e/')

/* ───────────────────────── 工厂/账套 ───────────────────────── */
/** 显示名/代码 → 后端代码;含「测试」或 YJ_TEST ⇒ YJ_TEST,其余 ⇒ YJ */
export function normalizeFactory(factory) {
  const s = String(factory == null ? 'YJ' : factory).trim()
  if (s === 'YJ_TEST' || /测试/.test(s)) return 'YJ_TEST'
  return 'YJ'
}

/* ─────────────────────────── 断言收集 ─────────────────────────── */
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
    console.log(`FACT  ${name}  = ${JSON.stringify(value)}`)
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

/* ─────────────────────────── JWT 自签 ─────────────────────────── */
/** 后端缺省密钥自签令牌(claims 与 JwtUtil.generate 一致:sub/factory/iat/exp) */
export function signToken(username, factory = 'YJ_TEST') {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'HS256' })
  const b = b64({ sub: username, factory: normalizeFactory(factory), iat: now, exp: now + 6 * 3600 })
  return `${h}.${b}.${crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url')}`
}

/* ─────────────────────────── HTTP ─────────────────────────── */
/**
 * 登录。/api/auth/login 的 factory **必须传代码**(YJ/YJ_TEST);本函数会把显示名归一。
 * 返回真实姓名等信息(approvePanels 等权限清单在 user 里)。
 */
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

/** 非 admin 账号:先试登录密码,失败退回自签 token(claims 同登录签发) */
export async function loginOrSign(base, { userName, password = '123456', factory = 'YJ_TEST' }) {
  try {
    const r = await login(base, { userName, password, factory })
    return { ...r, tokenSource: 'login' }
  } catch (e) {
    return { token: signToken(userName, factory), user: { userName }, raw: null, tokenSource: 'self-signed' }
  }
}

export function api(base, token) {
  const B = base.replace(/\/$/, '')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, Connection: 'close' }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  /** 带 3 次重试的 POST(Playwright 子进程长跑后父进程 keep-alive 连接会被服务端回收 → fetch failed) */
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
  const postJson = async (p, body) => {
    const r = await fetch(B + p, { method: 'POST', headers: H, body: JSON.stringify(body ?? {}) })
    const t = await r.text()
    if (!r.ok) throw new Error(`POST ${p} HTTP ${r.status}: ${t.slice(0, 300)}`)
    return JSON.parse(t)
  }
  const getBinary = async (p) => {
    const r = await fetch(B + p, { headers: { Authorization: 'Bearer ' + token, Connection: 'close' } })
    const buf = Buffer.from(await r.arrayBuffer())
    return {
      status: r.status, contentType: r.headers.get('content-type') || '',
      disposition: r.headers.get('content-disposition') || '', buf,
    }
  }
  /**
   * callButton → { httpStatus, code, message, data }
   * 后端成功码实测 200(_oqc-next)与 0(_probe-qcdocs-twolevel)都可能出现 ⇒ okCall 统一判。
   */
  const callButton = async (panelCode, buttonName, formData, buttonParam = {}) => {
    const body = { panelCode, buttonName, formData: formData || {}, buttonParam: buttonParam || {} }
    const { httpStatus, json } = await postJsonRetry('/api/px/callButton', body)
    return { httpStatus, code: json.code, message: json.message || '', data: json.data }
  }
  return { getJson, postJson, postJsonRetry, getBinary, callButton, B, H }
}

/** 后端动作成功码:200 / 0 */
export const okCall = (r) => !!r && (r.code === 200 || r.code === 0)

/* ─────────────────────────── SQL Server ─────────────────────────── */
export const DB_CONF = {
  server: '127.0.0.1', port: 1433,
  user: process.env.YJ_DB_USER || 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}
/** 只允许的写库账套(测试账套) */
export const WRITE_DB = 'HSDZ_MES_TEST'
export const READONLY_DB_ALLOW = ['HSDZ_MES', 'HSDZ_MES_TEST']

export async function dbConnect(database = WRITE_DB) {
  const mssql = requireE2E('mssql')
  const pool = await new mssql.ConnectionPool({ ...DB_CONF, database }).connect()
  const q = async (sql) => (await pool.request().query(sql)).recordset
  const one = async (sql) => (await q(sql))[0] || null
  return { mssql, pool, q, one, database, close: () => pool.close() }
}

/** SQL 字符串字面量转义 */
export const qs = (s) => String(s == null ? '' : s).replace(/'/g, "''")

/* ─────────────────────────── PDF 文本 ─────────────────────────── */
/** 用与后端同一 openpdf 抽取 PDF 文本层(首次调用时编译 tools/_PdfText.java 到 .tmp 类目录) */
export function pdfText(pdfPath, outTxtPath) {
  const classes = path.join(ABS_WORK, 'classes')
  const cls = path.join(classes, '_PdfText.class')
  const src = path.join(TOOLS, '_PdfText.java')
  fs.mkdirSync(classes, { recursive: true })
  if (!fs.existsSync(cls) || fs.statSync(cls).mtimeMs < fs.statSync(src).mtimeMs) {
    execFileSync(JAVAC, ['-encoding', 'UTF-8', '-cp', OPENPDF, '-d', classes, src], { stdio: ['ignore', 'pipe', 'pipe'] })
  }
  const out = execFileSync(JAVA, [
    '-Dstdout.encoding=UTF-8',
    '-cp', `${OPENPDF};${classes}`,
    '_PdfText', pdfPath, outTxtPath,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const text = fs.readFileSync(outTxtPath, 'utf8')
  const m = /pages=(\d+)\s+chars=(\d+)/.exec(out || '')
  return { pages: m ? Number(m[1]) : -1, chars: m ? Number(m[2]) : text.length, text, txtPath: outTxtPath }
}

/* ─────────────────────────── XLSX 文本 ─────────────────────────── */
export function unzipEntry(file, entryName) {
  const buf = fs.readFileSync(file)
  const sig = 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === sig) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('不是合法 ZIP(未找到 EOCD): ' + file)
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('ZIP 中央目录损坏 @' + off)
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    if (name === entryName) {
      if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error('ZIP 本地头损坏: ' + entryName)
      const lNameLen = buf.readUInt16LE(localOff + 26)
      const lExtraLen = buf.readUInt16LE(localOff + 28)
      const dataOff = localOff + 30 + lNameLen + lExtraLen
      const data = buf.subarray(dataOff, dataOff + compSize)
      return method === 8 ? zlib.inflateRawSync(data) : data
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return null
}

function xmlDecode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
}

export function zipEntryNames(bufOrFile) {
  const buf = Buffer.isBuffer(bufOrFile) ? bufOrFile : fs.readFileSync(bufOrFile)
  const sig = 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === sig) { eocd = i; break }
  }
  if (eocd < 0) return []
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const names = []
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    names.push(buf.toString('utf8', off + 46, off + 46 + nameLen))
    off += 46 + nameLen + extraLen + commentLen
  }
  return names
}

export function xlsxText(file) {
  const parts = []
  const shared = unzipEntry(file, 'xl/sharedStrings.xml')
  if (shared) {
    const xml = shared.toString('utf8')
    for (const m of xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) parts.push(xmlDecode(m[1]))
  }
  const names = zipEntryNames(file)
  for (const n of names.filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x))) {
    const xml = (unzipEntry(file, n) || Buffer.alloc(0)).toString('utf8')
    // ① 内联字符串 <is><t>..</t></is>(部分库/手工生成)
    for (const m of xml.matchAll(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/g)) parts.push(xmlDecode(m[1]))
    // ② 前端 xlsx 库写出的 t="str" 内联值:<c r="A1" t="str"><v>文本</v></c>
    for (const m of xml.matchAll(/<c\b[^>]*\bt="str"[^>]*>\s*<v[^>]*>([\s\S]*?)<\/v>/g)) parts.push(xmlDecode(m[1]))
    // ③ 直接的 <c ...><v>文本</v></c> 但无 t 属性(数字/公式结果) 忽略,不算文本
  }
  return parts.join('\n')
}

/* ─────────────────────────── 证据落盘 ─────────────────────────── */
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
/** 标准化空白后做文本包含判断(中文 PDF 抽取常夹空格) */
export const norm = (s) => String(s ?? '').replace(/[\s\u00a0]+/g, '')
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function nowStamp() {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`
}

/** 证据目录(按任务分):evidence/{stage1,t1,t2,t3,cleanup} */
export function evidenceDir(sub) {
  const d = path.join(EVIDENCE, sub)
  fs.mkdirSync(d, { recursive: true })
  return d
}
