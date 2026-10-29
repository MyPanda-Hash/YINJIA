/**
 * wideSheetNarrow.test.js —— 两张工艺清单的纸宽从 1040 收到 780
 *
 * 【需求来源】用户 2026-10-29 口径:
 *   「过宽的可以把表格适当收窄,因为有一些表格内容不多,但是占用了大部分的空白,
 *    调整完之后再给原生打印也加等比缩放」→ 追问后选定 **A. 只收宽表本身**。
 *
 * 【为什么只收这两张】逐列实测(见 tools/archive/_print-all-tabs-20261029/_q-emptyspace.mjs):
 *   数据记录表(阻垢性能/压降精度/矿化/抗菌/浸泡/碱性等)的"空列"是**录入网格**,
 *   不是浪费 —— 收窄等于把将来要填数据的位置压到 60px,属版面重做,用户已明确不做(A 方案)。
 *   真正"内容不多却占满宽度"的只有 成型工艺清单 / 组装工艺清单 这两张 1040px 的工艺表。
 *
 * 【为什么是 780】与产品信息表同宽(130+260+130+260),一张 A4 上缩放比从 70% 提到 94%;
 *   同时保持四列结构(标签 130 / 值 260),不改变任何字段的数据键。
 *
 * ⚠ 收窄网格必须同时收窄**数据表自己的列宽**(带 w 的列会自持 colgroup):
 *   dtW(dt) = 可见列 w 之和,若与网格不相等,表格就比上方章节宽或窄
 *   (2026-10-28 组装BOM表踩过,见 asmBomColumns.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const TARGET = 780
const PANELS = ['RD_MOLD_PROC', 'RD_ASM_PROC']

/** 某面板某页的网格合计 */
function gridSum(cfg, pageIdx) {
  const p = cfg.pages ? cfg.pages[pageIdx] : null
  const g = (p && p.grid) || cfg.grid || []
  return g.reduce((a, b) => a + b, 0)
}

test('① 两张工艺清单所有页的网格都收到 780(含修订记录页)', () => {
  const problems = []
  for (const panel of PANELS) {
    const cfg = recordSheetConfigs[panel]
    assert.ok(cfg, panel + ' 配置不存在')
    const n = (cfg.pages || [null]).length
    for (let i = 0; i < n; i++) {
      const s = gridSum(cfg, i)
      if (s !== TARGET) problems.push(`${panel} page${i} 网格合计 ${s},应为 ${TARGET}`)
    }
    // 面板级 grid 也要同步(未按页声明的路径会用面板级)
    if (Array.isArray(cfg.grid)) {
      const s = cfg.grid.reduce((a, b) => a + b, 0)
      if (s !== TARGET) problems.push(`${panel} 面板级 grid 合计 ${s},应为 ${TARGET}`)
    }
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})

test('② 组装工艺清单保持四列结构 130/260/130/260;成型工艺清单保持原列数只缩宽', () => {
  const problems = []
  // 组装工艺清单:四列(标签+值 成对),收窄只改数值不改列数
  const asm = recordSheetConfigs.RD_ASM_PROC
  const EXPECT4 = JSON.stringify([130, 260, 130, 260])
  if (Array.isArray(asm.grid) && JSON.stringify(asm.grid) !== EXPECT4) {
    problems.push(`RD_ASM_PROC 面板级 grid = ${JSON.stringify(asm.grid)}`)
  }
  ;(asm.pages || []).forEach((p, i) => {
    if (p.grid && JSON.stringify(p.grid) !== EXPECT4) {
      problems.push(`RD_ASM_PROC page${i} grid = ${JSON.stringify(p.grid)}`)
    }
  })

  // 成型工艺清单:11 列 / 13 列(按设计),收窄**只缩宽度,列数不变**
  const mold = recordSheetConfigs.RD_MOLD_PROC
  const EXPECT_NCOLS = [11, 13, 11]   // 工艺清单 / 配方 / 修订记录
  if (Array.isArray(mold.grid) && mold.grid.length !== EXPECT_NCOLS[0]) {
    problems.push(`RD_MOLD_PROC 面板级 grid 列数 ${mold.grid.length},应为 ${EXPECT_NCOLS[0]}`)
  }
  ;(mold.pages || []).forEach((p, i) => {
    if (p.grid && p.grid.length !== EXPECT_NCOLS[i]) {
      problems.push(`RD_MOLD_PROC page${i} grid 列数 ${p.grid.length},应为 ${EXPECT_NCOLS[i]}`)
    }
  })

  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})

test('③ 自持列宽的数据表:可见列 w 之和必须等于 780(colgroup 不能比章节宽/窄)', () => {
  const problems = []
  for (const panel of PANELS) {
    const cfg = recordSheetConfigs[panel]
    for (const [i, dt] of (cfg.dataTables || []).entries()) {
      const vis = (dt.cols || []).filter((c) => !c.hiddenCol)
      const hasW = vis.some((c) => c.w)
      if (!hasW) continue    // 不持宽的表格跟随网格,无需检查
      const s = vis.reduce((a, c) => a + (Number(c.w) || 0), 0)
      if (s !== TARGET) {
        problems.push(`${panel} dt${i}(${dt.bar || dt.pageTitle || ''}) 可见列 w 合计 ${s},应为 ${TARGET}`)
      }
    }
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})

test('④ 修订记录表列宽重排后仍然合理(备注/更改内容不能被压到不可用)', () => {
  for (const panel of PANELS) {
    const dts = recordSheetConfigs[panel].dataTables || []
    const rev = dts.find((d) => d.filterVal === '修订记录')
    assert.ok(rev, panel + ' 缺修订记录表')
    const vis = rev.cols.filter((c) => !c.hiddenCol)
    const byKey = Object.fromEntries(vis.map((c) => [c.label || c.key, c.w]))
    assert.ok(byKey['更改内容'] >= 200, `${panel} 更改内容 ${byKey['更改内容']}px 太窄`)
    assert.ok(byKey['更改原因'] >= 130, `${panel} 更改原因 ${byKey['更改原因']}px 太窄`)
    assert.ok(byKey['备注'] >= 110, `${panel} 备注 ${byKey['备注']}px 太窄`)
  }
})
