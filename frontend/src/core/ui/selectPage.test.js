/**
 * selectPage.test.js —— 下拉候选翻页
 *
 * 【用户口径·2026-10-30】「如果一个种类的物料超过了一页下拉的长度，可以提供切页选项，
 *   通过切页来选择，就不会出现明明有这个物料但是因为下拉框限制找不到」。
 *
 * 钉住四件事（都是"翻页写错"时不会报错、只会让人找不到料的地方）：
 *   ① 页码越界要**夹取**而不是给空页（空页 = 用户以为没了）；
 *   ② 末页条数按余数算，from/to 是人看的 1 起序号；
 *   ③ 空列表仍是一页（界面上显示 0 条，而不是 pages=0 导致页码按钮消失、判断反过来）；
 *   ④ 非法入参（null/负页码/0 条每页）不能抛错，落回安全值。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { SELECT_PAGE_SIZE, slicePage } from './selectPage.js'

const list = (n) => Array.from({ length: n }, (_, i) => `M-${String(i + 1).padStart(3, '0')}`)

test('每页条数 · 默认 50，首末页的 items 与 from/to 都按人看的 1 起算', () => {
  const all = list(128)
  const p1 = slicePage(all, 1)
  assert.equal(p1.page, 1)
  assert.equal(p1.pages, 3, '128 条 / 每页 50 ⇒ 3 页（末页 28 条）')
  assert.equal(p1.items.length, SELECT_PAGE_SIZE)
  assert.equal(p1.from, 1)
  assert.equal(p1.to, 50)
  assert.equal(p1.total, 128)
  const p3 = slicePage(all, 3)
  assert.equal(p3.items.length, 28)
  assert.equal(p3.from, 101)
  assert.equal(p3.to, 128)
  assert.equal(p3.items[27], 'M-128', '末页最后一条必须是全量里的最后一条（不许掉料）')
})

test('页码越界夹取 · 0/负数/超过末页都不给空页', () => {
  const all = list(60)
  assert.equal(slicePage(all, 0).page, 1)
  assert.equal(slicePage(all, -7).page, 1)
  assert.equal(slicePage(all, 99).page, 2, '超过末页 ⇒ 停在末页，而不是显示空列表')
  assert.equal(slicePage(all, 99).items.length, 10)
  assert.equal(slicePage(all, 2.9).page, 2, '小数页码取整')
})

test('空列表仍是 1 页（总数为 0），from/to 都是 0', () => {
  for (const bad of [null, undefined, [], 'nope']) {
    const r = slicePage(bad, 1)
    assert.equal(r.items.length, 0)
    assert.equal(r.pages, 1, 'pages 不许是 0，否则页脚判断会整个反转')
    assert.equal(r.total, 0)
    assert.equal(r.from, 0)
    assert.equal(r.to, 0)
  }
})

test('自定义每页条数 · 非法值落回默认', () => {
  const all = list(120)
  assert.equal(slicePage(all, 1, 10).pages, 12)
  assert.equal(slicePage(all, 2, 10).items[0], 'M-011')
  for (const bad of [0, -5, 1.5, NaN, 'x']) {
    assert.equal(slicePage(all, 1, bad).items.length, SELECT_PAGE_SIZE, `每页 ${String(bad)} 应落回 ${SELECT_PAGE_SIZE}`)
  }
})
