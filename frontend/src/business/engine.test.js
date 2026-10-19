import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAllRows } from './pagedQuery.js'

/**
 * engine.test.js — 探针：`fetchAllRows` 必须把列表**翻页拉全**（2026-10-18）
 *
 * 背景（用户报「商品面板里显示没有库存」）：`fillCurrentStock` 查库存状况表时写死
 *   `{ pageNo: 1, pageSize: 500 }`，只取第一页。而 `v_stock_balance` 实测 **1366 行**
 *   ⇒ 落在第 501 行之后的存货一律匹配不到、现存量回填成 0，界面就是「没有库存」。
 * 所以这里断言：页数够多、行数拿全、边界不越界。
 */

const pager = (total, rows) => {
  const chunks = []
  for (let i = 0; i < rows.length; i += 500) chunks.push(rows.slice(i, i + 500))
  let calls = 0
  const fn = async (pageNo, pageSize) => {
    calls++
    const list = chunks[pageNo - 1] || []
    return { totalSize: total, list }
  }
  fn.calls = () => calls
  return fn
}

test('只有一页时只请求一次', async () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ 存货编码: 'A' + i }))
  const p = pager(300, rows)
  const out = await fetchAllRows(p)
  assert.equal(out.length, 300)
  assert.equal(p.calls(), 1)
})

test('库存状况表 1366 行必须全部拿到(本次 bug 的核心)', async () => {
  const rows = Array.from({ length: 1366 }, (_, i) => ({ 存货编码: 'M' + i, 现存量: 1 }))
  const p = pager(1366, rows)
  const out = await fetchAllRows(p)
  assert.equal(out.length, 1366, '1366 行必须全拿到，不能只拿前 500')
  assert.equal(p.calls(), 3, '应翻 3 页（500/500/366）')
})

test('后端不回 totalSize 时按「不满一页」判断结束', async () => {
  const rows = Array.from({ length: 640 }, (_, i) => ({ id: i }))
  let calls = 0
  const fn = async (pageNo) => {
    calls++
    const list = rows.slice((pageNo - 1) * 500, pageNo * 500)
    return { list } // 故意不给 totalSize
  }
  const out = await fetchAllRows(fn)
  assert.equal(out.length, 640)
  assert.equal(calls, 2)
})

test('空结果只请求一次并返回空数组', async () => {
  let calls = 0
  const out = await fetchAllRows(async () => { calls++; return { totalSize: 0, list: [] } })
  assert.deepEqual(out, [])
  assert.equal(calls, 1)
})

test('maxPages 兜底:后端 totalSize 异常大也不会无限翻页', async () => {
  let calls = 0
  const out = await fetchAllRows(async (pageNo) => {
    calls++
    return { totalSize: 999999, list: Array.from({ length: 500 }, (_, i) => ({ id: pageNo * 1000 + i })) }
  }, { maxPages: 3 })
  assert.equal(calls, 3)
  assert.equal(out.length, 1500)
})
