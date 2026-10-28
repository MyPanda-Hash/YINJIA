/**
 * rdInspPlanTitle.test.js —— 出货检验计划表「标题」默认填「出货检验项目控制计划」
 *
 * 【用户原话 2026-10-28】「出货检验计划表，默认填写出货检验项目控制计划」
 *
 * 【背景】这张纸的大标题格 2026-10-19 起是 `titleKey: '标题'` 的**输入框**
 *   （之前是印死的静态文字，而 yj_field 里「标题」是 required=1 ⇒ 保存永远失败、
 *   用户还看不出是哪一格没填）。改成输入框后，新建单据的标题是**空的**，
 *   只剩 placeholder 灰字提示 —— 用户看到的就是截图里那片灰。
 *   实测正式账套现有 2 张单（IP-2026-10-0002 / 0001）标题都被手填成了「cs」。
 *
 * 【口径】这是**纸面固定表单名**（YJ-RD001《出货检验项目控制计划》），不是业务事实，
 *   与同面板「表单管理人 / 密级 / 使用范围」同款处理：走**默认值**（仅空时填、可人工改），
 *   不锁成只读 —— 个别客户要改抬头时仍能改。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyDocDefaults } from './docDefaults.js'
import { readFileSync } from 'node:fs'

const USER = { realName: '系统管理员', userName: 'admin' }
const T = '2026-10-28'
const TITLE = '出货检验项目控制计划'

test('新建出货检验计划表:「标题」默认带出「出货检验项目控制计划」', () => {
  const form = {}
  applyDocDefaults('RD_INSP_PLAN', form, USER, { isNew: true, today: T })
  assert.equal(form['标题'], TITLE, '标题格默认必须是纸面印的表单名，不能留空')
})

test('默认值只在为空时填，不覆盖用户已填的抬头', () => {
  const form = { 标题: '客户定制抬头' }
  applyDocDefaults('RD_INSP_PLAN', form, USER, { isNew: true, today: T })
  assert.equal(form['标题'], '客户定制抬头', '用户已填就不该被默认值覆盖')
})

test('校验必填不会再卡住:带上默认值后「标题」不再为空', () => {
  // 标题在 yj_field 里 required=1 —— 这是 2026-10-19 那次报障的根因链条,
  // 默认值补上后新建单据直接满足必填，不用用户先去猜是哪一格。
  const form = {}
  applyDocDefaults('RD_INSP_PLAN', form, USER, { isNew: true, today: T })
  assert.ok(String(form['标题'] || '').trim().length > 0, '必填字段必须有值')
})

test('纸面配置的 titleKey 与 titleKeyPh 仍指向同一格（默认值与渲染同源）', () => {
  const cfg = readFileSync(new URL('../views/recordSheetConfigs.js', import.meta.url), 'utf8')
  const at = cfg.indexOf('RD_INSP_PLAN: {')
  assert.ok(at >= 0, '找不到 RD_INSP_PLAN 配置块')
  const block = cfg.slice(at, at + 3000)
  assert.match(block, /titleKey: '标题'/, '大标题格必须仍绑「标题」字段（否则默认值填了也不显示）')
  assert.match(block, new RegExp(`titleKeyPh: '${TITLE}'`), 'placeholder 与默认值必须是同一句话')
})

test('默认值不得落到同族其它面板（规格书/成型工艺/组装工艺没有「标题」格）', () => {
  for (const code of ['RD_SPEC_DOC', 'RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_APPROVAL']) {
    const form = {}
    applyDocDefaults(code, form, USER, { isNew: true, today: T })
    assert.equal('标题' in form, false, `${code} 不该被本批默认值波及`)
  }
})
