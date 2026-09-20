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
SELECT panel_code, place, col_name, label FROM yj_field WHERE panel_code LIKE 'RD[_]%' ORDER BY panel_code, place, seq;`

function runSqlcmd() {
  const args = [
    '-S', process.env.YINJIA_SQL_HOST || 'localhost',
    '-d', process.env.YINJIA_SQL_DB || 'HSDZ_MES',
    '-U', process.env.YINJIA_SQL_USER || 'yinjia',
    '-P', process.env.YINJIA_SQL_PASSWORD || 'Yinjia@2026',
    '-W', '-s', '\t', '-h', '-1', '-Q', SQL,
  ]
  return execFileSync('sqlcmd', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

const raw = runSqlcmd()
/** panel -> { cols: {col_name: label}, labels: [label...] } */
const out = {}
let rows = 0
for (const line of raw.split(/\r?\n/)) {
  if (!line.trim()) continue
  const p = line.split('\t')
  if (p.length < 4) continue
  const [panel, place, col, label] = p.map((s) => s.trim())
  if (!panel || !col) continue
  rows++
  const e = (out[panel] = out[panel] || { cols: {}, labels: [] })
  e.cols[col] = label
  if (!e.labels.includes(label)) e.labels.push(label)
}

if (!rows) throw new Error('sqlcmd 没返回任何 yj_field 行 —— 检查连接/库名')
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8')
console.log(`OK  ${rows} 行 yj_field → ${Object.keys(out).length} 个面板 → ${path.relative(path.join(__dirname, '..'), OUT)}`)
