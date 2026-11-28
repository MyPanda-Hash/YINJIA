/**
 * mergeGenerate.test.js —— 「合单生单」的钉子(2026-11-13 建立,2026-11-24 按选单改版重钉)
 *
 * 【用户原话·初版(2026-11-13)】
 *   「采购订单新增一个合单生单在生单按钮下面,可以选择同一供应商的单据,进行合单,合成一张送料暂收单。
 *    并且要注意后面的逻辑(对应的行号有的是对应采购订单行号,是合单前的行号。有些对应行号的送料暂收后
 *    的行号是送料暂收的行号,是合单后的行号)」
 *
 * 【用户原话·改版(2026-11-24,本次)】
 *   「和单生单添加一个弹窗选择,不再是勾选了,而是点击合单生单弹出一个窗口,这个窗口可以选择单据,
 *    选择单据后,加入到现在的合单生单页面。然后又删除按钮,可以删除掉不需要单据的明细。也可以重新添加,
 *    在合单生单页面多一个选择单据的按钮,选择后单据明细会添加进来,已经有的明细就只补没有的就行。
 *    参考金蝶erp选单的设计逻辑。」
 *
 * 【要钉住的六件事】(少一处就会出"合单后溯源断链"或"选单进不去/加重复行"):
 *   ① 入口:只有**采购订单**的「生单 ▼」多出「合单生单」,点了先弹**选单窗口**(不再靠左栏勾选);
 *   ② 选单窗:金蝶式 —— 只列已审核 + 还有未送量的源单,同一供应商锁定,已加入的标「已添加」不可再选;
 *   ③ 出单:合单走 /px/push/merge,**一张**目标单(docs 全部并进去,不是逐张);
 *   ④ 行号:行级「采购单号」= 合单**前**的订单号(逐行不同),「采购订单行号」= 合单**前**的订单行号;
 *      暂收单自己的行 id / source_line_key 才是合单**后**的行号(占用用它);
 *   ⑤ 删改:合单页面上整单/整行都能删,删完还能再选单补回来,补的时候**只补没有的行**;
 *   ⑥ 下游:检验/退回/入库逐行带「采购单号」,转ERP 行级 src_bill_no 用它(表头合单串不能当源单号)。
 *
 * 单测跑不了运行时,按仓库既有做法读源码钉住(同 approvalSeparation.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const glDialog = readFileSync(new URL('./GenerateLinesDialog.vue', import.meta.url), 'utf8')
const pickDialog = readFileSync(new URL('./MergePickDocsDialog.vue', import.meta.url), 'utf8')
const engine = readFileSync(new URL('../../business/engine.js', import.meta.url), 'utf8')
const pushHandler = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/panel/PushGenerateHandler.java', import.meta.url), 'utf8')
const pxController = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/PxController.java', import.meta.url), 'utf8')
const buttonService = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const kingdee = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/KingdeePushService.java', import.meta.url), 'utf8')
const voucherFlow = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/VoucherFlowService.java', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

/** 取 onButton 里「合单生单」那一层分支(到「批量生单」那一段为止) */
function mergeBranch() {
  const at = panelx.indexOf('if (action === MERGE_GENERATE_ACTION)')
  assert.ok(at > 0, 'onButton 里缺「合单生单」分支')
  const end = panelx.indexOf("// 批量生单(2026-10-31 用户口径)", at)
  assert.ok(end > at, '找不到「合单生单」分支的结束位置(下一个分支)')
  return panelx.slice(at, end)
}

test('① 入口:只有采购订单的「生单 ▼」多出「合单生单」,点了先开**选单窗口**', () => {
  assert.match(panelx, /const MERGE_GENERATE_ACTION = '合单生单'/)
  assert.match(panelx, /const MERGE_GENERATE_PANELS = new Set\(\['PU_ORDER', 'SUPPLIER_PU_ORDER'\]\)/,
    '只挂采购订单(含供应商门户副本)')
  assert.match(panelx, /if \(canMergeGenerate\.value\) extra\.push\(MERGE_GENERATE_ACTION\)/,
    '下拉项由 canMergeGenerate 决定,别的地板面板不能出现')
  const branch = mergeBranch()
  assert.match(branch, /mergePickAction\.value = genMergeAction\.value/, '先把生单动作记下来')
  assert.match(branch, /mergePickVisible\.value = true/, '点它就弹选单窗口(金蝶 ERP 选单口径)')
  assert.ok(!/railChecked/.test(branch), '合单不再依赖左栏勾选(那条只服务「批量生单」)')
  // 选单窗确定 → 才打开合单页面(第三参 merge=true)
  assert.match(panelx, /function onMergeDocsPicked\(\{ nos \}\)/, '选单窗要回一个单据号清单')
  assert.match(panelx, /openGenerateDialog\(mergePickAction\.value, list, true\)/,
    '选单确定后走 merge=true 的对话框(第三参)')
  // 少于两张当场说清,不要等填完才被后端拒
  assert.match(panelx, /list\.length < 2/, '合单至少要两张(后端 generateMerged 同口径)')
})

test('② 选单窗:金蝶口径 —— 已审核+有未送量、勾一张就只剩同一供应商、支持模糊搜索', () => {
  // 数据源与生单页面/后端校验同一份口径(行级剩余量),不是"只查单据头"的通用列表接口
  assert.match(pickDialog, /engine\.purchaseFlowSources\(/, '候选单必须走 /px/voucherFlow/sources(带剩余量)')
  assert.match(pickDialog, /condition\['供应商'\] = lockSupplier\.value/, '锁了供应商就把条件带上(服务端过滤)')
  assert.match(pickDialog, /const lockSupplier = computed\(\(\) => String\(props\.supplier \|\| chosenSupplier\.value \|\| ''\)\.trim\(\)\)/,
    '供应商锁:父组件给了用父组件的(合单页已有单据),否则由本次第一张勾选锁定')
  // 「勾选后一个后只出现同一供应商」——锁上就**重查**(不是把别家涂灰),并且保住刚勾的那张
  assert.match(pickDialog, /if \(sup && sup !== chosenSupplier\.value\) \{[\s\S]{0,200}?load\(1, \{ keepPicked: true \}\)/,
    '勾第一张就把列表收窄到这家供应商(keepPicked 保住这一勾)')
  assert.match(pickDialog, /const keepNos = keepPicked \? \[\.\.\.pickedNos\.value\] : \[\]/,
    '重查后要按单号回填勾选,否则"勾了一下就没了"')
  // 「支持模糊搜索」——关键字走服务端 broad-OR(单号/供应商/物料名),不再只按单号查
  assert.match(pickDialog, /keyword: String\(keyword\.value \|\| ''\)\.trim\(\)/, '关键字要透传给 /px/voucherFlow/sources')
  assert.match(pickDialog, /tt\('关键字：单号\/供应商\/物料'\)/, '关键字输入框要说明搜什么,且走 tt()')
  assert.match(engine, /pageNo = 1, pageSize = 20, keyword = '' \}\)/, '引擎要能带 keyword')
  assert.match(pxController, /String keyword = body\.get\("keyword"\) == null \? null : String\.valueOf\(body\.get\("keyword"\)\)/,
    '控制器要把 keyword 交给服务')
  assert.match(voucherFlow, /queryService\.queryFormDataList\(sourcePanel, keyword, cond, pageNo, pageSize\)/,
    '服务端关键字要直通 queryFormDataList 的 broad-OR(单号/供应商/物料名都能命中)')
  assert.match(pickDialog, /function selectableRow\(row\)/, '选择列的可用判据要**只**看供应商锁')
  assert.ok(!/if \(addedOf\(row\)\) return false/.test(pickDialog),
    '已在合单里的单也要能再选(用户口径「也可以重新添加」)—— 去重由合单页面按 lineKey 做')
  // 状态列(2026-11-28):可加入 / 部分已添加 / 已添加,由 docState 一处派生、模板统一过 tt()
  assert.match(pickDialog, /function docState\(doc\)/, '状态要集中在一处算,别在模板里散着判')
  for (const s of ["'可加入'", "'部分已添加'", "'已添加'"]) {
    assert.match(pickDialog, new RegExp(`text: ${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `状态要含 ${s}(客户 2026-11-28 追问「可加入表达什么,还有别的状态吗」)`)
  }
  assert.match(pickDialog, /tt\(docState\(row\.__doc\)\.text\)/, '状态文案要走 tt(),不能裸写中文')
  assert.match(glDialog, /@confirm="onDocsPicked"/, '合单页面里要能接着选单(用户口径「也可以重新添加」)')
  // 勾了多家供应商当场拦(金蝶选单:必须先按往来单位筛)
  assert.match(pickDialog, /合单生单只能选同一供应商的采购订单，当前勾了/, '混了多家供应商要有一句明确的话')
})

test('②-金蝶式明细:一张单据拆成多行物料,单据级列合并单元格(2026-11-28 客户口径)', () => {
  // 客户原话:「物料罗列在一起,不好看是总共有哪些物料,改成和金蝶一样,一个单据,多个物料分行罗列出来」
  // ⇒ 一张单 = 一组行,组内一行一个物料;原来那种「前两个物料名用、拼一格」的摘要必须消失
  assert.ok(!/names\.join\('、'\)/.test(pickDialog), '不许再把多个物料拼进一格(那正是客户说"不好看"的写法)')
  assert.ok(!/function itemsText/.test(pickDialog), '物料摘要函数已由逐行明细取代')
  assert.match(pickDialog, /const flatRows = computed\(\(\) => \{/, '表格数据 = 单据 × 明细行摊平')
  assert.match(pickDialog, /__span: i === 0 \? items\.length : 0/, '组内第一行带整组的 rowspan,其余 0')
  assert.match(pickDialog, /:span-method="spanMethod"/, '单据级列靠 span-method 纵向合并')
  assert.match(pickDialog, /function spanMethod\(\{ row, columnIndex \}\)/, 'spanMethod 要能认列号')
  for (const col of ['行号', '物料编码', '物料名称', '规格型号', '单位', '数量', '剩余数量']) {
    assert.match(pickDialog, new RegExp(`tt\\('${col}'\\)`), `明细列要逐行显示「${col}」`)
  }
  assert.match(pickDialog, /function lineKeyOf\(row, item\)/, '明细行键要能和合单页面的 lineKey 对上')
  assert.match(pickDialog, /item\?\.\['_lineKey'\]/, '行键取服务端下发的 _lineKey(docNo#行id)')
  assert.match(glDialog, /:added-line-keys="addedLineKeys"/, '合单页面要把已加入的行键传给选单窗')
  assert.match(glDialog, /const addedLineKeys = computed\(\(\) => docs\.value\.flatMap/,
    '已加入行键 = 页面上各单明细的 lineKey 合起来')
  assert.match(pickDialog, /function isLineAdded\(row\)/, '已加入的那几行要能单独识别(灰显)')
  assert.match(pickDialog, /mpd-added-line/, '灰显靠行类名,样式在 scoped 里')
  // 勾选仍按单据(合单页面才是逐行挑),并有本页全选
  assert.match(pickDialog, /function toggleDoc\(doc, on\)/, '勾选按单据开着走')
  assert.match(pickDialog, /function toggleAllPage\(on\)/, '表头那颗 = 本页全选')
  assert.match(pickDialog, /const pickedNos = ref\(\[\]\)/, '选中态就是单据号清单')
})

test('③ 后端:合单也校验同一供应商,且**先**校验供应商再校验数量', () => {
  const body = pushHandler.slice(pushHandler.indexOf('public Map<String, Object> generateMerged'))
  assert.match(body, /合单生单只允许\*\*同一供应商\*\*的单据/, '供应商不一致要有一句明确的话')
  assert.match(body, /至少要两张来源单据/, '合单至少两张')
  const supplierAt = body.indexOf('合单生单只允许')
  const capAt = body.indexOf('超出允许上限')
  assert.ok(supplierAt > 0 && capAt > supplierAt, '供应商校验要在数量校验之前(否则先报"某行超量",看不出是合单选错了)')
})

test('③ 出单:合单只出**一张**目标单(docs 全部并进去),走 /px/push/merge', () => {
  assert.match(engine, /export async function pushFlowMerge\(\{ panelCode, action, docs, batchNo \}\)/, '引擎要有合单接口')
  assert.match(engine, /request\.post\('\/px\/push\/merge'/, '后端入口 /px/push/merge')
  assert.match(pxController, /@PostMapping\("\/push\/merge"\)/, '控制器要有 /push/merge')
  assert.match(panelx, /:merge="genMerge"/, '列表页要把合单开关传给对话框')
  assert.match(glDialog, /const merge = computed\(\(\) => !!props\.merge\)/)
  // 合单分支:一次 merge 调用 + 只回一张单(没有「生成清单/失败」那套逐张循环)
  const confirmBody = glDialog.slice(glDialog.indexOf('async function confirm('))
  assert.match(confirmBody, /props\.merge\s*\n?\s*\? await engine\.pushFlowMerge/, '合单走 pushFlowMerge')
  assert.match(confirmBody, /已合单生成/, '提示要说清是合单出的单')
  assert.match(confirmBody, /合单来源/, '提示里带上"哪几张订单合的"')
})

test('④ 行号:行级「采购单号」= 合单前的订单号;占用仍用合单后的暂收行 id', () => {
  const body = pushHandler.slice(pushHandler.indexOf('public Map<String, Object> generateMerged'))
  assert.match(body, /if \(rowHasPoNo\) row\.put\("采购单号", p\.sourceNo\(\)\)/,
    '每一行写自己的来源订单号(合单前的号),不能只写在表头')
  assert.match(body, /targetHead\.put\(colLabel\(tgtDef, "来源单号", "来源单号"\), String\.join\("、", orderNos\)\)/,
    '表头放全部订单号(给人看)')
  assert.match(body, /newNo \+ "#" \+ tgtId/, '占用/反查写的是**合单后**的暂收行(单号#行id)')
  assert.match(body, /p\.lineKey\(\)/, '占用按来源行键记(合单前那一行的已送量),两种行号各司其职')
})

test('⑤ 合单页面:能选单补单(只补没有的明细),删除 = 明细行首一个叉', () => {
  // 选单按钮在合单页面顶部(用户口径「在合单生单页面多一个选择单据的按钮」)
  const bar = glDialog.slice(glDialog.indexOf('class="gl-bar"'), glDialog.indexOf('class="gl-doc"'))
  assert.match(bar, /v-if="merge"/, '选单按钮只在合单模式出现(批量生单是逐张出单,没有选单语义)')
  assert.match(bar, /tt\('选择单据'\)/, '顶部要有「选择单据」按钮')
  assert.match(glDialog, /<MergePickDocsDialog[\s\S]{0,400}?@confirm="onDocsPicked"/,
    '合单页面要挂选单弹窗,选完把明细补进来')
  assert.match(glDialog, /:added-nos="addedNos"/, '已在页面上的单据要传给选单窗(标「已添加」)')
  assert.match(glDialog, /:supplier="mergeSupplier"/, '供应商锁定要传给选单窗(合单只允许同一家)')

  // 只补没有的明细:按 lineKey 去重(已有行一律跳过)
  const addBody = glDialog.slice(glDialog.indexOf('async function onDocsPicked'))
  assert.match(addBody, /const have = new Set\(exist\.lines\.map\(\(r\) => r\.lineKey\)\)/, '已有行键集合')
  assert.match(addBody, /if \(have\.has\(row\.lineKey\)\) continue/, '已有的明细不许重复加进来')
  assert.match(addBody, /adoptDoc\(src\)/, '新单据整段纳入(默认值/勾选与首次打开同源)')
  assert.match(addBody, /该单据的明细已全部在合单页面中，无需重复添加/, '全都在了就说明白,不要静默什么都不做')

  // 删除:明细行首一个「叉」,点一下删这一行(2026-11-24 用户口径「直接在明细中加入一个叉点击后删除」)
  assert.match(glDialog, /function removeLine\(doc, row\)/, '要能删单行明细')
  assert.match(glDialog, /class="gl-x"[^>]*@click\.stop="removeLine\(doc, row\)"/,
    '明细每行要有一个可点的叉(删这一行)')
  assert.match(glDialog, /tt\('删除这一行'\)/, '叉要有 title,且走 tt()')
  assert.match(glDialog, /function removeDoc\(doc\)/, '删空某张单的行时要能整单撤掉(removeLine 内部调用)')
  assert.match(glDialog, /if \(!doc\.lines\.length\) removeDoc\(doc\)/, '删空了就整单撤掉,别留一段空表')
  // 单一入口:不再另挂「删除本单 / 操作列」,免得两个删除分不清
  assert.ok(!/tt\('删除本单'\)/.test(glDialog), '「删除本单」按用户口径撤掉(删除只剩行首那个叉)')
  assert.ok(!/tt\('删除行'\)/.test(glDialog), '「操作」列的删除行按用户口径已并入行首的叉')
  assert.ok(!/tt\('操作'\)/.test(glDialog), '去掉末尾那列「操作」')
  // 叉放在勾选列右边第一格:96vw 宽表横向滚动时也在视野内
  const xAt = glDialog.indexOf('class="gl-x"')
  const lineNoAt = glDialog.indexOf('prop="行号"')
  assert.ok(xAt > 0 && lineNoAt > xAt, '叉必须在「行号」列之前(行首第一格,不用滚到最右)')
})

test('⑥ 下游:检验/退回逐行带采购单号;入库行用它落「源单编号」;转ERP 行级 src_bill_no 用它', () => {
  assert.match(buttonService, /if \(r\.get\("采购单号"\) != null\) line\.put\("采购单号", r\.get\("采购单号"\)\)/,
    '检验审核自动生的退回行要带行级采购单号')
  assert.match(buttonService, /if \(r\.get\("采购单号"\) != null\) line\.put\("源单编号", r\.get\("采购单号"\)\)/,
    '入库行落的是**已有的 源单编号**(金蝶 src_bill_no 同名),不再另开 采购单号 列')
  assert.match(buttonService, /" 采购单号,"[\s\S]{0,80}" 送检数量/, '入库行取数 SELECT 要把采购单号取回来')
  assert.match(kingdee, /String linePo = str\(line\.get\("源单编号"\)\)/, '转ERP 行级优先用本行的 源单编号')
  assert.match(kingdee, /multiOrderHead/, '表头是"订单1、订单2"这种合单串时不能当 src_bill_no')
  assert.match(kingdee, /e\.put\("src_bill_no", hit\.billNo\(\)\)/, 'src_bill_no 写解析到的金蝶真实号')
})

test('多语言:合单 + 选单相关文案都有英文译文', () => {
  for (const k of ['合单生单', '确定合单生单', '已合单生成', '张采购订单合成一张',
    '合单生单只能选同一供应商的采购订单，当前勾了',
    // 2026-11-24 选单改版新增
    '选择单据', '选择采购订单', '删除本单', '删除行', '加入合单', '已添加', '可送数量',
    '只能选同一供应商的采购订单', '该单据的明细已全部在合单页面中，无需重复添加',
    '合单生单至少要两张采购订单，当前只有', '没有可加入的已审核采购订单',
    '把这张单据整单从合单页面移除', '把这一行从本次合单里移除',
    // 2026-11-24 第二轮:模糊搜索 + 勾一张就只剩同一供应商
    '关键字：单号/供应商/物料', '列表已只显示这一家的单据，可用关键字继续模糊搜索',
    '选单加入合单：已加入的明细只补还没进来的行，不会重复',
    // 2026-11-28 金蝶式明细行 + 第三种状态
    '部分已添加', '全选本页可加入的单据', '把这张单据的全部明细加入合单',
    '灰显的明细行已经在合单页面里', '已送完，仍可超送', '可送行数']) {
    const rx = new RegExp(`'${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'([^']*)'`)
    const m = en.match(rx)
    assert.ok(m, `en.js 缺词条:${k}`)
    assert.ok(!/[\u4e00-\u9fa5]/.test(m[1]), `en.js 的 ${k} 译文不应含中文`)
  }
})

test('多语言:选单窗与合单页面新增的中文全部走 tt()', () => {
  for (const src of [pickDialog, glDialog]) {
    const tpl = src.slice(0, src.indexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '')
    const bare = tpl.split('\n')
      .filter((line) => /[\u4e00-\u9fa5]/.test(line))
      .filter((line) => !line.includes('tt('))
    assert.deepEqual(bare, [], '模板里出现未走 tt() 的中文:\n' + bare.join('\n'))
  }
})
