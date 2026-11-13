/**
 * docSheetWidth.test.js —— 文书式面板「定死纸宽」的钉子(用户口径 2026-10-16)
 *
 * 【用户口径】「立项申请和项目实施计划的宽度是多少现在」→ 答:没有固定宽,是弹性的
 *   (纸宽 = 窗口宽 − 398px:右侧 176px 操作栏 + 门户 222px;1600 窗口实测 1202px);
 *   → 「定死纸宽 1242」。
 *
 * 【为什么必须有这条测试】纸宽在源码里**看不出来**:
 *   · DocSheet.vue 的 CSS 写的是 `.approval-sheet{width:940px;max-width:100%}`;
 *   · 但 PanelxList.vue 的 `.approval-layout :deep(.approval-sheet){flex:1;min-width:0}` 把它变成
 *     弹性撑满(flex-basis 归 0)⇒ **只写 width 一点都不生效**,实测 1600 窗口是 1202px。
 *   所以「定宽」= width + flex:none + max-width:none 三件套,少任何一件都会退回弹性。
 *   单测跑不了 CSS/模板分支,按仓库既有做法读源码钉住(同 rdChangeConfig.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FIXED_SHEET_W, fixedSheetWidth } from './docSheetConfigs.js'

const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const cfgs = readFileSync(new URL('./docSheetConfigs.js', import.meta.url), 'utf8')

/** 从 docSheetConfigs.js 里取某张表格式纸面的 grid.cols 宽度和（源码级解析，避免 import 副作用） */
function gridColsSum(exportName) {
  const m = cfgs.match(new RegExp(`export const ${exportName} = \\{[\\s\\S]*?\\n\\}`))
  assert.ok(m, `找不到 ${exportName}`)
  const ws = [...m[0].matchAll(/\{ key: '[^']+', label: '[^']+', w: (\d+)/g)].map((x) => Number(x[1]))
  assert.ok(ws.length > 0, `${exportName} 里没解析到列宽`)
  return ws.reduce((a, b) => a + b, 0)
}

test('表格式纸面的纸宽必须等于列宽之和(否则纸右缘空档 + 列被拉宽)', () => {
  // 2026-11-11 实测缺陷：内部样品单 FIXED_SHEET_W 写 1450，而 13 列只占 1220
  //   ⇒ 纸面右侧一条 229px 空档、表体只占左边 1221px、标题被滚动容器裁掉 67px。
  // 口径：纸宽 = Σ列宽（DocSheet 的 .sg-table 用 width:gridW 定宽，两者不等就一定错位）。
  const pairs = [
    ['RD_SAMPLE_EXT', 'sampleExtSheetCfg'],
    ['RD_SAMPLE_INT', 'sampleIntSheetCfg'],
  ]
  for (const [panelCode, exportName] of pairs) {
    const sum = gridColsSum(exportName)
    assert.equal(fixedSheetWidth(panelCode), sum,
      `${panelCode} 纸宽 ${fixedSheetWidth(panelCode)} ≠ ${exportName} 列宽和 ${sum}`)
  }
})

test('定死纸宽:立项申请/项目实施计划都是 1242px', () => {
  assert.equal(fixedSheetWidth('RD_APPROVAL'), 1242)
  assert.equal(fixedSheetWidth('RD_PLAN'), 1242)
  assert.equal(FIXED_SHEET_W.RD_APPROVAL, 1242)
  assert.equal(FIXED_SHEET_W.RD_PLAN, 1242)
})

test('其余文书式面板不受影响(返回 0 = 保持自适应弹性宽)', () => {
  // 反例守卫:哪天有人顺手把全部文书面板都定死了,这条会红
  for (const code of ['QC_TC_IN', 'QC_BHG', 'RD_PROGRESS', 'RD_PROD_DOCLIST', '']) {
    assert.equal(fixedSheetWidth(code), 0, `${code} 不应被定死纸宽`)
  }
  assert.equal(fixedSheetWidth(undefined), 0)
  assert.equal(fixedSheetWidth(null), 0)
})

test('纸面根节点真的套上了 sheetStyle(否则配置只是摆设)', () => {
  // 2026-11-11 起根节点多了 ref="sheetRef"(窄窗缩放要量容器宽),故只要求 class + :style 都在
  assert.match(docSheet, /<div[^>]*class="approval-sheet"[^>]*:style="sheetStyle"/, '模板根节点必须绑定 :style="sheetStyle"')
  // 2026-10-28:同一行还 import 了 docnoLabel(右上角编号格标识),故只钉"从 docSheetConfigs 取"
  assert.match(docSheet, /import \{[^}]*\bfixedSheetWidth\b[^}]*\} from '\.\/docSheetConfigs'/,
    '必须从 docSheetConfigs 取宽度表')
})

test('定宽三件套齐备:width + maxWidth:none + flex:none', () => {
  // flex:none 是**必须**的一条:外层 .approval-layout 的 flex:1(flex-basis:0)会把 width 吃掉
  const m = docSheet.match(/const sheetStyle = computed\(\(\) => \{[\s\S]*?\n\}\)/)
  assert.ok(m, '找不到 sheetStyle 计算属性')
  const body = m[0]
  assert.match(body, /width: w \+ 'px'/, '要写死宽度')
  assert.match(body, /maxWidth: 'none'/, '要解除 CSS 的 max-width:100%')
  assert.match(body, /flex: 'none'/, '要解除外层 flex:1 的弹性撑满(否则 width 不生效)')
  // 2026-11-11 起返回值可能带 zoom(窄窗缩放),三元可能写成多行 ⇒ 只钉"未定宽时仍返回 null"
  assert.match(body, /: (isGrid\.value \? [\s\S]*?: )?null/, '未配置定宽的面板要返回 null(不套内联样式)')
})

test('打印/导出仍是整页宽(定宽不能压过 @media print 的 !important)', () => {
  // 打印分支用的是带 !important 的 width:100%,内联样式压不过它 —— 这条防的是"把 !important 删了"
  assert.match(docSheet, /body\.approval-printing \.approval-sheet \{[\s\S]*?width: 100% !important/)
})

test('定宽纸外面套了横向滚动容器,右侧操作栏不会被顶出视口', () => {
  // 定死 1242 后,窄窗(如 1280)纸比容器宽 —— 没有这个容器,176px 的操作栏会整条被推出屏幕外
  assert.match(panelx, /<div v-else class="sheet-scroll">/, 'DocSheet 分支要包一层 .sheet-scroll')
  assert.match(panelx, /\.approval-layout > \.sheet-scroll \{[\s\S]*?overflow-x: auto/, '.sheet-scroll 要横向可滚动')
  // v-else 必须留在容器上:挪到容器内部的 <DocSheet> 上会让 v-if/v-else 链断掉(编译报错)
  assert.ok(!/class="sheet-scroll"[\s\S]{0,200}<DocSheet v-else/.test(panelx), 'v-else 不能被留在容器里面')
})
