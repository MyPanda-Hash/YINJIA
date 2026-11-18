/**
 * qcJjfSheet.test.js —— 紧急放行申请单 QC_JJF(YJ-QR-92)版面与审批口径的**回归钉子**(2026-11-17)
 *
 * 【用户原话(附截图,红框/绿字批注)】
 *   「紧急放行通知这个单据需要完成的内容二级审批,其他内容按照图中填写的进行修改即可」
 *   「不需要指定人只需要实现二级审批即可」
 *
 * 【钉住的四条(任何一条被改回去,用户报的版面/审批口径就会复发)】
 *   ① 右上信息表:使用范围=印刷值「公司内部」、责任部门=**责任人所属部门**(动态 key)、时间=单据日期;
 *   ② 「物料编码」= 责任人手动录入(不再挂 INV 参照 → 纸面不再出现「点击选择」);
 *   ③ 「一．紧急放行原因」责任人 + 日期由系统自动生成(责任人是编制格、日期绑单据日期,两格只读);
 *      「三．检测结果」整行删除;
 *   ④ 底部落款 编制 = 责任人(不是旧的「检测人」),审核 = 一级审批人、批准 = 二级(超级管理员);
 *      二级审批引擎侧 = ADMIN_L2_PANELS 里的 QC_JJF(本文件只钉编制格绑列与自动生成钩子)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { qcSheetCfgs } from './docSheetConfigs.js'

const VUE = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const JAVA = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const SQL = readFileSync(
  new URL('../../../../tools/migrate-jjf-twolevel-20261117.sql', import.meta.url), 'utf8')

const CFG = qcSheetCfgs.QC_JJF

test('① 右上信息表:使用范围(印刷值)/ 责任部门(责任人所属部门)/ 时间(单据日期)', () => {
  assert.deepEqual(CFG.info.map((i) => i.label), ['使用范围', '责任部门', '时间'])
  assert.equal(CFG.info[0].kind, 'static')
  assert.equal(CFG.info[0].text, '公司内部', '使用范围是纸面印刷值,不是录入项')
  assert.equal(CFG.info[1].key, '责任部门', '责任部门必须是动态列(责任人所属部门由后端写入)')
  assert.equal(CFG.info[2].key, '单据日期')
})

test('② 物料编码由「点击选择」改为责任人手动录入(纸面不再有参照控件)', () => {
  const row = CFG.rows.find((r) => (r.cells || []).some((c) => c.key === '物料编码'))
  assert.ok(row, '缺少 物料名称/物料编码 行')
  const cell = row.cells.find((c) => c.key === '物料编码')
  assert.equal(cell.kind, undefined, '物料编码不得声明 kind(手输就是普通输入框)')
  // 元数据侧:迁移脚本必须把 data_type 改成文本并清掉参照源
  assert.match(SQL, /SET data_type\s*=\s*N'文本'[\s\S]{0,200}ref_panel\s*=\s*NULL/, '迁移必须清参照源')
})

test('③ 一．紧急放行原因:责任人 + 日期自动生成(两格只读);三．检测结果整行删除', () => {
  const sec = CFG.rows.find((r) => r.kind === 'section' && r.key === '紧急放行原因')
  assert.ok(sec, '缺少 一．紧急放行原因')
  assert.equal(sec.signKey, '责任人', '责任人 = 编制格(自动生成填写人员)')
  assert.equal(sec.dateKey, '单据日期', '日期 = 单据日期(自动生成时间),不能是纸面空白「年 月 日」')
  assert.equal(CFG.rows.some((r) => r.key === '检测结果'), false, '「三．检测结果」整行必须已下线')
  assert.match(SQL, /DELETE FROM yj_field WHERE panel_code = N'QC_JJF' AND label = N'检测结果'/)
  // 责任人/单据日期 在元数据侧只读(纸面不给手填),否则「自动生成」会变成「想填填不进去」
  assert.match(SQL, /UPDATE yj_field SET editable = 0[^;]*label = N'责任人'[\s\S]{0,200}?label = N'单据日期'/,
    '责任人/单据日期 必须两格都置只读')
})

test('④ 底部落款:编制 = 责任人(不再绑检测人);审核/批准仍由审批流写', () => {
  assert.deepEqual(CFG.signCells.map((c) => c.label), ['编制', '审核', '批准'])
  assert.equal(CFG.signCells[0].key, '责任人', '编制格绑「责任人」')
  assert.equal(CFG.signCells[1].key, '审核人', '审核 = 一级审批通过人')
  assert.equal(CFG.signCells[2].key, '审批人', '批准 = 二级(超级管理员)')
  // 后端「编制格」登记表同步改列(否则提交审批会把姓名写进旧列 检测人)
  assert.match(JAVA, /Map\.entry\("QC_JJF", "责任人"\)/, 'QC_DOC_PREPARER[QC_JJF] 必须是「责任人」')
  assert.doesNotMatch(JAVA, /Map\.entry\("QC_JJF", "检测人"\)/, '旧的「检测人」绑定必须已移除')
})

test('④b 表头自动生成钩子:建单预填 + 保存补 + 提交时责任部门跟提交人刷新', () => {
  const setLine = JAVA.match(/PREPARER_CREATOR_PREFILL\s*=\s*java\.util\.Set\.of\(([^)]*)\)/)
  assert.ok(setLine && setLine[1].includes('"QC_JJF"'), 'QC_JJF 必须在「创建人预填」名单里(建单即出责任人)')
  assert.match(JAVA, /private void prefillRespDept\(PanelRegistry\.PanelDef def, String no, String user\)/)
  assert.match(JAVA, /private void putRespDept\(PanelRegistry\.PanelDef def, Map<String, Object> head, String user\)/)
  assert.match(JAVA, /private void syncRespDeptToSubmitter\(PanelRegistry\.PanelDef def, String no, String operator\)/)
  // 提交审批路径必须真的调到(责任人刷成提交人的同一处)
  assert.match(JAVA, /if \(respDeptPanel\(def\)\) syncRespDeptToSubmitter\(def, no, operator\);/)
  // 空白草稿分支直接 return,必须在那条路上也补
  // 空白草稿分支里「预填」之后紧跟门禁/落账几步,最后 return result(no, "草稿") —— 只要求同在一个分支内
  assert.match(JAVA, /prefillRespDept\(def, no, user\);[\s\S]{0,1200}?return result\(no, "草稿"\)/)
})

test('⑤ DocSheet:章节行签名支持 dateKey,且日期格认字段级只读', () => {
  assert.match(VUE, /function dateKeyLocked\(c\)/, '缺少 dateKeyLocked(日期格按 yj_field.readonly 判只读)')
  // 章节行(row.kind==='section')的签名日期必须走 dateKey 三分支,不能还是写死的空白「年 月 日」
  assert.ok(VUE.includes('章节行签名日期'), '章节行签名日期分支缺失(注释即标记)')
  assert.match(VUE, /row\.dateKey && editable && !dateKeyLocked\(row\)/, '可编辑分支必须过字段级只读')
  assert.match(VUE, /\{\{ tt\('日期'\) \}\}：\{\{ datePart\(row\.dateKey, 'y'\) \}\}/, '只读分支要印出真日期')
  assert.match(VUE, /dateKey && head\[row\.dateKey\]/, '有值才印日期,没值仍回落空白「年 月 日」')
})

test('⑥ 责任部门列与字段登记:幂等 + 两账套可跑 + 中文注明', () => {
  assert.match(SQL, /IF COL_LENGTH\('qc_jjf', '责任部门'\) IS NULL[\s\S]{0,160}ALTER TABLE qc_jjf ADD \[责任部门\]/)
  assert.match(SQL, /sp_addextendedproperty N'MS_Description'/, '新增列必须写中文注明')
  assert.match(SQL, /INSERT INTO yj_field[\s\S]{0,200}N'责任部门'/, '责任部门必须登记 yj_field(否则纸面取不到值)')
})
