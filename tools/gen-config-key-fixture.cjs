/**
 * gen-config-key-fixture.cjs — 生成 recordSheetConfigs 的 key 校验基线
 *
 * 【为什么需要】后端 QueryService.selectCols 用 `AS [label]` 出列、rowToLabels 按 **label** 建行模型,
 * 保存链 labelsToCols 再用 label 反查 col_name 落库 ⇒ **配置里的数据键必须恰好等于 yj_field.label**。
 * 换句话说:**改 label 就是改数据键** —— 2026-09-18 那轮把一批 label 对齐设计后,
 * RD_PROD_INFO(特殊性能描述/责任人)、RD_ASM_PROC(物料名/更改原因/更改内容)、
 * RD_INSP_PLAN(控制项目/控制标准及要求)等配置的 key 立刻过期(整列取不到值且保存静默丢值)。
 *
 * 本脚本从活库导出「面板 → 当前 label 集合」快照,供前端单测在 CI/无库环境下守住这条不变量。
 *
 * 用法(改过 label 或加过字段后必须重跑):
 *   node tools/gen-config-key-fixture.cjs
 * 依赖:sqlcmd 可连 HSDZ_MES(与迁移脚本同一套连接方式)。
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const OUT = path.join(__dirname, '..', 'frontend', 'src', 'core', 'views', 'rdPanelLabels.fixture.json')

const SQL = `SET NOCOUNT ON;
SELECT CONVERT(NVARCHAR(MAX), panel_code) + NCHAR(9) + ISNULL(place, N'') + NCHAR(9)
     + CONVERT(NVARCHAR(MAX), col_name) + NCHAR(9) + ISNULL(label, N'') + NCHAR(9)
     + CONVERT(NVARCHAR(5), ISNULL(required, 0)) + NCHAR(9)
     + CONVERT(NVARCHAR(5), ISNULL(hidden, 0)) + NCHAR(9)
     + CONVERT(NVARCHAR(5), ISNULL(visible, 1))
FROM yj_field WHERE panel_code LIKE 'RD[_]%' ORDER BY panel_code, place, seq`

/**
 * 跑 sqlcmd 并**按实际字节编码**解码。
 *
 * ⚠ 这里踩过坑:sqlcmd 的输出编码跟的是**控制台代码页**(本机 GBK),`-f 65001` 只管
 *   `-i` 输入文件的编码、`-u` 在新版 sqlcmd 里已被忽略 —— 两者都改不了输出。
 *   先前按 'utf8' 硬解 ⇒ 中文 label 全长成乱码写回 fixture,
 *   而 fixture 是测试基线,污染后**不会报错**,只会让断言在乱码上"通过"。
 *   改成:先按严格 UTF-8 试解(控制台已是 65001 的机器走这条),失败再回落 GBK。
 *   两者都不成立时抛错,绝不静默写坏基线。
 */
/**
 * 连接方式(2026-10-08 改):优先走 **JDBC(tools/SqlRunner.java)**,`sqlcmd` 仅作兜底。
 *
 * 【为什么改】本机 Schannel 损坏,`sqlcmd` 连不上(仓库里 SqlRunner 就是为绕开它而写的);
 *   生成脚本一旦跑不起来,`fixture` 就没人能刷新 —— 基线悄悄过期,守卫测试在**过期的 label 上
 *   继续"通过"**,而线上该列照旧丢值。本次(2026-10-08「实验记录表填了丢数据」)正是这么爆的:
 *   fixture 停在 2026-09-30,期间 10-07 的实验室日期改动之后没人能重跑它。
 */
function runSqlcmd() {
  const args = [
    '-S', process.env.YINJIA_SQL_HOST || 'localhost',
    '-d', process.env.YINJIA_SQL_DB || 'HSDZ_MES',
    '-U', process.env.YINJIA_SQL_USER || 'yinjia',
    '-P', process.env.YINJIA_SQL_PASSWORD || 'Yinjia@2026',
    '-W', '-s', '\t', '-h', '-1', '-Q', SQL,
  ]
  const buf = execFileSync('sqlcmd', args, { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  return decodeOutput(buf)
}

/**
 * 走 JDBC:调 tools/verify/FieldMetaDump.java 拿**全量 TSV**(panel/place/col/label/required/hidden/visible)。
 *
 * 为什么不是其它两条路(2026-11-06 都实测踩过):
 *   · `SqlRunner` 是给迁移脚本做**人读**输出的,SELECT 结果只打 **50 行** —— 956 行 yj_field 拿到 50 行;
 *   · `FOR JSON PATH` 的 JSON 结果在这台 mac 的驱动下被拆成 ~2KB 多行、且**尾部截断**(101,650 字符处),
 *     按行拼回去也拼不全 ⇒ JSON.parse 报 Unterminated string。
 */
function runJdbc() {
  const tools = path.join(__dirname)
  const db = process.env.YINJIA_SQL_DB || 'HSDZ_MES'
  // trustServerCertificate:连远程(生产)库时是自签证书,缺这行 SSL 握手直接失败
  const url = `jdbc:sqlserver://${process.env.YINJIA_SQL_HOST || '127.0.0.1'}:1433;databaseName=${db};encrypt=false;trustServerCertificate=true;loginTimeout=15`
  const buf = execFileSync('java', [
    '-Dstdout.encoding=UTF-8', '-cp', path.join('lib', 'mssql-jdbc.jar'), path.join('verify', 'FieldMetaDump.java'),
    url, process.env.YINJIA_SQL_USER || 'yinjia', process.env.YINJIA_SQL_PASSWORD || 'Yinjia@2026',
  ], { cwd: tools, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  return rowsFromSqlcmd(decodeOutput(buf))
}

/** 统一成 [{panel, place, col, label}] —— sqlcmd 走文本、JDBC 走 JSON,两条路都归一到同一形状 */
function rowsFromSqlcmd(raw) {
  const rows = []
  for (const rawLine of raw.split(/\r?\n/)) {
    if (!rawLine.trim()) continue
    // SqlRunner 单列输出形如 `  | a	b	... |` —— 先剥外壳再按 tab 切
    let line = rawLine.trim()
    if (line.startsWith('|')) line = line.slice(1)
    if (line.endsWith('|')) line = line.slice(0, -1)
    if (line.startsWith(' ')) line = line.slice(1)
    if (line.endsWith(' ')) line = line.slice(0, -1)
    const p = line.split('\t')
    if (p.length < 4) continue
    const [panel, place, col, label, req, hid, vis] = p.map((s) => s.trim())
    if (!panel || !col) continue
    rows.push({ panel, place, col, label, required: Number(req) === 1, hidden: Number(hid) === 1, visible: Number(vis) !== 0 })
  }
  return rows
}
function rowsFromJson(arr) {
  return (arr || [])
    .map((r) => ({
      panel: String(r.panel_code ?? '').trim(),
      place: String(r.place ?? '').trim(),
      col: String(r.col_name ?? '').trim(),
      label: String(r.label ?? '').trim(),
      required: Number(r.required) === 1,
      hidden: Number(r.hidden) === 1,
      visible: Number(r.visible) !== 0,
    }))
    .filter((r) => r.panel && r.col)
}

/** 先 JDBC,失败再退回 sqlcmd(两台机器两条路,哪条能通走哪条) */
function readRows() {
  try {
    return runJdbc()  // 已归一成 {panel, place, col, label, required, hidden, visible}
  } catch (e) {
    try {
      return rowsFromSqlcmd(runSqlcmd())
    } catch (e2) {
      throw new Error(`JDBC 与 sqlcmd 都取不到 yj_field:\n  JDBC: ${e.message}\n  sqlcmd: ${e2.message}`)
    }
  }
}

function decodeOutput(buf) {
  try {
    const s = new TextDecoder('utf-8', { fatal: true }).decode(buf)
    // 带 BOM 的 UTF-8 会残留 ﻿,按首字符剥掉
    return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
  } catch { /* 不是合法 UTF-8,继续试 GBK */ }
  try {
    return new TextDecoder('gbk').decode(buf)
  } catch (e) {
    throw new Error(`sqlcmd 输出既不是 UTF-8 也不是 GBK,无法安全解码:${e.message}`)
  }
}

/**
 * panel -> {
 *   cols: {col_name: label},          ← 配置 key 必须写 label(见 keys.test.js)
 *   labels: [label...],
 *   req: {label: {required, hidden, visible}}  ← 「必填是否真的画在纸上」体检用(2026-11-06)
 * }
 */
const out = {}
let rows = 0
for (const { panel, col, label, required, hidden, visible } of readRows()) {
  rows++
  const e = (out[panel] = out[panel] || { cols: {}, labels: [], req: {} })
  e.cols[col] = label
  if (!e.labels.includes(label)) e.labels.push(label)
  // 同 label 多条(不同 place)时:任一条「必填且可见」就算必填 —— 校验按字段(不是按 place)罚
  const prev = e.req[label]
  e.req[label] = {
    required: !!(required || (prev && prev.required)),
    hidden: hidden && (!prev || prev.hidden),
    visible: visible || (prev && prev.visible),
  }
}

if (!rows) throw new Error('没取到任何 yj_field 行 —— 检查连接/库名')
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8')
console.log(`OK  ${rows} 行 yj_field → ${Object.keys(out).length} 个面板 → ${path.relative(path.join(__dirname, '..'), OUT)}`)
