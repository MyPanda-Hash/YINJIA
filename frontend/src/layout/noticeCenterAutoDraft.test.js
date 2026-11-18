import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * 「来料检验单审核自动生成的采购入库单 / 暂收退料单 → 通知生产销售 + 仓库审核(仅知情)」
 * 的源码级回归闸(2026-11-17 用户口径)。
 *
 * 用户口径原文:「从来料检验单审批自动生产采购入库单和暂收退料单能不能消息通知到生产销售和
 * 仓库审核两个角色。都是只要知情,并且告诉我他们在哪里收到消息」。
 *
 * 钉住四件事(少一件这条链路就静默失效):
 * 1. 后端两个自动生单方法**都**发了消息(此前一条都没有,草稿也别无提醒:草稿不进门户待办);
 * 2. 收件人是**按角色**解析的(scxs=生产销售 / cksh=仓库审核),不能退回按审批权解析 ——
 *    生产销售在这两张单上没有 audit 权限,按审批权找人永远收不到;
 * 3. 前端 MSG_TPL 有该消息码的模板(缺了会渲染成通用「业务消息」);
 * 4. en.js 有英文词条(切英语不回落中文 —— 多语言强制规范)。
 */
const here = (p) => new URL(p, import.meta.url)
const notice = readFileSync(here('../layout/NoticeCenter.vue'), 'utf8')
const en = readFileSync(here('../i18n/locales/en.js'), 'utf8')
const buttonService = readFileSync(here('../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java'), 'utf8')
const messageService = readFileSync(here('../../../backend/src/main/java/com/yinjia/mes/service/MessageService.java'), 'utf8')

test('两个自动生单方法都要发「已生成、请知悉」消息(采购入库单 / 暂收退料单)', () => {
  assert.match(buttonService, /notifyAutoDraft\("PURCHASE_IN",\s*piNo,\s*no,\s*user\)/,
    'inspAutoPurchaseIn 必须发 PURCHASE_IN 的知情消息')
  assert.match(buttonService, /notifyAutoDraft\("QC_RETURN",\s*thNo,\s*no,\s*user\)/,
    'inspAutoReturn 必须发 QC_RETURN 的知情消息')
})

test('知情收件人按角色解析 = 生产销售 scxs + 仓库审核 cksh,不得退回按审批权解析', () => {
  assert.match(buttonService, /DRAFT_AUDIT_NOTIFY_ROLES\s*=\s*java\.util\.List\.of\("scxs",\s*"cksh"\)/,
    '默认收件角色必须是 scxs(生产销售) + cksh(仓库审核)')
  assert.match(messageService, /public List<String> accountsOfRoles\(/, 'MessageService 缺按角色取账号')
  assert.match(buttonService, /messageService\.draftAuditNotifyTargets\(targetPanel, DRAFT_AUDIT_NOTIFY_ROLES\)/,
    '收件人必须走 draftAuditNotifyTargets(角色/配置),不能走 approversOf(审批权)')
  assert.ok(!/notifyAutoDraft[\s\S]{0,600}approversOf/.test(buttonService),
    'notifyAutoDraft 里不得用 approversOf —— 生产销售没有这两张单的审批权')
})

test('消息码 + 前端模板 + 英文词条齐备', () => {
  assert.match(messageService, /String AUTO_DRAFT_FOR_AUDIT\s*=\s*"AUTO_DRAFT_FOR_AUDIT"/)
  assert.match(notice, /AUTO_DRAFT_FOR_AUDIT\s*:\s*\{/, 'NoticeCenter 的 MSG_TPL 缺 AUTO_DRAFT_FOR_AUDIT')
  assert.match(notice, /已自动生成待审核单据/, '缺消息标题模板')
  assert.match(notice, /已自动生成「\{panelName\} \{docNo\}」草稿/, '缺消息正文模板(必须点出下游单据)')
  assert.match(en, /'已自动生成待审核单据':\s*'[^']+'/, 'en.js 缺标题词条')
  assert.match(en, /\{actor\} 审核「来料检验单 \{sourceNo\}」后，已自动生成「\{panelName\} \{docNo\}」草稿[^']*':\s*'[^']+'/,
    'en.js 缺正文词条')
})
