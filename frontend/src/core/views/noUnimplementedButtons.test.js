/**
 * noUnimplementedButtons.test.js —— 表格工具条上「点了只弹提示」的按钮必须不出现
 *
 * 【用户口径 2026-10-28】「把所有面板表格上未实现的功能的按钮去掉，现在有一些按钮点击会提示」
 *   截图里点「更多▼」弹出：`演示环境暂未实现「更多▼」，界面与 T+ 保持一致`
 *
 * 【为什么直接删而不是改成禁用/置灰】
 *   置灰的按钮仍然占位、仍然让人去点、点完仍要解释"为什么不能点"——
 *   用户明确要的是**去掉**。留一个永远点不动的按钮，等于把"这个系统有这个功能但坏了"
 *   写在界面上。没实现就不显示，等真做了再放回来。
 *
 * 【判定口径（唯一真源）】一个工具条动作算"已实现"，当且仅当它的点击处理函数里
 *   有对应的显式分支（`it === 'X'`）并 return。没有分支 ⇒ 落到末尾那句
 *   `演示环境暂未实现「...」` ⇒ 属于"未实现"，不得出现在图标列表里。
 *   本测试**动态比对**这两份清单，而不是硬编码一份"该删哪些"——
 *   以后谁真实现了某个动作，只要加分支，测试就会提示"可以放回去了"。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

/** 取某个函数体（从签名到下一个顶格 `}` 之后的第一行 `}`） */
function funcBody(name) {
  const at = src.indexOf(`function ${name}(`)
  assert.ok(at >= 0, `找不到 ${name}`)
  const end = src.indexOf('\n}\n', at)
  return src.slice(at, end > at ? end + 3 : at + 3000)
}

/** 函数里显式处理了哪些动作 */
function handledItems(body) {
  const out = new Set()
  for (const m of body.matchAll(/it === '([^']+)'/g)) out.add(m[1])
  return out
}

/** 某个数组常量里的项（去空格、去 ▼ 后缀） */
function listItems(name) {
  const m = src.match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`))
  assert.ok(m, `找不到 ${name}`)
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

const norm = (s) => s.replace(/[▼\s]/g, '')

test('图标工具条（iconA/iconB）不得包含未实现的动作', () => {
  const done = new Set([...handledItems(funcBody('onIcon'))].map(norm))
  for (const listName of ['iconA', 'iconB']) {
    for (const it of listItems(listName)) {
      if (norm(it) === '更多') continue // 「更多」是下拉触发词，单独判（见下一条）
      assert.ok(done.has(norm(it)),
        `${listName} 里的「${it}」在 onIcon 里没有实现分支（点了只会弹"演示环境暂未实现"）`)
    }
  }
})

test('右键菜单（ctxItems）不得包含未实现的动作', () => {
  const done = new Set([...handledItems(funcBody('onCtxItem'))].map(norm))
  for (const it of listItems('ctxItems')) {
    if (norm(it) === '更多') continue
    assert.ok(done.has(norm(it)),
      `ctxItems 里的「${it}」在 onCtxItem 里没有实现分支`)
  }
})

test('「更多▼」本身也必须去掉（它整颗都是未实现的）', () => {
  const done = new Set([...handledItems(funcBody('onIcon'))].map(norm))
  assert.ok(!done.has('更多'),
    '「更多」没有任何实现分支 ⇒ 它的按钮不该留在工具条上')
  assert.ok(!listItems('iconA').some((x) => norm(x) === '更多'),
    'iconA 不该再含「更多」—— 点它只会弹提示')
  assert.ok(!listItems('iconB').some((x) => norm(x) === '更多'),
    'iconB 不该再含「更多」')
  assert.ok(!listItems('ctxItems').some((x) => norm(x) === '更多'),
    'ctxItems 不该再含「更多」')
})

test('「Ctrl+V列粘贴」「定位」「从剪贴板粘贴」「批量修改」「销售订单查询」「存货中心」都不能留（均无实现）', () => {
  const all = [...listItems('iconA'), ...listItems('iconB'), ...listItems('ctxItems')].map(norm)
  for (const dead of ['Ctrl+V列粘贴', '从剪贴板粘贴', '批量修改', '销售订单查询', '存货中心']) {
    assert.ok(!all.includes(dead), `「${dead}」没有实现分支，不该出现在任何一份工具条清单里`)
  }
  // 「定位」只在右键菜单里有实现（onCtxItem），图标条里没有 ⇒ 图标条不该有它
  assert.ok(!listItems('iconA').map(norm).includes('定位'), 'iconA 的「定位」未实现')
  assert.ok(!listItems('iconB').map(norm).includes('定位'), 'iconB 的「定位」未实现')
})

test('保留确实能用的三项：复制到剪贴板 / 另存为EXCEL模板 / 现存量提取', () => {
  const done = new Set([...handledItems(funcBody('onIcon'))].map(norm))
  assert.ok(done.has('复制到剪贴板'), '复制到剪贴板有实现，应保留')
  assert.ok(done.has('另存为EXCEL模板'), '另存为EXCEL模板有实现，应保留')
  assert.ok(done.has('现存量提取'), '现存量提取有实现，应保留（仅 iconB）')
  assert.ok(listItems('iconB').map(norm).includes('现存量提取'), 'iconB 应保留现存量提取')
})
