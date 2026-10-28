import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * 2026-10-27 报障(1027系统使用-产品工艺文件问题点待改善 #3)回归钉:
 *   迁移把 RD_MOLD_PROC.产品管控类型 的 alias 改成「产品管控等级」、data_type 改参照,
 *   后端 getPanelConfig 也确实下发了 `displayName="产品管控等级"`,
 *   但**纸面表头仍显示「产品管控类型」**。
 *
 * 根因(2026-10-27 实测定位):
 *   grid 的**标签格**渲染时传的是 `c.label`(纯纸面文案),而 `fieldMap` 是按 `dataName`
 *   (= 物理列名)建的索引。中文环境 `foreign=false` 时 displayName = alias,
 *   所以只要查不到字段就整条 alias 失效 —— 而「外观要求/产品形态」作为**值格**传的是 `c.key`,
 *   恰好等于 dataName,所以它一直是好的。两类格一条对一条不对,极难看出来。
 *
 * 这组断言钉两件事:
 *   ① 源码里 effColLabel 必须有"按 label 反查"的兜底(否则本 bug 会被人手回退);
 *   ② 该兜底在 label 撞车时必须放弃(不能把 A 的别名显示到 B 上)。
 *
 * ⚠ 这是**源码断言**而不是行为单测:.vue 组件内部逻辑没法 node --test 直接跑
 *   (与 recordSheetConfigs.keys.test.js 里读 PanelxList 源码同一套做法)。
 */
const here = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(here, 'RecordSheetPanels.vue'), 'utf8')

test('#3 表头改名:effColLabel 必须按 label 反查字段(否则 grid 标签格的 alias 全失效)', () => {
  // ① 必须存在"label → 字段"的辅助索引
  assert.match(SRC, /const fieldsByLabel = computed\(/, 'effColLabel 缺 label 反查索引 fieldsByLabel')
  // ② effColLabel 的取字段顺序:先 dataName,再 label 反查
  const fn = SRC.match(/function effColLabel\(key, fallback\) \{([\s\S]*?)\n\}/)
  assert.ok(fn, '没找到 effColLabel 实现')
  assert.match(fn[1], /fieldMap\.value\.get\(key\)/, 'effColLabel 应先用 dataName 取')
  assert.match(fn[1], /fieldsByLabel\.value\.get/, 'effColLabel 必须在 dataName 取不到时按 label 反查')
  // ③ 最终仍以 displayName 优先(alias 生效的关键)
  assert.match(fn[1], /displayName/, 'effColLabel 必须优先取 displayName')
})

test('#3 label 撞车时放弃反查,不把某个字段的别名显示到另一个字段上', () => {
  const idx = SRC.match(/const fieldsByLabel = computed\(\(\) => \{([\s\S]*?)\n\}\)/)
  assert.ok(idx, '没找到 fieldsByLabel 实现')
  const body = idx[1]
  // 撞车 = 第二次遇到同一 label 时置 null;之后 get 到 null ⇒ effColLabel 回退 fallback
  assert.match(body, /m\.has\(lb\) \? null : f/, '同 label 出现两次时必须置 null(放弃反查),不能后写覆盖前写')
  assert.match(body, /lb === String\(f\.dataName/, 'label 与 dataName 相同时不必进反查表(纯噪声)')
})
