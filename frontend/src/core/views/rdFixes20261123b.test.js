/**
 * 2026-11-23 第二批（用户 7 条报障）源码级守卫。
 *
 *   ① 项目实施计划阶段日期显示不全（input 内滚动宽 > 可视宽）
 *   ② 左侧蓝列标签折行「串行」、字体没对上框
 *   ④ 去掉「自动生成下一阶段计划开始时间」
 *   ⑤ 项目进度查询「项目定级原则」改为可自己编辑
 *   ⑦ 产品进度查询页头字样（已在上一批删除，这里防回潮）
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const progress = readFileSync(new URL('./ProgressControlSheet.vue', import.meta.url), 'utf8')
const stage = readFileSync(new URL('../progress/stageProgress.js', import.meta.url), 'utf8')
const productFlow = readFileSync(new URL('../../views/rd/ProductFlow.vue', import.meta.url), 'utf8')
const mig = readFileSync(new URL('../../../../tools/migrate-progress-grade-principle-20261123.sql', import.meta.url), 'utf8')

test('① 阶段日期框给足宽度 + 收字号（内部 input 不再被裁）', () => {
  const m = docSheet.match(/\.as-phase-date \{[^}]*\}/)
  assert.ok(m, '缺 .as-phase-date 样式')
  assert.match(m[0], /min-width:\s*1[6-9]\dpx/, '必须给最小宽度，否则 2026-11-30 会被裁')
  // ⚠ 子组件内部元素必须用 :deep()，否则 scoped 会编译成 `.el-input__inner[data-v-x]` 永远不匹配
  assert.match(docSheet, /\.as-phase-date :deep\(\.el-input__inner\) \{ font-size: 12px/)
  const inp = docSheet.match(/\.as-phase-input \{[^}]*\}/)
  assert.ok(inp && /max-width:\s*2\d\dpx/.test(inp[0]), '日期/文本输入的最大宽要放开到 200+')
})

test('② 蓝列标签字号收到 16px（8 字标签单行放得下，不再折行成「串行」）', () => {
  const m = docSheet.match(/\.as-name \{[^}]*\}/)
  assert.ok(m, '缺 .as-name 样式')
  assert.match(m[0], /font-size:\s*16px/, '8 字 × 19px = 152px > 可用宽，必然折行')
  // 序号列与标签列都顶部对齐（测试计划行高达 1500px，居中会把字甩到半空）
  const no = docSheet.match(/\.as-no \{[^}]*\}/)
  assert.match(no[0], /align-items:\s*flex-start/)
})

test('④ 不再自动推算下一阶段开始时间（函数、调用、单测都删除）', () => {
  assert.ok(!docSheet.includes('chainNextStageStart'), 'DocSheet 不得再调用')
  assert.ok(!/export function chainNextStageStart/.test(stage), 'stageProgress 不得再有该函数')
  const fn = docSheet.match(/function onPhaseDone[\s\S]{0,400}?\n\}/)
  assert.ok(fn, '缺 onPhaseDone')
  assert.ok(!/阶段\d\+?1?_计划开始|chainNextStageStart/.test(fn[0]), 'onPhaseDone 只能落本格')
})

test('⑤ 项目定级原则可编辑：纸面 textarea + 迁移加列登记字段', () => {
  assert.match(progress, /v-model="head\['项目定级原则'\]"/, '纸面必须绑到字段')
  assert.match(progress, /GRADE_PRINCIPLE_DEFAULT/, '空值要有默认文案回落')
  assert.ok(progress.includes('type="textarea"'), '多行文本用 textarea')
  assert.match(mig, /ALTER TABLE dbo\.rd_progress ADD \[项目定级原则\]/)
  assert.match(mig, /INSERT INTO yj_field/, '要登记 yj_field 才会被后端识别')
  assert.match(mig, /ROLLBACK TRANSACTION/, '自检失败必须回滚')
})

test('⑦ 产品进度查询页头字样仍是删掉的状态（防回潮）', () => {
  const tpl = productFlow.slice(0, productFlow.indexOf('<script'))
  assert.ok(!tpl.includes("tt('产品文件流程管控')"))
  assert.ok(!tpl.includes('数据来源：产品信息表与 4 个文件面板'))
})

test('①/② 补充：日期框必须定宽 + 子组件样式必须走 :deep()；标签列顶部对齐（长行不居中漂浮）', () => {
  const d = docSheet.match(/\.as-phase-date \{[^}]*\}/)
  assert.ok(d, '缺 .as-phase-date')
  assert.match(d[0], /min-width:\s*190px/, '日期框要定宽（100% 会跟着父容器一起窄）')
  assert.match(docSheet, /\.as-phase-date :deep\(\.el-input__inner\)/, '子组件内部元素必须用 :deep()，否则 scoped 选择器匹配不到')
  const n = docSheet.match(/\.as-name \{[^}]*\}/)
  assert.match(n[0], /align-items:\s*flex-start/, '标签列要顶部对齐（1232px 高的行居中会把字甩到行中间）')
})
