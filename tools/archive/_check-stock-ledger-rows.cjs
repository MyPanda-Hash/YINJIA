'use strict'
/**
 * _check-stock-ledger-rows.cjs — 库存台账分支 SQL 校验(常驻防线)
 *
 * ── 为什么需要它 ────────────────────────────────────────────────────────────────
 * 2026-09-23「仓库字段正名」(41a683aa)把业务单据明细的 `仓库名称` 列统一改名 `仓库`。
 * 当时采购入库分支同步改了、**销售出库分支漏改** —— StockLedgerService.loadRows 的
 * SALE_OUT 段此后一直引用**不存在的列** `l.[仓库名称]`,使销售出库单的审核/弃审
 * **一律 HTTP 500(error 207 列名无效)**。这个缺陷在库里躺了**一周**才被发现:
 *   · 审核接口报 500 时,前端只显示"服务异常",不会暴露是哪条 SQL 的哪个列名;
 *   · 类型检查/单元测试都不碰真实库,`mvn package` 照样 BUILD SUCCESS;
 *   · 该段 SQL 只在**审核销售出库单**这一条路径上执行,不走这条路就永远看不到;
 *   · 后果是 src=5 的流水永远产生不了 —— 三表结构里销售出库这条链整个是断的。
 *
 * 本脚本把 loadRows 的**全部 8 个分支 SQL 从 Java 源码里抽出来**,逐条打到**真实库**上,
 * 让"改了一个分支的列名、另一个分支还指着旧列"这类缺陷在**几秒钟内**暴露,
 * 而且是在**没有业务数据、不用点界面**的情况下暴露。
 *
 * ── 为什么不手抄 SQL ──────────────────────────────────────────────────────────
 * 手抄 = 第二份真相。源码改了脚本不改,脚本会一直"通过",反而给出虚假安全感。
 * 因此本脚本**只从源码提取**(必要时用 --source 指定别的路径),提取结果同时打印
 * 行号与语句长度:源码结构一变(比如 switch 改了写法)提取数不为 8 会直接判失败。
 *
 * ── 校验口径 ──────────────────────────────────────────────────────────────────
 * 用 `SELECT TOP 1 …… WHERE 单据编号 = <真实存在的单号>` 执行。选真单号而不是假的,
 * 是为了让语句**真的跑出 1 行**变成可断言的事实(取不到真单号时才退化成不存在的单号)。
 * TOP 1 ⇒ 覆盖"列名/表名/别名/WHERE 可用"这一层(本次事故的全部成因),
 * 但**不覆盖**数据语义 —— 那要跑 _probe-stock-flow.cjs 这类端到端探针。
 *
 * 用法:
 *   node tools/archive/_check-stock-ledger-rows.cjs                 # 两个账套都跑
 *   node tools/archive/_check-stock-ledger-rows.cjs --db HSDZ_MES   # 只跑指定库
 *   node tools/archive/_check-stock-ledger-rows.cjs --source <路径> # 指定 Java 源码
 * 退出码: 0 全通过 / 1 有失败(便于挂进验收) / 2 提取层失败(源码结构变了)
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

// ── 参数 ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const argOf = (name, def) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const SRC = path.resolve(argOf('--source', path.join(__dirname, '..', '..', 'backend', 'src', 'main', 'java',
  'com', 'yinjia', 'mes', 'service', 'StockLedgerService.java')))
const DBS = argOf('--db', '') ? [argOf('--db')] : ['HSDZ_MES', 'HSDZ_MES_TEST']
const SQL_USER = process.env.YINJIA_SQL_USER || 'yinjia'
const SQL_PASS = process.env.YINJIA_SQL_PASS || 'Yinjia@2026'

/** 8 个分支 = 结存(kucun)记账口径的全部入口。提取数不为 8 ⇒ 源码结构变了,必须有人来看。 */
const EXPECTED = ['PURCHASE_IN', 'FINISH_IN', 'OTHER_IN', 'OUTSOURCE_IN',
  'SALE_OUT', 'OTHER_OUT', 'OUTSOURCE_ISSUE', 'MATERIAL_OUT']
const TBL = {                                   // 分支 → 行表/头表(用于取一条真实单号)
  PURCHASE_IN: 'bl_purchase_in', FINISH_IN: 'bl_finish_in', OTHER_IN: 'bl_other_in',
  OUTSOURCE_IN: 'bl_outsource_in', SALE_OUT: 'bl_sale_out', OTHER_OUT: 'bl_other_out',
  OUTSOURCE_ISSUE: 'bl_outsource_issue', MATERIAL_OUT: 'bl_material_out',
}

// ── sqlcmd 包装(沿用仓内既有口径;不是这次新造的机制)──────────────────────────
// -I : QUOTED_IDENTIFIER ON —— inh/outh 上有过滤索引,关掉它会报 1934
// -W -s\t -h -1 : 无表头、无对齐空格、制表符分隔(注意 -W 与 -y/-h 互斥,别一起用 -y)
// 语句走 `-i <文件>` 而不是 `-Q <文本>`:这 8 条 SQL 里全是中文列名/中文字面量,
// 命令行长参数在中转时容易被咬;落 UTF-8 文件最稳。
// ⚠ 文件路径必须是**反斜杠**的 Windows 路径:`D:/x.sql` 会被 sqlcmd 当成
//   `-i D:` + 日志写不进去,报「打开文件 D: …拒绝访问」,而错误说的是路径不是 SQL,
//   看着像权限问题,白白查半天。
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-ledger-'))
let tmpSeq = 0
function runSql (db, q) {
  const file = path.join(TMP_DIR, `q${++tmpSeq}.sql`)
  fs.writeFileSync(file, q, 'utf8')
  try {
    const out = execFileSync('sqlcmd', ['-S', 'localhost', '-d', db, '-U', SQL_USER, '-P', SQL_PASS,
      '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-I', '-i', file], { encoding: 'utf8' })
    return out.trim()
  } finally {
    try { fs.unlinkSync(file) } catch { /* 尽力清理 */ }
  }
}
/**
 * 返回 { rows, err }。**错误判定不能只看 sqlcmd 退出码** —— 实测某些错误(如「附近有语法错误」)
 * 退出码仍是 0,只把消息写在输出里;第一版脚本因此把语法错报成 ✓(假通过,比不检查更坏)。
 * 故:退出码非 0 或 输出里出现 `消息 NNN，级别` / `Msg NNN, Level` 都算失败(见 SELF-TEST)。
 */
const ERR_RE = /(?:消息|Msg)\s+\d+[，,]\s*(?:级别|Level)/
function trySql (db, q) {
  let out = '', err = null
  try {
    out = runSql(db, q)
  } catch (e) {
    err = [e.stdout, e.stderr].map(s => (s ? String(s).trim() : '')).filter(Boolean).join('\n') || String(e.message)
  }
  if (!err && ERR_RE.test(out)) err = out
  return { rows: err ? '' : out, err }}
const num = (db, q) => { const r = trySql(db, q); return r.err ? 0 : Number(r.rows || 0) }

// ── 提取:loadRows 的 8 个分支 SQL(唯一真相 = Java 源码)──────────────────────
/**
 * 提取 loadRows 的 8 个分支 SQL。
 *
 * 分支边界**按结构切**,不靠"语句以分号收尾":SQL 的最后一段是
 *   `+ " WHERE ... <> 'Y'", no);`
 * 分号在**字符串字面量之外**,所以拼接出来的 SQL 根本不以 `;` 结尾 ——
 * 第一版按分号收尾判断,结果每个分支都越界吃掉了后面所有分支(报出一堆
 * "OTHER_INSELECT 附近有语法错误"这种自己造成的假失败)。正确做法:
 * 从 case 标签往下扫,遇到**下一个 case/default 标签或其后的右括号**就停。
 */
const CASE_RE = /^\s*(?:case\s+"([A-Z_]+)"\s*->|default\s*->)/
function extractBranchSql (src) {
  const lines = src.replace(/^\uFEFF/, '').split(/\r?\n/)
  const start = lines.findIndex(l => /private\s+List<Map<String,\s*Object>>\s+loadRows\s*\(/.test(l))
  if (start < 0) throw new Error('源码里找不到 loadRows 方法(结构变了?提取逻辑要跟着改)')
  let depth = 0, started = false, end = -1
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) { if (ch === '{') { depth++; started = true } else if (ch === '}') depth-- }
    if (started && depth === 0) { end = i; break }
  }
  if (end < 0) throw new Error('loadRows 方法体没有闭合(结构变了?)')

  const body = lines.slice(start, end + 1)
  const labels = []
  for (let i = 0; i < body.length; i++) {
    const m = CASE_RE.exec(body[i])
    if (m) labels.push({ i, panel: m[1] || 'MATERIAL_OUT', viaDefault: !m[1] })
  }
  const out = []
  for (let k = 0; k < labels.length; k++) {
    const cur = labels[k], next = labels[k + 1]
    const stop = next ? next.i : body.length
    const acc = []
    for (let j = cur.i + 1; j < stop; j++) {
      for (const mm of body[j].matchAll(/"((?:[^"\\]|\\.)*)"/g)) acc.push(mm[1])
      // 已经拿到 SQL 且本行以 `)` 收尾(如 `", no);`)= 语句结束,后面是注释/下一个分支
      if (acc.length && /\)\s*;?\s*$/.test(body[j])) break
    }
    // default 分支按源码注释就是 MATERIAL_OUT(见 loadRows 的 `default ->` 行)
    out.push({ panel: cur.panel, line: cur.i + start + 1, viaDefault: cur.viaDefault, raw: acc.join('') })
  }
  return { start: start + 1, end: end + 1, branches: out }
}

/**
 * Java 源码字面量 → 可执行 SQL。
 *
 * 从 Java 源码里拼 SQL,只有一个地方会踩坑:**单引号**。源码里 `N''` 有互斥的两种含义 ——
 *   ① `N` + `''` = **空字符串字面量**(源码 → SQL 都是 `N''`),必须原样保留;
 *   ② 字符串内部的转义引号(源码 `N''Y''` → SQL `N'Y'`),必须收拢成单个。
 * 两者在**文本上完全同形**,只能靠上下文区分 —— 而上下文是可判定的:
 *   转义引号收拢后,右边一定紧跟着同一字符串的**内容**,即 `''` 后面还是引号(或到串尾);
 *   空串 `N''` 的右边一定是 SQL 分隔符(`,` / `)` / 空白 / `;` / 比较符)。
 * 故规则:`''` 后面既不是引号、也不是串尾 ⇒ 它不是转义引号,别动它。
 *
 * ⚠ 这条规则是**试错三轮**换来的,每一次错法都表现得像"源码里有坏列名",其实全是转换器把 SQL 改坏:
 *   ① 无条件 `''` → `'`:把 `ISNULL(NULLIF(l.[批次号], N''), …)` 变成 `N')`,
 *      引号总数变**奇数**,SQL Server 报「字符串 '…' 后的引号不完整」「"采购入库单"附近有语法错误」;
 *   ② 后行断言 `(?<=[\w\]])''`:治不了 ①,因为出问题的正是**字母 N 后面的空串**;
 *   ③ 于是有了 quoteCount 这道闸 —— 生成语句引号数为奇数说明**是转换器错了**,直接报转换错误,
 *      绝不再冒充成"源码里的列名无效"(那会把人引到完全错误的方向上去查)。
 */
function toSql (raw, no) {
  const lit = String(no).replace(/'/g, "''")
  return raw
    .replace(/\?/g, `N'${lit}'`)                       // 绑定参数(此时仍双写,不会被下两步误伤)
    .replace(/''(?='|$)/g, "'")                        // 只收拢真正的转义引号
}
/** 引号数必须为偶数,否则生成的就是**语法上不可能平衡**的语句 = 转换器 bug。 */
const quoteCount = (s) => [...s].filter(c => c === "'").length

/**
 * 自检:确认这套检查**会失败**。一个永远绿的检查等于没有检查 —— 灌一条引用不存在列的 SQL,
 * 必须被 trySql 判为错误;若它"通过",说明错误判定又退回了只看退出码的老路子,直接退出码 2。
 */
function selfTest (db) {
  const bad = trySql(db, "SET NOCOUNT ON;\nSELECT TOP 1 l.[绝对不存在的列_selftest] FROM bl_sale_out l;")
  const good = trySql(db, 'SET NOCOUNT ON;\nSELECT 1 AS ok;')
  if (!bad.err) {
    console.error(`\n[自检失败] ${db}:引用不存在列的 SQL 竟然没被判错 ⇒ 本脚本的失败判定失效,结果不可信。`)
    process.exit(2)
  }
  if (good.err) {
    console.error(`\n[自检失败] ${db}:合法 SQL 被误判为错误 ⇒ 失败判定过宽。${good.err}`)
    process.exit(2)
  }
  console.log(`  · 自检:不存在的列被正确判错(${String(bad.err).split('\n').filter(Boolean)[1]?.trim() || '已拦下'})`)
}

function main () {
  console.log(`源码: ${SRC}`)
  if (!fs.existsSync(SRC)) { console.error(`找不到源码文件: ${SRC}`); process.exit(2) }
  const { start, end, branches } = extractBranchSql(fs.readFileSync(SRC, 'utf8'))
  console.log(`loadRows: 第 ${start}-${end} 行,提取到 ${branches.length} 个分支 SQL`)
  const got = branches.map(b => b.panel)
  if (branches.length !== EXPECTED.length || EXPECTED.some(p => !got.includes(p))) {
    console.error(`\n[提取失败] 期望 ${EXPECTED.length} 个分支 ${EXPECTED.join('/')}`)
    console.error(`           实际 ${branches.length} 个: ${got.join('/')}`)
    console.error('           ⇒ loadRows 的源码结构变了,本脚本的提取逻辑需要跟着更新(不是绕过它)。')
    process.exit(2)
  }

  let fail = 0
  const withRow = new Set()          // 哪个分支**真的跑出过行**(否则"通过"只证明表在、语句能编译)
  for (const db of DBS) {
    console.log(`\n══════ ${db} ══════`)
    selfTest(db)
    for (const b of branches) {
      const tbl = TBL[b.panel]
      const no = runSql(db, `SET NOCOUNT ON; SELECT TOP 1 单据编号 FROM ${tbl} ORDER BY 单据编号 DESC;`) || 'NO-SUCH-DOC'
      const sql = toSql(b.raw, no)
      const label = `${b.panel}${b.viaDefault ? '(default)' : ''}`.padEnd(17)
      // 闸门:引号数为奇数 ⇒ 语句语法上不可能平衡 ⇒ **是本脚本把 SQL 拼坏了**,
      // 不是源码有问题。这条必须单独报,否则会把人引到"去查那个列名"的错误方向(踩过)。
      if (quoteCount(sql) % 2 !== 0) {
        fail++
        console.log(`  ✗ ${label} L${b.line} [转换器错误] 生成的 SQL 单引号数为奇数(${quoteCount(sql)})——本脚本的 Java→SQL 转换有问题,不是源码的列名问题`)
        console.log(`      ${JSON.stringify(sql.slice(0, 200))}`)
        continue
      }
      const r = trySql(db, `SET NOCOUNT ON;\nSET QUOTED_IDENTIFIER ON;\n${sql}`)
      if (r.err) {
        fail++
        console.log(`  ✗ ${label} L${b.line} ${tbl} 单号=${no}`)
        console.log(`      ${r.err.split('\n').map(s => s.trim()).filter(Boolean).join(' | ')}`)
      } else {
        const cols = r.rows ? r.rows.split('\t').length : 0
        if (cols) withRow.add(b.panel)
        const sample = r.rows.replace(/\t/g, ' │ ').slice(0, 150)
        console.log(`  ✓ ${label} L${b.line} ${tbl} 单号=${no}  ${cols ? cols + ' 列, 样例: ' + sample : '0 行(该表暂无数据 ⇒ 本轮只证明了列/表/别名都在)'}`)
      }
    }
    console.log(`  · kucun 结存行数 = ${num(db, 'SET NOCOUNT ON; SELECT COUNT(*) FROM kucun;')}`)
  }
  // 诚实交代覆盖面:一条行都没取到的分支,本轮只做到"能编译",没做到"跑得出数据"
  const thin = branches.map(b => b.panel).filter(p => !withRow.has(p))
  if (thin.length) console.log(`\n注:以下分支在两个账套都没取到行,仅证明列/表/别名可用(要真跑数据请用 _probe-stock-flow.cjs):\n    ${thin.join(' / ')}`)
  console.log(`\n═══ 结果: ${fail ? '失败 ' + fail + ' 条' : '8 分支 × ' + DBS.length + ' 账套 全部通过'} ═══`)
  process.exit(fail ? 1 : 0)
}

try { main() } catch (e) { console.error('CHECK FAIL: ' + e.stack); process.exit(2) }
