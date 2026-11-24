/**
 * colWidth.test.js —— 报表列宽「按内容展开」的钉子(用户口径 2026-11-23)
 *
 * 【用户口径】「这些最基础的内容 … 需要默认完全展开而不是关闭的」,附《出货检验（功能）明细表》截图:
 *   单据编号/工单号/产品名称/规格型号/批次号 全是 `ZC-2026-11...` 这种省略号。
 *
 * 【钉住三件事】
 *   ① 纯函数口径:列宽 = max(列名宽, yj_field.width, 内容宽 + 内边距),到上限就 wrap;
 *   ② 内容宽必须**偏大**取值 —— 实测差 2px 仍出省略号(条码面板 CGRK-20261014-03414 145px 列);
 *   ③ 组件真的用了它:PanelxList 里 reportColW 走 fitColWidth、wrap 列关掉 show-overflow-tooltip。
 *      只改纯函数不改渲染层 = 白改(仓库踩过:元数据改了但界面没变)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REPORT_COL_MAX, textPx, contentPx, fitColWidth, needsWrap } from './colWidth.js'

const panelx = readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8')

test('① 内容比列名长 ⇒ 列宽跟着内容走(单据编号 15 位 160 放得下)', () => {
  // 旧口径:colW('单据编号') = 4*16+30 = 94 → 96;15 位编号实测单元格要 111px 才不出省略号
  const w = fitColWidth(96, 0, ['ZC-2026-10-0131'])
  assert.ok(w >= 120, `15 位单号要比旧的 96px 明显宽(实测要 111px),实际 ${w}`)
  assert.ok(w <= REPORT_COL_MAX)
})

test('② 中文品名/规格按全角宽算(X烧结PP复合阻垢碳棒/滤芯 要 163px)', () => {
  const w = fitColWidth(96, 0, ['X烧结PP复合阻垢碳棒/滤芯'])
  assert.ok(w >= 163, `中文品名 163px 放不下,实际 ${w}`)
})

test('③ 没配宽度、内容也短 ⇒ 保底用列名宽(不缩成 0)', () => {
  assert.equal(fitColWidth(96, 0, []), 96)
  assert.equal(fitColWidth(136, 0, ['2026-11-13']), 136)
})

test('④ yj_field.width 是下限:配了 200 就至少 200(迁移里 产品名称/客户名称 就是 200)', () => {
  assert.equal(fitColWidth(96, 200, ['T410']), 200)
  // 元数据宽度也压不过内容:内容更宽时按内容
  assert.ok(fitColWidth(96, 120, ['X'.repeat(40)]) > 120)
})

test('⑤ 到上限就截宽并交给 wrap(长段落换行全文显示,而不是继续加宽)', () => {
  const long = '将炭棒水平放置在水平面板上，设置下压速度5mm/min，按测试键，仪器自动下压，断裂后读取压断时最大力压力值。 控制标准：>50kgf'
  const w = fitColWidth(96, 260, [long])
  assert.equal(w, REPORT_COL_MAX)
  assert.equal(needsWrap(w), true)
  assert.equal(needsWrap(REPORT_COL_MAX - 1), false)
})

test('⑥ 文字宽度估算必须偏大:CGRK-20261014-03414 与 ZC-2026-11-0006 都不许少算', () => {
  // 实测:18 位半角单号 121px 文字 + 24px 内边距 = 145px(比按 6.2px/字算多 2px,差一点就出省略号)
  assert.ok(textPx('CGRK-20261014-03414') >= 121)
  assert.ok(textPx('ZC-2026-11-0006') >= 95)
  // 全角按 12px 以上
  assert.ok(textPx('合格') >= 24)
  assert.equal(contentPx(['', null, undefined, '合格']), textPx('合格'))
  assert.equal(contentPx([]), 0)
})

test('⑦ 组件真接了纯函数(只改纯函数不改渲染层 = 白改)', () => {
  assert.match(panelx, /import \{ fitColWidth, needsWrap \} from '@core\/report\/colWidth'/)
  assert.match(panelx, /function reportColW\(field, prop\) \{[\s\S]{0,400}?return fitColWidth\(colW\(field\), field\.width, values\)/)
  assert.match(panelx, /wrap: needsWrap\(width\)/)
  // 报表表格的两处列(散列 + 分组子列)都要按 wrap 关掉省略号
  assert.match(panelx, /:show-overflow-tooltip="!column\.wrap"/)
  assert.match(panelx, /:show-overflow-tooltip="!child\.wrap"/)
})
