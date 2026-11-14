import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PREVIEW_COMPACT_CAP, PREVIEW_FIELDS, PREVIEW_SKIP, PREVIEW_VALUE_CAP,
  previewLineText, previewSummaryOf,
} from './docPreview.js'

/**
 * 文书侧栏「单据预览查找」的卡片摘要（2026-11-11 用户口径）。
 *
 * 用户原话：「立项申请的单据预览做成和销售订单左侧栏类似，显示最主要的信息方便去查找对应单据」。
 * 参照物（销售订单选择左侧列表）= 一行一张单：单号 / 日期 / 客户 / 审核状态。
 *
 * 钉住两件事：
 *   ① 立项申请的卡片**只显示客户名（+ 项目等级）**，不带长文本、不带标签 —— 卡片两行扫完；
 *   ② 没登记的面板**行为不变**（前 4 个非空业务字段、带标签、42 字截断）——
 *      这是"改一个面板别顺手改掉十三个面板"的防线。
 */

const fields = [
  { dataName: '单据编号' }, { dataName: '单据日期' }, { dataName: '客户名' },
  { dataName: '立项背景' }, { dataName: '机型及应用位置' }, { dataName: '滤芯炭棒规格或结构' },
  { dataName: '项目开发目标' }, { dataName: '项目等级' }, { dataName: '申请立项人' },
]
const keyOf = (f) => f.dataName

const approvalRow = {
  单据编号: 'LXA-2026-11-011',
  单据日期: '2026-11-10',
  单据状态: '已归档',
  客户名: '零售客户',
  立项背景: '客户希望开发一款带抑菌功能的家用滤芯，目标是明年的新品线，需要联动炭棒配方一起改',
  机型及应用位置: '1',
  滤芯炭棒规格或结构: '1',
  项目等级: '二',
  申请立项人: '系统管理员',
}

test('① 立项申请：只出客户名 + 项目等级 + 申请立项人，且 compact（不带标签、一行拼起来）', () => {
  const s = previewSummaryOf({ row: approvalRow, fields, keyOf, panelCode: 'RD_APPROVAL' })
  assert.equal(s.compact, true, '登记过摘要字段的面板必须 compact')
  assert.deepEqual(s.items.map((x) => x.label), ['客户名', '项目等级', '申请立项人'])
  assert.deepEqual(s.items.map((x) => x.value), ['零售客户', '二', '系统管理员'])
  assert.equal(previewLineText(s), '零售客户 · 二 · 系统管理员', '日期与这一行同排显示由调用方拼')
  // 长文本一格都不许混进来（那正是"一张卡片十行"的来源）
  const labels = s.items.map((x) => x.label)
  for (const k of ['立项背景', '机型及应用位置', '滤芯炭棒规格或结构', '项目开发目标']) {
    assert.ok(!labels.includes(k), `${k} 是长文本，不该出现在预览卡片上`)
  }
})

test('② 立项申请：空摘要字段跳过（不留"客户名：—"这种空行）', () => {
  const s = previewSummaryOf({
    row: { ...approvalRow, 客户名: '   ', 项目等级: '', 申请立项人: '' }, fields, keyOf, panelCode: 'RD_APPROVAL',
  })
  assert.deepEqual(s.items, [])
  assert.equal(previewLineText(s), '')
})

test('③ 其他面板行为不变：前 4 个非空业务字段、带标签、42 字截断', () => {
  const s = previewSummaryOf({ row: approvalRow, fields, keyOf, panelCode: 'RD_SPEC_DOC' })
  assert.equal(s.compact, false, '没登记的面板必须走旧口径')
  assert.deepEqual(s.items.map((x) => x.label), ['客户名', '立项背景', '机型及应用位置', '滤芯炭棒规格或结构'],
    '系统列(单据编号/单据日期)要按 PREVIEW_SKIP 剔掉，最多 4 个')
  assert.ok(s.items.every((x) => x.value.length <= PREVIEW_VALUE_CAP + 1), '超过 42 字要截断加省略号')
})

test('④ 通用口径的剔除清单与阶段列：单据编号/备注/阶段N 不进卡片', () => {
  const row = { 单据编号: 'A-1', 单据日期: '2026-11-10', 备注: 'x', 阶段1状态: 'y', 客户名: '甲' }
  const s = previewSummaryOf({
    row, fields: [{ dataName: '单据编号' }, { dataName: '备注' }, { dataName: '阶段1状态' }, { dataName: '客户名' }],
    keyOf, panelCode: 'RD_OTHER',
  })
  assert.deepEqual(s.items.map((x) => x.label), ['客户名'])
  assert.ok(PREVIEW_SKIP.has('备注') && PREVIEW_SKIP.has('单据编号'))
})

test('⑤ 指定字段的截断比通用口径短（一行放得下）', () => {
  const long = '某某某某某某某某某某某某某某某某某某某某客户'
  const s = previewSummaryOf({
    row: { 客户名: long }, fields, keyOf, panelCode: 'RD_APPROVAL',
  })
  assert.equal(s.items[0].value.length, PREVIEW_COMPACT_CAP + 1, '截到 18 字 + 省略号')
  assert.ok(s.items[0].value.endsWith('…'))
})

test('⑥ 登记表本身：立项申请有摘要字段，且都是真实存在的表头字段名', () => {
  assert.deepEqual(PREVIEW_FIELDS.RD_APPROVAL, ['客户名', '项目等级', '申请立项人'])
  const real = new Set(fields.map((f) => f.dataName))
  for (const k of PREVIEW_FIELDS.RD_APPROVAL) assert.ok(real.has(k), `${k} 不在表头字段里(打错字就永远不显示)`)
})

/* ── 产品信息表：浮层横向多列 + 摘要字段固定（2026-11-12 用户口径）────── */
test('RD_PROD_INFO 必须登记摘要字段，卡片才对得齐', () => {
  // 用户口径原话：「单据预览做成和销售订单的左侧边栏一样的形式，横向多列排布」。
  // 横向多列的前提是**卡片等高**；不登记就会走通用口径（前 4 个非空字段），
  // 而各单填的字段不同（实测 PI-…0002 出「编辑人/审核人」，CP382 出「产品编号/名称/类别」）
  // ⇒ 卡片高矮不齐、列错位。这里钉住登记内容。
  assert.ok(PREVIEW_FIELDS.RD_PROD_INFO, '缺 RD_PROD_INFO 摘要字段登记')
  assert.deepEqual(PREVIEW_FIELDS.RD_PROD_INFO, ['产品编号', '产品名称', '客户名称'],
    '产品信息表摘要 = 产品编号 / 产品名称 / 客户名称（找单三线索，都是短字段）')
})

test('右栏预览必须复用 DocSelectRail 本体（左栏那套表格），不是自造卡片列表', () => {
  // 用户口径（2026-11-13）：「我要左边栏的展示效果在右边展示，而不是换成右边之前的样式」。
  // 演进史（每一步都是被纠正出来的，别再往回改）：
  //   ① 窄侧栏卡片 → ② 弹窗浮层（「应该是侧边栏不是弹窗」）
  //   → ③ 展开左侧 → ④ 右栏但用自造卡片列表（「要左边栏的展示效果」）
  //   → ⑤ **右栏里直接放 DocSelectRail**（本版）。
  const vue = readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8')
  // ① 预览态里必须是 DocSelectRail 组件本体
  const at = vue.indexOf('<template v-if="previewInSide">')
  const at2 = vue.indexOf('<div v-if="previewInSide" class="ps-wrap">')
  const from = at > 0 ? at : at2
  assert.ok(from > 0, '找不到预览态模板')
  const seg = vue.slice(from, from + 1400)
  assert.match(seg, /<DocSelectRail/, '右栏预览里必须直接用 DocSelectRail（与左栏同一组件）')
  assert.match(seg, /class="ps-back"/, '必须有返回按钮')
  // ② 不能再有自己的卡片列表（那是方案④，被否掉了）
  assert.ok(!vue.includes('ps-row'), '不应再有自造卡片行 ps-row')
  // ③ 列配置必须登记在 PREVIEW_COLUMNS（预览专用），**不能**进 DOC_RAIL_PANELS
  const pv = vue.indexOf('const PREVIEW_COLUMNS = {')
  assert.ok(pv > 0, '缺 PREVIEW_COLUMNS')
  const pvBlock = vue.slice(pv, pv + 900)
  assert.ok(pvBlock.includes('RD_PROD_INFO: ['), '产品信息表未登记预览列')
  assert.ok(pvBlock.includes('RD_APPROVAL: ['), '立项申请未登记预览列')
  // ⚠ 关键回归守卫（用户 2026-11-13 报障「把左边的删掉，现在多了」）：
  //   DOC_RAIL_PANELS 是"这个面板有左侧选择栏"的开关，登记进去就会平白多出一条左栏。
  const dir = vue.indexOf('const DOC_RAIL_PANELS = {')
  // 只取该对象本体（到 PREVIEW_COLUMNS 之前），否则会把预览的列配置也算进来
  const dirEnd = vue.indexOf('const PREVIEW_COLUMNS = {')
  const block = dirEnd > dir ? vue.slice(dir, dirEnd) : vue.slice(dir, dir + 14000)
  assert.ok(!block.includes('RD_PROD_INFO: ['), 'RD_PROD_INFO 不能进 DOC_RAIL_PANELS（会多出左栏）')
  assert.ok(!block.includes('RD_APPROVAL: ['), 'RD_APPROVAL 不能进 DOC_RAIL_PANELS（会多出左栏）')
  // ④ 预览态右栏要加宽（176px 放不下 6 列，实测只露出单号+日期）
  // ④ 预览态右栏要加宽到**能完整放下 6 列**。
  //    实测演进：176px 只露「单号+日期」；382px 仍不够（产品信息表表格 scrollWidth=416px，
  //    .dsr-grid 是 overflow-x:auto ⇒「审核状态」被推到右侧看不见）⇒ 现为 440px。
  const wm = vue.match(/\.approval-side\.preview-on \{ width: (\d+)px; \}/)
  assert.ok(wm, '预览态右栏必须加宽，否则表格列被挤掉')
  assert.ok(Number(wm[1]) >= 420,
    `预览态右栏宽度 ${wm[1]}px 不足以完整显示 6 列表格（实测需 ≥416px）`)
})

test('预览态必须替换操作栏（按钮不渲染），返回后恢复', () => {
  const vue = readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8')
  assert.match(vue, /<template v-if="!sideCollapsed && !previewInSide">/,
    '预览态要把原操作栏一起关掉（替换而不是叠加）')
  assert.match(vue, /canPreviewSide \? openSidePreview\(\) : openDocPreview\(\)/,
    '按钮要按面板分派：这两个面板走右栏预览，其余走原逻辑')
  assert.ok(vue.includes('closeSidePreview'), '缺返回函数')
})
