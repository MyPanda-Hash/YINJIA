/**
 * specMaterialPickSource.test.js —— 规格书「关键物料列表」的引用源改回**物料清单(WLBOM)**
 *
 * 【需求来源】用户 2026-10-29 口径(截图:规格书页 3「1.关键物料列表」上的按钮):
 *   「规格书的从商品引用改回去引用物料清单」
 *
 * 【历史沿革(别再来回摇摆)】
 *   · 2026-09-20 初版:读已下架 BOM 面板的主从结构;
 *   · 2026-10-13 恢复:改读 WLBOM「物料清单」—— 先选物料清单单,整单子件带入
 *     (用户口径「我要的是选物料编码 S032-3 / 单据日期 / 物料代码 / 物料名称,然后带入 …」);
 *   · 2026-10-21 改源:换成**商品档案 INV**(四栏级联收窄 + 勾选落行);
 *   · **2026-10-29 改回**:用户看到实际界面后要求「改回去引用物料清单」。
 *
 * 【当前设计:两条源并存,由表的 `materialPickSource` 决定】
 *   'mate'  = 物料清单 WLBOM —— 规格书「1.关键物料列表」用这条。
 *             弹窗列 = 物料编码 / 单据日期 / 物料代码 / 物料名称,**勾整张单**,
 *             确认时该单全部子件展开逐行落;数量 ← **标准用量**。
 *   'goods'(缺省) = 商品档案 INV —— 产品信息表「三、产品BOM表」用这条。
 *             四栏级联收窄,勾单条存货;数量**不带**(商品档案没有用量口径)。
 *
 * ⚠ 所以本文件**不能**断言「代码里不再出现 INV」—— 那条源是产品信息表要用的,
 *   必须留着。要验的是「规格书那张表声明的是 mate,且 mate 分支真的读 WLBOM」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const configs = readFileSync(new URL('./recordSheetConfigs.js', import.meta.url), 'utf8')

/** 取某函数体(到下一个顶层函数/常量定义为止) */
function fnBody(src, name, max = 9000) {
  const at = src.indexOf('function ' + name)
  assert.ok(at >= 0, `找不到 ${name}`)
  const rest = src.slice(at + 10)
  const m = rest.search(/\n(?:async )?function |\n\/\/ ──|\nconst \w+ = (?:ref|computed|reactive)\(/)
  return src.slice(at, at + (m > 0 ? m + 10 : max))
}

test('① 规格书那张表声明 materialPickSource: mate(引用源 = 物料清单)', () => {
  const at = configs.indexOf("tablesAfterBar: '1.关键物料列表'")
  assert.ok(at >= 0, '找不到规格书物料清单表')
  const block = configs.slice(at, at + 1200)
  assert.match(block, /materialPickSource:\s*'mate'/, '这张表要走物料清单源')
  assert.match(block, /materialPick:\s*true/, '仍要用引用按钮')
})

test('② mate 分支真的读 WLBOM,子件挂在 __kids 上等确认时展开', () => {
  const fn = fnBody(panels, 'openMaterialPick')
  assert.match(fn, /panelCode:\s*['"]WLBOM['"]/, 'mate 分支要从 WLBOM 取数')
  assert.match(fn, /__kids/, '每张单要把子件挂在 __kids 上')
  assert.match(fn, /detail\?\.items|detail\.items/, '子件在 detail.items(WLBOM 是单据面板)')
  assert.match(fn, /物料代码/, '弹窗要显示 物料代码(用户点名的四列之一)')
  // 两条源并存:INV 那条必须还在(产品信息表 BOM 用)
  assert.match(fn, /INV_PANEL/, '商品档案源不能删 —— 产品信息表 BOM 表还在用')
})

test('③ mate 落行:整单子件展开,数量 ← 标准用量', () => {
  const fn = fnBody(panels, 'confirmMaterialPick')
  assert.match(fn, /__kids/, '确认时要展开 __kids')
  assert.match(fn, /子件代码/, '物料编码 ← 子件代码')
  assert.match(fn, /子件名称/, '物料名称 ← 子件名称')
  assert.match(fn, /标准用量/, '数量 ← 标准用量(商品档案没有这个,改回后必须带)')
  // 分支判据:按来源分流
  assert.match(fn, /matPickSource\.value === 'mate'/, '要按来源分流')
  // 商品源也必须在(产品信息表 BOM 走它)
  assert.match(fn, /goodsToDetail/, '商品落行映射要留着')
})

test('④ 按钮/弹窗文案按来源给缺省:mate ⇒「从物料清单引用」', () => {
  const fn = fnBody(panels, 'defaultPickLabel', 1200)
  assert.match(fn, /'从物料清单引用'/, 'mate 源的缺省文案')
  assert.match(fn, /'从商品引用'/, 'goods 源的缺省文案')
  // 规格书那张表没有逐表覆盖文案 ⇒ 实际显示「从物料清单引用」
  const at = configs.indexOf("tablesAfterBar: '1.关键物料列表'")
  const block = configs.slice(at, at + 1200)
  assert.ok(!/materialPickLabel:/.test(block), '这张表不覆盖文案,让缺省值生效')
})

test('⑤ 物料清单子件键名与后端一致(mate 里就是这几列)', () => {
  const fn = fnBody(panels, 'confirmMaterialPick')
  for (const k of ['子件代码', '子件名称', '规格型号', '标准用量', '备注']) {
    assert.match(fn, new RegExp(k), `映射缺少 ${k}`)
  }
})
