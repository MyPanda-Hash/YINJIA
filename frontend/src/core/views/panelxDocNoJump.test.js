/**
 * panelxDocNoJump.test.js —— 「按单号打开一张单」的回归闸（2026-11-20）
 *
 * 【用户报障】「研发管理 › 样品进度跟踪」点单号/点行，页面不跳到对应的样品单。
 *  生产取证（谢琴 xieqin，非管理员、无 view_all）：
 *    · 进度页 17 行（/px/sampleFlow 全表），单据列表只有 1 行（queryDocs 按 asp_user1 过滤）；
 *    · 点击别人的行 → 面板列表页的 ?focus= 在**当前列表**里找不到 → 停在她自己那张单，
 *      URL 变了但纸面没变，用户观感「点了没反应」。
 *
 * 【修法】跨页打开某张单必须用 `?docNo=`（applyDocNoQuery → 条件 _docNo），不能用 ?focus=
 *  （focus 是按"当前列表下标"定位，天然受分页/页签/可见范围影响）。这里守 3 件事：
 *   ① 定向取数有 0 行兜底：清掉 _docNo、恢复列表、明确提示，绝不静默留在 0/0 空白页；
 *   ② applyDocNoQuery 的三个入口（切面板 / 同面板换单 / 首次挂载）都走同一段兜底；
 *   ③ 提示词有英文词条（AGENTS §2.1 多语言红线）。
 *
 * 写法照 railStatusTabs.test.js：node:test + readFileSync 读源码断言（不引 vue 运行时）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

function sliceBetween(src, anchor, endMarker) {
  const from = src.indexOf(anchor)
  assert.notEqual(from, -1, `找不到锚点：${anchor}`)
  const to = src.indexOf(endMarker, from + anchor.length)
  assert.notEqual(to, -1, `找不到结束锚点：${endMarker}`)
  return src.slice(from, to)
}

test('?docNo= 定向取数 0 行：清筛选 + 恢复列表 + 明确提示（不留 0/0 空白页）', () => {
  const seg = sliceBetween(list, 'async function loadDocNoTarget()', '// 同一面板内跳另一张单据')
  assert.match(seg, /shouldRestoreAfterDocNo\(no, list\.value\)/, '用纯函数判定是否回退（docFocus.js 已单测）')
  assert.match(seg, /delete condition\['_docNo'\]/, '回退要撤掉定向筛选')
  assert.match(seg, /docQueryNo\.value = ''/, '「查询单据」输入框同步清空')
  assert.match(seg, /ElMessage\.warning\(tt\('未找到该单据/, '必须给用户明确说明')
  const loads = [...seg.matchAll(/await load\(/g)].length
  assert.equal(loads, 2, `定向取数一次 + 回退后恢复一次，共 2 次 load；实际 ${loads} 次`)
})

test('applyDocNoQuery 的三个入口都走 loadDocNoTarget（切面板 / 换单 / 首次挂载）', () => {
  const calls = [...list.matchAll(/if \(applyDocNoQuery\(\)\)[^\n]*/g)].map((m) => m[0].trim())
  assert.ok(calls.length >= 2, `至少切面板与换单两个入口；实际 ${calls.length}`)
  for (const c of calls) assert.match(c, /loadDocNoTarget\(\)/, `入口必须走兜底：${c}`)
  assert.match(list, /applyDocNoQuery\(\)\) loadDocNoTarget\(\)/, '首次挂载入口：有 docNo 走兜底，否则正常 load')
})

test('提示词有英文词条（切 en 不回落中文）', () => {
  assert.match(en, /'未找到该单据（可能已作废或没有查看权限）':\s*'[^']+'/, 'en.js 缺词条')
})
