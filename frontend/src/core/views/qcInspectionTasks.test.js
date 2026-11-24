/**
 * qcInspectionTasks.test.js —— 2026-11-23 品质单据六项修订的回归钉子。
 *
 * 用户口径(原话):
 *   1)「当这个新增批次号后，填写内容到下面这个位置了」⇒ 出货检验明细数据格顶对齐 + 项目行全局归并
 *   2)「增加未检验的筛选。然后能看到需要检验和没有检验的」⇒ 生产工序进度看板「检验状态」筛选
 *   3)「这每个责任人都是不同的责任人，而不是作为同一个责任人」⇒ QC_BHC 五段责任人独立列
 *   4)「时间取填写提交日期」⇒ QC_BHC 右上「时间」= 提交审批时间戳(含时分)
 *   5)「这个客户名称不显示修改为产品编码」⇒ QC_BHC 左侧目录列换成产品编码
 *   7)「增加当前出货检验两个表的明细表，实现方式参考检验数据记录明细表」⇒ 两张 flat 只读明细表
 *
 * 这里只钉**能静态判定**的契约(源码/SQL/菜单)；渲染效果由 ego 实测截图取证。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { menuTree } from '../../business/menus.js'
import { qcSheetCfgs } from './docSheetConfigs.js'

const SQL_BHC = readFileSync(
  new URL('../../../../tools/migrate-qc-bhc-resp-per-section-20261123.sql', import.meta.url), 'utf8')
const SQL_DETAIL = readFileSync(
  new URL('../../../../tools/migrate-qc-insp-detail-panels-20261123.sql', import.meta.url), 'utf8')
const BOARD = readFileSync(
  new URL('../../views/modules/plan/WorkOrderProgressBoard.vue', import.meta.url), 'utf8')
const PROGRESS_SVC = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/WorkOrderProgressService.java', import.meta.url), 'utf8')
const QUERY_SVC = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java', import.meta.url), 'utf8')
const LIST = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('③ QC_BHC 五段责任人独立列:迁移 5 列 + 5 yj_field + 译名,纸面 signKey 各绑各的', () => {
  for (const col of ['问题描述责任人', '原因分析责任人', '性能验证责任人', '处理意见责任人', '改善效果验证责任人']) {
    assert.ok(SQL_BHC.includes(`N'${col}'`), `迁移缺列 ${col}`)
    assert.ok(SQL_BHC.includes(`ADD [${col}] nvarchar(100) NULL`), `迁移缺 ADD ${col}`)
    assert.ok(SQL_BHC.includes(`(N'QC_BHC', N'${col}', N'${col}', N'文本'`), `迁移缺 yj_field ${col}`)
  }
  const signs = qcSheetCfgs.QC_BHC.rows.filter((r) => r.signKey).map((r) => r.signKey)
  assert.equal(new Set(signs).size, signs.length, 'QC_BHC 责任人签名键不得重复')
  assert.equal(signs.length >= 5, true, 'QC_BHC 至少五段落款各有签名键')
  // 表头「责任人」仍是业务责任人列(不能被替换掉)
  assert.ok(qcSheetCfgs.QC_BHC.rows.some((r) => r.cells?.some((c) => c.key === '责任人')))
})

test('④ QC_BHC 右上「时间」= 提交审批时间戳(含时分),后端派生只读', () => {
  const time = qcSheetCfgs.QC_BHC.info.find((i) => i.label === '时间')
  assert.equal(time.key, '提交时间')
  assert.equal(time.kind, 'head-static')
  assert.match(QUERY_SVC, /DOC_SUBMIT_TIME_PANELS = java\.util\.Set\.of\("QC_BHC", "QC_BHCP"\)/,
    '制程与成品两张不合格品处理单都要派生「提交时间」')
  assert.match(QUERY_SVC, /ofPattern\("yyyy-MM-dd HH:mm"\)/)
  assert.match(QUERY_SVC, /pending_at.*shsj.*firstSave/s, '必须是 提交时间 → 审核时间 → 首次填写 的回退链')
})

test('⑤ QC_BHC 左侧目录:客户名称列换成产品编码', () => {
  assert.match(LIST, /QC_BHC: \['产品编码'\]/)
  assert.doesNotMatch(LIST, /QC_BHC: \['客户名称', '产品编码'\]/)
})

test('② 生产工序进度看板:「检验状态」筛选 = 全部检验/未检验/已检验,服务端按质检状态过滤', () => {
  for (const label of ['全部检验', '未检验', '已检验']) {
    assert.ok(BOARD.includes(`label: '${label}'`), `看板缺筛选项「${label}」`)
  }
  assert.match(BOARD, /payload\['检验状态'\] = qcFilter\.value/)
  assert.match(PROGRESS_SVC, /String qcState = nz\(str\(b\.get\("检验状态"\)\)\)/)
  assert.match(PROGRESS_SVC, /qcMatches\(r, want\)/)
  assert.match(PROGRESS_SVC, /"无需检验"\.equals\(s\)\) return false/)
})

test('⑦ 出货检验两张明细表:2 视图 + 2 flat 面板 + 字段/授权/译名;菜单入口紧跟两张单', () => {
  for (const view of ['v_qc_proc_insp_detail', 'v_qc_asm_insp_detail']) {
    assert.ok(SQL_DETAIL.includes(`CREATE OR ALTER VIEW dbo.${view}`), `缺视图 ${view}`)
  }
  for (const panel of ['QC_PROC_INSP_DETAIL', 'QC_ASM_INSP_DETAIL']) {
    assert.ok(SQL_DETAIL.includes(`N'${panel}'`), `缺面板 ${panel}`)
  }
  assert.ok(SQL_DETAIL.includes("N'报表', N'flat'"))
  assert.ok(SQL_DETAIL.includes('yj_role_panel'))
  assert.ok(SQL_DETAIL.includes('yj_translation'))
  const qc = menuTree.find((n) => n.code === 'qc')
  const group = (qc.children || []).find((c) => c.code === 'qcProcess')
  const codes = (group.children || []).map((c) => c.panelCode)
  const iAsm = codes.indexOf('QC_ASM_INSP')
  assert.equal(codes[iAsm + 1], 'QC_PROC_INSP_DETAIL')
  assert.equal(codes[iAsm + 2], 'QC_ASM_INSP_DETAIL')
})

test('查询对话框:内容超高时限高 + 内容区滚动,页脚「查询」不被顶出视口(鼠标实测发现)', () => {
  // 2026-11-23 鼠标实测:12 个查询条件 + 高级筛选比 656px 视口高,页脚按钮在视口外
  // (elementFromPoint 命中 null、page.click 报 html intercepts pointer events) ⇒ 点不到「查询」。
  assert.match(LIST, /:global\(\.header-query-dialog\)[\s\S]*?max-height:\s*calc\(100vh - 32px\)/)
  assert.match(LIST, /:global\(\.header-query-dialog \.el-dialog__body\)[\s\S]*?overflow-y:\s*auto/)
  assert.match(LIST, /:global\(\.header-query-dialog \.el-dialog__footer\)[\s\S]*?flex:\s*none/)
})
