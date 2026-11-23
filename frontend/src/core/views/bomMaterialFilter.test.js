/**
 * 产品信息表 · 产品BOM表「直接导入采购物料清单」的类别过滤（2026-11-19 / 2026-11-23 用户口径）：
 *   只显示**采购物料** —— 裸棒 / 成品 / 滤芯 / **半成品** 一律不出现。
 *   空类别保留（历史档案有脏值为空的物料，不能因此被藏掉）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

test('排除类别含 裸棒/成品/滤芯/半成品', () => {
  const m = src.match(/const MAT_PICK_EXCLUDE_CATS = new Set\(\[([^\]]+)\]\)/)
  assert.ok(m, '缺 MAT_PICK_EXCLUDE_CATS')
  for (const c of ['裸棒', '成品', '滤芯', '半成品']) {
    assert.ok(m[1].includes(`'${c}'`), `排除类别缺 ${c}`)
  }
})

test('两条取数路径都过滤（缓存命中 + 实拉）', () => {
  const hits = src.match(/filter\(isPurchasableMaterial\)/g) || []
  assert.ok(hits.length >= 2, `应有 2 处过滤，实际 ${hits.length}`)
})

test('空类别保留（不过滤空值）', () => {
  assert.match(src, /return !cat \|\| !MAT_PICK_EXCLUDE_CATS\.has\(cat\)/, '空类别必须保留')
})
