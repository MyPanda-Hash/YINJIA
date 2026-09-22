/**
 * recordSheetConfigs.docno.test.js —— 报告头「公司名 / 编号」分列 = 设计原表 !merges 固化(2026-09-22)
 *
 * 为什么单独一条:报告头第 1 行的「公司名格 | 编号格」以前由**动态算法**决定
 * (RecordSheetPanels.vue 的 dynamicDocnoSpan:从最后一列向左并列凑 ≥160px)。
 * 列宽凑出来的位置与设计原表并不一致 —— 例:碱性设计公司名格 12 列 + 编号格 1 列,
 * 动态算法给的是 11+2(**总列数对、切开的位置错**),纸面上公司名格的右竖线落在第 11/12 列之间。
 * 现在改为按设计**显式切分**(head.noSpan / head.noGapSpan),本文件把实测值钉死,
 * 防止以后有人调 grid 列宽又把它算回去。
 *
 * 证据(逐张,行号取自 D:\DSHTemp\rd-cmp\records.dump.txt 的「合并区」/「格子内容」段,
 * 该 dump 由 tools/archive/_dump-xlsx.cjs 从原 xlsx 解析,不是二次加工):
 *   面板(sheet)     公司名合并区      编号格                      ⇒ 公司名列数 / [空列] / 编号列数
 *   碱性            L82  B2:M2       L111 N2=" YJ-PD-01"          ⇒ 12 / 0 / 1
 *   矿化            L145 B2:E2       L159 F2="YJ-PD-01"           ⇒ 4  / 0 / 1
 *   阻垢性能        L211 A1:J1(一格两段文字) K1 空                ⇒ 同格 / 右侧空 1 列
 *   RO保护          L270 B2:I2       L306 K2="YJ-PD-01"(J2 空)    ⇒ 8  / 1 / 1
 *   浸泡安全        L337 B2:G2(一格两段文字)                      ⇒ 同格 / 0 / 整行 6 列
 *   压降、精度      L412 B2:J2       L434 L2=" YJ-PD-01"(K2 空)   ⇒ 9  / 1 / 1
 *   功能性滤效      L9   B2:J2       L10  K2:L2="YJ-PD-01"        ⇒ 9  / 0 / 2   (该张在 DataRecordSheet.vue)
 * 编号前缀:7 张的纸面原值都是**裸编号**(无「编号：」),故 head.docnoPrefix 一律 false。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

/** 设计原表实测:noSpan=编号格占几列(0=编号与公司名同一格);noGap=没并进任一格的空列数;
 *  company=公司名格列数(0=同格版式,不单独出公司名格);evidence 只作说明用。 */
const DESIGN = {
  RD_ALKALINE: { sheet: '碱性', company: 12, noSpan: 1, noGap: 0, evidence: 'B2:M2 公司名 / N2 编号' },
  RD_MINERAL: { sheet: '矿化', company: 4, noSpan: 1, noGap: 0, evidence: 'B2:E2 公司名 / F2 编号' },
  RD_SCALE: { sheet: '阻垢性能', company: 0, noSpan: 0, noGap: 1, evidence: 'A1:J1 一格含公司名+编号 / K1 空' },
  RD_RO_PROTECT: { sheet: 'RO保护', company: 8, noSpan: 1, noGap: 1, evidence: 'B2:I2 公司名 / J2 空 / K2 编号' },
  RD_SOAK: { sheet: '浸泡安全', company: 0, noSpan: 0, noGap: 0, evidence: 'B2:G2 一格含公司名+编号(整行)' },
  RD_DROP_PREC: { sheet: '压降、精度', company: 9, noSpan: 1, noGap: 1, evidence: 'B2:J2 公司名 / K2 空 / L2 编号' },
}

/** 功能性滤效(RD_FILTER_EFF)在 DataRecordSheet.vue 里手写版式:公司名格 auto / 编号格按设计 9:2。 */
test('功能性滤效的编号格宽度 = 设计 B..L 里 K2:L2 的占比(9/2)', () => {
  const src = readFileSync(new URL('./DataRecordSheet.vue', import.meta.url), 'utf8')
  const m = src.match(/<colgroup>\s*<col style="width:([\d.]+)%"\s*\/>\s*<col style="width:([\d.]+)%"\s*\/>\s*<\/colgroup>/)
  assert.ok(m, 'DataRecordSheet.vue 报告头 colgroup 应写成设计 B..J / K..L 的百分比(9/2 分列)')
  // 设计列宽(pt,records.dump.txt L73 的 B..L):公司名 9 列 138.9 / 编号 2 列 38.13 ⇒ 78.46% / 21.54%
  assert.equal(Number(m[1]) + Number(m[2]), 100, '两格占比之和必须是 100%')
  assert.ok(Math.abs(Number(m[1]) - 78.46) < 0.05, `公司名格占比应≈78.46%,实际 ${m[1]}%`)
  assert.ok(Math.abs(Number(m[2]) - 21.54) < 0.05, `编号格占比应≈21.54%,实际 ${m[2]}%`)
})

test('报告头「公司名 / 编号」分列 = 设计原表 !merges', () => {
  const problems = []
  for (const [panel, d] of Object.entries(DESIGN)) {
    const cfg = recordSheetConfigs[panel]
    if (!cfg) { problems.push(`${panel} 配置不存在`); continue }
    const h = cfg.head || {}
    const cols = cfg.grid.length
    if (h.noSpan !== d.noSpan) problems.push(`${panel}(${d.sheet}) head.noSpan=${h.noSpan},设计 ${d.noSpan}`)
    if ((h.noGapSpan || 0) !== d.noGap) problems.push(`${panel}(${d.sheet}) head.noGapSpan=${h.noGapSpan},设计 ${d.noGap}`)
    const company = h.noSpan === 0 ? 0 : cols - (h.noGapSpan || 0) - h.noSpan
    if (company !== d.company) problems.push(`${panel}(${d.sheet}) 公司名格算出 ${company} 列,设计 ${d.company}`)
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})

test('三条不比设计松的通用约束:三段跨度=grid 列数、编号格不越界、前缀与设计原值一致', () => {
  const problems = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    const h = cfg.head
    if (!h || !Array.isArray(cfg.grid) || !cfg.grid.length) continue
    // 「三段跨度 = grid 列数」只在**有信息块**时成立:info 声明为空数组的面板(产品变更申请单,
    // 纸面右侧没有密级/适用范围那四格)报告头那一行由大标题跨满全部列,title/infoLabel/infoValue
    // 三个数不参与排版(RecordSheetPanels.vue: infoSpan ? effHead.title : nCols)⇒ 不适用。
    const hasInfo = !(Array.isArray(cfg.info) && cfg.info.length === 0)
    if (hasInfo && h.title + h.infoLabel + h.infoValue !== cfg.grid.length)
      problems.push(`${panel} head 三段跨度 ${h.title}+${h.infoLabel}+${h.infoValue} ≠ grid ${cfg.grid.length} 列`)
    const gap = h.noGapSpan || 0
    if (h.noSpan !== undefined) {
      if (h.noSpan < 0) problems.push(`${panel} head.noSpan=${h.noSpan} 不能为负`)
      if (gap < 0) problems.push(`${panel} head.noGapSpan=${gap} 不能为负`)
      if (h.noSpan + gap >= cfg.grid.length)
        problems.push(`${panel} 编号格+空列 ${h.noSpan + gap} 列 ≥ grid ${cfg.grid.length} 列(公司名格会被挤成 0 列)`)
    }
  }
  for (const panel of Object.keys(DESIGN)) {
    if (recordSheetConfigs[panel].head.docnoPrefix !== false)
      problems.push(`${panel} head.docnoPrefix 应为 false(设计原值是裸编号,无「编号：」前缀)`)
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})
