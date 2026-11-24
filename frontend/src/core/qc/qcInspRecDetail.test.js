import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { QC_REC_DETAIL_PANEL, QC_REC_DETAIL_LINKS, QC_REC_DETAIL_REOPEN } from './qcInspRecDetail.js'

/**
 * 检验数据记录明细表(QC_INSP_REC_DETAIL)—— 列表页呈现契约的回归。
 *
 * 守的线(2026-11-24 用户报障「明细表也可以直接索引」)：
 *   ① 两个挂靠单号列 → 目标面板的映射只能改这里，不能散进 16k 行的 PanelxList；
 *   ② 常量**必须真的接到渲染方**：此前 QC_REC_DETAIL_LINKS 定义了却没有任何 import，
 *      界面上单号是纯文本、点不动 —— 只有源码级断言能抓住这种"契约在、功能不在"；
 *   ③ 点号即跳转(用户口径：不要图标、不要二次确认)，所以渲染分支必须是 .doc-no-link +
 *      openReportDocLink，而不是条码面板那个带弹窗的 openDocNoDialog。
 */

const SRC = readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8')

test('单号 → 目标面板映射:检验数据记录单号→QC_INSP_REC / 来料检验单号→QC_INSP', () => {
  assert.deepEqual({ ...QC_REC_DETAIL_LINKS }, {
    来料检验单号: 'QC_INSP',
    检验数据记录单号: 'QC_INSP_REC',
  })
  assert.equal(QC_REC_DETAIL_PANEL, 'QC_INSP_REC_DETAIL')
  // 行内「取消完成」的取参口径(后端仍是待检验目录的「修改」按钮)
  assert.equal(QC_REC_DETAIL_REOPEN.catalogPanel, 'QC_CATALOG')
  assert.equal(QC_REC_DETAIL_REOPEN.rowIdField, '目录行id')
})

test('列表页必须 import 这份契约常量(不允许再出现"常量没人用")', () => {
  assert.match(SRC, /import\s*\{[^}]*QC_REC_DETAIL_LINKS[^}]*\}\s*from\s*'@\/core\/qc\/qcInspRecDetail'/)
  assert.match(SRC, /import\s*\{[^}]*QC_REC_DETAIL_PANEL[^}]*\}\s*from\s*'@\/core\/qc\/qcInspRecDetail'/)
})

test('报表单元格分支:登记过的单号列渲染成 .doc-no-link 且直接跳转(不弹窗)', () => {
  const at = SRC.indexOf('v-else-if="reportDocLinkPanel(column.prop)')
  assert.ok(at > 0, '缺单号直索引的单元格分支')
  const cell = SRC.slice(at, SRC.indexOf('/>', at))
  assert.ok(cell.includes('class="doc-no-link"'), '必须是可点单号样式')
  assert.ok(cell.includes('@click.stop="openReportDocLink(row, column.prop)"'), '点击要直接跳转')
  assert.ok(!cell.includes('openDocNoDialog'), '单号直索引不应弹窗(用户口径:不要二次确认)')
  assert.ok(cell.includes("tt('点击跳转到该单据')"), '需要有可点提示(title)')
})

test('跳转:过面板查看权限(报表不能当跳板绕过授权)+ 带 ?docNo= 定位', () => {
  const at = SRC.indexOf('function openReportDocLink(')
  assert.ok(at > 0, '缺 openReportDocLink')
  const fn = SRC.slice(at, SRC.indexOf('\n}', at))
  assert.ok(fn.includes('canViewPanel('), '缺权限判定')
  assert.ok(fn.includes('query: { docNo: no }'), '必须以 ?docNo= 定位目标单据')
  assert.ok(fn.includes('/panelx/list/${target}'), '必须跳到目标面板')
})

test('按单号打开落空时:提示按真实单据状态说清原因(已作废),不能只给笼统文案', () => {
  assert.match(SRC, /async function loadDocNoTarget\(\)[\s\S]{0,400}await missingDocHint\(no\)/)
  const at = SRC.indexOf('async function missingDocHint(')
  assert.ok(at > 0, '缺 missingDocHint')
  const fn = SRC.slice(at, SRC.indexOf('\n}', at))
  assert.ok(fn.includes("status.includes('作废')"), '已作废要说清是作废')
  assert.ok(fn.includes("tt('该单据已作废,作废单不进入列表')"), '缺已作废文案')
  // 不存在的单号也会返回一张「新单默认抬头」(草稿)——不得被当成真实状态
  assert.ok(fn.includes('SHELL_KEYS'), '必须排除接口合成的空抬头')
  assert.ok(fn.includes("tt('未找到该单据（可能已作废或没有查看权限）')"), '缺通用兜底文案')
})

test('英文词条齐备(AGENTS §2.1:新增 UI 文案必须有 en)', () => {
  const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')
  for (const key of ['该单据已作废,作废单不进入列表', '当前状态为']) {
    assert.ok(en.includes(`'${key}'`), `en.js 缺词条: ${key}`)
  }
})
