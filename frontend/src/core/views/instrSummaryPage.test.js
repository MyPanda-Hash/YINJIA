/**
 * 仪器使用汇总表 —— 独立页面契约(2026-11-20)
 *
 * 用户口径:「为当前的试验仪器记录表创建一个汇总表,汇总表需要查看的内容如图1所示。
 *   汇总表实现可以参考样品检验汇总表」;追问落点后:「不要这个页签,同时(第2项)按照独立页面完成」。
 *
 * 本测试钉住四层契约(页面配置/取数/导出/权限),都是"改一处漏一处就静默失效"的点:
 *   · 页面 = views/modules/rd/InstrSummary.vue,路由 /rd/instrSummary,面板码 INSTR_SUMMARY;
 *   · 表格列 = 用户图样的 9 列且**顺序一致**;
 *   · 行可勾选,导出时只带勾中的 记录id(不勾 = 全部);
 *   · 后端 = /px/instrSummary/summary|export,纸面导出有跨列大标题「实验室仪器使用记录表」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../../views/modules/rd/InstrSummary.vue', import.meta.url), 'utf8')
const router = readFileSync(new URL('../../router/index.js', import.meta.url), 'utf8')
const menus = readFileSync(new URL('../../business/menus.js', import.meta.url), 'utf8')
const controller = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/InstrSummaryController.java', import.meta.url), 'utf8')
const service = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/InstrSummaryService.java', import.meta.url), 'utf8')
const registry = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PagePanelRegistry.java', import.meta.url), 'utf8')
const perm = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelPermissionService.java', import.meta.url), 'utf8')

/** 用户图样的 9 列(顺序即纸面顺序) */
const WANT_COLS = ['仪器名称/型号', '日期', '起止时间', '仪器状态', '是否内校', '项目名称/内容', '数量', '使用人', '备注']

test('页面/路由/菜单三处都指向同一面板码 INSTR_SUMMARY', () => {
  assert.match(router, /path: 'rd\/instrSummary'/, '缺 /rd/instrSummary 路由')
  assert.match(router, /views\/modules\/rd\/InstrSummary\.vue/, '路由要指向新页面')
  const routeLine = router.slice(router.indexOf("path: 'rd/instrSummary'"))
  assert.match(routeLine.slice(0, 400), /panelCode: 'INSTR_SUMMARY'/, '路由必须带 panelCode(守卫据此拦无权限)')
  // 菜单挂在 研发管理 › 测试记录 › 实验室使用记录表 下,紧跟「仪器使用记录表」
  assert.match(menus, /code: 'rdInstrSummary'[^\n]*path: '\/rd\/instrSummary'[^\n]*panelCode: 'INSTR_SUMMARY'/)
  assert.ok(menus.indexOf("code: 'rdInstrSummary'") > menus.indexOf("code: 'rdInstrUse'"),
    '菜单顺序:仪器使用汇总表要排在仪器使用记录表之后')
})

test('表格列 = 用户图样的 9 列且顺序一致', () => {
  const table = page.slice(page.indexOf('<el-table ref="tableRef"'), page.indexOf('</el-table>'))
  assert.ok(table.length > 0, '没找到记录表')
  let last = -1
  for (const col of WANT_COLS) {
    const at = table.indexOf(`:label="tt('${col}')"`)
    assert.ok(at > 0, `缺列「${col}」`)
    assert.ok(at > last, `列「${col}」顺序不对(应按用户图样从左到右)`)
    last = at
  }
  // 排序/分页:日期可排序;超过一页时前端分页(整表 5000 行不可能一次渲染完)
  assert.match(table, /prop="日期"[^\n]*sortable/, '日期列要可排序')
  assert.match(page, /el-pagination/, '行多时要有分页')
})

test('行可勾选:导出只带勾中的 记录id,不勾 = 全部', () => {
  assert.match(page, /<el-table-column type="selection"/, '缺勾选列')
  assert.match(page, /@selection-change="onSelection"/, '缺勾选变化处理')
  assert.match(page, /row-key="记录id"/, '行键必须是记录 id(否则勾选跨页会错行)')
  assert.match(page, /reserve-selection/, '跨页勾选要保留选择')
  assert.match(page, /const picked = selectedRows\.value\.map\(\(r\) => r\['记录id'\]\)/, '导出要取勾中的记录 id')
  assert.match(page, /if \(picked\.length\) body\['记录id'\] = picked/, '勾选非空时导出请求要带 记录id')
  // 重新查询必须清勾选:否则会导出"当前屏幕上已经看不见的行"
  assert.match(page, /async function load\(\)[\s\S]{0,600}clearSelection\(\)/, '查询前置要清勾选')
})

test('后端:两个端点 + 页面级面板权限 + 导出词', () => {
  assert.match(controller, /@PostMapping\("\/summary"\)/, '缺 /summary')
  assert.match(controller, /@PostMapping\("\/export"\)/, '缺 /export')
  assert.match(controller, /requirePanelView\(PagePanelRegistry\.INSTR_SUMMARY\)/, '取数要校验页面查看权')
  assert.match(controller, /requireButton\(PagePanelRegistry\.INSTR_SUMMARY, "导出"\)/, '导出要校验「导出」词')
  assert.match(registry, /public static final String INSTR_SUMMARY = "INSTR_SUMMARY"/, '面板码未登记')
  assert.match(registry, /new PagePanelDef\(INSTR_SUMMARY, "仪器使用汇总表", "研发管理"/, '面板定义/分组未登记')
  assert.match(perm, /INSTR_SUMMARY \+ "\|导出"[^\n]*"export"/, '按钮导出词未映射')
})

test('取数口径:明细×表头、明细优先、作废过滤、日期 ISDATE 兜底', () => {
  assert.match(service, /FROM dbo\.rd_instr_use_detail d/, '行表来源')
  assert.match(service, /JOIN dbo\.rd_instr_use_head h ON h\.\[单据编号\] = d\.\[单据编号\]/, '头表关联')
  assert.match(service, /ISNULL\(d\.asp_cancel, N'N'\) <> N'Y'/, '行作废过滤')
  assert.match(service, /ISNULL\(h\.asp_cancel, N'N'\) <> N'Y'/, '头作废过滤')
  assert.match(service, /NULLIF\(LTRIM\(RTRIM\(d\.\[仪器名称\/型号\]\)\)/, '仪器名优先取明细行')
  assert.match(service, /NULLIF\(LTRIM\(RTRIM\(d\.\[使用日期\]\)\)/, '日期优先取明细使用日期')
  assert.match(service, /ISDATE\(/, 'nvarchar 日期要用 ISDATE 兜底')
  // 9 列常量顺序 = 用户图样(取数组字面量本身,别把后面的字符串算进来)
  const colsAt = service.indexOf('public static final String[] COLS')
  const colsSeg = service.slice(colsAt, service.indexOf('};', colsAt))
  assert.deepEqual([...colsSeg.matchAll(/"([^"]+)"/g)].map((m) => m[1]), WANT_COLS)
})

test('导出纸面版式:跨列大标题 + 表头 + 记录行,支持只导所选', () => {
  assert.match(service, /实验室仪器使用记录表/, '缺纸面大标题')
  assert.match(service, /addMergedRegion\(new CellRangeAddress\(0, 0, 0, COLS\.length - 1\)\)/, '大标题要跨 9 列合并')
  assert.match(service, /for \(int i = 0; i < COLS\.length; i\+\+\) \{[\s\S]{0,120}c\.setCellValue\(COLS\[i\]\)/, '表头按 COLS 顺序')
  assert.match(service, /pickedIds\(body\)/, '导出要识别勾选行')
  assert.match(service, /picked\.contains\(idOf\(/, '按勾选过滤行')
  assert.match(service, /out\.add\(r\)/, '按勾选过滤行')
  assert.match(service, /setLandscape\(true\)/, '纸面横向(A4 一页宽,用户图样是一整行 9 列)')
})
