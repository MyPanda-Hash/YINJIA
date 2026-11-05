/**
 * _lib.mjs —— 出厂检验报告(OQC)端到端验证公共库(2026-11-04,task-4)
 *
 * 只做验证工具事:HTTP 登录/取数/导出落盘、PDF 文本抽取(复用 tools/_PdfText.java)、
 * XLSX 文本抽取(无依赖 ZIP 解析)、断言收集与 JSON 证据落盘。
 * 不写业务库、不改 backend/frontend 源码。
 *
 * 依赖:
 *   - Node 22+
 *   - JDK 25:C:/Users/vigna/.jdks/ms-25.0.4(PATH 上的 java 是 1.8,必须显式路径)
 *   - openpdf:C:\...\yinjia\.m2-repo/.../openpdf-1.3.32.jar(与后端同一 PDF 文本抽取器)
 *   - mssql / playwright:tests/e2e/node_modules(通过 createRequire 从该目录解析)
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

export const ROOT = 'D:/workspace/yinjia'
export const TOOLS = ROOT + '/tools'
export const VERIFY_DIR = '.tmp/oqc-verify'
export const ABS_VERIFY = ROOT + '/' + VERIFY_DIR
export const JAVA = 'C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe'
export const JAVAC = 'C:/Users/vigna/.jdks/ms-25.0.4/bin/javac.exe'
export const OPENPDF = ROOT + '/.m2-repo/com/github/librepdf/openpdf/1.3.32/openpdf-1.3.32.jar'

/** tests/e2e/node_modules 里的依赖(mssql / playwright) */
export const requireE2E = createRequire(ROOT + '/tests/e2e/')

// ─────────────────────────── 断言收集 ───────────────────────────
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
  /** 记录「基线事实」,不计入 PASS/FAIL(旧环境预期值) */
  fact(name, value) {
    this.items.push({ name, ok: null, detail: JSON.stringify(value) })
    console.log(`FACT  ${name}  = ${JSON.stringify(value)}`)
  }
  get failed() { return this.items.filter((i) => i.ok === false) }
  get passed() { return this.items.filter((i) => i.ok === true) }
  summary() {
    const s = { title: this.title, startedAt: this.startedAt, endedAt: new Date().toISOString(), pass: this.passed.length, fail: this.failed.length, items: this.items }
    s.result = s.fail === 0 ? 'PASS' : 'FAIL'
    console.log(`\nRESULT: ${s.result}  (PASS ${s.pass} / FAIL ${s.fail})`)
    return s
  }
}

// ─────────────────────────── HTTP ───────────────────────────
export async function login(base, { factory = 'YINJIA-MES', userName = 'admin', password = '123456' } = {}) {
  const res = await fetch(base.replace(/\/$/, '') + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' },
    body: JSON.stringify({ userName, password, factory }),
  })
  const raw = await res.text()
  let json
  try { json = JSON.parse(raw) } catch { throw new Error(`登录响应非 JSON: HTTP ${res.status} ${raw.slice(0, 200)}`) }
  const token = json?.data?.token
  if (!token) throw new Error(`登录失败: ${JSON.stringify(json).slice(0, 300)}`)
  return { token, user: json.data.user || {}, raw: json }
}

export function api(base, token) {
  const B = base.replace(/\/$/, '')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, Connection: 'close' }
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
    return { status: r.status, contentType: r.headers.get('content-type') || '', disposition: r.headers.get('content-disposition') || '', buf }
  }
  return { getJson, postJson, getBinary, B, H }
}

/** 出厂检验报告列表查询(与前端左栏同端点) */
export async function listOqcDocs(cli, { condition = {}, pageSize = 100 } = {}) {
  const j = await cli.postJson('/api/px/queryFormDataList', { panelCode: 'QC_OQC_REPORT', condition, pageNo: 1, pageSize })
  return j?.data || { totalSize: 0, list: [] }
}

// ─────────────────────────── PDF 文本 ───────────────────────────
/**
 * 用与后端同一 openpdf 抽取 PDF 文本层。
 * @returns {{pages:number, chars:number, text:string, txtPath:string}}
 */
export function pdfText(pdfPath, outTxtPath) {
  const classes = path.join(ABS_VERIFY, 'classes')
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

// ─────────────────────────── XLSX 文本(无依赖 ZIP 解析) ───────────────────────────
/** 读 ZIP 中央目录,按文件名取解压内容(Buffer);不依赖第三方库 */
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

/** 解码 XML 文本节点里的常见实体 */
function xmlDecode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
}

/**
 * 抽取 xlsx 全部可见文本(sharedStrings + 各 worksheet 的 inlineStr),用于断言页脚/签署文字。
 * @returns {string} 以 \n 连接的去标签文本
 */
export function xlsxText(file) {
  const parts = []
  const shared = unzipEntry(file, 'xl/sharedStrings.xml')
  if (shared) {
    const xml = shared.toString('utf8')
    for (const m of xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) parts.push(xmlDecode(m[1]))
  }
  // worksheet 里的 inlineStr / 数字字符串(不依赖 workbook 关系表,直接遍历 xl/worksheets/*.xml)
  const buf = fs.readFileSync(file)
  const names = zipEntryNames(buf)
  for (const n of names.filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x))) {
    const xml = (unzipEntry(file, n) || Buffer.alloc(0)).toString('utf8')
    for (const m of xml.matchAll(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/g)) parts.push(xmlDecode(m[1]))
  }
  return parts.join('\n')
}

/** 列出 ZIP 内文件名(中央目录) */
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

// ─────────────────────────── 证据落盘 ───────────────────────────
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
export function norm(s) {
  return String(s ?? '').replace(/[\s\u00a0]+/g, '')
}

export function nowStamp() {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`
}
