/**
 * wlbomEditableAfterSave.test.js —— 物料清单(WLBOM):**保存即归档 + 归档后「修改」按钮退回草稿**
 *
 * 【用户口径演化 — 别搞混两版】
 *   2026-10-29 第一版:「这个是不需要审批的,现在保存之后是不能修改的」
 *     → 当时理解成"保存后要保持草稿",把 WLBOM 从归档集合移出。
 *   2026-10-29 用户澄清(最终口径):
 *     「我现在想的是肯定是要能保存归档的,但是加上一个修改按钮,点击之后就退回草稿状态,
 *       然后就可以继续修改了,修改完再保存就行了」
 *   ⇒ **归档要保留**(基础数据填完即定稿),缺的是**归档后的退路**:
 *     侧栏一个「修改」按钮 → 退回草稿 → 改完保存 → 重新归档。
 *
 * 【为什么不能再走「申请修改」】
 *   文书那套闭环是「申请修改 → 管理员审批 → 修改中 → 再审批」，对基础数据太重,
 *   而且要求审批权。物料清单是谁维护谁改，不该被审批权卡住 ⇒ 专属 selfModify。
 *
 * 【这条测试钉四件事，缺一条都会退回"锁死"】
 *   ① WLBOM 仍在 DOC_ARCHIVE_PANELS(保存即归档);
 *   ② WLBOM 仍在 SELF_MAINTAINED_PANELS(与 ① 配套:不进"保存=送审"分支);
 *   ③ 按钮分发里「修改」对自助维护型面板走 selfModify(不是检验目录的 reopenCatalogRow);
 *   ④ 前端侧栏确实渲染了这个按钮，且只在已归档/已审核出现。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const btn = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url),
  'utf8',
)
const cfg = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java', import.meta.url),
  'utf8',
)
const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('WLBOM 仍「保存即归档」(用户要能归档)', () => {
  const m = btn.match(/DOC_ARCHIVE_PANELS\s*=\s*java\.util\.Set\.of\(([\s\S]*?)\);/)
  assert.ok(m, '找不到 DOC_ARCHIVE_PANELS 声明')
  assert.ok(/"WLBOM"/.test(m[1]), 'WLBOM 必须在 DOC_ARCHIVE_PANELS 里(保存后要归档)')
})

test('WLBOM 也在 SELF_MAINTAINED_PANELS(不走"保存=送审")', () => {
  const m = btn.match(/SELF_MAINTAINED_PANELS\s*=\s*java\.util\.Set\.of\(([^)]*)\)/)
  assert.ok(m, '找不到 SELF_MAINTAINED_PANELS 声明')
  assert.ok(/"WLBOM"/.test(m[1]), 'WLBOM 必须在 SELF_MAINTAINED_PANELS 里(否则掉进"保存=送审")')
})

test('「修改」按钮按面板分流:自助维护型走 selfModify,其余仍是检验目录', () => {
  assert.match(
    btn,
    /case "修改" -> SELF_MAINTAINED_PANELS\.contains\(def\.code\(\)\)[\s\S]{0,80}?selfModify\(def, formData\)[\s\S]{0,40}?: reopenCatalogRow/,
    '「修改」必须按面板分流 —— 物料清单要走 selfModify(退回草稿),不能复用检验目录的回弹逻辑',
  )
  assert.match(btn, /private Map<String, Object> selfModify\(/, '缺 selfModify 实现')
  // 退回草稿必须清干净:archived 不清的话状态推导仍判"已归档",按钮点了没反应
  const m = btn.match(/private Map<String, Object> selfModify\([\s\S]*?\n {4}\}/)
  assert.ok(m, '找不到 selfModify 方法体')
  assert.match(m[0], /archived = NULL/, 'selfModify 必须清 archived(否则单据统计仍判已归档)')
  assert.match(m[0], /modify_state = NULL/, 'selfModify 必须清 modify_state(否则停在"修改中")')
  assert.match(m[0], /snapshotOnUnaudit/, '退回前必须落快照 —— 否则修改记录丢失')
})

test('前端:「修改」在工具栏放出,且只在已归档/已审核可点', () => {
  assert.match(panelx, /const isSelfMaintainedPanel = computed\(\(\) => \!\!cfgCache\.value\?\.metadata\?\.selfMaintained\)/,
    '前端必须从 metadata.selfMaintained 取标记')
  // ⚠ 物料清单是**无侧栏的工具栏布局**(实测 .as-side-btn 为空),按钮走 .tb-main 工具栏;
  //   它来自面板元数据的按钮组(后端 buttonGroups 里那个「修改」组),
  //   而工具栏历史上把「修改」无条件过滤掉了(怕死按钮)⇒ 必须按面板放行。
  assert.match(
    panelx,
    /\.filter\(\(action\) => !\['查询', '查找'\]\.includes\(action\)[\s\S]{0,160}?action === '修改' && !isSelfMaintainedPanel\.value/,
    '工具栏过滤必须对自助维护型面板放行「修改」,否则按钮永远不出现',
  )
  // 置灰口径:物料清单看「已归档/已审核」,与后端 selfModify 的门禁同源
  assert.match(
    panelx,
    /修改: isSelfMaintainedPanel\.value[\s\S]{0,120}?!\['已归档', '已审核'\]\.includes\(st\)/,
    '「修改」置灰规则必须按面板分流:物料清单只在已归档/已审核可点',
  )
})

test('后端下发 metadata.selfMaintained(前端按钮的开关)', () => {
  assert.match(cfg, /metadata\.put\("selfMaintained", ButtonService\.SELF_MAINTAINED_PANELS\.contains\(def\.code\(\)\)\)/,
    '必须下发 selfMaintained,否则前端按钮永不出现')
})