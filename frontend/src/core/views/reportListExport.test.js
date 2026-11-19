/**
 * reportListExport.test.js —— 报工记录「勾选行 → 导出报表 Excel」的渲染层护栏(2026-11-19)
 *
 * 【用户口径】
 *   「报工记录需要可以选择出所选行导出 Excel,就是当前的导出报表需要实现,但是需要增加勾选行。」
 *   ⇒ 报工记录(WO_REPORT_LIST)是平表,没有 .jrxml 模板;「导出报表」改为前端 xlsx:
 *     勾选行 → 只导这些行;未勾选 → 导当前查询结果全部行。
 *
 * 【为什么读源码钉住】
 *   组件依赖 Element Plus / CSS,node --test 挂不起来;仓库既有做法就是读源码守规则
 *   (reportListDateRange.test.js / docSheetWidth.test.js 同款)。真正的导出内容已在 ego 浏览器
 *   实测(勾 2 行导出的 xlsx 只有 2 行数据 + 13 个可见列)。
 *
 * 【不可回退点】
 *   A. 勾选列只给 WO_REPORT_LIST,别的报表面板行为零变化;
 *   B. 导出弹窗在报工记录下必须出「勾选行 / 全部当前结果」两个入口,不能退回服务端单据报表;
 *   C. 导出列必须取当前可见列(reportColumnTree 叶子),行必须取当前排序/筛选后的 reportList;
 *   D. 「导出报表」按钮对报工记录不再要求管理员(它已经不走服务端模板)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('勾选列只给报工记录(WO_REPORT_LIST),其它报表面板不出现', () => {
  assert.match(vue, /const reportListSelectable = computed\(\(\) => String\(panelCode\.value \|\| ''\) === 'WO_REPORT_LIST'\)/,
    'reportListSelectable 必须只认 WO_REPORT_LIST')
  assert.match(vue, /<el-table-column v-if="reportListSelectable" type="selection"/,
    '报工记录报表表必须有勾选列,且由 reportListSelectable 守门')
  assert.match(vue, /@selection-change="\(rows\) => \(reportChecked = rows\)"/,
    '勾选状态必须接住 el-table 的 selection-change')
})

test('导出报表弹窗:报工记录走「勾选行 / 全部当前结果」,其它面板仍走服务端模板', () => {
  const seg = vue.slice(vue.indexOf('<el-dialog v-model="reportVisible"'), vue.indexOf('<!-- ═══ 报表模板管理'))
  assert.match(seg, /<template v-if="reportListSelectable">/, '报工记录必须有独立分支')
  assert.match(seg, /exportReportExcel\(true\)/, '勾选行入口必须 exportReportExcel(true)')
  assert.match(seg, /exportReportExcel\(false\)/, '全部入口必须 exportReportExcel(false)')
  assert.match(seg, /<template v-else>/, '其它面板必须保留原有 PDF/打印预览/Excel 模板分支')
  assert.match(seg, /downloadReport\('xlsx'\)/, '原有服务端 Excel 入口不能被删掉')
})

test('导出内容取当前可见列 + 当前排序/筛选结果;勾选行必须仍在本页结果里', () => {
  const fn = vue.slice(vue.indexOf('async function exportReportExcel'), vue.indexOf('async function exportReportExcel') + 3000)
  assert.match(fn, /reportColumnTree\.value/, '列必须取当前可见列表(reportColumnTree)')
  assert.match(fn, /c\.children/, '分组表头要摊平成叶子列')
  assert.match(fn, /reportList\.value/, '行必须取当前排序/筛选后的 reportList')
  assert.match(fn, /reportCheckedRows\.value/, '勾选行入口必须用当前结果里的勾选行(reportCheckedRows)')
  assert.match(fn, /pool\.includes\(r\)/, '勾选行必须过滤掉已不在当前结果里的行')
  assert.match(fn, /XLSX\.utils\.aoa_to_sheet/, '必须用 xlsx 生成真正的 .xlsx')
  assert.match(fn, /请先勾选要导出的行/, '勾 0 行时给提示,不得静默导全部')
})

test('导出报表入口:报工记录不再要求管理员(它不走服务端模板)', () => {
  const hits = vue.match(/reportListSelectable \|\| reportTemplates\.length \|\| user\.isAdmin/g) || []
  assert.ok(hits.length >= 2, `工具栏与侧栏两个入口都要放开报工记录(实际 ${hits.length} 处)`)
})
