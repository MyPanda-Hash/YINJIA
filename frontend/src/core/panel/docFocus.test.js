/**
 * docFocus.test.js —— 列表页「按单号定位（?focus=）」的回归闸（2026-11-20）
 *
 * 【用户报障】「立项查询」（全屏预览浮层）里点某一行 /「跳转」，页面回到**第一张草稿**。
 *  根因：jumpToApprovalDoc 先 closeApprovalPreview()（里面 load() 一次），再 router.push 到
 *  **同一 path 只改 query** —— 组件不重挂、load 不重跑，?focus= 从来没被消费，curIdx 停在 0。
 *
 * 【本测试守什么】
 *  ① 纯函数口径：list 行契约的单号键序（编号 → 单据编号 → 锭号）、三种键都能命中、
 *     预览（pageSize=200 一页取全）下标 → 还原分页后的目标页码；
 *  ② 接线：watch(route.query.focus) 存在；命中当前 list 时只设 curIdx、**不再 load**；
 *     未命中才 load() 一次（并按预览下标换页 / 被页签挡住时回「全部」）；
 *     定位后 router.replace 摘掉 focus（后退回来不重复跳）；
 *  ③ 深链行为不被改坏：load() 里既有的 ?focus= 定位段原样保留；
 *     切面板的深链继续由 panelCode watcher 的 load() 消费（loadedPanelCode 闸门，不许抢跑）；
 *  ④ 跳转按**当前面板**拼地址（产品信息表跳转不能被带去立项申请列表）。
 *
 * 写法照 railStatusTabs.test.js：node:test + readFileSync 断言源码（不引 vue 运行时）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { docNoOf, findDocIndex, pageOfPreviewIndex } from './docFocus.js'

const list = readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

/* ── ① 纯函数：单号键序与页码换算 ─────────────────────────────── */

test('docNoOf: list 行单号键序 = 编号 → 单据编号 → 锭号（空/非对象返回空串）', () => {
  // QueryService.loadDocs 对每张单都落 `doc.put("编号", no)`；其余键是历史面板的兜底
  assert.equal(docNoOf({ 编号: 'LXA-1', 单据编号: 'LXA-1' }), 'LXA-1')
  assert.equal(docNoOf({ 单据编号: 'LXA-2' }), 'LXA-2', '只有单据编号的面板(立项/产品信息表字段)也要认')
  assert.equal(docNoOf({ 锭号: 'D-3' }), 'D-3', '锭号面板的兜底键')
  // 产品信息表：行上有 单据编号 与 编号(=group_col) 同值；只有 编号 时也要能跳
  assert.equal(docNoOf({ 编号: 'PI-2026-10-0001', 产品编号: 'CB-1' }), 'PI-2026-10-0001')
  assert.equal(docNoOf({ 编号: '  LXA-4  ' }), 'LXA-4', '单号首尾空白要吃掉')
  assert.equal(docNoOf({}), '')
  assert.equal(docNoOf(null), '')
  assert.equal(docNoOf(undefined), '')
})

test('findDocIndex: 三种单号键都能命中；空单号/无匹配 = -1', () => {
  const rows = [
    { 编号: 'LXA-1' },
    { 单据编号: 'LXA-2' },
    { 锭号: 'D-3' },
    { 编号: 'PI-1', 产品编号: 'CB-1' },
  ]
  assert.equal(findDocIndex(rows, 'LXA-1'), 0)
  assert.equal(findDocIndex(rows, 'LXA-2'), 1)
  assert.equal(findDocIndex(rows, 'D-3'), 2)
  assert.equal(findDocIndex(rows, 'PI-1'), 3)
  assert.equal(findDocIndex(rows, '  PI-1  '), 3, 'URL 上的 focus 带空白也认')
  assert.equal(findDocIndex(rows, '不存在'), -1)
  assert.equal(findDocIndex(rows, ''), -1)
  assert.equal(findDocIndex(rows, null), -1)
  assert.equal(findDocIndex(null, 'LXA-1'), -1)
})

test('pageOfPreviewIndex: 预览 200 条的下标 → 还原分页（默认 20/页）后目标在第几页', () => {
  assert.equal(pageOfPreviewIndex(0, 20), 1)
  assert.equal(pageOfPreviewIndex(19, 20), 1, '第 1 页最后一行仍算第 1 页')
  assert.equal(pageOfPreviewIndex(20, 20), 2, '第 21 行 = 第 2 页第 1 行（下标/页大小 + 1）')
  assert.equal(pageOfPreviewIndex(87, 20), 5)
  assert.equal(pageOfPreviewIndex(199, 20), 10)
  assert.equal(pageOfPreviewIndex(0, 200), 1, '预览开着时 pageSize 就是 200，仍在第 1 页')
  // 没有提示/非法 pageSize ⇒ 回第 1 页，不能算出 0 页或 NaN
  assert.equal(pageOfPreviewIndex(-1, 20), 1)
  assert.equal(pageOfPreviewIndex(undefined, 20), 1)
  assert.equal(pageOfPreviewIndex(5, 0), 6, 'pageSize 兜底 1：任何下标都落在自己那一页，不会除零')
  assert.equal(pageOfPreviewIndex(5, NaN), 6)
})

/* ── ② 接线：focus 消费的时序 ───────────────────────────────── */

/** 取一段源码：从 anchor 到下一个 endMarker（不含），找不到直接 FAIL */
function sliceBetween(src, anchor, endMarker) {
  const from = src.indexOf(anchor)
  assert.notEqual(from, -1, `找不到锚点：${anchor}`)
  const to = src.indexOf(endMarker, from + anchor.length)
  assert.notEqual(to, -1, `找不到结束锚点：${endMarker}`)
  return src.slice(from, to)
}

const consumeSrc = sliceBetween(list, 'async function consumeFocusQuery(', 'watch(')
const jumpSrc = sliceBetween(list, 'async function jumpToApprovalDoc(row) {', 'function previewSummaryFor(')

test('watch(route.query.focus)：同 path 只改 query 的那次跳转必须由它消费', () => {
  assert.match(list, /watch\(\s*\(\) => route\.query\.focus,/, '缺 ?focus= 的路由 query 监听')
  // 不是 immediate：首次挂载/外部深链那次仍交给 load()（watch 只接"已挂载后又来一个 focus"）
  const watchBlock = sliceBetween(list, 'watch(\n  () => route.query.focus,', 'watch(cfgCache')
  assert.ok(!/immediate:\s*true/.test(watchBlock), 'focus watch 不能 immediate（会与 onMounted 的首次 load 抢）')
  assert.match(watchBlock, /if \(loadedPanelCode !== String\(panelCode\.value\)\) return/,
    '切面板时（list 已被 panelCode watcher 清空）不许抢跑，深链交给那一趟 load 消费')
  assert.match(watchBlock, /consumeFocusQuery\(v\)/, 'watch 要把 focus 交给 consumeFocusQuery')
})

test('consumeFocusQuery：命中当前 list 只设 curIdx、不 load；未命中才 load 一次并摘 focus', () => {
  assert.match(consumeSrc, /let fi = findDocIndex\(list\.value, key\)/, '先按统一键序在当前 list 里找')
  assert.match(consumeSrc, /if \(fi >= 0\) curIdx\.value = fi/, '命中即把 curIdx 设到目标下标（这是报障的正面需求）')
  // 未命中分支：按预览下标换页 + 页签回「全部」后再 load —— 整段函数只允许一次 await load()
  assert.match(consumeSrc, /pageOfPreviewIndex\(/, '未命中要按预览列表下标换算页码（否则目标在第 2 页后仍回第一张）')
  assert.match(consumeSrc, /railStatusTab\.value = 'all'/, '被默认页签挡住时回退「全部」（与深链口径一致）')
  const loads = [...consumeSrc.matchAll(/await load\(/g)].length
  assert.equal(loads, 1, `focus 消费最多 load 一次（幂等，不重复取数）；实际 ${loads} 次`)
  assert.match(consumeSrc, /router\.replace\(\{ path: route\.path, query: \{ \.\.\.route\.query, focus: undefined \} \}\)/,
    '定位后必须 replace 摘掉 focus（否则后退回来又跳一次）')
  assert.match(consumeSrc, /focusConsuming = true/, '要有重入闸，避免 watch 与 load 里的消费互相触发')
})

test('jumpToApprovalDoc：按当前面板跳（产品信息表不能跑去立项申请）+ 先记下预览下标再关浮层', () => {
  assert.match(jumpSrc, /const no = docNoOf\(row\)/, '单号取值要按统一键序（单据编号/编号/锭号）')
  assert.ok(jumpSrc.indexOf('previewFocusHint') < jumpSrc.indexOf('await closeApprovalPreview()'),
    '预览下标必须在关闭浮层（会还原 pageSize 并重载）之前记下，否则下标对不上')
  assert.match(jumpSrc, /await closeApprovalPreview\(\)/, '关闭浮层还原 pageSize + 重新取数（2026-11-19 报障的既有修复）')
  assert.match(jumpSrc, /router\.push\(\{ path: `\/panelx\/list\/\$\{panelCode\.value\}`, query: \{ \.\.\.route\.query, focus: no \} \}\)/,
    '跳到**当前面板**并带 focus，且保留其它 query（产品信息表/立项申请共用这一处）')
  assert.ok(!/path:\s*['"`]\/panelx\/list\/RD_APPROVAL/.test(jumpSrc), '禁止写死 RD_APPROVAL（2026-11-19 报障原样回归）')
})

/* ── ③ 深链不被改坏 + ④ 产品信息表沿用同一函数 ─────────────── */

test('load() 里既有的 ?focus= 深链消费保持原样（外部带 focus 进入仍按原逻辑定位）', () => {
  assert.match(list, /const focus = route\.query\.focus/, 'load() 的深链消费段不能被删')
  assert.match(list, /const fi = findDocIndex\(list\.value, String\(focus\)\)/, '深链定位改用同一份键序（两处不打架）')
  // 默认页签挡住 ⇒ 回退「全部」只重取一次（既有 2026-11-11 口径）
  assert.match(list,
    /if \(fi < 0 && railStatusTabs\.value\.length && railStatusTab\.value !== 'all'\) \{\s*railStatusTab\.value = 'all'\s*query\.pageNo = 1\s*await load\(true\)/,
    '?focus= 深链的页签回退逻辑必须原样保留')
  assert.match(list, /loadedPanelCode = loadCode/, 'load 成功要把「当前 list 属于哪个面板」落账（focus 消费的时序闸门）')
})

test('全屏预览面板共用同一处跳转与 focus 消费（不按面板分叉）', () => {
  // 2026-11-20：全屏预览从"两个面板的白名单"改成规则（研发管理全部面板），
  // 跳转函数仍不许按面板分叉 —— 规则在 docPreview.isFullPreviewPanel 一处，
  // 这里钉住"没有退回白名单"与"用的是同一条规则"。
  assert.match(list, /const canFullPreview = computed\(\(\) => isFullPreviewPanel\(panelCode\.value\)\)/,
    '全屏判定必须走统一规则 isFullPreviewPanel（不要退回 RD_APPROVAL/RD_PROD_INFO 白名单）')
  assert.ok(!list.includes('FULL_PREVIEW_PANELS = new Set'),
    '白名单已改规则：不能再出现硬编码的 FULL_PREVIEW_PANELS 集合')
  assert.match(list, /const previewOwnerKey = computed\(\(\) => resolvePreviewOwnerKey\(/,
    '归属人字段必须按面板探测（不能写死"立项=申请立项人/其余=编辑人"）')
  assert.ok(!/panelCode\.value === 'RD_PROD_INFO'[\s\S]{0,200}jumpToApprovalDoc/.test(jumpSrc),
    'jumpToApprovalDoc 不能按面板分叉（修一处两处都生效）')
  // 预览浮层的列配置仍按面板登记（本次不动列/页签）
  assert.match(list, /RD_PROD_INFO: \[/, '产品信息表预览列配置不能被本次修复删掉')
})
