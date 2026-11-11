import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * MaterialLabelDialog.boxQty.test.js — 钉住「打印材料码」的**每箱数量**链路(2026-11-11,同日第二轮)
 *
 * 用户原话:
 *   ①「材料码多加一个每箱数量打印,每箱数量才等于标识卡上的数量。」
 *   ②「还有弹窗需要尽量大,减少左右横拉」
 *   ③(同一天改口径)「不要有这个提示,这个设计为必填。」
 *   ④「打印份数还是通过打印数量/每箱数量计算出来吧,零头箱取也根据计算带出。
 *      并且给出有零头箱的提示,还要记录的打印里面对零头箱做标记。」
 *
 * ⇒ 定稿口径:**每箱数量必填**;标签张数 = ⌈本次打印数量 ÷ 每箱数量⌉,零头箱**自动**多出一张
 *   (卡面印零头数量,不再是"让用户自己在预览里设份数");已打印记录里给零头箱打标记。
 *
 * 与 MaterialLabelDialog.prodDate.test.js 同款做法:读源码断言,不起浏览器。
 */
const src = readFileSync(new URL('./MaterialLabelDialog.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

/** 主表列区块 / 补登表列区块 / 已打印记录区块 */
const mainTable = src.slice(src.indexOf('ref="tableRef"'), src.indexOf('<div class="mlq-foot">'))
const suppTable = src.slice(src.indexOf('ref="suppRef"'), src.indexOf('name="records"'))
const recBlock = src.slice(src.indexOf('name="records"'), src.indexOf('name="poPrints"'))
/** cardsOf / confirm 函数体 */
const cardsOfBody = src.slice(src.indexOf('function cardsOf('), src.indexOf('async function confirm('))
const confirmBody = src.slice(src.indexOf('async function confirm('), src.indexOf('async function doReprint('))

test('① 主表有「每箱数量」列,排在「本次打印数量」之后,且标了必填星号', () => {
  const qtyAt = mainTable.indexOf("tt('本次打印数量')")
  const boxAt = mainTable.indexOf("tt('每箱数量')")
  assert.ok(qtyAt > 0, '主表应有「本次打印数量」列')
  assert.ok(boxAt > 0, '主表应有「每箱数量」列(用户截图红框位置)')
  assert.ok(boxAt > qtyAt, '「每箱数量」必须在「本次打印数量」之后')
  assert.ok(/mlq-req/.test(mainTable), '表头要有必填星号(.mlq-req)')
  assert.ok(/boxOf\[row\.id\]/.test(mainTable), '列里绑的是 boxOf 状态')
  assert.ok(/placeholder="tt\('必填'\)"/.test(mainTable), '占位词改成「必填」(不再暗示可以不填)')
})

test('① 补登表也有「每箱数量」列(补登同样要印卡,同样必填)', () => {
  assert.ok(suppTable.includes("tt('每箱数量')"), '补登表应加「每箱数量」列')
  assert.ok(/suppBox\[row\.suppKey\]/.test(suppTable), '补登列绑 suppBox')
  assert.ok(/mlq-req/.test(suppTable), '补登表头也要必填星号')
})

test('① 每箱数量输入上限 = 本次打印数量(不让人填出"一箱比整批还多")', () => {
  assert.ok(/:max="Number\(qtyOf\[row\.id\] \|\| 0\)"/.test(mainTable), '主表输入框 max 应取本次打印数量')
  assert.ok(/:max="Number\(suppQty\[row\.suppKey\] \|\| 0\)"/.test(suppTable), '补登表输入框 max 应取本次打印数量')
})

test('② 必填:没填每箱数量时,确定打印必须被拦下并点名行号', () => {
  assert.ok(/const missing = all\.filter\(\(l\) => !\(Number\(l\['每箱数量'\]\) > 0\)\)/.test(confirmBody),
    'confirm 里应有"每箱数量为空"的收集')
  assert.ok(/if \(missing\.length\)/.test(confirmBody), 'missing 非空要直接 return')
  assert.ok(/请填写每箱数量（必填）/.test(confirmBody), '提示文案要说明是必填')
  assert.ok(/lineNoOf/.test(confirmBody), '提示里要点名是哪几行')
})

test('② 提交:每箱数量随行带给接口(必填 ⇒ 不去条件)', () => {
  assert.ok(/每箱数量: Number\(boxOf\[r\.id\] \|\| 0\) \|\| 0/.test(confirmBody), '主表行带 每箱数量')
  assert.ok(/每箱数量: box,/.test(confirmBody), '补登行也带 每箱数量')
})

test('③ 出纸:张数 = ⌈本次打印数量 ÷ 每箱数量⌉,零头自动多出一张卡', () => {
  assert.ok(/function cardsOfQty\(/.test(src), '应有"张数/零头"计算函数')
  assert.ok(/Math\.floor\(qty \/ box \+ 1e-9\)/.test(src), '整箱数向下取整(不满一箱算零头)')
  assert.ok(/for \(let i = 0; i < full; i\+\+\) out\.push\(\{ \.\.\.base, 数量: box \}\)/.test(cardsOfBody),
    '整箱逐张展开,每张印每箱数量')
  assert.ok(/if \(rem > 0\) out\.push\(\{ \.\.\.base, 数量: rem \}\)/.test(cardsOfBody),
    '零头箱单独一张,印零头数量')
  assert.ok(/if \(!\(box > 0\)\) \{ out\.push\(\{ \.\.\.base, 数量: qty \}\); continue \}/.test(cardsOfBody),
    '历史单(没填每箱数量)回退"一张卡印整批",不让老记录打不出纸')
})

test('③ 张数上限守卫(每箱数量填错不会瞬间出上千张纸)', () => {
  assert.ok(/const MAX_CARDS = 1000/.test(src), '应有张数上限常量')
  assert.ok(/if \(totalCards > MAX_CARDS\)/.test(confirmBody), '超上限要拦下并提示核对每箱数量')
})

test('④ 零头箱:给提示(不拦打印)+ 记录表里做标记', () => {
  assert.ok(/const boxHints = computed\(/.test(src), '弹窗底部要有逐行张数/零头提示')
  assert.ok(/mlq-box-hint/.test(src), '提示块要渲染')
  assert.ok(/const odd = all/.test(confirmBody) && /type: 'warning'/.test(confirmBody), '点打印时再 warning 一次')
  const afterWarn = confirmBody.slice(confirmBody.indexOf("type: 'warning'"))
  assert.ok(!/return/.test(afterWarn.slice(0, afterWarn.indexOf('busy.value = true'))),
    '零头提示之后不得 return(零头卡已自动带出,必须继续打印)')
  // 记录表:两列 + 零头箱用 tag 标记
  assert.ok(/prop="标签张数" :label="tt\('标签张数'\)"/.test(recBlock), '已打印记录要有「标签张数」列')
  assert.ok(/tt\('零头箱'\)/.test(recBlock), '已打印记录要有「零头箱」列')
  assert.ok(/<el-tag v-if="Number\(row\['零头箱'\]\) > 0" type="warning"/.test(recBlock),
    '零头箱要用警示 tag 标出来(有零头才显示)')
})

test('⑤ 撤掉「打几张卡在打印预览里设置份数」这条提示(用户明确不要)', () => {
  assert.ok(!/打几张卡在打印预览里设置份数/.test(src), '这条提示必须已删除')
  assert.ok(!/不填按本次打印数量/.test(src), '"不填按本次打印数量"的占位词也要撤(字段已必填)')
})

test('⑥ 弹窗放大:宽度跟屏幕走(不再写死 1000px),表高自适应', () => {
  assert.ok(!/width="1000px"/.test(src), '不得再写死 1000px')
  assert.ok(/:width="dlgWidth"/.test(src), '宽度应绑 dlgWidth')
  assert.ok(/const dlgWidth = 'min\(1560px, 96vw\)'/.test(src), 'dlgWidth = min(1560px, 96vw)')
  assert.ok(/top="3vh"/.test(src), '向上扩(3vh 顶距),把纵向空间也吃满')
  assert.ok(/:height="tableHeight"/.test(src), '表高应绑 tableHeight')
  assert.ok(/onWinResize/.test(src), '应有窗口尺寸变化时重算表高')
})

test('多语言:本轮词条都有英文译文(切 en 不露中文)', () => {
  const keys = [
    '每箱数量', '每箱', '整箱', '零头箱', '必填', '共 {n} 张', '零头不足一箱，已自动出卡',
    '请填写每箱数量（必填）',
    '按每箱数量算出的标签张数过多（{n} 张），请核对每箱数量',
    '有零头箱：整批不是每箱数量的整数倍，零头箱会单独出一张卡（卡面印零头数量）',
    '标签张数',
  ]
  for (const k of keys) {
    const rx = new RegExp(`'${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'([^']*)'`)
    const m = en.match(rx)
    assert.ok(m, `en.js 缺少词条:${k}`)
    assert.notEqual(m[1].trim(), '', `en.js 的 ${k} 译文为空`)
    assert.ok(!/[\u4e00-\u9fa5]/.test(m[1]), `en.js 的 ${k} 译文不应含中文`)
  }
  // 已废弃的旧词条不能再留在语言包里
  assert.ok(!/'不填按本次打印数量':/.test(en), '旧词条「不填按本次打印数量」应已删除')
  assert.ok(!/'标识卡上的「数量」印每箱数量（一箱一张卡）；打几张卡在打印预览里设置份数':/.test(en),
    '旧词条「…打印预览里设置份数」应已删除')
})

test('模板里新增文案一律走 tt(不裸写中文)', () => {
  const drawerRaw = src.slice(src.indexOf('<template>'), src.indexOf('</template>'))
  const drawer = drawerRaw.replace(/<!--[\s\S]*?-->/g, '')
  const offenders = drawer
    .split('\n')
    .filter((line) => /[\u4e00-\u9fa5]/.test(line))
    .filter((line) => !line.includes('tt('))
    .map((line) => line.trim())
  assert.deepEqual(offenders, [], `这些模板行有中文但不是 tt():${offenders.join(' | ')}`)
})
