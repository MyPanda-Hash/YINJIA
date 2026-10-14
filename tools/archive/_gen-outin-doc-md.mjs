/**
 * 生成器(2026-10-14)Phase 4:产出《出入库单据字段与显示字段.md》
 *
 * 与《采购链四单字段与显示字段.md》**同构**(用户口径「写成与它一样的执行文档,方便别人同步时统一字段」):
 *   一、通用口径 → 二、总览与金蝶接口对照 → 三、逐单字段登记 → 四、金蝶字段对照与未登记说明
 *   → 五、顺序核验汇总 → 六、红线 → 七、变更流程 → 八、回写与核验流程
 *
 * 真源(全部读现网/现成产物,不手抄):
 *   · 元数据:HSDZ_MES 的 yj_panel + yj_field + yj_translation(正式库为准,与四单文档同口径)
 *   · 金蝶字段:tools/archive/_dump-out/kingdee-3docs-fields-1014.json(逐键+样例)
 *               tools/archive/_dump-out/kingdee-3docs-fieldfill-1014.json(30 张真实单据非空率)
 *   · 金蝶↔MES 映射:tools/archive/_outin-mapping.mjs(唯一真源,取样脚本共用)
 *
 * 用法(仓库根): node tools/archive/_gen-outin-doc-md.mjs
 * 产物: docs/development/出入库单据字段与显示字段.md
 */
import { readFileSync, writeFileSync } from 'node:fs'
import mssql from '../../deploy/node_modules/mssql/index.js'
import { HEAD_MAP, LINE_MAP, SKIP_REASON, applies } from './_outin-mapping.mjs'

const HERE = new URL('./', import.meta.url)
const fields = JSON.parse(readFileSync(new URL('./_dump-out/kingdee-3docs-fields-1014.json', HERE), 'utf8'))
const fill = JSON.parse(readFileSync(new URL('./_dump-out/kingdee-3docs-fieldfill-1014.json', HERE), 'utf8'))

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES',
  user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})

const DOCS = [
  { api: 'inv_product', panel: 'FINISH_IN', label: '产品入库单', mesName: '产成品入库单', head: 'bd_finish_in', line: 'bl_finish_in' },
  { api: 'inv_other_in', panel: 'OTHER_IN', label: '其他入库单', mesName: '其他入库单', head: 'bd_other_in', line: 'bl_other_in' },
  { api: 'inv_other_out', panel: 'OTHER_OUT', label: '其他出库单', mesName: '其他出库单', head: 'bd_other_out', line: 'bl_other_out' },
]

const q = async (sql) => (await pool.request().query(sql)).recordset
const panels = await q(`SELECT * FROM yj_panel WHERE panel_code IN ('FINISH_IN','OTHER_IN','OTHER_OUT','OTHER_IN_DETAIL','OTHER_IN_STATS','OTHER_OUT_DETAIL','OTHER_OUT_STATS','FINISH_IN_DETAIL','FINISH_IN_STATS')`)
const fieldsAll = await q(`SELECT * FROM yj_field WHERE panel_code IN ('FINISH_IN','OTHER_IN','OTHER_OUT','OTHER_IN_DETAIL','OTHER_IN_STATS','OTHER_OUT_DETAIL','OTHER_OUT_STATS','FINISH_IN_DETAIL','FINISH_IN_STATS') ORDER BY panel_code, seq, id`)
const trans = await q(`SELECT scope, ref_key, locale, text FROM yj_translation WHERE scope='panel'`)
const panelTrans = new Map(trans.filter((t) => t.locale === 'en').map((t) => [t.ref_key, t.text]))
const fieldTrans = new Map((await q(`SELECT ref_key, text FROM yj_translation WHERE scope='field' AND locale='en'`)).map((t) => [t.ref_key, t.text]))

const P = panels.find((x) => x.panel_code === 'FINISH_IN')
const L = []
const w = (s = '') => L.push(s)
const placeText = (p) => ({ 'header': '表头', 'query': '查询', 'detail': '明细', 'query,header': '查询+表头', 'query,detail': '查询+明细', 'header,query': '表头+查询', 'header,detail': '表头+明细', 'query,header,detail': '查询+表头+明细' }[p] || p)

/** 反查:MES 物理列 → 金蝶键(可多列同源) */
const kdOf = (col, api) => {
  const hitH = HEAD_MAP.filter(([kd, c, only]) => c === col && applies(only, api)).map(([kd]) => kd)
  const hitL = LINE_MAP.filter(([kd, c, only]) => c === col && applies(only, api)).map(([kd]) => kd)
  return [...new Set([...hitH, ...hitL])]
}
const rateOf = (api, kd, part) => {
  const s = fill.docs[api]?.[part]?.[kd]
  return s ? `${Math.round((s.nonEmpty / Math.max(1, s.present)) * 100)}%` : '—'
}

w('# 出入库单据:字段与显示字段登记(唯一一致性基线)')
w('')
w('> **本文档是这三张单据「字段叫什么、显示成什么、按什么顺序显示、对应金蝶哪个接口字段」的唯一基线。**')
w('> 凡涉及 **产品入库单(FINISH_IN)/ 其他入库单(OTHER_IN)/ 其他出库单(OTHER_OUT)** 的字段增删、显示名调整、')
w('> 顺序变化、**以及与金蝶同步时的字段对齐**,一律以本文档为准;改完必须重跑生成器回写本文档。')
w('> 判定标准:界面上这三单的**表头 · 查询区 · 明细列**的字段名 / 显示名 / 顺序与本文档逐条一致;')
w('> 金蝶同步时按本文档「金蝶键 ↔ MES 列」逐字段对齐,不另起口径。')
w('')
w('| 项 | 值 |')
w('|---|---|')
w('| 登记日期 | 2026-10-14 |')
w(`| 取证库 | \`HSDZ_MES\`(正式账套;测试库 \`HSDZ_MES_TEST\` 只是快照副本,口径一律以正式库为准) |`)
w('| 元数据真源 | `yj_panel` + `yj_field` —— 面板与字段**全部数据驱动**,前端不硬编字段 |')
w('| 运行时真源 | `GET /api/px/getPanelConfig?panelCode=<面板编码>`(`PanelConfigService` 下发,前端只渲染) |')
w('| 金蝶字段真源 | `tools/archive/_dump-out/kingdee-3docs-fields-1014.md`(逐键+样例值)· `kingdee-3docs-fieldfill-1014.md`(30 张真实单据逐键非空率) |')
w('| 金蝶↔MES 映射真源 | `tools/archive/_outin-mapping.mjs`(取样脚本 `_pull-kingdee-samples-1014.mjs` 共用同一份) |')
w('| 生成脚本 | `tools/archive/_gen-outin-doc-md.mjs`(**本文档由脚本产出,请勿手改**) |')
w('| 复核命令 | 见末节 **§8 回写与核验流程** |')
w('')
w('## 一、通用口径(三单共用,动字段前必读)')
w('')
w('### 1.1 位置(place):决定字段出现在哪、按什么排序')
w('')
w('| `place` 取值 | 出现处 | 排序 |')
w('|---|---|---|')
w('| `header` | 单据表单页(表头) | `seq` 升序 |')
w('| `query` | 列表页查询条 **+ 表单页表头(同一字段出现两次)** | `seq` 升序 |')
w('| `query,header` | 表单页表头 + 查询条 | `seq` 升序 |')
w('| `detail` | 明细页签 | `seq` 升序 |')
w('| `query,detail` | 查询条 + 明细列 | `seq` 升序 |')
w('')
w('> 🔴 **表单页表头顺序 = `place` 含 `header`,或 `place` 恰为 `query` 的全部字段,合并后按 `seq` 升序。**')
w('> 只按 `header` 算会少一排字段(单号/单据日期/业务类型…全在 `query` 位上);')
w('> 而 `query,detail` 的字段只进查询条与明细,**不进表单页表头**。')
w('> 列表页顶部宽表的明细列顺序 = `place` 含 `detail` 且可见的字段按 `seq` 升序。')
w('')
w('### 1.2 排序真源与并列规则')
w('')
w('| 优先 | 键 |')
w('|---|---|')
w('| 1 | `yj_field.seq` 升序 |')
w('| 2(并列时) | `yj_field.id` 升序(= 该字段行的登记先后) |')
w('')
w('> `seq` 允许并列,并列时后端按 `id` 排。要精确控制顺序,请把 `seq` 写成不重复的值。')
w('')
w('### 1.3 四个显示开关')
w('')
w('| 列 | 语义 | 后果 |')
w('|---|---|---|')
w('| `visible` | 是否作为**表格列**出现 | `0` ⇒ 表格不显示该列(明细**表单**里仍可录入) |')
w('| `hidden` | 是否隐藏 | `1` ⇒ 表格与表单都不显示(值仍存、仍参与链路映射) |')
w('| `editable` | 是否可编辑 | `0` ⇒ 只读(同步/生单带下来的字段靠它锁死) |')
w('| `required` | 是否必填 | `1` ⇒ 表单校验拦截保存 |')
w('')
w('### 1.4 字段 vs 显示字段(ADR-0001:数据键永远中文)')
w('')
w('| 概念 | 落在哪 | 说明 |')
w('|---|---|---|')
w('| **字段(数据键)** | `yj_field.label` | 也是前后端 API 的 `dataName`;**永远中文、不随语言变** |')
w('| **物理列** | `yj_field.col_name` | 落库列名,**可与字段名不同** |')
w('| **显示名(译名)** | `yj_translation(scope=\'field\', ref_key=中文标签, locale)` | 切语言后**只换显示名**,字段名与顺序都不变 |')
w('')
w('### 1.5 参照字段的显示来源')
w('')
w('参照型字段(`dataType=参照`)按 `ref_panel` 的 `ref_field` 匹配,选中后把 `display_field` 回填本字段。')
w('')
w('## 二、三单总览与金蝶接口对照')
w('')
w('| 单据 | 面板编码 | 表头表 | 明细表 | 单号前缀 | 表头字段 | 查询区 | 明细字段(登记 / 表格可见) | 每页 | 金蝶接口 | 金蝶账套内条数(已审核) |')
w('|---|---|---|---|---|---|---|---|---|---|---|')
for (const d of DOCS) {
  const p = panels.find((x) => x.panel_code === d.panel)
  const fs = fieldsAll.filter((x) => x.panel_code === d.panel)
  const head = fs.filter((x) => (x.place || '').includes('header') || x.place === 'query')
  const query = fs.filter((x) => (x.place || '').includes('query'))
  const det = fs.filter((x) => (x.place || '').includes('detail'))
  const vis = det.filter((x) => x.visible && !x.hidden)
  w(`| **${d.mesName}** | \`${d.panel}\` | \`${d.head}\` | \`${d.line}\` | \`${p?.prefix || ''}\` | ${head.length} | ${query.length} | ${det.length} / ${vis.length} | ${p?.page_size || ''} | \`/jdy/v2/scm/${d.api}\` | ${fields.docs[d.api]?.count ?? '—'} |`)
}
w('')
w('三单的下游面板(与采购入库单/销售出库单同构 —— 用户口径「详细和统计也要做」):')
w('')
w('| 单据 | 明细表面板 | 统计表面板 | 视图 |')
w('|---|---|---|---|')
for (const d of DOCS) {
  w(`| ${d.mesName} | \`${d.panel}_DETAIL\` | \`${d.panel}_STATS\` | \`v_${d.head.replace('bd_', '')}_detail\` / \`v_${d.head.replace('bd_', '')}_stats\` |`)
}
w('')
w('## 三、逐单字段登记')
w('')
for (const d of DOCS) {
  const p = panels.find((x) => x.panel_code === d.panel)
  const fs = fieldsAll.filter((x) => x.panel_code === d.panel)
  const head = fs.filter((x) => (x.place || '').includes('header') || x.place === 'query').sort((a, b) => a.seq - b.seq || a.id - b.id)
  const det = fs.filter((x) => (x.place || '').includes('detail')).sort((a, b) => a.seq - b.seq || a.id - b.id)
  w(`### ${d.mesName} —— \`${d.panel}\``)
  w('')
  w('| 项 | 值 |')
  w('|---|---|')
  w(`| 金蝶接口 | \`/jdy/v2/scm/${d.api}\`(金蝶侧叫「${d.label}」) |`)
  w(`| 表头表 / 明细表 | \`${d.head}\` / \`${d.line}\` |`)
  w(`| 单号列 / 日期列 / 前缀 | \`${p?.code_col || ''}\` / \`${p?.date_col || ''}\` / \`${p?.prefix || ''}\` |`)
  w(`| 模块 / 每页 | ${p?.module_group || ''} / ${p?.page_size || ''} |`)
  w(`| 面板译名(en) | ${panelTrans.get(p?.panel_name) || '—'} |`)
  w('')
  const table = (rows, title, part) => {
    w(`#### ${title}(表单页显示顺序,共 **${rows.length}** 个)`)
    w('')
    w('| # | 字段(数据键/中文) | 物理列 | 类型 | 宽 | 位置 | 必填 | 只读 | 隐藏 | 显示名(en) | 金蝶键 | 金蝶非空率 |')
    w('|---|---|---|---|---|---|---|---|---|---|---|---|')
    rows.forEach((f, i) => {
      const kds = kdOf(f.col_name, d.api)
      w(`| ${i + 1} | **${f.label}** | \`${f.col_name}\` | ${f.data_type} | ${f.width ?? ''} | ${placeText(f.place)} | ${f.required ? '✔' : ''} | ${f.editable ? '' : '只读'} | ${f.hidden ? '✔' : ''} | ${fieldTrans.get(f.label) || '—'} | ${kds.length ? kds.map((k) => '`' + k + '`').join(' / ') : '—(MES 本地)'} | ${kds.length ? kds.map((k) => rateOf(d.api, k, part)).join(' / ') : '—'} |`)
    })
    w('')
  }
  table(head, '表头', 'header')
  table(det, '明细', 'entry')
}

w('## 四、金蝶字段对照与「未登记」说明')
w('')
w('> 用户口径:**主要的字段不能少;有数据的字段要保留,不要无用数据。**')
w('> 判定依据 = 金蝶账套 30 张真实单据的逐键非空率(`_dump-out/kingdee-3docs-fieldfill-1014.md`)。')
w('> 下表按类型列明:金蝶键总数 / 有值键数 / 已映射到 MES 的键 / 未映射的键及其原因 —— 「完全对照」由此可审计。')
w('')
for (const d of DOCS) {
  const f = fill.docs[d.api] || { header: {}, entry: {} }
  const mapped = new Set([...HEAD_MAP, ...LINE_MAP].filter(([, , only]) => applies(only, d.api)).map(([kd]) => kd))
  for (const part of ['header', 'entry']) {
    const keys = Object.keys(f[part] || {})
    const withData = keys.filter((k) => (f[part][k]?.nonEmpty || 0) > 0)
    const notMapped = withData.filter((k) => !mapped.has(k))
    w(`### ${d.mesName} · ${part === 'header' ? '表头' : '分录'}`)
    w('')
    w(`- 金蝶键共 **${keys.length}** 个,其中有数据 **${withData.length}** 个;已映射到 MES **${withData.filter((k) => mapped.has(k)).length}** 个`)
    if (notMapped.length) {
      w('')
      w('| 有值但未映射的金蝶键 | 非空率 | 原因 |')
      w('|---|---|---|')
      for (const k of notMapped) w(`| \`${k}\` | ${rateOf(d.api, k, part)} | ${SKIP_REASON[k] || '—(见字段清单;按「不要无用数据」口径未登记)'} |`)
    } else w('- 有值键**全部已映射**(无遗漏)。')
    const empty = keys.filter((k) => (f[part][k]?.nonEmpty || 0) === 0)
    w('')
    w(`- 恒空键 **${empty.length}** 个(按用户口径「不要无用数据」不落列、不登记):${empty.map((k) => '`' + k + '`').join('、') || '(无)'}`)
    w('')
  }
}

w('## 五、顺序核验汇总')
w('')
w('| 单据 | 表头(place 含 header 或恰为 query)按 seq | 明细表格列(detail + visible=1 + hidden=0)按 seq | 结论 |')
w('|---|---|---|---|')
for (const d of DOCS) {
  const fs = fieldsAll.filter((x) => x.panel_code === d.panel)
  const head = fs.filter((x) => (x.place || '').includes('header') || x.place === 'query').sort((a, b) => a.seq - b.seq || a.id - b.id)
  const vis = fs.filter((x) => (x.place || '').includes('detail') && x.visible && !x.hidden).sort((a, b) => a.seq - b.seq || a.id - b.id)
  const dup = head.length - new Set(head.map((x) => x.seq)).size
  w(`| ${d.mesName} | ${head.length} 个 | ${vis.length} 个 | ${dup ? `seq 并列 ${dup} 处(按 id 兜底)` : 'seq 无并列 ✅'} |`)
}
w('')
w('> 运行时真源可比对:`GET /api/px/getPanelConfig?panelCode=FINISH_IN` 的 `dataSchema.fields`(表头)')
w('> 与 `detail.tabs[0].fields`(明细)顺序应与上表一致。')
w('')
w('## 六、红线(改字段时不可违反)')
w('')
w('1. **数据键永远中文**(ADR-0001):`label` 不随语言变,只改 `yj_translation` 的显示名。')
w('2. **`place` 决定出现处**:把 `header` 字段改成 `detail` 会让它从表单页消失;`query,detail` 不会进表头。')
w('3. **金蝶必填项不能空**:其他入库/其他出库的 **业务类型id**(`trans_type_id`)**保存接口必需**(真实账套 其他入库=12 / 其他出库=13);')
w('   产品入库单的 `qty` 等数值**必须传字符串**(protobuf 校验,否则报 `invalid value for string type`)。')
w('4. **检验方式(全检/抽检)是 MES 本地字段**:金蝶保存接口对检验类键**静默忽略**,不得指望它随转ERP 落金蝶。')
w('5. **改参照源**必须带窄条件 + 行数守卫 + 越界自检(见《采购链四单字段与显示字段》§5.3 事故)。')
w('')
w('## 七、变更流程(增/删/改名/调序都走这条)')
w('')
w('1. 写迁移脚本(`tools/migrate-*.sql`),幂等 + 末尾自检;库变更**两账套都要执行**(先正式、后测试)。')
w('2. 涉及结构的,同步更新 `tools/db-inuse-tables.txt` 与 `docs/development/数据库表清单.md`。')
w('3. 重跑生成器回写本文档:`node tools/archive/_gen-outin-doc-md.mjs`(**不得手改本文档**)。')
w('4. 若改了金蝶字段口径,同步更新映射真源 `tools/archive/_outin-mapping.mjs`,并重跑取样核对(§8)。')
w('5. 单独一个 commit(`feat:`/`fix:`/`db:` 视改动性质)。')
w('')
w('## 八、回写与核验流程(拉取云端仓库更新后 / 每次改字段后必做)')
w('')
w('```powershell')
w('# ① 库侧真源:面板 + 字段 + 译名(正式库)')
w('cd tools; $env:YINJIA_SQL_PASS=\'<口令>\'; java "-Dstdout.encoding=UTF-8" -cp lib\\mssql-jdbc.jar DbSync.java')
w('')
w('# ② 重新生成本文档(顺带输出 §四 对照与 §五 顺序核验)')
w('cd ..; node tools/archive/_gen-outin-doc-md.mjs; git diff -- docs/development/出入库单据字段与显示字段.md')
w('')
w('# ③ 运行时真源:后端实际下发的字段与顺序(需 8090 在跑)')
w('#    GET /api/px/getPanelConfig?panelCode=FINISH_IN|OTHER_IN|OTHER_OUT')
w('')
w('# ④ 金蝶字段核对(只读真实账套):重新抓字段清单 + 非空率')
w('node tools/archive/_dump-kingdee-3docs-fields-1014.mjs')
w('node tools/archive/_stat-kingdee-3docs-fieldfill-1014.mjs 30')
w('')
w('# ⑤ 取样核对:每类拉 1 条真实单据 → 写入测试账套 → 逐字段比对')
w('node tools/archive/_pull-kingdee-samples-1014.mjs')
w('cd tools; java "-Dstdout.encoding=UTF-8" -cp lib\\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false" yinjia env archive\\_dump-out\\kingdee-samples-1014.sql')
w('cd ..; node tools/archive/_verify-kingdee-samples-1014.mjs   # 期望「不一致处 = 0」')
w('')
w('# ⑥ 端到端转ERP 验证(测试账套会话 → 沙箱,不碰客户真实账套)')
w('node tools/archive/_verify-erp-push-e2e-1014.mjs')
w('```')
w('')
w('> 判定:**§五 顺序核验全绿**、**§八⑤ 不一致处 = 0**、**§八⑥ 通道全绿** ⇒ 字段基线未被破坏。')
w('> 任何一项变红,按 §七 走变更流程,而不是就地改文档。')

writeFileSync(new URL('../../docs/development/出入库单据字段与显示字段.md', HERE), L.join('\n') + '\n', 'utf8')
await pool.close()
console.log(`已生成 docs/development/出入库单据字段与显示字段.md(${L.length} 行)`)
