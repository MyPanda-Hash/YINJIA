/**
 * generateLinesDialog.test.js —— 统一生单对话框 / 批量生单 的回归闸(2026-10-31 用户口径)
 *
 * 【用户原话】「在生单下多写一个**批量生单**的功能……勾选多个采购单后打开一个新的界面为勾选的
 *   各个单据的明细行,再进行选择,来实现这个的转单的处理。」「并且**生单**也要变成可以勾选的和
 *   选择数量的(现在只有采购订单的生单做了特殊处理)……非定制化的生单只要可以勾选和选择数量就可以」
 *
 * 【本测试守什么】
 *   ① 对话框里的**每一条**中文显示文案都走了 tt() 且 en.js 有词条(AGENTS 多语言红线:
 *      只看代码不看效果 ⇒ 英文界面下这些字直接掉回中文);
 *   ② 「批量生单」确实挂在**生单组的下拉**里(不是在工具栏另起一颗按钮),并且点它走的是
 *      左栏勾选 → 统一对话框,而不是"没有勾选也弹窗";
 *   ③ 非定制化的生单(通用推式链路)真的改走对话框了;定制化动作(生成生产工单/生成检验或入库单)
 *      仍保持原来的直接调用 —— 改动面必须只落在"非定制化"那一侧。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dialog = readFileSync(new URL('./GenerateLinesDialog.vue', import.meta.url), 'utf8')
const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const rail = readFileSync(new URL('./DocSelectRail.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')
const helper = readFileSync(new URL('../selection/pushGenerateLines.js', import.meta.url), 'utf8')

/** 抽出源码里所有 `tt('中文')` 字面量 */
function ttKeys(src) {
  const out = new Set()
  for (const m of src.matchAll(/tt\('([^']+)'\)/g)) out.add(m[1])
  return [...out]
}

test('对话框显示文案全部走 tt()', () => {
  const keys = ttKeys(dialog)
  assert.ok(keys.length > 20, '文案是从模板里抽出来的,条数不对说明抽取/写法变了')
  // 裸写中文(不在 tt() 里)只允许出现在注释里 —— 模板区(第一个 </template> 之前)扫一遍
  const tpl = dialog.slice(0, dialog.indexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '')
  const bare = tpl
    .split('\n')
    .filter((line) => /[\u4e00-\u9fa5]/.test(line))
    .filter((line) => !line.includes('tt('))
  assert.deepEqual(bare, [], '模板里出现未走 tt() 的中文:\n' + bare.join('\n'))
})

test('对话框 + 左栏 + 列表页新增文案在 en.js 都有词条', () => {
  const keys = [...ttKeys(dialog), ...ttKeys(rail)]
  // 列表页只用本功能新增的那几条(整份 PanelxList 有上千条历史文案,不在本闸范围内)
  for (const k of ['批量生单', '请先在左侧单据列表勾选要生单的单据', '该面板没有可批量生单的下游链路',
    '已生成新单据，可在目标面板查看', '请先选择一张单据',
    '勾选的单据都不是「已审核」状态：生单只能已审核单据', '已跳过', '张非已审核单据']) keys.push(k)
  const missing = [...new Set(keys)].filter((k) => !en.includes("'" + k + "'"))
  assert.deepEqual(missing, [], 'en.js 缺词条:\n' + missing.join('\n'))
})

test('纯函数里的提示文案(拦截原因)也在 en.js 有词条', () => {
  // 只有 mixedBatchBlocked 会回一句用户可见的话(其余返回的都是空串)——
  // 这句话在原分批对话框里已有译名,这里要求两处同一条,别各说各的。
  const msg = '勾选了多个已打印批次号时不能同时送未打印量：请先按已打印行生单，或把未打印量分开操作'
  assert.ok(helper.includes(msg), '纯函数里的拦截文案要与原分批对话框保持同一条')
  assert.ok(en.includes("'" + msg + "'"), 'en.js 缺这条提示的译名')
})

test('「批量生单」是生单组的下拉项,且没有勾选时先提示而不是弹窗', () => {
  assert.match(list, /name === '生单' && railSelectable\.value/,
    '批量生单必须并进「生单」组(追加动作 ⇒ 主按钮右侧出现 ▼),且只在有左栏勾选列时出现')
  assert.match(list, /action === '批量生单'/, 'onButton 必须接住这个动作')
  assert.match(list, /请先在左侧单据列表勾选要生单的单据/,
    '没勾单据就点批量生单时应先提示,不能弹一个空对话框')
  assert.match(list, /openGenerateDialog\(item\.action, audited\.map\(docNoOfRow\)\)/,
    '批量生单的取数来源必须是左栏勾选(railChecked),且只送已审核的那几张')
  // 多去向面板(销售订单:生成生产工单 / 生成销售出库单)要各出一项,否则两项同名没法选
  assert.match(list, /batchGenerateItems = computed/, '批量生单项要按生单动作派生')
  assert.match(list, /批量生单·/, '一个生单动作一项,多动作面板文案要带动作名区分')
})

test('左栏勾选列由「有批量生单链路」驱动,并且状态按单号保管', () => {
  assert.match(rail, /selectable: \{ type: Boolean, default: false \}/, 'DocSelectRail 要新增 selectable 开关')
  assert.match(rail, /checked: \{ type: Array, default: \(\) => \[\] \}/, '勾选态由父组件按单号下发')
  assert.match(rail, /dsr-picked|已勾选/, '左栏要有「已勾选 N 张」摘要,否则多页翻着勾会糊')
  assert.match(list, /railSelectable = computed/, '是否显示勾选列由面板能力派生')
})

test('所有推式生单都走对话框(只有两条按用户口径保持原样)', () => {
  // 用户口径(10-31 第二轮)「所有单据只要有生单和批量生单这个按钮的,都要实现 ——
  // 送料暂收就不能批量,而且生单也没有勾选」⇒ 不能再按动作名排除
  assert.ok(!/CUSTOM_GENERATE_ACTIONS|isCustomGenerate/.test(list),
    '不该再有"定制化动作不走对话框"的白名单(它是送料暂收单没有勾选的根因)')
  // 但 10-31 第三轮:「销售订单 → 生产工单、生产工单 → 产成品入库单 这两个保持原来的不变」
  assert.match(list, /GENERATE_KEEP_ORIGINAL = new Set\(\['SO_ORDER\|生成生产工单', 'MANU_ORDER\|生成产成品入库单'\]\)/,
    '这两条必须登记为"保持原样"(不进对话框、也不出批量生单)')
  assert.match(list, /generatableActions = computed\(\(\) => Object\.keys\(pushTargets\.value\)\.filter\(\(a\) => !keepOriginalGenerate\(a\)\)\)/,
    '可生单动作 = 全部链路 − 保持原样的两条')
  assert.match(list, /if \(actionPushTarget && !keepOriginalGenerate\(action\)\)/,
    '保持原样的两条要落回原来的 callButton 调用')
  // 分批源头那一跳(采购订单→送料暂收单)的分批对话框必须原样保留
  assert.match(list, /needBatchDialog\(actionPushTarget\)/, '分批送料对话框不能被新对话框顶掉')
})

test('生单结果支持「一单生两张」', () => {
  // 送料暂收单 → 检验单 + 入库单(一条动作两个去向)
  assert.match(dialog, /m\['生成清单'\]/, '对话框要把「生成清单」摊平后计数,否则只报一张')
  assert.match(dialog, /商品档案未登记的商品按免检（否）处理/, '未登记商品要提示(与旧 callButton 路径同口径)')
})

test('超送比例只有采购订单有,别的生单不显示也不放额度', () => {
  // 用户口径(2026-10-31):「除了采购订单,别的生单没有超送比例」
  assert.match(dialog, /OVER_RATIO_PANELS = new Set\(\['PU_ORDER', 'SUPPLIER_PU_ORDER'\]\)/,
    '超送额度只属于采购订单(含供应商打印副本)这一跳')
  assert.match(dialog, /v-if="showOverRatio"/, '比例输入框要按面板显隐,不能对所有分批链路都显示')
  assert.match(dialog, /ratioPct\.value = showOverRatio\.value \? Math\.round\(meta\.overRatio \* 100\) : 0/,
    '非采购订单的比例恒 0 ⇒ 上限=剩余量(否则显示 数量×1.2,填了会被后端按剩余拒)')
})

test('销售订单的生单只用「生成销售出库单」', () => {
  // 用户口径(2026-10-31):「销售订单只用生销售出库单,不用生成生产工单」
  assert.match(list, /GENERATE_HIDDEN = \{ SO_ORDER: \['生成生产工单'\] \}/,
    '销售订单生单组里要隐藏「生成生产工单」⇒ 主按钮变成「生成销售出库单」')
  assert.match(list, /!hiddenGenerateActions\.value\.includes\(action\)/,
    '隐藏要落在 toolbarGroups 的动作过滤上(数据键与后端能力保留给订单结转/选单)')
})

test('全选放在勾选列表头(行号前面的格子),不占顶部条', () => {
  // 【用户原话 2026-11-18】「批量生单和合单生单弹窗最顶部都没有全选按钮。」→ 先补在顶部;
  // 紧接着 2026-11-18 第二轮:「全选按钮在**行号前面的格子上**就行,和生单保持一致」
  //   ⇒ 移到每张来源单表格「勾选列」的表头格子里(标准表头全选的位置),顶部那颗撤掉。
  const head = dialog.slice(dialog.indexOf('class="gl-bar"'), dialog.indexOf('class="gl-doc"'))
  assert.ok(head.length > 100, '取不到顶部条,说明 gl-bar / gl-doc 的类名变了')
  assert.ok(!/gl-pick-all|pickAllDocs/.test(dialog), '顶部那颗总全选按用户口径已撤掉,不要再挂回去')

  // 勾选列：以表头全选的 title 为锚点定位 —— 它必须在「行号」列之前。
  // 列宽随版面压缩调整过（42 → 34），且合单模式在勾选列与行号之间还多一个「删行叉」列，
  // 所以不能再假设勾选列与行号列紧邻，也不能写死宽度。
  const rowNoAt = dialog.indexOf('prop="行号"')
  const pickTitleAt = dialog.indexOf("tt('全选本单的全部明细行')")
  const firstColAt = pickTitleAt > 0 ? dialog.lastIndexOf('<el-table-column', pickTitleAt) : -1
  const firstCol = firstColAt > 0 && rowNoAt > firstColAt ? dialog.slice(firstColAt, rowNoAt) : ''
  assert.ok(firstCol.length > 80 && pickTitleAt < rowNoAt,
    '取不到勾选列，或全选列不在行号列之前（列顺序变了）')
  assert.match(firstCol, /<template #header>/, '勾选列表头不能是空格子')
  assert.match(firstCol, /tt\('全选本单的全部明细行'\)/, '表头全选要有 title,且走 tt()(英文界面不掉回中文)')
  assert.match(firstCol, /docStats\(doc\)\.all/, '表头勾选框要有"本单已全勾"状态')
  assert.match(firstCol, /docStats\(doc\)\.some/, '部分勾选要显示成三态中间态')
  assert.match(firstCol, /:disabled="!docStats\(doc\)\.total"/, '本单没有可勾行时表头全选要禁用,不能点了没反应')
  // 口径复用单张的 selectAll / selectNone:只勾可选行(草稿单/可生单=0 的行不许被全选放进来)
  assert.match(firstCol, /v \? selectAll\(doc\) : selectNone\(doc\)/, '表头勾上/取消必须就是本单的 selectAll/selectNone')
  assert.match(dialog, /function docStats\(doc\) \{[\s\S]{0,400}?if \(!selectable\(doc, row\)\) continue/,
    '三态基数只算可选行 —— 否则草稿单会显示"可全选"却点不动')

  // 同一块里不许再留「全选 / 取消全选」文字链:表头那颗就是唯一入口,留两份是噪声
  const docHead = dialog.slice(dialog.indexOf('class="gl-doc-head"'), dialog.indexOf('<el-table'))
  assert.ok(!/tt\('全选'\)|tt\('取消全选'\)/.test(docHead), '单据行头不要再挂「全选/取消全选」文字链')
})

test('表头全选的文案在 en.js 有词条', () => {
  assert.ok(en.includes("'全选本单的全部明细行'"), 'en.js 缺「全选本单的全部明细行」的译名')
})
