/**
 * 立项申请表 / 项目实施计划 的表头（2026-11-17 用户口径，1117问题 #2）。
 *
 * 用户对照《立项申请表》《项目实施计划》目标版式要求：
 *   · 右上角 = **受控文件编号**：立项申请 YJ-QR-155 / 实施计划 YJ-QR-156（不再是"项目编号"参照格）；
 *   · 文件使用范围 = **固定「公司项目组」**（不再下拉）；
 *   · 信息表新增「立项编号」，与原来的「项目编号」是**同一个东西**（用户选 A）。
 *
 * ⚠ ADR-0001 红线：改的是**显示名**，数据键仍是 `文档编号` ——
 *   下游（实施计划按文档编号索引立项单、项目流程管控按单号对进度）因此零影响。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { approvalSheetCfg, planSheetCfg } from './docSheetConfigs.js'

const sheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

test('右上角固定文件编号：立项申请 155 / 实施计划 156', () => {
  assert.equal(approvalSheetCfg.docnoStatic, 'YJ-QR-155', '立项申请表')
  assert.equal(planSheetCfg.docnoStatic, 'YJ-QR-156', '项目实施计划')
})

test('DocSheet 真的会渲染固定编号（且此时不再出参照控件）', () => {
  assert.match(sheet, /const docnoStatic = computed\(/, '缺 docnoStatic computed')
  const at = sheet.indexOf('class="as-docno"')
  const seg = sheet.slice(at, at + 700)
  assert.match(seg, /v-if="docnoStatic"/, '编号格要先判固定编号')
  assert.match(seg, /\{\{ tt\('文件编号'\) \}\}：\{\{ docnoStatic \}\}/, '文案应为「文件编号：YJ-QR-xxx」')
  assert.match(seg, /v-else-if="editable && isRefKey\('文档编号'\)"/, '原参照控件降级为 v-else-if')
})

test('文件使用范围固定「公司项目组」（不再下拉）', () => {
  for (const [name, cfg] of [['立项申请表', approvalSheetCfg], ['实施计划', planSheetCfg]]) {
    const row = cfg.info.find((i) => i.label === '文件使用范围')
    assert.ok(row, `${name} 缺少「文件使用范围」行`)
    assert.equal(row.kind, 'static', `${name} 应为静态文本行`)
    assert.equal(row.text, '公司项目组', `${name} 固定值应为公司项目组`)
    assert.equal(row.key, undefined, `${name} 不应再绑定下拉字段`)
  }
})

test('新增「立项编号」行，数据键仍是 文档编号（下游关联键不变）', () => {
  for (const [name, cfg] of [['立项申请表', approvalSheetCfg], ['实施计划', planSheetCfg]]) {
    const row = cfg.info.find((i) => i.label === '立项编号')
    assert.ok(row, `${name} 缺少「立项编号」行`)
    assert.equal(row.key, '文档编号', `${name}：立项编号必须复用 文档编号（ADR-0001 数据键不变）`)
  }
})

test('信息表顺序：文件管理人 / 密级 / 文件使用范围 / 立项编号', () => {
  for (const cfg of [approvalSheetCfg, planSheetCfg]) {
    assert.deepEqual(cfg.info.map((i) => i.label),
      ['文件管理人', '密级', '文件使用范围', '立项编号'])
  }
})

test('右上角文件编号是黑色，不是红色（用户 2026-11-17 口径）', () => {
  // 用户：「立项申请和项目实施计划的文件编号是红色的，改为黑色」
  //   原 `.as-docno-static{color:#b00}`（照产品文件那批受控编号的红字观感）⇒ 改 #333。
  // ⚠ 只改这两张文书：`.as-docno*` 只存在于 DocSheet，产品文件的红色编号（RecordSheetPanels）
  //   不受影响 —— 别为了这条去动产品文件的样式。
  const at = sheet.indexOf('.as-docno-static {')
  assert.ok(at > 0, '缺 .as-docno-static 样式')
  const block = sheet.slice(at, sheet.indexOf('}', at))
  assert.match(block, /color:\s*#333/, '文件编号应为黑色 #333')
  assert.doesNotMatch(block, /#b00|red|#f00/i, '不应再是红字')
})
