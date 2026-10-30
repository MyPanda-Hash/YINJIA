/**
 * recordSheetGroupPages.test.js —— 「保存后能切组查看 + 按组出纸」的契约守卫
 *
 * 【需求来源】用户 2026-10-29 口径:
 *   「实验室使用记录表里面改过的 3 个面板在保存之后没有办法进行切换去查看对应的数据,
 *    只能是在最后保存停留的那页数据看得到,到时候打印也应该是有多少个下拉切换就打印对应页面的多少张」
 *
 * 【为什么用源码断言而不是 mount 测试】这三处的关键点都是「**渲染条件**是否还绑着 editable」
 *   与「打印/导出是否读了 groupPages」。mount 整张 RecordSheetPanels(含 Element Plus、
 *   axios、附件上传、jsPDF 动态 import)成本极高且脆弱;而这类回归几乎都发生在
 *   「有人顺手把 `editable &&` 加回去」这一行上 —— 源码断言正好钉住它。
 *   分组算法的行为本身由 recordGroup.test.js 覆盖(groupValues 的 5 条用例)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('只读态的分组下拉必须仍可切换（不能又被 editable 挡回去）', () => {
  // 副标题里的分组下拉:条件必须是 editable || isGroupHead(...)
  const m = panels.match(/v-if="cfg\.subtitle\.type === 'select' && \(editable \|\| isGroupHead\(cfg\.subtitle\.key\)\)"/)
  assert.ok(m, '副标题分组下拉的 v-if 应为 (editable || isGroupHead(...))，否则保存后无法切换查看')
  // 且必须走 onGroupHeadChange(只读只改视图、不写头字段)
  assert.match(panels, /@update:model-value="\(v\) => onGroupHeadChange\(cfg\.subtitle\.key, v\)"/)
  // 只读切组不能标 dirty
  const fn = panels.slice(panels.indexOf('function onGroupHeadChange'), panels.indexOf('function onGroupHeadChange') + 600)
  assert.match(fn, /if \(props\.editable\)/, 'onGroupHeadChange 要区分可编辑/只读两种口径')
  assert.match(fn, /viewGroup\.value = val/, '只读态写 viewGroup，不写 head')
  assert.ok(!/@change="emit\('dirty'\)"/.test(fn), '只读切组不能触发 dirty')
})

test('换单/换面板要清掉只读视图位置（不能把上一张单看的组带过来）', () => {
  assert.match(panels, /watch\(\(\) => \[props\.panelCode, props\.head\?\.\['单据编号'\], props\.head\?\.\['编号'\]\], \(\) => \{ viewGroup\.value = null \}\)/)
})

test('组件要向下暴露 groupPages / setViewGroup / getViewGroup（打印与导出共用）', () => {
  const ex = panels.slice(panels.indexOf('defineExpose({'), panels.indexOf('defineExpose({') + 1200)
  assert.match(ex, /groupPages:/, 'defineExpose 必须暴露 groupPages')
  assert.match(ex, /setViewGroup:/, 'defineExpose 必须暴露 setViewGroup')
  assert.match(ex, /getViewGroup:/, 'defineExpose 必须暴露 getViewGroup')
})

test('导出 PDF：按「页 × 组」两层出纸，且收尾还原页签与分组', () => {
  // 2026-10-30 起「逐页截图」这段被抽成 collectSheetShots（导出 PDF 与打印共用同一份走纸逻辑）
  const at = list.indexOf('async function collectSheetShots')
  const fn = list.slice(at, at + 3200)
  assert.match(fn, /const groups = Array\.isArray\(comp\?\.groupPages\)/, '采集要读 groupPages')
  assert.match(fn, /for \(const gv of perGroup\)/, '每组各截一张')
  assert.match(fn, /comp\.setViewGroup\(startGroup\)/, '收尾要把分组切回来，别把界面停在别的设备上')
  // 导出必须仍走这份采集，否则两条路的版式会各自漂移
  const pdfAt = list.indexOf('async function buildSheetPdfBlob')
  assert.match(list.slice(pdfAt, pdfAt + 800), /await collectSheetShots\(\)/, '导出 PDF 必须复用 collectSheetShots')
})

test('打印：多页签/多组走逐张出纸（window.print 只能印当前 DOM）', () => {
  const at = list.indexOf('async function printApprovalSheet')
  const nx = list.indexOf('\nasync function ', at + 10)
  const fn = list.slice(at, nx > at ? nx : at + 5000)
  assert.match(fn, /const groups = Array\.isArray\(comp\?\.groupPages\)/, '打印要读 groupPages')
  // 2026-10-29 条件扩成「多页签 或 多组」:多页签同样只能靠逐张截图出纸
  // (window.print 只印当前页签那一张)。见 sheetPrintAllTabs.test.js。
  // 2026-10-30 起出纸实现改为 openSheetPrint（写 HTML + 原生打印预览，不再交 blob PDF 给阅读器）。
  assert.match(fn, /if \(pageCount > 1 \|\| groups\.length > 1\)/, '多页签或多组都走逐张出纸')
  assert.match(fn, /openSheetPrint\(/, '逐张出纸走 openSheetPrint')
  // 单组/单页面板仍走老的 window.print()
  assert.match(fn, /window\.print\(\)/, '单组保留原生打印路径')
})

test('行内「＋」是「在本行下方插入」，表底按钮才是追加到末尾', () => {
  const fn = panels.slice(panels.indexOf('function addRow(dt, afterRow)'), panels.indexOf('function addRow(dt, afterRow)') + 1600)
  assert.match(fn, /if \(afterRow && at >= 0\) arr\.splice\(at \+ 1, 0, row\)/, '有 afterRow 时插在它下面')
  assert.match(fn, /else arr\.push\(row\)/, '没有 afterRow 时追加到末尾')
  // 行内按钮两个分支都要把当前行传进去
  const hits = [...panels.matchAll(/class="rs-op-add"[^>]*@click="addRow\(dt, (row|r\.row)\)"/g)]
  assert.ok(hits.length >= 2, `行内「＋」应把本行传给 addRow（找到 ${hits.length} 处，期望 ≥2）`)
})

test('组装工艺清单的标准库可新增/修改变体（不能只剩「选一条替换」）', () => {
  assert.match(panels, /新增变体/, '变体库弹窗要有「新增变体」表单标题')
  assert.match(panels, /async function saveAsmVariant\(/, '要有保存变体的实现')
  const fn = panels.slice(panels.indexOf('async function saveAsmVariant'), panels.indexOf('async function saveAsmVariant') + 1800)
  assert.match(fn, /lib: 'asm\.proc'/, '新增走 asm.proc 库')
  assert.match(fn, /\/stdlib\/update/, '修改走 /stdlib/update')
  assert.match(fn, /已有同名变体/, '同一变体名不能重复入库')
})

test('原水水质条件由元数据驱动（不再把 8 个指标写死在模板里）', () => {
  const vue = readFileSync(new URL('./DataRecordSheet.vue', import.meta.url), 'utf8')
  assert.match(vue, /WATER_DEFAULT/, '要有内置兜底清单（未配元数据的老环境行为不变）')
  assert.match(vue, /props\.metadata\?\.waterIndicators/, '指标列要从 metadata 读')
  assert.match(vue, /v-for="\(w, wi\) in waterCols"/, '指标格要循环渲染')
  assert.match(vue, /saveRowLabels/, '改名要走 /px/saveRowLabels')
  // 行标题可编辑
  assert.match(vue, /waterRowDraft/, '行标题要有草稿输入')
})

test('后端配置键名与解析方法一致（editableRowLabels，不能少个 s）', () => {
  // frontend/src/core/views → 上溯 4 级到仓库根，再进 backend
  const reg = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelRegistry.java', import.meta.url), 'utf8')
  const fn = reg.slice(reg.indexOf('public List<String> editableRowLabels()'), reg.indexOf('public List<String> editableRowLabels()') + 700)
  assert.match(fn, /config\.contains\("editableRowLabels"\)/, 'contains 用的是复数键')
  assert.match(fn, /path\("editableRowLabels"\)/, 'path 用的是复数键')
})
