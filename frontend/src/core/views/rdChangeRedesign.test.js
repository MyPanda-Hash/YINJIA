/**
 * rdChangeRedesign.test.js —— 产品变更申请表改版（用户口径 2026-11-11）
 *
 * 【用户原话】
 *   「现在对产品变更申请表进行一个重新设计，这个产品变更申请表的表的表头标题固定为产品变更申请表，
 *    会签人字段改为下拉勾选对应的账号，就是人员姓名，四五内容区去掉」
 *
 * 三条要求逐条钉住：
 *   ① 表头标题**固定**「产品变更申请表」→ 不能再走 titleKey（可编辑输入框）；
 *   ② 会签人 → **下拉勾选账号**，界面上显示**人员姓名**；
 *      但落库仍必须是**账号**：后端 submitSignoff/signersOf 按账号校验启用状态、发通知、
 *      写 yj_form_approval.operator（见 ButtonService.signersOf 按 [,，、;；\s] 切分）。
 *      ⇒ 显示名与存储值分离，本测试同时钉住两头。
 *   ③ 「四、库存产品处理方式」「五、其它」两段**整段删除**。
 *
 * 单测跑不了模板分支，按仓库既有做法读源码钉住（同 rdChangeConfig.test.js）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')
const sheet = read('src/core/views/RecordSheetPanels.vue')
const px = read('../backend/src/main/java/com/yinjia/mes/controller/PxController.java')

const cfg = recordSheetConfigs.RD_CHANGE

test('① 表头标题固定为「产品变更申请表」，不再可编辑', () => {
  assert.equal(cfg.staticTitle, '产品变更申请表')
  // 有 titleKey 就会在编辑态渲染成输入框（用户 2026-10-16 曾要求可编辑；2026-11-11 改为固定）
  assert.equal(cfg.titleKey, undefined, 'titleKey 必须去掉，否则标题又变成可编辑输入框')
  // 留一个防回退：没有 titleKey 时，占位词不该再参与渲染
  assert.equal(cfg.titleKeyPh, undefined, 'titleKey 已去掉，titleKeyPh 一并清理')
})

test('② 会签人是「选人」控件，且支持下拉勾选（多选）', () => {
  const rows = (cfg.sections || []).flatMap((s) => s.rows || [])
  const cell = rows.flatMap((r) => r.grid || []).find((c) => c.key === '会签人')
  assert.ok(cell, '找不到会签人那一格')
  assert.equal(cell.userPick, true, '会签人必须用选人控件（下拉勾选账号），不能再是纯文本输入')
  assert.equal(cell.multiple, true, '会签人可以多选（后端 signersOf 支持多账号）')
  // 旧文案是"多人用逗号分隔（账号）"—— 改成选人后不该再让用户手打账号
  assert.ok(!String(cell.ph || '').includes('逗号'), '占位词不该再教用户手打逗号分隔的账号')
})

test('③ 组件里显示的是**人员姓名**，而落库保持**账号**', () => {
  // 选人控件：label 取 realName、value 取 username
  assert.match(sheet, /realName/, '选人下拉的显示名必须取 realName（用户口径"就是人员姓名"）')
  assert.match(sheet, /:value="u\.username"/, '选人下拉的值必须是账号（后端按账号校验/发通知/写留痕）')
  // 多选值 ↔ 存库文本 的转换必须存在（存库是顿号分隔的账号串，与 signersOf 的切分口径一致）
  assert.match(sheet, /pickListOf/, '缺少 账号串 → 数组 的解析函数')
  assert.match(sheet, /setPickList/, '缺少 数组 → 账号串 的写回函数')
})

test('④ 只读态也要显示姓名，不能把账号直接印在纸上', () => {
  // 只读分支必须走"账号→姓名"的映射，而不是原样显示 head[key]
  assert.match(sheet, /signNamesOf/, '只读态缺少账号→姓名映射（否则纸面印出一串英文账号）')
})

test('⑤ 后端提供会签人选人清单，权限挂 RD_CHANGE（不复用别的面板端点）', () => {
  assert.match(px, /@GetMapping\("\/rdChange\/users"\)/, '缺少 /px/rdChange/users 端点')
  const m = px.match(/@GetMapping\("\/rdChange\/users"\)[\s\S]{0,400}?\n    \}/)
  assert.ok(m, '端点声明格式异常')
  assert.match(m[0], /requirePanelView\("RD_CHANGE"\)/, '端点必须挂 RD_CHANGE 查看权（挂别的面板会 403）')
  assert.match(m[0], /enabledUsers\(\)/, '端点应返回启用账号清单（与其它选人下拉同源）')
})

test('⑥ 「四、库存产品处理方式」「五、其它」两段整段删除', () => {
  const bars = (cfg.tailSections || []).map((s) => s.bar)
  assert.ok(!bars.some((b) => String(b).includes('库存产品处理方式')), '四、库存产品处理方式 必须删掉')
  assert.ok(!bars.some((b) => String(b).includes('其它')), '五、其它 必须删掉')
  // 这两段独有的字段不该再出现在纸面上
  const seen = new Set((cfg.tailSections || []).flatMap((s) => (s.rows || []))
    .flatMap((r) => r.grid || []).flatMap((c) => [c.key, c.label]).filter(Boolean))
  for (const k of ['原料数量', '成品处理方式', '文件管理人', '文件使用范围']) {
    assert.ok(!seen.has(k), `${k} 属于已删除的四/五段，不该还留着`)
  }
  // 三.相关变更 与 批准 仍要保留（删的是四、五，不是把尾巴全砍）
  assert.ok(bars.some((b) => String(b).includes('相关变更')), '三.相关变更 应保留')
  assert.ok(bars.some((b) => String(b).includes('批准')), '批准 段应保留')
})
