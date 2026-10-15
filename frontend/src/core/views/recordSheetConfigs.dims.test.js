/**
 * recordSheetConfigs.dims.test.js —— 「外径排在内径之前」是我们表头的既定惯例,钉死它
 *
 * 【为什么要有这条】
 * 2026-10-16 用户口径:「把研发管理里面的产品信息表的内径跟外径两个位置换一下,
 * 一般都是**外径*内径*长度**来表示,其他的面板有这种错误的也一起改了」。
 *
 * 而产品信息表(RD_PROD_INFO)的纸面顺序**不是** yj_field.seq 驱动的 —— 它走
 * recordSheetConfigs.js 里硬编码的记录表版式(sections → rows → pairs → cells),
 * 所以只改库里的 seq 界面上看不出来,必须连配置一起改。
 * 这正是本条测试存在的理由:光看 yj_field 会以为已经改好了。
 *
 * 【覆盖两条】
 *   A. 产品信息表「炭棒尺寸」三内格 = 外径 · 内径 · 长度(用户点名的这一处)
 *   B. 通用惯例扫描:任何面板里,只要同时出现「外径」「内径」字段,
 *      渲染顺序必须是 外径 不晚于 内径(防以后新加面板又反过来)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { recordSheetConfigs } from './recordSheetConfigs.js'

/** 按**渲染顺序**收集一个面板配置里的所有数据键(sections 的 rows→pairs→cells/key,再拼上 cols) */
function collectKeysInOrder(cfg) {
  const out = []
  const pushPair = (p) => {
    if (!p) return
    if (Array.isArray(p.cells)) for (const c of p.cells) if (c && c.key) out.push(String(c.key))
    if (p.key) out.push(String(p.key))
  }
  for (const sec of cfg?.sections || []) {
    for (const row of sec?.rows || []) {
      for (const p of row?.pairs || []) pushPair(p)
      // 少数行用 grid 铺格子(与 pairs 二选一)
      for (const g of row?.grid || []) pushPair(g)
    }
  }
  for (const c of cfg?.cols || []) if (c && c.key) out.push(String(c.key))
  return out
}

test('A. 产品信息表「炭棒尺寸」三内格顺序 = 外径 · 内径 · 长度', () => {
  const cfg = recordSheetConfigs.RD_PROD_INFO
  assert.ok(cfg, 'RD_PROD_INFO 配置必须存在')

  let cells = null
  for (const sec of cfg.sections || []) {
    for (const row of sec.rows || []) {
      for (const p of row.pairs || []) {
        if (Array.isArray(p.cells) && p.cells.some((c) => c && /炭棒(内径|外径)/.test(String(c.key)))) cells = p.cells
      }
    }
  }
  assert.ok(cells, '应能找到含 炭棒内径/炭棒外径 的三内格')

  const keys = cells.map((c) => String(c.key))
  assert.deepEqual(keys, ['炭棒外径', '炭棒内径', '炭棒长度'],
    `炭棒尺寸三内格应为「外径*内径*长度」,实为 ${JSON.stringify(keys)}`)
})

test('B. 通用惯例:任何面板里 外径 都不得排在内径之后', () => {
  const problems = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    const keys = collectKeysInOrder(cfg)
    const iOuter = keys.findIndex((k) => k.includes('外径'))
    const iInner = keys.findIndex((k) => k.includes('内径'))
    if (iOuter < 0 || iInner < 0) continue
    if (iOuter > iInner) {
      problems.push(`${panel}: 外径@${iOuter}(${keys[iOuter]}) 排在内径@${iInner}(${keys[iInner]}) 之后`)
    }
  }
  assert.deepEqual(problems, [], `外径必须在内径之前(惯例 外径*内径*长度):\n  ${problems.join('\n  ')}`)
})
