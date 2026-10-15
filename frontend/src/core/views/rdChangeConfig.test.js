/**
 * rdChangeConfig.test.js —— 产品变更申请单版式 + 文书归档面板「反审核」入口的钉子
 *
 * 【用户口径 2026-10-16】
 *   「第三张是产品变更申请表,把表头改为可自由编辑的模式而不是固定的,在没有填写数据的时候
 *    可以不要压这么扁,可以适当拉长看起来协调一点,现在有一点宽和有一点短了,修改一下」
 *   「加上可反审核的机制,方便申请修改」
 *
 * 实测(1600×1200,新增一张空白 CHG 单):表头每行只有 **31~33px**,而这张纸横跨 1963px
 * (设计 B..G 列宽之和)⇒ 空白单据"又宽又扁"。故逐行给最小行高 h、大填写区给 rows:2。
 *
 * 单测跑不了 CSS 与模板分支,按仓库既有做法读源码钉住(同 docSheetConfigs.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const devTask = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/DevTaskService.java', import.meta.url), 'utf8')

// ── 一、变更申请单:每行都要有明确的最小行高,大填写区至少两行 ──
test('RD_CHANGE 每个表格行都给最小行高 h(>=36),大填写区 rows>=2', () => {
  const cfg = recordSheetConfigs.RD_CHANGE
  assert.ok(cfg, 'RD_CHANGE 配置必须存在')
  const rowsOf = (secs) => (secs || []).flatMap((s) => (s.rows || []).map((r) => ({ bar: s.bar, r })))
  const all = [...rowsOf(cfg.sections), ...rowsOf(cfg.tailSections)]
  assert.ok(all.length >= 12, `行数异常:${all.length}`)
  const noH = all.filter((x) => !(Number(x.r.h) >= 36)).map((x) => x.bar)
  assert.deepEqual(noH, [], '这些行没给行高(空白时会被压扁):' + noH.join(' / '))
  const areas = all.filter((x) => (x.r.grid || []).some((c) => c.area))
  assert.ok(areas.length > 0, '应当存在大填写区行')
  for (const { bar, r } of areas) {
    for (const c of r.grid.filter((x) => x.area)) {
      assert.ok(Number(c.rows) >= 2, `${bar} 的「${c.key || c.label}」大填写区要至少两行(rows>=2),否则空白时只有一行高`)
    }
  }
})

test('RD_CHANGE 的数据表行也要有最小行高 rowH(空表时别压扁)', () => {
  const dt = (recordSheetConfigs.RD_CHANGE.dataTables || [])[0]
  assert.ok(dt && Number(dt.rowH) >= 40, '部门评审意见表要给 rowH(≥40)')
  const rec = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(rec, /:style="dt\.rowH \? \{ height: dt\.rowH \+ 'px' \} : null"/, '数据表行渲染要读 dt.rowH')
})

test('网格行渲染必须读 row.h / c.rows(否则配置里的行高不生效)', () => {
  const rec = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(rec, /<tr v-else-if="row\.grid" :style="row\.h \? \{ height: row\.h \+ 'px' \} : null">/,
    '网格行要按 row.h 设最小行高')
  assert.match(rec, /:autosize="\{ minRows: c\.rows \|\| 1, maxRows: 6 \}"/,
    '网格大填写区的最小行数要能由配置 c.rows 给')
})

// ── 二、反审核(弃审):文书归档面板必须能放出该按钮,且已归档不算"不可点" ──
test('文书归档面板放出「弃审」入口,置灰口径与后端一致(已审核/已归档/已生效)', () => {
  assert.match(panelx, /const canUnauditHere = computed\(\(\) => isDocArchivePanel\.value[\s\S]{0,200}?canApproveHere\(\)\)/,
    'canUnauditHere 必须存在:文书归档面板 + 已审核/已归档 + 有审批权')
  assert.match(panelx, /v-if="canUnauditHere"[\s\S]{0,300}?pickModAction\('弃审'\)/,
    '侧栏必须真的放出「弃审」按钮(此前只有标准流面板有,归档一族只能走申请修改闭环)')
  assert.match(panelx, /弃审: !current\.value \|\| !\['已审核', '已归档', '已生效'\]\.includes\(st\)/,
    '弃审置灰口径要覆盖已归档 —— 否则归档单上按钮永远点不动')
})

// ── 三、规格书「检验项目及标准」分组表:组首两格不能在后继行重复输出 ──
test('分组设计表:非组首行不得再输出序号/组名 <td>(否则整行右移两列 → 空白格)', () => {
  const rec = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
  // 组首两格必须包在 v-if="r.groupFirst" 里(它们带 rowspan 占住整组)
  assert.match(rec, /<template v-if="r\.groupFirst">\s*\n\s*<td class="rs-td" :style="designTdStyle\(dt, 'seq'\)" :rowspan="r\.group\.count">/,
    '序号格必须只在组首行渲染(带 rowspan)')
  assert.ok(!/:rowspan="r\.groupFirst \? r\.group\.count : undefined"/.test(rec),
    '旧写法在后继行输出空 <td> —— 浏览器把它们排到子项目/检验要求两列,内容整行右移两列' +
    '(2026-10-16 用户截图:「检验项目下面和检验要求下面有空白格」)')
})

// ── 四、规格书分发:rd_spec_doc_head 没有「编号」列(2026-10-16 用户报障 500) ──
test('DevTaskService 不得再引用 rd_spec_doc_head.编号(该列不存在 ⇒ 分发责任人 500)', () => {
  // ⚠ 匹配要带 SQL 上下文:修复注释里就写着 h.编号 这个反面例子,裸文本匹配会误报
  assert.ok(!/\(h\.编号 IS NULL OR h\.编号 = \?\)/.test(devTask),
    'h.编号 会让 GET /px/specAssign 抛「列名 编号 无效」,产品信息表的规格书分发直接打不开')
  assert.match(devTask, /\(h\.产品编号 IS NULL OR h\.产品编号 = \?\)/,
    '可分配候选单的判据列应是 产品编号(分发路径盖章写的就是它)')
})
