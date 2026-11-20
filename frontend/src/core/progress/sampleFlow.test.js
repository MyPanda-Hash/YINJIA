/**
 * 样品进度跟踪（2026-11-18 用户口径，Excel #9；2026-11-20 扩展为双外部面板）。
 *
 * 后端只回原始标记（pending / approve_node / archived / canceled），节点文案在这里推导：
 *   作废 > 归档 > 待二级 > 待一级 > 草稿（顺序不能反：作废单不该显示成"进行中"）。
 *
 * 2026-11-20 用户口径：「样品追踪应该是追踪外部的两个样品面板，现在只是一个，
 *   加上在这个界面可以切换分别追踪这两个外部的单据」⇒ 本页按面板取不同表：
 *   · RD_SAMPLE_EXT 外部-开发样品单（两级审批）
 *   · RD_SAMPLE_ND  外部-非开发样品单（一级审批，没有「确认」节点）
 * 同一套行契约 + 同一份字段查询/筛选逻辑，只有节点口径与跳转目标面板随面板切换。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SAMPLE_FLOW_FIELDS, SAMPLE_PANEL_EXT, SAMPLE_PANEL_ND, SAMPLE_PANELS,
  filterSampleRows, normalizeSamplePanel, sampleDocRoute, sampleKpisOf, sampleNodeOf, sampleNodeText,
} from './sampleFlow.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const querySvc = read('../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java')
const pxCtl = read('../../../../backend/src/main/java/com/yinjia/mes/controller/PxController.java')
const page = read('../../views/rd/SampleFlow.vue')

test('节点推导：草稿 / 待一级 / 待二级 / 已完成 / 已作废', () => {
  assert.equal(sampleNodeOf({ pending: 'N', archived: 'N', canceled: 'N' }), 'draft')
  assert.equal(sampleNodeOf({ pending: 'Y', approve_node: 1 }), 'l1')
  assert.equal(sampleNodeOf({ pending: 'Y', approve_node: 0 }), 'l1', '节点为空也按一级待审')
  assert.equal(sampleNodeOf({ pending: 'Y', approve_node: 2 }), 'l2')
  assert.equal(sampleNodeOf({ pending: 'Y', archived: 'Y' }), 'done')
  assert.equal(sampleNodeOf({ pending: 'Y', canceled: 'Y' }), 'void', '作废优先级最高')
  assert.equal(sampleNodeText({ pending: 'Y', approve_node: 2 }), '待二级确认')
})

test('KPI 不计作废单', () => {
  const k = sampleKpisOf([
    { pending: 'N', archived: 'N', canceled: 'N' },   // 草稿 → 计入总数
    { pending: 'Y', approve_node: 1 },                 // 待一级
    { pending: 'Y', approve_node: 2 },                 // 待二级
    { archived: 'Y' },                                 // 完成
    { canceled: 'Y' },                                 // 作废 → 不计
  ])
  assert.deepEqual(k, { total: 4, l1: 1, l2: 1, done: 1 })
})

test('检索：单号 / 客户 / 审核人 / 确认人 / 进度描述 都可命中，支持片段与大小写', () => {
  const rows = [
    { 单据编号: 'liulei-2026-11-18-01', 客户名称: '傲美', 审核人: '刘磊/2026.11.18', 确认人: '', 进度描述: '已寄样' },
    { 单据编号: 'SPW-2026-11-0011', 客户名称: '飞利浦', 审核人: '', 确认人: '冯总/2026.11.18', 进度描述: '待确认' },
  ]
  assert.equal(filterSampleRows(rows, '').length, 2, '空关键字不过滤')
  assert.deepEqual(filterSampleRows(rows, '傲美').map((r) => r.单据编号), ['liulei-2026-11-18-01'])
  assert.deepEqual(filterSampleRows(rows, 'LIULEI').map((r) => r.单据编号), ['liulei-2026-11-18-01'], '忽略大小写')
  assert.deepEqual(filterSampleRows(rows, '冯总').map((r) => r.单据编号), ['SPW-2026-11-0011'], '确认人也参与匹配')
  assert.deepEqual(filterSampleRows(rows, '寄样').map((r) => r.单据编号), ['liulei-2026-11-18-01'], '进度描述参与匹配')
  assert.equal(filterSampleRows(rows, '不存在的词').length, 0)
})

/* ═══ 2026-11-20：双外部面板 ═══ */

test('两个面板：默认外部-开发样品单（旧链接/旧调用保持兼容），非法值归一到 EXT', () => {
  assert.deepEqual(SAMPLE_PANELS.map((p) => p.code), [SAMPLE_PANEL_EXT, SAMPLE_PANEL_ND])
  assert.deepEqual(SAMPLE_PANELS.map((p) => p.singleLevel), [false, true], 'ND 只有一级审批')
  assert.equal(SAMPLE_PANEL_EXT, 'RD_SAMPLE_EXT')
  assert.equal(SAMPLE_PANEL_ND, 'RD_SAMPLE_ND')
  assert.equal(normalizeSamplePanel(), SAMPLE_PANEL_EXT, '不传 panel 默认 EXT')
  assert.equal(normalizeSamplePanel(''), SAMPLE_PANEL_EXT)
  assert.equal(normalizeSamplePanel('rd_sample_nd'), SAMPLE_PANEL_ND, '大小写不敏感')
  assert.equal(normalizeSamplePanel('  RD_SAMPLE_ND  '), SAMPLE_PANEL_ND, '两端空白忽略')
  assert.equal(normalizeSamplePanel('UNKNOWN'), SAMPLE_PANEL_EXT, '未知值不打死页面，落回 EXT')
})

test('外部-非开发样品单只有一级审批：不出现「待二级确认」，KPI 待二级恒 0', () => {
  assert.equal(sampleNodeOf({ pending: 'Y', approve_node: 1 }, SAMPLE_PANEL_ND), 'l1')
  // 脏数据里有 approve_node=2 也只能算「待一级」（本单没有二级节点，不能凭空多出一个待二级）
  assert.equal(sampleNodeOf({ pending: 'Y', approve_node: 2 }, SAMPLE_PANEL_ND), 'l1')
  assert.equal(sampleNodeText({ pending: 'Y', approve_node: 2 }, SAMPLE_PANEL_ND), '待一级审核')
  const k = sampleKpisOf([
    { pending: 'Y', approve_node: 2 },   // 一级待审（即使节点为 2）
    { pending: 'Y', approve_node: 1 },
    { archived: 'Y' },                   // 已审核（后端把单级通过映射成完成标记）
    { pending: 'N', archived: 'N' },     // 草稿
    { canceled: 'Y' },                   // 作废不计
  ], SAMPLE_PANEL_ND)
  assert.deepEqual(k, { total: 4, l1: 2, l2: 0, done: 1 })
  // 同一批数据按 EXT 口径仍算两级 —— 证明面板参数真的分叉，不是一刀切
  const ext = sampleKpisOf([{ pending: 'Y', approve_node: 2 }], SAMPLE_PANEL_EXT)
  assert.equal(ext.l2, 1)
})

test('切换后跳转目标面板：EXT → RD_SAMPLE_EXT，ND → RD_SAMPLE_ND（?docNo=单号）', () => {
  // 2026-11-20 报障：样品进度页点行不跳到对应单。根因是这里用了 ?focus= ——
  // focus 只在**当前已加载的列表**里找下标，目标一旦在别的页/被页签或可见范围挡住就落空，
  // 页面停在第 1 张单（用户观感=没反应）。?docNo= 是列表页「按单号定向打开」的既有口子
  // （applyDocNoQuery → 条件 _docNo），不受分页/页签影响，跨面板跳转与消息中心都走它。
  assert.deepEqual(sampleDocRoute(SAMPLE_PANEL_EXT, 'SPW-2026-11-0001'), {
    path: '/panelx/list/RD_SAMPLE_EXT',
    query: { docNo: 'SPW-2026-11-0001' },
  })
  assert.deepEqual(sampleDocRoute(SAMPLE_PANEL_ND, ' SPN2-2026-11-0001 '), {
    path: '/panelx/list/RD_SAMPLE_ND',
    query: { docNo: 'SPN2-2026-11-0001' },
  }, '单号两端空白去掉')
  assert.equal(sampleDocRoute('', 'SPW-1').path, '/panelx/list/RD_SAMPLE_EXT', '缺省仍跳 EXT')
  assert.ok(!('focus' in sampleDocRoute(SAMPLE_PANEL_EXT, 'SPW-1').query),
    '不得再传 focus（列表页按位置定位，目标不在当前页时必然落空）')
})

test('非开发样品单没有「确认人」：字段仍出现在查询下拉里，按它查就是空结果', () => {
  const ndRows = [
    { 单据编号: 'SPN2-2026-11-0001', 客户名称: '傲美', 审核人: '刘磊/2026.11.20', 确认人: '', 进度描述: '已寄样' },
    { 单据编号: 'SPN2-2026-11-0002', 客户名称: '飞利浦', 审核人: '', 确认人: '', 进度描述: '待审核' },
  ]
  assert.ok(SAMPLE_FLOW_FIELDS.includes('确认人'), 'ND 少「确认人」列，但字段仍可选')
  assert.equal(filterSampleRows(ndRows, { field: '确认人', keyword: '刘磊' }).length, 0, '按空处理')
  assert.equal(filterSampleRows(ndRows, { field: '审核人', keyword: '刘磊' }).length, 1, '同一关键字换字段能命中')
  assert.equal(filterSampleRows(ndRows, { field: '全部字段', keyword: '刘磊' }).length, 1)
})

test('接口契约：按 panel 取不同表 + 按对应面板校验权限，ND 确认人恒空', () => {
  const at = pxCtl.indexOf('@GetMapping("/sampleFlow")')
  assert.ok(at > 0, '缺 /sampleFlow 端点')
  const seg = pxCtl.slice(at, at + 900)
  assert.match(seg, /@RequestParam\(required = false\) String panel/, '要收 panel 参数且可空（默认 EXT）')
  assert.match(seg, /perm\.requirePanelView\(/, '要按面板校验查看权')
  assert.ok(!/requirePanelView\("RD_SAMPLE_EXT"\)/.test(seg), '不能写死 RD_SAMPLE_EXT')
  assert.match(seg, /sampleFlowRows\(/, '要把面板码传给查询层')

  const qAt = querySvc.indexOf('public List<java.util.Map<String, Object>> sampleFlowRows()')
  const qSeg = querySvc.slice(Math.max(0, qAt - 1200), qAt + 700)
  assert.ok(qAt > 0, '缺 sampleFlowRows')
  assert.match(qSeg, /normalizeSampleFlowPanel|SAMPLE_FLOW_PANEL_ND|"RD_SAMPLE_ND"/, '后端要认面板码')
  assert.match(qSeg, /rd_sample_ext_head/, 'EXT 读 rd_sample_ext_head')
  assert.match(qSeg, /rd_sample_nondev_head/, 'ND 读 rd_sample_nondev_head')
})

test('接口契约：进度页可见范围必须与目标单据列表同口径（列出来却点不进去 = 报障根因）', () => {
  // 2026-11-20 生产取证(谢琴 xieqin，非管理员/无 view_all)：
  //   进度页 17 行（/px/sampleFlow 返回全表），单据列表只有 1 行（queryDocs 按 asp_user1 过滤）；
  //   点别人那行 → focus 在列表里找不到 → 停在谢琴自己那张单，用户观感「点了没反应」。
  // 作废单同理：queryDocs 无条件排除 canceled='Y'，进度页却把 11 张作废单列了出来。
  // 所以进度页的取数必须复用列表的可见范围口径，否则「能看到的单」≠「点得开的单」。
  const at = querySvc.indexOf('public List<java.util.Map<String, Object>> sampleFlowRows(String panel)')
  assert.ok(at > 0, '缺 sampleFlowRows(String panel)')
  const seg = querySvc.slice(at, at + 5000)
  assert.match(seg, /ISNULL\(s\.canceled, ?'N'\) ?<> ?'Y'/, '作废单必须从进度页排除（与 queryDocs 的 canceled 过滤同口径）')
  assert.match(seg, /OWN_DOCS_PANELS/, '本人归属面板要复用同一份登记（RD_SAMPLE_EXT）')
  assert.match(seg, /canViewAllOf\(/, '有 view_all 的角色看全部（刘磊口径）')
  assert.match(seg, /asp_user1/, '没有 view_all 的账号按 asp_user1 = 当前账号收口')
  assert.match(seg, /currentLogin\(/, '取当前登录账号')
})

test('页面接线：顶部面板切换、切换重拉、行点击按当前面板跳转', () => {
  assert.deepEqual(SAMPLE_PANELS.map((p) => p.label), ['外部-开发样品单', '外部-非开发样品单'], '两个切换标签')
  assert.match(page, /el-radio-group[\s\S]{0,240}v-model="panel"/, '顶部要有分段切换')
  assert.match(page, /v-for="p in SAMPLE_PANELS"[\s\S]{0,120}tt\(p\.label\)/, '标签统一走 SAMPLE_PANELS + tt()')
  assert.match(page, /@change="[^"]*"/, '切换要触发动作（重拉 + 刷 KPI）')
  assert.match(page, /request\.get\('\/px\/sampleFlow',\s*\{\s*params:\s*\{\s*panel:/, '请求要带当前面板')
  assert.match(page, /sampleDocRoute\(panel\.value, no\)/, '跳转按当前面板 + 单号构造路由')
  assert.match(page, /@row-click="openDoc"/, '整行点击要接到 openDoc')
  assert.match(page, /@click\.stop="openDoc\(row\)"/, '单号 el-link 要 stop 后单独接到 openDoc')
  assert.match(page, /sampleKpisOf\(rows\.value,\s*panel\.value\)/, 'KPI 按当前面板统计')
  assert.match(page, /SAMPLE_FLOW_FIELDS/, '字段查询复用')
})
