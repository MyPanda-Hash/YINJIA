/**
 * _safe-reimport-details.mjs — 「重灌单据明细」安全脚本(V1, 2026-10-16)
 *
 * 【为什么需要它】2026-10-16 的事故:有人用 `asp_cancel='Y'` 去"清空"明细再打算重灌,
 *   结果只做了一半 —— 单头没作废、明细全废 ⇒ 面板/报表/台账全按 asp_cancel 过滤 ⇒
 *   界面表现为「明细是空的 / 数据没流转过来」(来料检验单 IJ-2026-10-0011 起、送料暂收单 SL-2026-10-0111~0119)。
 *   正确姿势是**真删旧行、插新行**,而不是置作废位。
 *
 * 【它做什么】对指定 (明细表, 单号):
 *   ① 读出当前明细行 → 存成 JSON 备份(默认 tools/archive/_reimport-backup/)——**可完整回退**;
 *   ② 解析你给的新 CSV(表头 = 列名,UTF-8 带不带 BOM 都行);
 *   ③ 生成 SQL:`BEGIN TRAN` → 行数守卫 → `DELETE FROM <表> WHERE 单据编号=@单号` → 批量 `INSERT` → `COMMIT`;
 *   ④ `--run` 才真正执行(默认 **dry-run**:只出备份 + SQL 文件 + 打印将要执行的语句行数)。
 *
 * 【安全护栏】
 *   · 表名/列名白名单校验(只允许 [A-Za-z0-9_\u4e00-\u9fa5],防注入);
 *   · CSV 必须含「单据编号」列,且**值必须等于 --no**(防灌错单);
 *   · 单头状态守卫:已审核/已完成 的单**默认拒绝**(`--force` 才放行,并提示先弃审);
 *   · 只在**单号范围**内删改,不含单号的整表操作一律不做;
 *   · 全程一个事务:任一步失败即整笔回滚;
 *   · 备份文件名带时间戳,回退用 `_restore-from-backup.mjs`(同目录,可后补)。
 *
 * 【用法】
 *   node tools/archive/_reimport/_safe-reimport-details.mjs \
 *        --table sl_recv_detail --no SL-2026-10-0111 --csv D:\new\SL-2026-10-0111.csv
 *   ... 确认打印内容无误后,加 --run 真正执行(需 YINJIA_SQL_PASS,库名取 YINJIA_SQL_DB,默认 HSDZ_MES)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')          // D:\YINJIA-main
const TOOLS = join(ROOT, 'tools')
const BACKUP_DIR = join(TOOLS, 'archive', '_reimport-backup')

/* ── 参数 ── */
const argv = process.argv.slice(2)
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const has = (k) => argv.includes(k)
const table = arg('--table')
const no = arg('--no')
const csvPath = arg('--csv')
const key = arg('--key', '单据编号')
const run = has('--run')
const force = has('--force')

if (!table || !no || !csvPath) {
  console.error('用法: node tools/archive/_reimport/_safe-reimport-details.mjs --table <明细表> --no <单号> --csv <新明细.csv> [--key 单据编号] [--run] [--force]')
  process.exit(2)
}
const IDENT = /^[A-Za-z0-9_\u4e00-\u9fa5]+$/
if (!IDENT.test(table) || !IDENT.test(key)) { console.error('[拒绝] 表名/键名含非法字符'); process.exit(2) }

/* ── CSV 解析(支持引号包裹与逗号内嵌;UTF-8 BOM 容错)── */
function parseCsv(text) {
  const s = text.replace(/^\uFEFF/, '')
  const rows = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''))
}
const csv = parseCsv(readFileSync(csvPath, 'utf8'))
if (csv.length < 2) { console.error('[拒绝] CSV 没有数据行'); process.exit(2) }
const cols = csv[0].map((c) => c.trim())
for (const c of cols) if (!IDENT.test(c)) { console.error(`[拒绝] CSV 列名非法: ${c}`); process.exit(2) }
if (!cols.includes(key)) { console.error(`[拒绝] CSV 缺少「${key}」列`); process.exit(2) }
const body = csv.slice(1)
const keyIdx = cols.indexOf(key)
const bad = body.filter((r) => String(r[keyIdx]).trim() !== no)
if (bad.length) { console.error(`[拒绝] CSV 里有 ${bad.length} 行的「${key}」不是 ${no}(防灌错单)`); process.exit(2) }
console.log(`[1] CSV 校验通过:表 ${table} / 单号 ${no} / 列 ${cols.length} 个 / 数据 ${body.length} 行`)

/* ── 备份现有明细(dry-run 也备份,保证有回退点)── */
const sqlFile = join(BACKUP_DIR, `${table}-${no}.sql`)
const backupFile = join(BACKUP_DIR, `${table}-${no}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })

const dbName = process.env.YINJIA_SQL_DB || 'HSDZ_MES'
const dbUrl = `jdbc:sqlserver://127.0.0.1:1433;databaseName=${dbName};encrypt=false;trustServerCertificate=true`
const runSql = (sql) => execFileSync(process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java.exe') : 'java',
  ['-Dstdout.encoding=UTF-8', '-Dstderr.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java', dbUrl, 'yinjia', process.env.YINJIA_SQL_PASS || '', sql],
  { cwd: TOOLS, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

// 读出旧行(用 t.* 展开成每列的 SELECT,便于 JSON 备份)
const probe = join(BACKUP_DIR, '_probe.sql')
writeFileSync(probe, `SET NOCOUNT ON;\nSELECT * FROM [${table}] WHERE [${key}] = N'${no}';\n`, 'utf8')
let oldRows = ''
try { oldRows = runSql(probe) } catch (e) { console.error('[警告] 读取旧行失败(继续,但备份不含旧行):', e.message) }
writeFileSync(backupFile, JSON.stringify({ table, key, no, db: dbName, at: new Date().toISOString(), raw: oldRows }, null, 2), 'utf8')
console.log(`[2] 旧明细已备份 → ${backupFile}`)

/* ── 生成 SQL(一个事务:守卫 → 删 → 插)── */
const lit = (v) => (v === undefined || v === null || String(v).trim() === '' ? 'NULL' : `N'${String(v).replace(/'/g, "''")}'`)
const insertRows = body.map((r) => `INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${cols.map((_, i) => lit(r[i])).join(', ')});`).join('\n')
const sql =
  `/* 安全重灌:${table} / ${no} —— 由 _safe-reimport-details.mjs 生成 ${new Date().toISOString()} */\n` +
  `SET NOCOUNT ON;\nSET XACT_ABORT ON;\nGO\n` +
  `BEGIN TRAN;\n` +
  `DELETE FROM [${table}] WHERE [${key}] = N'${no}';\n` +
  `DECLARE @del int = @@ROWCOUNT;\n` +
  `${insertRows}\n` +
  `DECLARE @ins int = @@ROWCOUNT;\n` +
  `IF @ins <> ${body.length} BEGIN ROLLBACK TRAN; RAISERROR(N'[中止] 插入行数与 CSV 不符,已回滚', 16, 1); END\n` +
  `ELSE BEGIN COMMIT TRAN; PRINT N'[OK] 删除 ' + CAST(@del AS nvarchar(10)) + N' 行,插入 ' + CAST(@ins AS nvarchar(10)) + N' 行'; END\nGO\n`
writeFileSync(sqlFile, sql, 'utf8')
console.log(`[3] 重灌 SQL 已生成 → ${sqlFile}(${body.length} 条 INSERT,单事务+行数守卫)`)

/* ── 单头状态守卫 ── */
const headTable = arg('--head', table.replace(/_detail$/, '').replace(/^bl_/, 'bd_'))
if (IDENT.test(headTable)) {
  const g = join(BACKUP_DIR, '_guard.sql')
  writeFileSync(g, `SET NOCOUNT ON;\nSELECT N''状态'' AS t, ISNULL(单据状态, N''(空)'') AS 状态 FROM [${headTable}] WHERE 单据编号 = N'${no}';\n`, 'utf8')
  try {
    const st = runSql(g)
    console.log(`[4] 单头(${headTable})状态: ${st.trim().split('\n').pop().trim()}`)
    if (/已审核|已完成/.test(st) && !force) {
      console.error('[拒绝] 单头已审核/已完成 —— 请先弃审;确要强灌加 --force')
      process.exit(3)
    }
  } catch { console.log(`[4] 单头表 ${headTable} 不存在或读取失败(跳过状态守卫)`) }
}

/* ── 执行 ── */
if (!run) {
  console.log('[5] 当前是 **dry-run**(未改动数据库)。核对备份与 SQL 后,加 --run 执行:')
  console.log(`    $env:YINJIA_SQL_DB="${dbName}"; $env:YINJIA_SQL_PASS="<密码>"; node tools/archive/_reimport/_safe-reimport-details.mjs --table ${table} --no ${no} --csv "${csvPath}" --run`)
  process.exit(0)
}
console.log('[5] 执行重灌(单事务)…')
const out = runSql(sqlFile)
console.log(out)
console.log(`[6] 完成。若需回退:用 ${backupFile} 里的旧行重新生成 INSERT(或 git/库备份恢复)。`)
