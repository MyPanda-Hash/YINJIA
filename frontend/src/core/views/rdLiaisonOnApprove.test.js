/**
 * rdLiaisonOnApprove.test.js —— 立项「定级时一并分发对接人 + 后续可改」+ 研发管理员取消保存即归档
 *
 * 【用户原话 2026-10-28】
 *   ①「立项申请可以由管理员在审批定级的时候确定一个对接人进行分发，后续也默认是这个对接人，
 *      除非进行修改，否则默认选择这个对接人」
 *   ②「把所有研发的管理员的保存就归档去掉，一样走审批流程，但是管理员可以自己提交自己审批」
 *
 * 【为什么用源码断言】②的重心在后端 ButtonService.saveDoc 的分支走向、①的重心在
 *   approveApproval 的 RD_APPROVAL 分支与 gradeAndDispatch 的门禁 —— 都是 Spring 服务内部
 *   依赖 JDBC/事务的路径，本仓库没有 Spring 测试基座（backend/src/test 为空）。
 *   沿用 approvalSeparation.test.js 的既有做法：读源码钉住"判据还在、旧门禁已拆"，
 *   活体行为另用 8090 探针验证（tools/archive/_rd-liaison-approve-20261028/）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const buttonService = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

/** 取某个方法/分支的源码片段（从 anchor 起 limit 个字符，够断言用） */
const slice = (text, anchor, limit = 2500) => {
  const at = text.indexOf(anchor)
  assert.ok(at >= 0, `找不到锚点：${anchor}`)
  return text.slice(at, at + limit)
}

// ── ① 审批定级时确定对接人 ────────────────────────────────────────────────
test('approveApproval 的 RD_APPROVAL 分支：定级之后把「对接人」也落库（可一步分发）', () => {
  // 锚点取 approveApproval 内那段「审批与定级同一步」的注释 → 下面的分支
  const at = buttonService.indexOf('// 立项申请:审批与定级是**同一步骤的两个动作**')
  assert.ok(at >= 0, '找不到 approveApproval 里的立项分支')
  const branch = buttonService.slice(at, at + 1200)
  assert.match(branch, /pickOf\(formData, "对接人"\)/,
    '审批弹窗带上的对接人必须在这里被读出来，否则"审批定级时一并分发"只是个下拉摆设')
  assert.match(branch, /assignLiaison\(/, '要走同一个落库/留痕/通知入口，别在审批里再写一份')
})

test('落库/留痕/通知 收在一个 assignLiaison 里（审批路径与定级分发共用）', () => {
  const fn = slice(buttonService, 'private void assignLiaison(', 2000)
  assert.match(fn, /UPDATE rd_approval SET 备用1 = \?/, '对接人落在 备用1（既有真源）')
  assert.match(fn, /LIAISON/, '要留 LIAISON 痕，否则流程管控页看不出谁发的')
  assert.match(fn, /LIAISON_ASSIGNED/, '被指定的人要收到消息')
})

test('定级分发允许改对接人（2026-10-28「除非进行修改」取代 2026-10-09「不能更改」）', () => {
  const fn = slice(buttonService, 'private Map<String, Object> gradeAndDispatch(', 4000)
  // 旧门禁把改人口彻底堵死（"已分发给 X，不能重复分发"）；注释里提到不算，必须是活代码抛错
  assert.ok(!/throw new IllegalStateException\("对接人已分发给/.test(buttonService),
    '旧的"已分发给X不能重复分发"把改人口堵死了，与本轮口径冲突')
  assert.match(fn, /assignLiaison\(/, '改人也要走同一个入口（留痕记原对接人）')
})

test('「定级分发」按钮的放行条件不再要求"对接人为空"（否则改了人按钮永远灰）', () => {
  const line = slice(buttonService, 'out.put("canGradeDispatch"', 200)
  assert.ok(!/liaison\.isEmpty\(\)/.test(line.split('\n')[0]),
    'canGradeDispatch 里不能再带 liaison.isEmpty()')
})

test('审批弹窗带对接人下拉，并默认带出当前对接人', () => {
  assert.match(panelx, /const apvLiaison = ref\(''\)/)
  assert.match(panelx, /apvLiaison\.value = String\(rdFlow\.liaison \|\| ''\)/,
    '打开弹窗要默认选中已有对接人（"后续也默认是这个对接人"）')
  assert.match(panelx, /v-model="apvLiaison"/, '弹窗里要真的有这个控件')
  assert.match(panelx, /对接人: apvLiaison\.value/, '提交时随 formData 发出去')
})

// ── ② 研发管理员取消「保存即归档」，改走审批流 ──────────────────────────
test('saveDoc 里管理员的「保存即归档」分支整段移除（不再按面板手写名单）', () => {
  const save = slice(buttonService, '// 文件类面板:保存 = 落库 + 按面板语义流转', 3000)
  assert.ok(!/isAdminUser\(user\)\s*&&\s*!ADMIN_SAVE_DEFERS_TO_FLOW/.test(save),
    '管理员归档捷径必须去掉 —— 留着就等于"管理员的保存不归档"仍是按名单手写的特例')
  // 该留痕字符串只在"管理员保存即归档"那条分支里写过；活代码里不该再有
  assert.ok(!/recordApproval\([^)]*"APPROVE", "APPROVED", "保存即归档（管理员保存）"\)/.test(buttonService),
    '这条留痕是管理员捷径的产物；口径改了就不该再写出来')
  // 自助维护型面板(WLBOM,无审批)必须仍然保存即归档，否则会永远卡在审批中
  assert.match(save, /SELF_MAINTAINED_PANELS\.contains\(def\.code\(\)\)/,
    'WLBOM 是基础数据、没有审批，不能跟着落进"送审"分支')
})

test('管理员保存 = 送审（pending=Y），不再 markArchived —— 但审批通过仍会归档', () => {
  // 进审批流的那段要写 pending='Y'
  assert.match(buttonService, /WHEN MATCHED THEN UPDATE SET pending = 'Y', pending_by = \?/,
    '普通用户/管理员共用的送审语句要还在')
  // 审批通过后归档这条必须保留（否则管理员自己批完停在"已审核"）
  const approve = slice(buttonService, '// 文件类面板:审批通过后归档', 400)
  assert.match(approve, /markArchived\(def\.code\(\), no, operator\)/,
    '审批通过后的归档入口不能被一起删掉')
})

test('管理员自己提交自己审批仍然放行（编制与审批分离对管理员豁免）', () => {
  assert.match(buttonService, /if \(!isAdminUser\(operator\) && operator\.equals\(submitter\)\)/,
    '这个豁免是本轮"管理员可以自己提交自己审批"的唯一开关，删了管理员就批不了自己的单')
})

test('新增 UI 文案有多语言词条（en 至少）', () => {
  assert.match(en, /'对接人（选填）':/)
  assert.match(en, /'在审批定级的同时选择对接人，一步完成分发；不选则审批后再到「定级分发」补发':/)
})
