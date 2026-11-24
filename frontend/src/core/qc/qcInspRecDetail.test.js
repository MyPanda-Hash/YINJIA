import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { QC_REC_DETAIL_PANEL, QC_REC_DETAIL_LINKS, QC_REC_DETAIL_REOPEN } from './qcInspRecDetail.js'

/**
 * 检验数据记录明细表(QC_INSP_REC_DETAIL)—— 列表页呈现契约的回归。
 *
 * 【为什么有这份闸】这张表的两处渲染(单号可点跳转 + 行内「取消完成」)在 2026-11-11 就交付过
 * (commit 6cf9aea6c),却在 **merge 9e8e5db2c(2026-11-13「合并 origin/main(LF 云端) 到本地分支」)
 * 里被整段丢掉** —— 常量 qcInspRecDetail.js 一直都在,只有 PanelxList 里的渲染与动作没了。
 * 界面上表现为:明细表单号点不动、行内没有「取消完成」,而 QcCatalogService.assertLinkedRowNotCompleted
 * 的报错却让用户去这张表点那个按钮(死路)。2026-11-24 按原实现恢复,并用本文件钉住:
 *   ① 两个挂靠单号列 → 目标面板的映射只能改 qcInspRecDetail.js;
 *   ② 常量必须真的接到渲染方(不允许再出现"契约在、功能不在");
 *   ③ 行内「取消完成」走 QC_CATALOG 的「修改」按钮,取参 = 目录单号 + 目录行id;
 *      点了之后目录行回弹成「正在检验中」⇒ 该行离开本表(statusGate 只放行已完成)并回到待检验目录。
 */

const SRC = readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8')

test('单号 → 目标面板映射:检验数据记录单号→QC_INSP_REC / 来料检验单号→QC_INSP', () => {
  assert.deepEqual({ ...QC_REC_DETAIL_LINKS }, {
    来料检验单号: 'QC_INSP',
    检验数据记录单号: 'QC_INSP_REC',
  })
  assert.equal(QC_REC_DETAIL_PANEL, 'QC_INSP_REC_DETAIL')
})

test('行内「取消完成」取参口径:目录面板 QC_CATALOG 的「修改」按钮 + 目录行id', () => {
  assert.equal(QC_REC_DETAIL_REOPEN.catalogPanel, 'QC_CATALOG')
  assert.equal(QC_REC_DETAIL_REOPEN.buttonName, '修改')
  assert.equal(QC_REC_DETAIL_REOPEN.docField, '目录单号')
  assert.equal(QC_REC_DETAIL_REOPEN.rowIdField, '目录行id')
  assert.equal(QC_REC_DETAIL_REOPEN.statusField, '检验状态')
  assert.equal(QC_REC_DETAIL_REOPEN.doneStatus, '已完成检验')
})

test('列表页必须 import 这份契约常量(不允许再出现"常量没人用")', () => {
  assert.match(SRC, /import\s*\{[^}]*QC_REC_DETAIL_LINKS[^}]*\}\s*from\s*'@core\/qc\/qcInspRecDetail'/)
  assert.match(SRC, /import\s*\{[^}]*QC_REC_DETAIL_REOPEN[^}]*\}\s*from\s*'@core\/qc\/qcInspRecDetail'/)
  assert.match(SRC, /import\s*\{[^}]*QC_REC_DETAIL_PANEL[^}]*\}\s*from\s*'@core\/qc\/qcInspRecDetail'/)
})

test('两个单号列渲染成可点跳转(.doc-no-link + gotoLinkedDoc),目标面板取自契约', () => {
  const at = SRC.indexOf('v-else-if="qcRecLinkPanel(column.prop)')
  assert.ok(at > 0, '缺单号跳转的单元格分支')
  const cell = SRC.slice(at, SRC.indexOf('/>', at))
  assert.ok(cell.includes('class="doc-no-link"'), '必须是可点单号样式')
  assert.ok(cell.includes('@click.stop="gotoLinkedDoc(row[column.prop], qcRecLinkPanel(column.prop))"'), '点击要跳转')
  assert.ok(cell.includes("tt('点击跳转到该单据')"), '需要有可点提示(title)')
  // 跳转实现:过面板查看权 + ?docNo= 定位
  const fnAt = SRC.indexOf('function gotoLinkedDoc(')
  assert.ok(fnAt > 0, '缺 gotoLinkedDoc')
  const fn = SRC.slice(fnAt, SRC.indexOf('\n}', fnAt))
  assert.ok(fn.includes('canViewPanel('), '缺权限判定(报表不能当跳板绕过授权)')
  assert.ok(fn.includes('query: { docNo: v }'), '必须以 ?docNo= 定位目标单据')
})

test('行内「取消完成」列:只在「已完成检验」的行出按钮,点击回弹目录行', () => {
  assert.match(SRC, /<el-table-column v-if="qcRecDetailReopen"[^>]*>[\s\S]{0,700}reopenCatalogRow\(row\)/)
  const at = SRC.indexOf('async function reopenCatalogRow(')
  assert.ok(at > 0, '缺 reopenCatalogRow')
  const fn = SRC.slice(at, SRC.indexOf('\n}', at))
  assert.ok(fn.includes('cfg.catalogPanel'), '面板码必须取自契约(QC_CATALOG)')
  assert.ok(fn.includes('cfg.buttonName'), '按钮名必须取自契约(修改)')
  assert.ok(fn.includes('formData: { 编号: docNo, id: rowId }'), '必须带目录单号 + 目录行id')
  assert.ok(fn.includes('await load()'), '成功后要重取列表(该行已被 statusGate 滤掉)')
  // 状态判定走契约常量,不得裸写「已完成检验」
  const colAt = SRC.indexOf('<el-table-column v-if="qcRecDetailReopen"')
  const col = SRC.slice(colAt, SRC.indexOf('</el-table-column>', colAt))
  assert.ok(col.includes('QC_REC_DETAIL_REOPEN.statusField'), '状态列名要取契约')
  assert.ok(col.includes('QC_REC_DETAIL_REOPEN.doneStatus'), '完成态要取契约')
})

test('英文词条齐备(AGENTS §2.1:新增 UI 文案必须有 en)', () => {
  const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')
  for (const key of [
    '取消完成',
    '操作',
    '取消完成并回弹为正在检验中（之后才可反审核挂靠的检验单与检验数据记录）',
    '取消完成后该目录行回到「正在检验中」（会重新出现在待检验目录里），之后才可反审核挂靠的检验单与检验数据记录。确定取消完成吗？',
    '已取消完成（已写入修改记录）',
    '该行没有关联的检验目录记录，无法取消完成',
  ]) {
    assert.ok(en.includes(`'${key}'`), `en.js 缺词条: ${key}`)
  }
})
