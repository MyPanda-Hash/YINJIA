/**
 * approvalSeparation.test.js —— 「编制与审批分离」前端闸门的钉子(用户报障 2026-10-16)
 *
 * 【用户原话】「我在填写一个产品信息表之后审批分发给cp账号，然后用这个账号签核出错，
 *   还是显示的选取二级审核人」
 *
 * 【实测根因】测试账套 PI-2026-10-0021:提交人 = cp，而 cp 又有 RD_PROD_INFO 审批权
 *   ⇒ 点「审批通过」弹出**一级**的「选取二级审核人」框，确认时后端拒绝:
 *     HTTP 200 / body code=403 「审批人不能与提交人相同（编制与审批分离）」
 *   证据:yj_form_approval 里这张单只有 SUBMIT，没有 APPROVE_L1 ⇒ 一级审批根本没落地，
 *   单据仍是「审批中」⇒ cp 再点弹的还是同一个框(报错后弹窗不关闭)。
 *   第二处同源坑:选人框把提交人自己也列为候选，非管理员选了必被后端拒(ButtonService:1826)。
 *
 * 【修法】前端只做**展示层**拦截(置灰 + 说清原因 + 候选剔除 + 报错留框内)，
 *   服务端门禁一条不改、仍是最终裁决。单测跑不了运行时，按仓库既有做法读源码钉住。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const queryService = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java', import.meta.url), 'utf8')
const buttonService = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('提交人从哪来：后端在「审批中」的单据上下发 `提交人`（= yj_doc_status.pending_by）', () => {
  assert.match(queryService, /doc\.put\("提交人", st\.get\("pending_by"\)\)/,
    '前端判据全靠这个键；后端不发了，前端闸门会静默失效（回到"点了才知道"）')
})

test('提交人（非管理员）点一级「审批通过」必须置灰，且只在「审批中」这一档生效', () => {
  const body = panelx.match(/审批通过: [\s\S]{0,400}?\n\s*审批驳回:/)
  assert.ok(body, '找不到 isDisabled 里的 审批通过 判定')
  assert.match(body[0], /st === '审批中' && iAmCurSubmitter\.value/,
    '置灰条件必须是「审批中 ∧ 我是提交人」——若漏掉 st 判断，「待二级审批」时被选为二级审核人的提交人会被错杀')
  assert.match(panelx, /const iAmCurSubmitter = computed\(\(\) => \{[\s\S]{0,300}?user\.isAdmin[\s\S]{0,200}?user\.userName/,
    '管理员必须豁免（与后端同款：保存即归档本就是等价权力）')
})

test('置灰必须给出人话原因（不是静默不可点）', () => {
  assert.match(panelx, /action === '审批通过' && st === '审批中' && iAmCurSubmitter\.value\) \{\s*\n\s*return tt\('本单由你提交：按「编制与审批分离」不能审批自己提交的单，请由他人完成一级审批'\)/,
    'disabledReason 里要有这一档解释')
  assert.match(en, /'本单由你提交：按「编制与审批分离」不能审批自己提交的单，请由他人完成一级审批':/,
    '新增 UI 文案必须有多语言词条（en 至少）')
})

test('二级审核人候选剔除提交人（后端必拒的那一项不该出现在下拉里）', () => {
  assert.match(panelx, /const l2PickOptions = computed\(\(\) => \{[\s\S]{0,300}?filter\(\(u\) => String\(u\.username\) !== hide\)/,
    '候选要按 hidden submitter 过滤')
  assert.match(panelx, /l2PickHiddenSubmitter\.value = \(!user\.isAdmin && curSubmitter\.value\) \? curSubmitter\.value : ''/,
    '只在非管理员时剔除（管理员后端豁免）')
  assert.match(panelx, /<el-option v-for="u in l2PickOptions"/, '模板要改用过滤后的候选源')
  assert.match(panelx, /排除提交人（提交人不能当二级审核人）/, '要写明是谁被排除、为什么')
})

test('弹窗失败时把后端原话留在框里（只弹 toast ⇒ 用户以为"又弹一次让我选人"）', () => {
  assert.match(panelx, /l2PickError\.value = String\(engine\.errMsg\(e\) \|\| tt\('审批失败'\)\)/)
  assert.match(panelx, /<div v-if="l2PickError" class="dq-error">/, '框内要有报错行')
  assert.match(panelx, /\.dq-error \{[\s\S]{0,200}?color: #b91c1c/, '.dq-error 要有样式')
})

test('后端两条拒绝话说清"谁提交的、接下来该找谁"', () => {
  assert.match(buttonService, /"审批人不能与提交人相同（编制与审批分离）：本单由 " \+ realNameOf\(submitter\)/,
    '一级拒绝要带提交人姓名')
  assert.match(buttonService, /"二级审核人不能是提交人本人（编制与审批分离）：本单由他提交，请另选一位账号"/)
  // 老探针 tools/archive/_probe-rd-flow-matrix.cjs 断言 msg 含前缀「审批人不能与提交人相同」——
  // 这里防的是"后人把前缀也改了"导致那条探针失效
  const probe = readFileSync(new URL('../../../../tools/archive/_probe-rd-flow-matrix.cjs', import.meta.url), 'utf8')
  assert.match(probe, /includes\('审批人不能与提交人相同'\)/)
  assert.match(buttonService, /审批人不能与提交人相同（编制与审批分离）/, '前缀必须保留')
})
