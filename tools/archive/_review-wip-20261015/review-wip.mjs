/**
 * review-wip.mjs — 只读审查:未提交的收敛迁移 + 迁移清单完整性
 * 输出:① converge 脚本的结构/幂等守卫/危险语句画像 ② db-migrations.txt 逐行契约校验
 * 只读,不改任何被测文件。
 */
import { readFileSync, existsSync } from 'node:fs'

const root = 'D:/workspace/yinjia'
const SQL = `${root}/tools/migrate-server-converge-20261007.sql`
const LIST = `${root}/tools/db-migrations.txt`

// ---------- ① 收敛迁移画像 ----------
const sql = readFileSync(SQL, 'utf8')
const lines = sql.split(/\r?\n/)
const batches = sql.split(/^\s*GO\s*$/im).filter((b) => b.trim())
const count = (re) => (sql.match(re) || []).length
const stmts = {
  CREATE_TABLE: count(/\bCREATE\s+TABLE\b/gi),
  ALTER_TABLE: count(/\bALTER\s+TABLE\b/gi),
  CREATE_VIEW: count(/\bCREATE\s+VIEW\b/gi),
  CREATE_INDEX: count(/\bCREATE\s+(UNIQUE\s+)?INDEX\b/gi),
  UPDATE: count(/\bUPDATE\s+[\[\w]/gi),
  INSERT: count(/\bINSERT\s+INTO\b/gi),
  DELETE: count(/\bDELETE\s+FROM\b/gi),
  DROP_TABLE: count(/\bDROP\s+TABLE\b/gi),
  TRUNCATE: count(/\bTRUNCATE\s+TABLE\b/gi),
  EXEC: count(/\bEXEC\b/gi),
}
const guards = {
  IF_NOT_EXISTS: count(/IF\s+NOT\s+EXISTS/gi),
  IF_EXISTS: count(/IF\s+EXISTS/gi),
  OBJECT_ID: count(/OBJECT_ID\s*\(/gi),
  COL_LENGTH: count(/COL_LENGTH\s*\(/gi),
  COLUMNPROPERTY: count(/COLUMNPROPERTY\s*\(/gi),
  NOT_EXISTS_WHERE: count(/NOT\s+EXISTS\s*\(/gi),
  ROWCOUNT_GUARD: count(/@@ROWCOUNT/gi),
  THROW_RAISERROR: count(/\b(THROW|RAISERROR)\b/gi),
  PRINT: count(/\bPRINT\b/gi),
}
// 危险语句:UPDATE/DELETE 未带 WHERE 的批次
const bare = []
for (const b of batches) {
  const t = b.replace(/--[^\n]*/g, '')          // 去行注释后再判断
  const up = t.match(/\bUPDATE\s+([\[\]\w.]+)\s+SET\b(?![^;]*\bWHERE\b)/gi)
  const del = t.match(/\bDELETE\s+FROM\s+([\[\]\w.]+)(?![^;]*\bWHERE\b)/gi)
  const drop = t.match(/\bDROP\s+(TABLE|VIEW)\s+([\[\]\w.]+)/gi)
  if (up || del || drop) bare.push({ up: up || [], del: del || [], drop: drop || [], head: t.trim().split(/\r?\n/)[0].slice(0, 90) })
}
// 触碰的业务表(脚本自称"业务数据不碰")
const business = ['yj_doc_status', 'yj_user', 'yj_doc_batch', 'yj_form_approval', 'yj_schema_log']
const touchedBiz = business.map((t) => ({
  table: t,
  update: count(new RegExp(`UPDATE\\s+\\[?${t}\\]?\\b`, 'gi')),
  insert: count(new RegExp(`INSERT\\s+INTO\\s+\\[?${t}\\]?\\b`, 'gi')),
  delete: count(new RegExp(`DELETE\\s+FROM\\s+\\[?${t}\\]?\\b`, 'gi')),
})).filter((x) => x.update + x.insert + x.delete > 0)

console.log('=== ① tools/migrate-server-converge-20261007.sql ===')
console.log(`行数 ${lines.length} / 批次(GO) ${batches.length} / 字节 ${sql.length}`)
console.log('语句画像:', JSON.stringify(stmts))
console.log('幂等守卫:', JSON.stringify(guards))
console.log('业务表触碰(脚本自称不碰):', touchedBiz.length ? JSON.stringify(touchedBiz) : '无 ✅')
console.log(`无 WHERE 的 UPDATE / 无 WHERE 的 DELETE / DROP 批次: ${bare.length}`)
for (const b of bare.slice(0, 8)) console.log('   ⚠', JSON.stringify(b).slice(0, 220))

// ---------- ② 迁移清单契约 ----------
const raw = readFileSync(LIST, 'utf8')
const lst = raw.split('\n').map((s) => s.replace(/\r$/, ''))
const entries = lst.map((s, i) => ({ i: i + 1, s: s.trim() })).filter((x) => x.s && !x.s.startsWith('#'))
const bad = entries.filter((x) => !/^[A-Za-z0-9._-]+\.sql$/.test(x.s))
const seen = new Map()
const dup = []
for (const e of entries) { if (seen.has(e.s)) dup.push(`${e.s} (行 ${seen.get(e.s)} 与 ${e.i})`); else seen.set(e.s, e.i) }
const missing = entries.filter((x) => !existsSync(`${root}/tools/${x.s}`))
console.log('\n=== ② tools/db-migrations.txt ===')
console.log(`总行 ${lst.length} / 有效脚本条目 ${entries.length} / 结尾换行 ${raw.endsWith('\n') ? '有' : '⚠ 无'}`)
console.log(`格式异常条目(非 纯脚本名.sql): ${bad.length}`, bad.slice(0, 5))
console.log(`重复登记: ${dup.length}`, dup.slice(0, 5))
console.log(`清单里有、tools/ 下不存在: ${missing.length}`, missing.slice(0, 8).map((x) => x.s))
console.log(`末尾 3 条:`, entries.slice(-3).map((x) => x.s))
