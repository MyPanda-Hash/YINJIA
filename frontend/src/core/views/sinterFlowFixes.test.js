/**
 * sinterFlowFixes.test.js — 2026-11-04「烧结工艺清单录单流程」核对后修的四处(回归闸)
 *
 *   ① 外观要求 ← 产品信息表「产品形态」:label 不同名 ⇒ 必须靠后端同义词表;
 *   ② 无数据填 '/':声明式 slashWhenEmpty + 纯函数 slashFillHead(只填空格);
 *   ③ 配方计算「按产品规格一键带出」必须剥 -tb 后缀(本面板产品编号带后缀,产品信息表存原始编号);
 *   ④ 检验要求·炭棒尺寸改成「按生产车间筛型号」的下拉(配置 moldPick + 选型号回填四格)。
 *
 * 为什么用源码断言:①③④ 的落点在 Vue 组件/Java 服务里,而本仓库前端只有 node --test
 *   (没有组件挂载环境),这四条又都是"接线型"改动 —— 断言接线在,比断言 nobody-calls 更实际。
 *   纯逻辑(车间归一 / 填 '/')另有单测:core/mold/workshopNo.test.js、本文件第 2 组。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { slashFillHead } from '../insp/specCarry.js'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')

/* ── ② 无数据填 '/' ──────────────────────────────────────────────────────── */
test("② slashFillHead:只填空格,已填(含用户自己填的 '/')一律不动", () => {
  const afs = { slashWhenEmpty: ['跌落要求', '强度要求kgf', '压降标准kpa'] }
  const head = { 跌落要求: '高度50cm,跌3次无断裂', 强度要求kgf: '', 压降标准kpa: '/' }
  const filled = slashFillHead(afs, head)
  assert.deepEqual(filled, ['强度要求kgf'])
  assert.equal(head.跌落要求, '高度50cm,跌3次无断裂', '规格书带出的整句不能被覆盖')
  assert.equal(head.强度要求kgf, '/')
  assert.equal(head.压降标准kpa, '/')
})

test('② slashFillHead:没声明 slashWhenEmpty 的面板一个格都不动', () => {
  const head = { 跌落要求: '', 强度要求kgf: '' }
  assert.deepEqual(slashFillHead({}, head), [])
  assert.deepEqual(slashFillHead(null, head), [])
  assert.deepEqual(head, { 跌落要求: '', 强度要求kgf: '' })
})

test("② slashFillHead:只填点名的格,不推广到高度/次数/间距", () => {
  const afs = { slashWhenEmpty: ['跌落要求'] }
  const head = { 跌落要求: '', 跌落高度cm: '', 跌落次数: '' }
  assert.deepEqual(slashFillHead(afs, head), ['跌落要求'])
  assert.equal(head.跌落高度cm, '', '机构参数不填斜杠(会让配方计算出 NaN)')
  assert.equal(head.跌落次数, '')
})

test("② 烧结工艺清单的 autoFillSpec 声明了 slashWhenEmpty 三格", () => {
  const src = read('src/core/views/recordSheetConfigs.js')
  const at = src.indexOf("slashWhenEmpty: ['跌落要求', '强度要求kgf', '压降标准kpa']")
  assert.ok(at > 0, 'RD_MOLD_PROC.autoFillSpec 必须声明 slashWhenEmpty 三格')
})

test('② autoFillFromSpec 用 finally 兜底填 /', () => {
  const src = read('src/core/views/RecordSheetPanels.vue')
  assert.match(src, /slashFillHead\(afs, props\.head\)/)
  // 兜底必须在 finally 里:规格书没批/没有这张单时也要补 '/'
  const at = src.indexOf('async function autoFillFromSpec(')
  assert.ok(at > 0)
  const body = src.slice(at, at + 700)
  assert.match(body, /finally\s*\{/)
  assert.match(body, /autoFillFromSpecInner/)
})

/* ── ① 外观要求 ← 产品形态 ──────────────────────────────────────────────── */
test('① 后端同义词表:产品形态 → 外观要求', () => {
  // ROOT = frontend/ ⇒ 仓库根是 ../
  const src = readFileSync(new URL('../backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java', ROOT), 'utf8')
  assert.match(src, /Map\.entry\("产品形态",\s*List\.of\("外观要求"\)\)/,
    'RD_MOLD_PROC.外观要求 与 RD_PROD_INFO.产品形态 不同名,只能靠同义词带回')
})

/* ── ③ 一键带出剥 -tb 后缀 ──────────────────────────────────────────────── */
test('③ 配方计算 carrySpec:查产品信息表前剥掉 -tb 后缀', () => {
  const src = read('src/core/views/RecipeCalcDialog.vue')
  const at = src.indexOf('async function carrySpec()')
  assert.ok(at > 0)
  const body = src.slice(at, at + 900)
  assert.match(body, /const code = rawProductCode\(productCode\.value\)/,
    '本面板产品编号存 X-tb,直接查产品信息表命中 0 行')
})

/* ── ④ 检验要求·炭棒尺寸:按车间筛型号 ──────────────────────────────────── */
test('④ 外径mm 那格声明 moldPick,四格仍在同一行', () => {
  const src = read('src/core/views/recordSheetConfigs.js')
  const at = src.indexOf("{ key: '外径mm', span: 2, moldPick: true }")
  assert.ok(at > 0, '外径mm 必须是「选型号」格')
  const row = src.slice(at, at + 260)
  for (const k of ['外径公差', '内径mm', '内径公差']) assert.ok(row.includes(k), `四格必须同行:${k}`)
})

test('④ 组件:型号下拉按生产车间筛,选中回填四格', () => {
  const src = read('src/core/views/RecordSheetPanels.vue')
  assert.match(src, /const moldRowsInWorkshop = computed\(\(\) => sinterRowsForWorkshop\(/)
  assert.match(src, /function applyMoldModel/)
  assert.match(src, /sinterPatch\(row\)/, '回填走 sinterPatch(与配方计算同一套键)')
  assert.match(src, /panelCode: 'PROD_MOLD'/, '候选来自生产模具表')
  assert.match(src, /c\.moldPick/, '模板要按配置开关渲染下拉')
})