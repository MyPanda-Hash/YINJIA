/**
 * d-check-insp-heads.cjs — 补验 D：QcInspAutoService 组装出的「头字段名」必须都是检验单头表的真实列
 *
 * 做法:从 QcInspAutoService.java 抽 firstInspHead/procInspHead/asmInspHead 里 head.put("X", …) 的键,
 *       与 probe_insp_heads_cols.sql 导出的 INFORMATION_SCHEMA 实际列清单逐键对照(只读)。
 * 用法: node tools/archive/_proc-card-verify/d-check-insp-heads.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const HERE = __dirname
const SRC = 'D:/workspace/yinjia/backend/src/main/java/com/yinjia/mes/service/QcInspAutoService.java'
const COLS = path.join(HERE, 'insp_heads_cols.log')

/** 解析日志:table -> Set(列) */
function parseCols() {
  const map = new Map()
  for (const line of fs.readFileSync(COLS, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*\|\s*(qc_[a-z_]+)\s*\|\s*([^|]+?)\s*\|/)
    if (!m) continue
    if (!map.has(m[1])) map.set(m[1], new Set())
    map.get(m[1]).add(m[2].trim())
  }
  return map
}

/** 从 Java 源码抽某方法里的 head.put("键") */
function keysOfMethod(src, name) {
  const start = src.indexOf(`private Map<String, Object> ${name}(`)
  if (start < 0) return null
  // 取到方法结束:下一个 "private " 或文件尾(按缩进 4 空格的 '    }' 结尾判断更稳,用粗略扫描)
  let depth = 0, i = src.indexOf('{', start), end = -1
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  const body = src.slice(start, end)
  const keys = []
  for (const m of body.matchAll(/head\.put\("([^"]+)"/g)) if (!keys.includes(m[1])) keys.push(m[1])
  return keys
}

const TARGETS = [
  { method: 'firstInspHead', table: 'qc_first_insp_head', detail: 'qc_first_insp_detail', ng: '不合格数量' },
  { method: 'procInspHead', table: 'qc_proc_insp_head', detail: 'qc_proc_insp_detail', ng: '不良数量' },
  { method: 'asmInspHead', table: 'qc_asm_insp_head', detail: 'qc_asm_insp_detail', ng: '不合格数量' },
]

const cols = parseCols()
const src = fs.readFileSync(SRC, 'utf8')
const out = { tables: {}, pass: true }
for (const t of TARGETS) {
  const keys = keysOfMethod(src, t.method) || []
  const set = cols.get(t.table) || new Set()
  const missing = keys.filter((k) => !set.has(k) && k !== 'detail')
  const detailCols = cols.get(t.detail) || new Set()
  const ngOk = detailCols.has(t.ng)
  out.tables[t.table] = { method: t.method, keys, missing, headerCols: set.size, detailNg: t.ng, detailNgOk: ngOk }
  console.log(`\n=== ${t.table} (${t.method}) ===`)
  console.log(`  组装键 ${keys.length} 个:${keys.filter((k) => k !== 'detail').join('、')}`)
  console.log(`  实际头列 ${set.size} 个`)
  console.log(`  ${missing.length === 0 ? '[PASS]' : '[FAIL]'} 组装键全部是真实列${missing.length ? ' —— 缺列:' + JSON.stringify(missing) : ''}`)
  console.log(`  ${ngOk ? '[PASS]' : '[FAIL]'} 明细表 ${t.detail} 存在「${t.ng}」列(不合格量口径)`)
  if (missing.length) out.pass = false
  if (!ngOk) out.pass = false
}
// 已下架的表不能又被引用
const dropped = ['qc_mold_insp_head', 'qc_cut_insp_head']
out.droppedReferenced = dropped.filter((t) => src.includes(`"${t}"`))
console.log(`\n${out.droppedReferenced.length === 0 ? '[PASS]' : '[FAIL]'} 源码不再引用已下架表 ${JSON.stringify(dropped)}`)
if (out.droppedReferenced.length) out.pass = false
fs.writeFileSync(path.join(HERE, 'd-check-insp-heads.json'), JSON.stringify(out, null, 2), 'utf8')
console.log(`\n[result] ${out.pass ? 'PASS' : 'FAIL'}`)
if (!out.pass) process.exit(1)
