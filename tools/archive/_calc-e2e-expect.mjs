/**
 * 算出 e2e 探针这套输入的**引擎口径期望值**(页面断言用)。
 * 引擎 recipeEngine.js 已由 85 条 exe 黄金向量逐位钉住 ⇒ 这里的数字等价于 exe 算的。
 * 输入集与 _probe-moldproc-e2e.cjs 完全一致:4 行配方 + 一切几 2 + 含水率 6%(档案带出)。
 */
import { slotsFromRows, applyArchiveMoisture, paramsFromHead, buildPatch, moisturePercent, toEngineRecipe } from '../../frontend/src/core/mold/recipeSheet.js'
import { compute } from '../../frontend/src/core/mold/recipeEngine.js'

const ROWS = [
  { '物料种类': '炭粉', '物料编号': 'YJ-XH-001', '物料名称': '鑫恒（80-250）', '设计添加量': '0.62' },
  { '物料种类': '胶粉', '物料编号': 'YJ-ZX-003', '物料名称': 'M2-D胶粉', '设计添加量': '0.30' },
  { '物料种类': '胶粉', '物料编号': 'YJ-SLD-009', '物料名称': '4012T1胶粉', '设计添加量': '0.08' },
  { '物料种类': '功能料-颗粒', '物料编号': 'HP-12', '物料名称': 'HP-12', '设计添加量': '2' },
]
const HEAD = { 炭棒规格1: '59.5', 炭棒规格2: '39.5', 炭棒规格3: '120', 实际密度管控下限: '0.58', 实际密度管控上限: '0.60' }
const ARCHIVE = { 'YJ-XH-001': 0.06 }

const { slots, warnings } = slotsFromRows(ROWS)
const arch = applyArchiveMoisture(slots, [], [], ARCHIVE)
console.log('料位分组:', slots.map((s) => `${s.slot}:${s.group}:${s.code}:设计=${s.designRatio ?? s.amountG}`).join('  '))
console.log('档案带出含水率(槽位%):', JSON.stringify(arch.values), 'filled=', JSON.stringify(arch.filledSlots), 'missing=', JSON.stringify(arch.missingCodes))
arch.values.forEach((v, i) => { slots[i].moisture = moisturePercent(v) })
console.log('slots moisture:', JSON.stringify(slots.map((s) => s.moisture)))

const { params, missing } = paramsFromHead(HEAD, { cavities: 2 })
console.log('missing:', JSON.stringify(missing))
console.log('params:', JSON.stringify(params))
const result = compute(params, toEngineRecipe(slots))
console.log('result keys:', Object.keys(result).join(','))
console.log('compute result:', JSON.stringify(result, null, 1))
const patch = buildPatch(result, slots, {})
console.log('patch:', JSON.stringify(patch, null, 1))
console.log('warnings:', JSON.stringify(warnings))
