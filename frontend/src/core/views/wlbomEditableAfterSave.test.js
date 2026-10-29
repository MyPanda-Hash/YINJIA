/**
 * wlbomEditableAfterSave.test.js —— 物料清单(WLBOM)保存后必须**仍可编辑**
 *
 * 【用户报障 2026-10-29】
 *   「现在先改本地的物料清单,是可以直接修改的,这个是不需要审批的,现在保存之后是不能修改的」
 *   截图佐证:单据状态显示「已审批」,但字段全灰、加行按钮消失。
 *
 * 【当前实现的链路(为什么会锁死)】
 *   ① ButtonService.saveDoc 里 WLBOM ∈ SELF_MAINTAINED_PANELS ⇒ 保存即调 markArchived(),
 *      把 yj_doc_status.archived 置 'Y' ⇒ 单据状态变成「已归档」;
 *   ② 前端 PanelxList 的 draftEditable 只认 '草稿' / '修改中' / 档案面板的 启用·停用,
 *      「已归档」不在其中 ⇒ 纸面/网格一律只读;
 *   ③ WLBOM 走的是「修改」组而不是审批组(SELF_MAINTAINED 的配套),没有「申请修改→审批→修改中」
 *      这条回路 ⇒ **归档之后就再也回不到可编辑态**,只能靠「弃审」这种文书式操作。
 *
 * 【用户口径】物料清单是**基础数据**,不是要签核的文书:
 *   填写不需要审批、修改也不需要审批 ⇒ 保存之后应当**继续可改**,
 *   不能因为"存过一次"就把自己锁死。
 *
 * 【修法】不动状态机、不给 WLBOM 造特例分支:
 *   把 WLBOM 从 SELF_MAINTAINED_PANELS 的"保存即归档"里摘出来,
 *   改为**保存后保持草稿**(不进归档),前端 draftEditable 本来就认草稿 ⇒ 天然可继续编辑。
 *   ⚠ 不改 DOC_ARCHIVE_PANELS 的其它成员;也不改「已归档」在别处的语义。
 *
 * ⚠ 这条测试钉的是**两处口径同时成立**,只改一边会立刻红:
 *   · 后端:WLBOM 不得在保存路径上被 markArchived;
 *   · 前端:draftEditable 仍必须认「草稿」。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const btn = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url),
  'utf8',
)
const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('物料清单(WLBOM)不再"保存即归档"', () => {
  // SELF_MAINTAINED_PANELS 的语义就是"保存即归档且不走审批"。
  // WLBOM 要求"保存后仍可改" ⇒ 必须从该集合移出,SELF_MAINTAINED 保持只服务真正的
  // "存一次就定稿"的自助面板(当前为空集也要保留声明,后续面板还要用)。
  const m = btn.match(/SELF_MAINTAINED_PANELS\s*=\s*java\.util\.Set\.of\(([^)]*)\)/)
  assert.ok(m, '找不到 SELF_MAINTAINED_PANELS 声明')
  assert.ok(!m[1].includes('"WLBOM"'), 'WLBOM 不得再登记进 SELF_MAINTAINED_PANELS(它保存后要能继续改)')
})

test('WLBOM 也不得落进「保存→送审批」那条分支', () => {
  // 移出 SELF_MAINTAINED 后,若仍留在 DOC_ARCHIVE_PANELS,会掉进 else 分支
  // ⇒ 保存就变成"提交审批",用户反而更改不了。两条都必须不满足。
  const m = btn.match(/DOC_ARCHIVE_PANELS\s*=\s*java\.util\.Set\.of\(([\s\S]*?)\);/)
  assert.ok(m, '找不到 DOC_ARCHIVE_PANELS 声明')
  assert.ok(!/"WLBOM"/.test(m[1]), 'WLBOM 不得再登记进 DOC_ARCHIVE_PANELS(否则保存=送审,更不可改)')
})

test('前端 draftEditable 仍认草稿(后端保持草稿 ⇒ 天然可编辑)', () => {
  assert.match(
    panelx,
    /const draftEditable = computed\(\(\) => \{[\s\S]{0,1200}?if \(st === '草稿'\) return true/,
    'draftEditable 必须认「草稿」—— 物料清单保存后靠它继续可编辑',
  )
})

test('保存路径仍要求 markSaved(草稿按钮不触发任何状态流转)', () => {
  // 「保存为草稿/新增」markSaved=false ⇒ 不流转;这条语义不能被本次改动破坏
  assert.match(btn, /if \(markSaved && DOC_ARCHIVE_PANELS\.contains\(def\.code\(\)\)/,
    '状态流转必须仍然受 markSaved 守卫(保存为草稿不得触发)')
})
