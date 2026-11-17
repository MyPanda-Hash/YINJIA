/**
 * 数据记录表「审核人需审核后生成，不能自动填充」（2026-11-17 用户口径，1117问题 #5）。
 *
 * 原实现：`docDefaults.js` 给 8 张数据记录表硬编码 `['表单审核人','秀丽']` ⇒ 建单即带签名，
 * 草稿态纸面上就已经"签过名"。用户要求改成**审核后生成**。
 *
 * 改法：前端不再预填；服务端在「审批通过」时回填、「弃审/驳回」时清空。
 * 注意落库键是「表单审核人」（叫「审核人」会被 save() 的 body.remove("审核人") 静默丢弃）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const defaultsSrc = readFileSync(new URL('../panel/docDefaults.js', import.meta.url), 'utf8')

const btn = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

const REC = ['RD_ALKALINE', 'RD_MINERAL', 'RD_ANTIBACT', 'RD_SCALE',
  'RD_RO_PROTECT', 'RD_SOAK', 'RD_DROP_PREC', 'RD_FILTER_EFF']

test('8 张数据记录表不得再预填「表单审核人」', () => {
  // 按行扫 DOC_DEFAULTS：这些面板的默认值数组里不许再出现 '审核'
  for (const p of REC) {
    const re = new RegExp(`${p}: \\[([^\\]]*)\\]`)
    const m = defaultsSrc.match(re)
    if (!m) continue // 该面板已无默认值配置 = 合规
    assert.doesNotMatch(m[1], /审核/, `${p} 仍在预填审核人：${m[1].slice(0, 80)}`)
  }
})

test('后端：审批通过回填、弃审清空，且两者都限定在数据记录表集合内', () => {
  assert.match(btn, /DATA_REC_AUDITOR_PANELS = java\.util\.Set\.of\(/, '缺集合常量')
  for (const p of REC) assert.ok(btn.includes(`"${p}"`), `集合缺少 ${p}`)
  assert.match(btn, /private void writeDataRecAuditor\(/, '缺回填方法')
  assert.match(btn, /SET \[表单审核人\] = \?/, '回填写的是「表单审核人」列')
  assert.match(btn, /private void clearDataRecAuditor\(/, '缺清空方法')
  // 回填必须挂在单节点审批通过之后
  assert.match(btn, /writeDataRecAuditor\(def, no, operator\);/, '审批通过未调用回填')
  // 清空挂在 clearAuditSignCells 的统一入口（弃审/驳回 4 条路都汇到这里）
  const at = btn.indexOf('private void clearAuditSignCells(')
  const seg = btn.slice(at, at + 600)
  assert.match(seg, /clearDataRecAuditor\(def, no\)/, '弃审未清空审核人')
})

test('#3 立项申请：对接人固定陈秀丽，弹窗不再给下拉', () => {
  assert.match(btn, /RD_DEFAULT_LIAISON_ACCOUNT = "chenxiuli"/, '后端默认对接人常量')
  assert.match(btn, /if \(liaison\.isEmpty\(\)\) liaison = RD_DEFAULT_LIAISON_ACCOUNT;/, '空则兜底默认')
  assert.match(list, /const RD_DEFAULT_LIAISON = 'chenxiuli'/, '前端默认常量')
  // 弹窗里不该再有对接人下拉
  const at = list.indexOf("tt('审批通过并定级')")
  const seg = list.slice(at, at + 2200)
  assert.doesNotMatch(seg, /v-model="apvLiaison"[\s\S]{0,80}el-select/, '弹窗里仍在给对接人下拉')
  assert.match(seg, /dq-fixed/, '应改为固定文本展示')
})
