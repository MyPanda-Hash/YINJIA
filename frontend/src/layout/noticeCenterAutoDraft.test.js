import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * 「来料检验单审核自动生成的采购入库单 / 暂收退料单 → 草稿单消息」的源码级回归闸(2026-11-17)。
 *
 * 用户口径(第一轮):「从来料检验单审批自动生产采购入库单和暂收退料单能不能消息通知到生产销售和
 * 仓库审核两个角色。都是只要知情,并且告诉我他们在哪里收到消息」。
 *
 * 用户口径(第二轮,本文件按这一版钉):
 *   1.「生产销售**只用收到暂收退料**就行。」⇒ 采购入库单**不发**生产销售;
 *   2.「生成单据的时候就要有消息,**这个草稿单是需要他们去补充的,不是待审批的消息**。」
 *      ⇒ 文案说"请补充完善后再审核",不许出现"待审批/等待审核";时机 = 生单那一刻(两个生单方法内)。
 *
 * 钉住五件事(少一件这条链路就静默失效或跑偏):
 * 1. 后端两个自动生单方法**都**发了消息;
 * 2. 「请补充」= 按角色(cksh 仓库审核);生产销售 = scxs,且只挂在 QC_RETURN 上;
 * 3. 不得退回按审批权解析(approversOf)——生产销售没有这两张单的审批权,按权限找人永远收不到;
 * 4. 前端 MSG_TPL 两个码都有模板,且文案不含"待审批/等待审核"字样;
 * 5. en.js 四条英文词条齐备(切英语不回落中文 —— 多语言强制规范)。
 */
const here = (p) => new URL(p, import.meta.url)
const notice = readFileSync(here('../layout/NoticeCenter.vue'), 'utf8')
const en = readFileSync(here('../i18n/locales/en.js'), 'utf8')
const buttonService = readFileSync(here('../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java'), 'utf8')
const messageService = readFileSync(here('../../../backend/src/main/java/com/yinjia/mes/service/MessageService.java'), 'utf8')

/** 取 NoticeCenter 里某个消息码的模板块(到下一个 `CODE: {` 或 MSG_TPL 结束为止) */
function tpl(code) {
  const start = notice.indexOf(`${code}: {`)
  assert.ok(start > 0, `MSG_TPL 缺 ${code}`)
  const rest = notice.slice(start + code.length)
  const end = rest.search(/\n\s{2}[A-Z_]+: \{|\n\}/)
  return end > 0 ? rest.slice(0, end) : rest
}

test('两个自动生单方法都要发草稿消息(采购入库单 / 暂收退料单)', () => {
  assert.match(buttonService, /notifyAutoDraft\("PURCHASE_IN",\s*piNo,\s*no,\s*user\)/,
    'inspAutoPurchaseIn 必须发 PURCHASE_IN 的草稿消息')
  assert.match(buttonService, /notifyAutoDraft\("QC_RETURN",\s*thNo,\s*no,\s*user\)/,
    'inspAutoReturn 必须发 QC_RETURN 的草稿消息')
})

test('「请补充」= 仓库审核;生产销售只收暂收退料单', () => {
  assert.match(buttonService, /DRAFT_FILL_ROLES\s*=\s*java\.util\.List\.of\("cksh"\)/,
    '「请补充完善」必须发给 cksh(仓库审核)')
  // 生产销售只在 QC_RETURN 一行里出现:PURCHASE_IN 必须是空列表
  assert.match(buttonService, /"PURCHASE_IN",\s*java\.util\.List\.of\(\s*\)/,
    'PURCHASE_IN 的知情角色必须为空 —— 用户口径「生产销售只用收到暂收退料」')
  assert.match(buttonService, /"QC_RETURN",\s*java\.util\.List\.of\("scxs"\)/,
    'QC_RETURN 的知情角色必须是 scxs(生产销售)')
})

test('收件人按角色/配置解析,不得退回按审批权解析', () => {
  assert.match(messageService, /public List<String> accountsOfRoles\(/, 'MessageService 缺按角色取账号')
  assert.match(buttonService, /messageService\s*\.draftNotifyTargets\(targetPanel, "fill", DRAFT_FILL_ROLES\)/,
    '「请补充」必须走 draftNotifyTargets(fill)')
  assert.match(buttonService, /messageService\s*\.draftNotifyTargets\(targetPanel, "fyi", fyiRoles\)/,
    '「知会」必须走 draftNotifyTargets(fyi)')
  assert.ok(!/notifyAutoDraft[\s\S]{0,900}approversOf/.test(buttonService),
    'notifyAutoDraft 里不得用 approversOf —— 生产销售没有这两张单的审批权')
})

test('两个消息码 + 前端模板齐备,且文案不是"待审批"口径', () => {
  assert.match(messageService, /String AUTO_DRAFT_TO_FILL\s*=\s*"AUTO_DRAFT_TO_FILL"/)
  assert.match(messageService, /String AUTO_DRAFT_FYI\s*=\s*"AUTO_DRAFT_FYI"/)
  const fill = tpl('AUTO_DRAFT_TO_FILL')
  const fyi = tpl('AUTO_DRAFT_FYI')
  assert.match(fill, /请补充完善后再审核/, '请补充那条必须说"补充完善后再审核"')
  assert.match(fill, /已自动生成草稿单/, '标题要说"已自动生成草稿单"')
  assert.match(fyi, /特此知会/, '知会那条要说"特此知会"')
  for (const [name, blk] of [['TO_FILL', fill], ['FYI', fyi]]) {
    assert.ok(!/待审批|等待仓库审核|等待您审批/.test(blk),
      `${name} 文案不得出现"待审批/等待审核" —— 用户口径:草稿是要去补充的,不是待审批的消息`)
  }
})

test('英文词条齐备(切 en 不回落中文)', () => {
  for (const key of ['已自动生成草稿单：请补充', '已自动生成草稿单（知会）']) {
    assert.match(en, new RegExp(`'${key}':\\s*'[^']+'`), `en.js 缺「${key}」`)
  }
  assert.match(en, /'\{actor\} 审核「来料检验单 \{sourceNo\}」后已自动生成「\{panelName\} \{docNo\}」草稿，请补充完善后再审核。':\s*'[^']+'/,
    'en.js 缺"请补充完善后再审核"模板')
  assert.match(en, /'\{actor\} 审核「来料检验单 \{sourceNo\}」后已自动生成「\{panelName\} \{docNo\}」草稿（由仓库补充完善），特此知会。':\s*'[^']+'/,
    'en.js 缺"知会"模板')
})
