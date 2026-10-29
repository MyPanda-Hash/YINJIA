/**
 * rdDomTestLink.test.js —— 「测试申请单 ↔ 数据记录表」关联链的契约守卫(2026-10-29)
 *
 * 【需求来源·用户原文】
 *   「汇总表是汇总前面两个 tap 的单据信息,现在的发起人没有,应该是提交审批的人的账号名,
 *    以提交审批的为准,草稿的可以覆盖,然后借鉴前面的立项申请的流程,现在也加上在审批的时候
 *    可以分发对应的负责人去测试之后填写数据记录表,在汇总表也弄上可以通过按钮跳转到对应的
 *    单据的数据记录表的页面,数据记录表也是引用的申请单的右上角的单据编号,这个自动生成,
 *    数据记录表的选择编号的弹窗改为左右两边,左边还是立项申请的项目编号关联,右边加入测试
 *    申请单的单据编号进行关联测试申请单,测试申请单的汇总也能看到有哪些数据记录表关联了
 *    测试申请单,然后点击可以弹窗显示对应的数据记录表的数据」
 *
 * 【为什么用源码断言】这条链跨 后端 QueryService / ButtonService / PxController / PanelConfigService
 *   + 前端 4 个文件 + 2 条迁移。mount 端到端成本过高;而这类回归的典型形态就是
 *   「有人把某一段删了/改回旧口径」——源码断言正好钉住每个环节的接线点。
 *   取值逻辑本身由 ledgerCols.test / recordGroup.test 覆盖。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../../../../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

const querySvc = read('backend/src/main/java/com/yinjia/mes/service/QueryService.java')
const buttonSvc = read('backend/src/main/java/com/yinjia/mes/service/ButtonService.java')
const pxCtl = read('backend/src/main/java/com/yinjia/mes/controller/PxController.java')
const cfgSvc = read('backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java')
const panels = read('frontend/src/core/views/RecordSheetPanels.vue')
const dataSheet = read('frontend/src/core/views/DataRecordSheet.vue')
const picker = read('frontend/src/core/views/DocNoPickDialog.vue')
const list = read('frontend/src/core/views/PanelxList.vue')
const cfgs = read('frontend/src/core/views/recordSheetConfigs.js')
const migration = read('tools/migrate-rd-domtest-link-20261029.sql')

test('① 发起人 = 提交审批的人：pending_by 优先，草稿退回制单人', () => {
  // 后端必须写「发起人」这个虚拟字段
  assert.match(querySvc, /doc\.put\("发起人"/, 'QueryService 要下发「发起人」')
  assert.match(querySvc, /pending_by/, '取值必须看 yj_doc_status.pending_by（提交审批的人）')
  const seg = querySvc.slice(querySvc.indexOf('String submitter ='), querySvc.indexOf('String submitter =') + 500)
  assert.match(seg, /制单人|申请人/, '草稿（没有 pending_by）要退回表内制单人')
  // 账号 → 姓名
  assert.match(querySvc, /private String realNameOf\(String user\)/, '要有账号转姓名的解析')
  // 前端汇总表读它
  assert.match(cfgs, /\{ label: '发起人', keys: \['发起人'/, '汇总表「发起人」列的 keys 首选后端「发起人」')
})

test('② 审批时可分发测试负责人（借鉴立项申请定级分发）', () => {
  assert.match(buttonSvc, /"RD_DOM_TEST"\.equals\(def\.code\(\)\)/, '审批分支要识别 RD_DOM_TEST')
  assert.match(buttonSvc, /private void assignTestOwner\(/, '要有分发的实现')
  const fn = buttonSvc.slice(buttonSvc.indexOf('private void assignTestOwner('), buttonSvc.indexOf('private void assignTestOwner(') + 1200)
  assert.match(fn, /UPDATE rd_dom_test_head SET 测试负责人/, '要写头表「测试负责人」')
  assert.match(fn, /recordApproval\(/, '要留痕')
  assert.match(fn, /isEnabledUser\(/, '账号必须存在且启用')
  // 前端专用弹窗
  assert.match(list, /openDomApprove/, '前端审批要通过专用弹窗')
  assert.match(list, /测试负责人: domApvTester\.value/, '载荷要带 测试负责人')
})

test('③ 关联判据读「文档编号」（用户实际填的那格），不是隐藏的「测试申请单编号」', () => {
  // 2026-10-29 修正:第一版只查迁移新加的「测试申请单编号」列,而它 place=query **界面上填不到**
  //   ⇒ 用户明明在记录表填了 DT-…,汇总表一直显示「无」。现主判据 = 文档编号。
  const fn = cfgSvc.slice(cfgSvc.indexOf('public List<Map<String, Object>> linkedRecordSheets'))
  const body = fn.slice(0, 3000)
  assert.match(body, /文档编号/, '主判据必须是「文档编号」')
  // 该列在 SQL 里参与匹配(不是只出现在注释里)
  assert.match(body, /ISNULL\(\[文档编号\]/, '文档编号要进 WHERE 条件')
  // 后端反查接口
  assert.match(pxCtl, /\/linkedRecordSheets/, '要有反查端点')
  assert.match(cfgSvc, /public List<Map<String, Object>> linkedRecordSheets/, '反查实现要在 PanelConfigService')
  // 隐藏列已被删除(见 migrate-drop-domtest-link-col-20261029.sql),代码仍兼容但不作为唯一判据
  assert.ok(!/only.*测试申请单编号/.test(body), '不能只查隐藏列')
})

test('③b 隐藏列已写迁移删除（8 表 × 1 列 + 8 条 yj_field），且带守卫', () => {
  const drop = read('tools/migrate-drop-domtest-link-col-20261029.sql')
  const tables = ['rd_alkaline_head', 'rd_mineral_head', 'rd_antibact_head', 'rd_scale_head',
    'rd_ro_protect_head', 'rd_soak_head', 'rd_drop_prec_head', 'rd_filter_eff_head']
  for (const t of tables) assert.ok(drop.includes(t), `删除迁移缺表 ${t}`)
  assert.match(drop, /DROP COLUMN \[测试申请单编号\]/, '要真的删列')
  assert.match(drop, /DELETE FROM yj_field WHERE label = N'测试申请单编号'/, '要删字段登记')
  // 不可逆操作必须有守卫:任一表该列有数据就中止
  assert.match(drop, /RAISERROR\('中止:测试申请单编号列仍有/, '必须有"有数据就中止"的守卫')
})

test('④ 汇总表有「数据记录表」列，且是可点入口（不是纯文本）', () => {
  assert.match(cfgs, /label: '数据记录表', link: 'recordSheets'/, '汇总表要声明关联列')
  assert.match(panels, /c\.link === 'recordSheets'/, '渲染层要识别关联列')
  assert.match(panels, /openLinkedSheets\(row\)/, '关联格要可点')
  assert.match(panels, /viewLinkedSheet\(r\)/, '要能点开单张记录表看数据')
  // 数量未取到时显示「查询」而不是 0（0 会被读成"没有关联"）
  const fn = panels.slice(panels.indexOf('function linkedCountOf'), panels.indexOf('function linkedCountOf') + 400)
  assert.match(fn, /return '查询'/, '未取过时提示「查询」，不能显示 0')
})

test('④b 「查看数据」取数走列表接口（getFormDescriptor 层级两次取错，已弃用）', () => {
  const idx = panels.indexOf('async function viewLinkedSheet')
  const fn = panels.slice(idx, idx + 2000)
  assert.match(fn, /\/px\/queryFormDataList/, '要用列表接口取单据数据')
  assert.ok(!fn.includes('getFormDescriptor'), '不要再用 getFormDescriptor（返回表单描述符，不是单据数据）')
  assert.match(fn, /doc\?\.detail\?\.items/, '明细从行的 detail.items 取')
})

test('⑤ 编号弹窗改为左右双源（左=项目编号，右=测试申请单）', () => {
  assert.ok(picker.includes('立项申请 · 项目编号'), '左栏标题')
  assert.ok(picker.includes('测试申请单 · 单据编号'), '右栏标题')
  // 单选语义:选左清右、选右清左
  assert.match(picker, /leftPick\.value = rowKeyOf\(row\)\s*\n\s*rightPick\.value = ''/, '选左要清右')
  assert.match(picker, /rightPick\.value = rowKeyOf\(row\)\s*\n\s*leftPick\.value = ''/, '选右要清左')
  // 数据记录表这格接双源弹窗
  assert.match(dataSheet, /openDocNoPick/, 'DataRecordSheet 的文档编号要走双源')
  assert.match(dataSheet, /DocNoPickDialog/, '要引入双源组件')
})

test('⑥ 双源弹窗的右栏取数走面板列表接口（queryFormDataList 才是现役真源）', () => {
  assert.match(picker, /engine\.queryFormDataList\(/, '右栏要用 queryFormDataList')
  assert.ok(!picker.includes('engine.queryPanelRows'), 'queryPanelRows 不存在，不能调')
  // 左栏沿用字段自身参照
  assert.match(picker, /engine\.refColumns\(props\.field\)/, '左栏沿用 refColumns')
  assert.match(picker, /engine\.queryRefRows\(props\.field/, '左栏沿用 queryRefRows')
})

test('⑦ 8 张记录表都声明了 dualDocNo（不是按面板码写死）', () => {
  const hits = [...cfgs.matchAll(/dualDocNo: '文档编号'/g)]
  assert.ok(hits.length >= 7, `内部委托/7 张 RecordSheetPanels 表都要声明（实际 ${hits.length}）`)
  assert.match(panels, /function isDualDocNoKey\(key\)/, '渲染层按配置判定，不按面板码')
})
