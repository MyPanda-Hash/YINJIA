import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PREVIEW_COMPACT_CAP, PREVIEW_FIELDS, PREVIEW_SKIP, PREVIEW_VALUE_CAP,
  approvalStatusTree, filterApprovalPreview, previewColumnsOf, previewLineText, previewSummaryOf,
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

/* ═══ 2026-11-17 用户口径:立项申请「单据预览」改成全屏 · 按申请立项人筛选 ═══
 *
 * 用户原话:「点击单据预览就根据申请立项人进行一个筛选全屏展示这些属于自己申请的单据的明细,
 *   设计要好看,使用设计库进行设计,要留一个返回按钮,点击对应单据要有一个跳转按钮,可以直接跳转到对应单据」。
 *
 * 钉住的是**筛选口径**(纯函数,页面只负责画):
 *   ① 默认「只看我申请的」= 申请立项人 === 当前登录人姓名;
 *   ② 可切到「全部」(管理员/代查场景),切换后不过滤;
 *   ③ 姓名比较忽略首尾空白与大小写;申请立项人为空的单**不算我的**;
 *   ④ 关键字搜索在筛选结果内再收窄(单号/客户名/申请立项人)。
 */

const APR_ROWS = [
  { 单据编号: 'LXA-1', 单据日期: '2026-11-17', 申请立项人: '张莉', 客户名: '青岛伊可普', 单据状态: '审批中' },
  { 单据编号: 'LXA-2', 单据日期: '2026-11-16', 申请立项人: '李梓维', 客户名: '天津远致', 单据状态: '已归档' },
  { 单据编号: 'LXA-3', 单据日期: '2026-11-13', 申请立项人: '张莉', 客户名: '深圳鼎百汇', 单据状态: '草稿' },
  { 单据编号: 'LXA-4', 单据日期: '2026-11-13', 申请立项人: '', 客户名: '没有申请人', 单据状态: '草稿' },
  { 单据编号: 'LXA-5', 单据日期: '2026-11-03', 申请立项人: ' 张莉 ', 客户名: '大咖国际', 单据状态: '审批中' },
]

test('⑱ 默认只列「我申请的」:申请立项人 = 当前登录人(忽略首尾空白)', () => {
  const mine = filterApprovalPreview(APR_ROWS, { me: '张莉', scope: 'mine' })
  assert.deepEqual(mine.map((r) => r['单据编号']), ['LXA-1', 'LXA-3', 'LXA-5'], '只留张莉申请的(含带空格的那张)')
  assert.ok(!mine.some((r) => r['单据编号'] === 'LXA-4'), '申请立项人为空的单不算我的')
  assert.ok(mine.every((r) => String(r['申请立项人'] || '').trim() === '张莉'))
})

test('⑲ 切到「全部」时不过滤(管理员/代查场景)', () => {
  const all = filterApprovalPreview(APR_ROWS, { me: '张莉', scope: 'all' })
  assert.equal(all.length, 5, '全部 = 一条不丢')
})

test('⑳ 关键字在筛选结果内再收窄(单号/客户名/申请立项人)', () => {
  assert.deepEqual(filterApprovalPreview(APR_ROWS, { me: '张莉', scope: 'mine', keyword: 'lxa-3' }).map((r) => r['单据编号']), ['LXA-3'], '单号大小写无关')
  assert.deepEqual(filterApprovalPreview(APR_ROWS, { me: '张莉', scope: 'mine', keyword: '深圳' }).map((r) => r['单据编号']), ['LXA-3'], '客户名可搜')
  assert.deepEqual(filterApprovalPreview(APR_ROWS, { me: '张莉', scope: 'mine', keyword: '李梓维' }).map((r) => r['单据编号']), [], '范围外的人不会被关键字带出来')
})

test('㉑ 当前登录人为空时不能误判成「全都不是我的」以外的结果', () => {
  // 拿不到姓名(未登录/匿名)时,「只看我的」应为空 —— 而不是把所有人的单都当自己的
  assert.deepEqual(filterApprovalPreview(APR_ROWS, { me: '', scope: 'mine' }), [])
  assert.equal(filterApprovalPreview(APR_ROWS, { me: '   ', scope: 'mine' }).length, 0)
})

/* ── 2026-11-17：参考金蝶「商品列表」升级预览（左状态树 + 多条件查询栏）── */
test('filterApprovalPreview 支持 状态 / 等级 / 日期区间 三个新条件', () => {
  const rows = [
    { 单据编号: 'A-1', 申请立项人: '张三', 单据状态: '草稿', 项目等级: 'A', 单据日期: '2026-11-01' },
    { 单据编号: 'A-2', 申请立项人: '张三', 单据状态: '已归档', 项目等级: 'B', 单据日期: '2026-11-10' },
    { 单据编号: 'A-3', 申请立项人: '李四', 单据状态: '草稿', 项目等级: 'A', 单据日期: '2026-11-20' },
  ]
  const base = { me: '张三', scope: 'all' }
  assert.equal(filterApprovalPreview(rows, base).length, 3)
  // 状态
  assert.deepEqual(filterApprovalPreview(rows, { ...base, status: '草稿' }).map((r) => r.单据编号), ['A-1', 'A-3'])
  // 等级
  assert.deepEqual(filterApprovalPreview(rows, { ...base, grade: 'A' }).map((r) => r.单据编号), ['A-1', 'A-3'])
  // 日期区间（含边界）
  assert.deepEqual(filterApprovalPreview(rows, { ...base, dateFrom: '2026-11-05', dateTo: '2026-11-15' }).map((r) => r.单据编号), ['A-2'])
  assert.deepEqual(filterApprovalPreview(rows, { ...base, dateTo: '2026-11-01' }).map((r) => r.单据编号), ['A-1'], '只给结束日也要生效')
  // 三个条件 AND
  assert.deepEqual(filterApprovalPreview(rows, { ...base, status: '草稿', grade: 'A', dateFrom: '2026-11-15' }).map((r) => r.单据编号), ['A-3'])
  // 没日期的行在按日期筛时不参与（不能当 0 通过）
  assert.deepEqual(filterApprovalPreview([{ 单据编号: 'X', 单据状态: '草稿' }], { ...base, dateFrom: '2026-01-01' }).length, 0)
})

test('approvalStatusTree：按业务顺序排、只出有数据的状态、首项固定「全部」', () => {
  const rows = [
    { 单据状态: '已归档' }, { 单据状态: '草稿' }, { 单据状态: '草稿' }, { 单据状态: '审批中' },
  ]
  const tree = approvalStatusTree(rows)
  assert.equal(tree[0].key, '')
  assert.equal(tree[0].label, '全部')
  assert.equal(tree[0].count, 4)
  // 业务顺序：草稿 → 审批中 → 已归档（不是字典序）
  assert.deepEqual(tree.slice(1).map((n) => n.label), ['草稿', '审批中', '已归档'])
  assert.deepEqual(tree.slice(1).map((n) => n.count), [2, 1, 1])
  // 空数据时只有「全部 0」
  assert.deepEqual(approvalStatusTree([]), [{ key: '', label: '全部', count: 0 }])
})

test('产品信息表复用同一套预览：归属人字段可参数化为「编辑人」', () => {
  const rows = [
    { 单据编号: 'P-1', 编辑人: '张三' },
    { 单据编号: 'P-2', 编辑人: '李四' },
  ]
  // 用 申请立项人 判据 → 一条都不匹配（产品信息表没这列）
  assert.equal(filterApprovalPreview(rows, { me: '张三', scope: 'mine' }).length, 0)
  // 传 ownerKey='编辑人' → 命中张三那张
  assert.deepEqual(
    filterApprovalPreview(rows, { me: '张三', scope: 'mine', ownerKey: '编辑人' }).map((r) => r.单据编号),
    ['P-1'])
})

/* ── 2026-11-17：表格列按面板配置（「单据编号是固定的，应展示重点字段」）── */
test('产品信息表的预览列以业务字段为主，单据编号退到最后', () => {
  const cols = previewColumnsOf('RD_PROD_INFO', '编辑人')
  const keys = cols.map((c) => c.key)
  // 业务识别字段必须在前
  assert.equal(keys[0], '产品编号', '产品编号是最有区分度的识别字段')
  assert.ok(keys.includes('产品名称') && keys.includes('客户名称'))
  // 单据编号不能在首位（它可能是 YJ-QR-152 这类固定表单编号）
  assert.notEqual(keys[0], '单据编号', '单据编号不能当第一列')
  assert.equal(keys[keys.length - 1], '单据编号', '单据编号退到最后一列（仍保留，便于对账）')
})

test('立项申请沿用客户/等级/申请人三条找单线索', () => {
  const keys = previewColumnsOf('RD_APPROVAL', '申请立项人').map((c) => c.key)
  assert.deepEqual(keys, ['单据编号', '单据日期', '客户名', '项目等级', '申请立项人'])
})

test('未登记的面板退回最小集（单号/日期/归属人），不会渲染出空表头', () => {
  const cols = previewColumnsOf('SOME_UNKNOWN', '编辑人')
  assert.deepEqual(cols.map((c) => c.key), ['单据编号', '单据日期', '编辑人'])
  assert.ok(cols.length > 0)
})
