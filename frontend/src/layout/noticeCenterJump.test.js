import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * 消息中心「去处理」跳转 + 检验人审批结果消息 —— 源码级回归闸(2026-11-11 用户口径)。
 *
 * 用户报障(2026-11-11):「根据消息跳转要能够跳转到对应单据的页面,现在只能跳转到首页」。
 * 病根:消息详情带的是 `?focus=<单号>`,而面板列表(PanelxList.applyDocNoQuery)只认 **`?docNo=`**;
 * 于是路由一跳,单据没被选中,看着就像"回到首页/没跳"。
 *
 * 用户口径(同日):「审批通过和驳回也要有消息提示对应的检验人」—— 后端在制单人之外
 * 另发 APPROVAL_*_INSPECTOR 两码,前端必须有对应的模板词条,否则会退化成通用「业务消息」。
 */
const notice = readFileSync(new URL('../layout/NoticeCenter.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../i18n/locales/en.js', import.meta.url), 'utf8')

test('去处理跳转必须带 docNo(PanelxList 只认这个),不得再用 focus', () => {
  assert.match(notice, /query:\s*current\.value\.formNo\s*\?\s*\{\s*docNo:\s*current\.value\.formNo\s*\}\s*:\s*\{\}/,
    'goCurrent 必须把单号放进 ?docNo=')
  assert.ok(!/query:\s*current\.value\.formNo\s*\?\s*\{\s*focus:/.test(notice),
    '不得再传 focus(= 没人读的参数,跳过去等于没跳)')
})

test('检验人审批结果两码必须有消息模板(否则渲染成通用「业务消息」)', () => {
  for (const code of ['APPROVAL_APPROVED_INSPECTOR', 'APPROVAL_REJECTED_INSPECTOR']) {
    assert.match(notice, new RegExp(code + '\\s*:'), `MSG_TPL 缺 ${code}`)
  }
  // 文案要点:收件人是「检验人」而不是「提交人」,否则同一单两种收件人会误导
  assert.match(notice, /您检验的「\{panelName\} \{docNo\}」已由 \{actor\} 审批通过。/)
  assert.match(notice, /您检验的「\{panelName\} \{docNo\}」被 \{actor\} 驳回。意见：\{opinion\}/)
})

test('两码的英文词条已就位(切 en 不回落中文)', () => {
  assert.match(en, /'您检验的「\{panelName\} \{docNo\}」已由 \{actor\} 审批通过。':\s*'[^']+'/,
    'en.js 缺「您检验的…审批通过」模板')
  assert.match(en, /'您检验的「\{panelName\} \{docNo\}」被 \{actor\} 驳回。意见：\{opinion\}':\s*'[^']+'/,
    'en.js 缺「您检验的…被驳回」模板')
})
