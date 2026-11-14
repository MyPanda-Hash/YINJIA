import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DESIGN_KEY, buildRecipeAoa, cellTextOf, designAmountText, designTotalText, designUnitOf,
  fixed2, materialRowsOf, rowHasMaterial,
} from './recipeExport.js'

/**
 * 配方表「设计添加量」单位 + 合计 + 导出件（2026-11-11 用户口径，研发管理优化 第 3 条）。
 *
 * 用户原话：「① 物料1第一行无带出的设计添加量数据 ② 粉料段和胶粉导出的设计添加量没有百分比号
 * 单位（若为功能料-颗粒属性则单位为 g/支）③ 设计添加量合计 = 非颗粒料比例（%）相加，颗粒料按
 * g/支」；追加：「导出数值的时候只需要保留 2 位小数就行，没有数据的行就自动删除」。
 * 单位显示口径：「**纸面和导出件都带单位**」。
 *
 * 这些断言钉的是**纯函数层**（纸面与导出件共用同一份格式化结果，改一处两边一起变）：
 *   · 单位按**物料种类**判（粉料/胶粉 = %，功能料-颗粒/折算物料 = g/支），不按文本里有没有 %；
 *   · 合计**只加 % 行**，且恒为 100%；颗粒料的克数不进这个合计；
 *   · 2 位小数、幂等（`8` / `8.00%` / `8` 的天真写法都收敛到 `8.00%`）；
 *   · 「有物料」= 编号或名称非空 —— 只有「物料种类」的行算空行（那正是用户说的"空白行"）。
 */

/** 造一行配方表行 */
const row = (kind, code, design, extra = {}) => ({
  表区: '配方表', 序号: '', 物料种类: kind, 物料编号: code, 物料名称: `${code}名`, [DESIGN_KEY]: design, ...extra,
})

test('单位按物料种类判：粉料/胶粉 = %，功能料-颗粒与折算物料 = g/支', () => {
  assert.equal(designUnitOf('炭粉'), '%')
  assert.equal(designUnitOf('胶粉'), '%')
  assert.equal(designUnitOf('功能料-粉末'), '%')
  assert.equal(designUnitOf('功能料-颗粒'), 'g/支')
  assert.equal(designUnitOf('折算物料'), 'g/支')
  assert.equal(designUnitOf(''), '%', '认不出种类时按百分数（与引擎「暂按粉料处理」同一口径）')
})

test('设计添加量落格文本：2 位小数 + 单位，且幂等（带单位的再算一遍不变形）', () => {
  assert.equal(designAmountText(row('炭粉', 'A', '50')), '50.00%')
  assert.equal(designAmountText(row('炭粉', 'A', '50.00%')), '50.00%', '已经带 % 的不许变成 50.00%%')
  assert.equal(designAmountText(row('胶粉', 'C', '30.5')), '30.50%')
  assert.equal(designAmountText(row('功能料-颗粒', 'G', '3')), '3.00 g/支')
  assert.equal(designAmountText(row('功能料-颗粒', 'G', '3.00 g/支')), '3.00 g/支', '已经带 g/支 的不许叠第二遍')
  assert.equal(designAmountText(row('折算物料', 'X', '2.456')), '2.46 g/支', '导出保留 2 位小数')
  assert.equal(designAmountText(row('炭粉', 'A', '')), '', '空格给空串，不当成 0.00%')
  assert.equal(designAmountText(row('炭粉', 'A', '--')), '', '脏值不猜')
})

test('fixed2 能剥掉 % 与 g/支（写进去的必须读得回来）', () => {
  assert.equal(fixed2('8'), '8.00')
  assert.equal(fixed2('8%'), '8.00')
  assert.equal(fixed2('10 g/支'), '10.00')
  assert.equal(fixed2('10.005 g/支'), '10.01')
  assert.equal(fixed2(''), '')
})

test('合计只加 % 行（颗粒料的克数不进），且恒为 100.00%', () => {
  // 对应 2026-11-11 截图那单：料位1 补差 50% + 粉料 10% + 胶粉 30% + 10% + 颗粒料 3 g/支
  const rows = [
    row('炭粉', 'YJ-YKRS-001', '50.00%'),
    row('炭粉', 'YJ-YPS-002', '10.00%'),
    row('胶粉', 'YJ-ZX-003', '30.00%'),
    row('胶粉', 'YJ-ZX-001', '10.00%'),
    row('功能料-颗粒', 'Sr-35200', '3.00 g/支'),
  ]
  assert.equal(designTotalText(rows), '100.00%')
  assert.equal(designTotalText(rows.slice(0, 4)), '100.00%', '只有 % 行时同样是 100%')
  assert.equal(designTotalText([]), '', '空表不写 0.00%')
  assert.equal(designTotalText([row('功能料-颗粒', 'G', '3 g/支')]), '', '只有颗粒料时没有百分比合计')
})

test('「有物料」= 编号或名称非空；只有物料种类的行算空行（用户指的"空白行"）', () => {
  assert.equal(rowHasMaterial(row('炭粉', 'A', '10')), true)
  assert.equal(rowHasMaterial({ 物料种类: '炭粉', 物料编号: '', 物料名称: '', [DESIGN_KEY]: '10' }), false,
    '只有种类 + 设计添加量，认不出是哪颗料 ⇒ 空行')
  assert.equal(rowHasMaterial({ 物料种类: '', 物料编号: '', 物料名称: '手填名' }), true, '只有名称也算有物料')
  assert.equal(rowHasMaterial(null), false)
  assert.equal(materialRowsOf([row('炭粉', 'A', '10'), { 物料种类: '胶粉' }, row('胶粉', 'C', '20')]).length, 2)
})

test('导出件：表头 + 只导有物料的行 + 2 位小数 + 带单位 + 合计行', () => {
  const cols = [
    { key: '表区', label: '表区', hiddenCol: true },
    { key: '序号', label: 'No.' },
    { key: '物料种类', label: '物料种类' },
    { key: '物料编号', label: '物料编号' },
    { key: '物料名称', label: '物料名称' },
    { key: '实际添加比例', label: '实际添加\n比例%' },
    { key: '单支物料含量', label: '单支\n物料含量g' },
    { key: DESIGN_KEY, label: '设计添加\n量' },
  ]
  const rows = [
    row('炭粉', 'YJ-YKRS-001', '50.00%', { 实际添加比例: '41.38%', 单支物料含量: '11.51' }),
    row('炭粉', 'YJ-YPS-002', '10.00%', { 实际添加比例: '10.00%', 单支物料含量: '2.78' }),
    { 表区: '配方表', 序号: '3', 物料种类: '炭粉', 物料编号: '', 物料名称: '', [DESIGN_KEY]: '0' }, // 空白行
    row('胶粉', 'YJ-ZX-003', '30.00%', { 实际添加比例: '28.38%', 单支物料含量: '7.90' }),
    row('胶粉', 'YJ-ZX-001', '10.00%', { 实际添加比例: '9.46%', 单支物料含量: '2.63' }),
    row('功能料-颗粒', 'Sr-35200', '3.00 g/支', { 实际添加比例: '10.78%', 单支物料含量: '3.00' }),
  ]
  const aoa = buildRecipeAoa({ cols, rows })

  assert.equal(aoa.length, 1 + 5 + 1, '表头 + 5 行有物料 + 合计；那条空白行被剔除')
  assert.deepEqual(aoa[0], ['No.', '物料种类', '物料编号', '物料名称', '实际添加比例%', '单支物料含量g', '设计添加量'],
    '列头去掉换行（Excel 里一格里塞换行反而难读）')
  assert.equal(aoa[1][0], '1', '序号按导出的次序重排，不留 1/2/4 这种断号')
  assert.equal(aoa[3][0], '3')
  assert.equal(aoa[1][4], '41.38%', '实际添加比例带 %（本来就有，导出不许丢）')
  assert.equal(aoa[1][5], '11.51', '单支物料含量 2 位小数，单位在列头')
  assert.equal(aoa[1][6], '50.00%', '设计添加量补 %')
  assert.equal(aoa[5][6], '3.00 g/支', '颗粒料的设计添加量补 g/支')
  assert.deepEqual(aoa[6], ['合计', '', '', '', '100.00%', '27.82', '100.00%'],
    '合计行：比例 100%、单支含量求和、设计添加量只加 % 行')
})

test('导出一格一格的取值口径（cellTextOf）', () => {
  const r = row('胶粉', 'C', '30', { 实际添加比例: '28.38%', 单支物料含量: '7.9' })
  assert.equal(cellTextOf(r, '序号', 2), '2')
  assert.equal(cellTextOf(r, '实际添加比例', 1), '28.38%')
  assert.equal(cellTextOf(r, '单支物料含量', 1), '7.90')
  assert.equal(cellTextOf(r, DESIGN_KEY, 1), '30.00%')
  assert.equal(cellTextOf(r, '物料名称', 1), 'C名')
})
