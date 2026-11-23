/**
 * testApplySummary.test.js — 「测试申请汇总表」契约守卫(2026-11-19)
 *
 * 【用户口径·原话】
 *   「做一个类似于样品检验汇总单一样的按照人员进行一个汇总分类的有关测试申请单的测试申请汇总面板,
 *    还可以点击跳转到对应的测试申请单」;
 *   补充确认:「内部和销售端放在同一张表里查询,按申请人分组,列按你拟的」。
 *
 * 【数据源取证(2026-11-19,本机 + 生产库只读查询)】
 *   「内部委托-测试申请单」「销售端-测试/检测申请表」**不是两张面板**,而是同一张
 *   `RD_DOM_TEST`(测试申请单,yj_panel 实测存在)的三个页签中的前两个 ——
 *   两张申请表共用行表 `rd_dom_test_detail`,靠物理列 `[表区]` 分块
 *   (`内部申请` / `外部申请`,见 tools/migrate-rd-test-apply.sql)。
 *   ⇒ 汇总=同表合并查询,申请人兜底链:申请人(内部) → 发起人(销售端) → 委托人 → 业务员。
 *
 * 【为什么用源码断言】这条链跨 后端 service/controller + 前端页面/路由/菜单 + 真实数据库字段;
 *   mount 端到端成本过高,而这类回归的典型形态是「有人把某段删了/把列序改了」——源码断言正好钉住。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { menuTree } from '../../../business/menus.js'

const root = new URL('../../../../../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

const svc = read('backend/src/main/java/com/yinjia/mes/service/TestApplySummaryService.java')
const pxCtl = read('backend/src/main/java/com/yinjia/mes/controller/PxController.java')
const page = read('frontend/src/views/modules/qc/TestApplySummary.vue')
const router = read('frontend/src/router/index.js')

/** 取一段源码(含起止标记之间),标记找不到直接判失败(而不是静默返回空串) */
function between(text, startMark, endMark) {
  const i = text.indexOf(startMark)
  assert.ok(i >= 0, `源码里找不到标记: ${startMark}`)
  const j = text.indexOf(endMark, i + startMark.length)
  assert.ok(j > i, `源码里找不到结束标记: ${endMark}`)
  return text.slice(i + startMark.length, j)
}

/** 从一段源码里按出现顺序取出所有引号内字符串 */
const quoted = (s, q) => [...s.matchAll(new RegExp(`\\${q}([^\\${q}]*)${q.replace(/'/g, "'")}`, 'g'))].map((m) => m[1])

/** 期望列序(用户口径「列按你拟的」;两张申请表合并后,申请人/申请类型必须显式区分来源) */
const EXPECTED_COLUMNS = [
  '单据日期', '单据编号', '申请人', '申请类型', '样品名称', '样品型号/规格',
  '样品数量', '检测项目', '检测项目数', '收费合计', '单据状态', '面板码',
]

test('① 后端只读接口:GET /api/px/testApplySummary + requirePanelView(RD_DOM_TEST)', () => {
  const hits = pxCtl.match(/@GetMapping\("\/testApplySummary"\)/g) || []
  assert.equal(hits.length, 1, 'PxController 里应有且只有一个 GET /testApplySummary')
  const seg = between(pxCtl, '@GetMapping("/testApplySummary")', '\n    @')
  assert.match(seg, /requirePanelView\("RD_DOM_TEST"\)/,
    '接口必须按测试申请单面板码做查看权校验(与列表页/单据同源,不新造页面级虚拟码)')
  assert.match(seg, /testApplySummary/, '接口要调用汇总服务,而不是把 SQL 写在 controller 里')
  // 只读:服务实现里不得出现任何写语句(摘要/汇总不该动业务数据)
  assert.ok(!/(INSERT\s+INTO|UPDATE\s+dbo\.|DELETE\s+FROM|MERGE\s+INTO)/i.test(svc),
    'TestApplySummaryService 必须只读(不得 INSERT/UPDATE/DELETE)')
})

test('② 数据源 = 测试申请单头×行(内部申请与外部申请同表合并),申请人按字段存在性兜底', () => {
  assert.match(svc, /rd_dom_test_head/, '取数要读测试申请单头表')
  assert.match(svc, /rd_dom_test_detail/, '取数要读测试申请单行表(两张申请表共用这一张)')
  assert.match(svc, /yj_doc_status/, '单据状态真源是 yj_doc_status(与列表页/审批同源)')
  // 申请人字段两张申请表不同:内部申请写「申请人」,销售端写「发起人」⇒ 兜底候选必须都在,且按此顺序
  const cand = between(svc, 'APPLICANT_CANDIDATES = {', '};')
  const fields = quoted(cand, '"')
  assert.deepEqual(fields.slice(0, 4), ['申请人', '发起人', '委托人', '业务员'],
    '申请人兜底链:申请人(内部) → 发起人(销售端) → 委托人 → 业务员')
  // 两张申请表的表区值都要进查询(否则「内部和销售端放同一张表」只剩一半)
  assert.ok(svc.includes('内部申请') && svc.includes('外部申请'), '两个表区值都要出现在取数口径里')
  // 取不到申请人时归入同一个可读分组,而不是丢行
  assert.match(svc, /未填申请人/)
})

test('③ 列契约:后端 SUMMARY_COLUMNS 与前端 SUMMARY_COLUMNS 同序同值', () => {
  const javaCols = quoted(between(svc, 'SUMMARY_COLUMNS = {', '};'), '"')
  const vueCols = quoted(between(page, 'const SUMMARY_COLUMNS = [', ']'), "'")
  assert.deepEqual(javaCols, EXPECTED_COLUMNS, '后端列序(前端/导出/测试三方同源)')
  assert.deepEqual(vueCols, javaCols, '前端列序必须与后端逐字同序 —— 改一处必须同步另一处')
  assert.equal(javaCols[javaCols.length - 1], '面板码', '末列=面板码(点击跳转用)')
})

test('④ 前端页面:GET 取数 + 两个页签 + 六项 KPI + 展开 + 导出 Excel', () => {
  assert.ok(page.includes('/px/testApplySummary'), '页面调 GET /api/px/testApplySummary')
  assert.match(page, /request\.get\(/, '汇总查询是 GET(只读接口,带 query 参数)')
  assert.ok(page.includes('按申请人') && page.includes('按单据'), '两个页签:按申请人 / 按单据')
  assert.ok(page.includes('type="expand"'), '按申请人表格要能展开该人的单据')
  assert.match(page, /导出 Excel/, '要有导出 Excel')
  assert.match(page, /import\('xlsx'\)/, '导出走前端 xlsx(与自制料查询同一套,不新增后端导出端点)')
  // KPI 六项(与后端「汇总」键一一对应)
  for (const k of ['申请人数', '申请单据数', '检测项目项次', '收费合计', '已审核单数', '待处理单数']) {
    assert.ok(page.includes(k), `KPI 口径缺 ${k}`)
  }
  // 状态列走 yj_doc_status 的五档,页面按同五档上色/筛选
  for (const s of ['草稿', '审批中', '已审核', '已作废', '已中止']) {
    assert.ok(page.includes(s), `状态词缺 ${s}`)
  }
})

test('⑤ 点单号跳转:/panelx/list/RD_DOM_TEST?focus=<单号>(无查看权只提示)', () => {
  assert.ok(page.includes('/panelx/list/${PANEL_CODE}'), '跳转路径按面板码拼 /panelx/list/<panelCode>')
  assert.ok(page.includes('focus:'), '用 ?focus=<单号> 定位该单(PanelxList 的深链口径)')
  assert.ok(page.includes('canViewPanel'), '跳转前要预检目标面板查看权(没有就只提示不跳)')
  // 路由:静态路由(带 panelCode 的菜单项不进 flatMenus 自动路由)
  const routeLine = between(router, "path: 'qc/testApplySummary'", '} },')
  assert.ok(routeLine.includes('TestApplySummary.vue'), '路由要指向新页面')
  assert.match(routeLine, /panelCode: 'RD_DOM_TEST'/, 'meta.panelCode 用测试申请单面板码')
})

test('⑥ 菜单:紧贴「测试申请单」,不新造重复分组(品质管理下没有测试申请分组)', () => {
  const rd = menuTree.find((n) => n.code === 'rd')
  const lab = rd.children.find((c) => c.code === 'rdTest').children.find((c) => c.code === 'rdLab')
  const titles = (lab.children || []).map((c) => c.title)
  const i = titles.indexOf('测试申请单')
  assert.ok(i >= 0, '「测试申请单」必须还在实验室使用记录表组里')
  assert.equal(titles[i + 1], '测试申请汇总表', '汇总表紧跟「测试申请单」(同一数据源,同一面板码)')
  const leaf = lab.children[i + 1]
  assert.equal(leaf.path, '/qc/testApplySummary', '页面级视图走专用路由,不是 /panelx/list')
  assert.equal(leaf.panelCode, 'RD_DOM_TEST', '权限复用测试申请单(看得到那张单的人才看得到汇总)')
  // 品质管理下不得另挂一个同名入口(否则侧栏两个「测试申请汇总表」)
  const qcJson = JSON.stringify(menuTree.find((n) => n.code === 'qc'))
  assert.ok(!qcJson.includes('测试申请汇总表'), '品质管理下不应重复挂入口')
  const all = JSON.stringify(menuTree)
  assert.equal(all.split('测试申请汇总表').length - 1, 1, '全树只允许一个「测试申请汇总表」入口')
})
