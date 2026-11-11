import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * MaterialLabelDialog.boxQty.test.js — 钉住「打印材料码」的**每箱数量**链路(2026-11-11)
 *
 * 用户原话:「材料码多加一个每箱数量打印,每箱数量才等于标识卡上的数量」;
 * 追问后确认的口径:「用 B 就行(仍一行一张卡,卡面数量印每箱数量,不拆多张),
 *   打多少张卡在打印预览里选份数」+「按每箱数量打印,并且给他提示零头箱数量不足每箱,
 *   可以单独打印零头箱相关数量」。
 *
 * 这条链路有 5 环,任何一环丢掉都表现为「填了每箱数量,纸上还是整批数量」:
 *   ① 界面:主表/补登表各有一列「每箱数量」(位置在「本次打印数量」**之后**);
 *   ② 提交:confirm() 只在 > 0 时把 每箱数量 发给接口(0/空 ⇒ 不按箱,服务端存 NULL);
 *   ③ 出纸:cardsOf() 卡面「数量」= 每箱数量,没填才回退本次打印数量(历史单行为不变);
 *   ④ 提示:整箱数向下取整,零头箱给出「不足每箱」提示且**不拦打印**;
 *   ⑤ 弹窗放大:宽度不再是写死的 1000px(用户口径「弹窗需要尽量大,减少左右横拉」)。
 *
 * 与 MaterialLabelDialog.prodDate.test.js 同款做法:读源码断言,不起浏览器。
 */
const src = readFileSync(new URL('./MaterialLabelDialog.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

/** 主表列区块(从主表 el-table 到 .mlq-foot) */
const mainTable = src.slice(src.indexOf('ref="tableRef"'), src.indexOf('<div class="mlq-foot">'))
/** 补登表列区块 */
const suppTable = src.slice(src.indexOf('ref="suppRef"'), src.indexOf('name="records"'))
/** cardsOf 函数体 */
const cardsOfBody = src.slice(
  src.indexOf('function cardsOf('),
  src.indexOf('\n}', src.indexOf('function cardsOf(')) + 2,
)
/** confirm 函数体 */
const confirmBody = src.slice(
  src.indexOf('async function confirm()'),
  src.indexOf('async function doReprint('),
)

test('① 主表有「每箱数量」列,且排在「本次打印数量」之后', () => {
  const qtyAt = mainTable.indexOf("tt('本次打印数量')")
  const boxAt = mainTable.indexOf("tt('每箱数量')")
  assert.ok(qtyAt > 0, '主表应有「本次打印数量」列')
  assert.ok(boxAt > 0, '主表应有「每箱数量」列(用户截图红框位置)')
  assert.ok(boxAt > qtyAt, '「每箱数量」必须在「本次打印数量」之后')
  assert.ok(/boxOf\[row\.id\]/.test(mainTable), '列里绑的是 boxOf 状态')
})

test('① 补登表也有「每箱数量」列(补登同样要印卡)', () => {
  assert.ok(suppTable.includes("tt('每箱数量')"), '补登表应加「每箱数量」列')
  assert.ok(/suppBox\[row\.suppKey\]/.test(suppTable), '补登列绑 suppBox')
})

test('① 每箱数量输入上限 = 本次打印数量(不让人填出"一箱比整批还多")', () => {
  assert.ok(/:max="Number\(qtyOf\[row\.id\] \|\| 0\)"/.test(mainTable),
    '主表输入框 max 应取本次打印数量')
  assert.ok(/:max="Number\(suppQty\[row\.suppKey\] \|\| 0\)"/.test(suppTable),
    '补登表输入框 max 应取本次打印数量')
})

test('② 提交:每箱数量只在 > 0 时带给接口(0/空 = 不按箱)', () => {
  assert.ok(/每箱数量: box/.test(confirmBody), 'confirm 应带 每箱数量')
  assert.ok(/box > 0 \? \{ 每箱数量: box \}/.test(confirmBody),
    '必须是 box > 0 才带上(0/空不传,服务端存 NULL ⇒ 卡面回退整批数量)')
})

test('③ 出纸:卡面「数量」= 每箱数量,没填才回退本次打印数量', () => {
  assert.ok(/const box = Number\(l\['每箱数量'\] \|\| 0\) \|\| 0/.test(cardsOfBody),
    'cardsOf 应读服务端回读的 每箱数量')
  assert.ok(/数量: box > 0 \? box : l\['打印数量'\]/.test(cardsOfBody),
    '数量 = 每箱数量,> 0 才用;否则回退打印数量(历史单/未填)')
})

test('④ 整箱向下取整 + 零头箱提示(不拦打印)', () => {
  assert.ok(/function fullBoxes\(/.test(src), '应有整箱数计算函数')
  assert.ok(/Math\.floor\(qty \/ box \+ 1e-9\)/.test(src), '整箱数必须向下取整(不满一箱算零头)')
  assert.ok(/function remainderQty\(/.test(src), '应有零头数量计算函数')
  assert.ok(/const boxHints = computed\(/.test(src), '应有 boxHints 提示计算')
  assert.ok(/mlq-box-hint/.test(src), '模板应有整箱/零头提示块')
  // 提示出现在 confirm 里,但**不能 return**(只提示不拦)
  const warnIdx = confirmBody.indexOf("type: 'warning'")
  assert.ok(warnIdx > 0, 'confirm 里应有零头箱 warning 提示')
  const afterWarn = confirmBody.slice(warnIdx)
  assert.ok(!/return/.test(afterWarn.slice(0, afterWarn.indexOf('busy.value = true'))),
    '零头箱提示之后不得 return(必须继续打印)')
})

test('⑤ 弹窗放大:宽度跟屏幕走(不再写死 1000px),表高自适应', () => {
  assert.ok(!/width="1000px"/.test(src), '不得再写死 1000px')
  assert.ok(/:width="dlgWidth"/.test(src), '宽度应绑 dlgWidth')
  assert.ok(/const dlgWidth = 'min\(1560px, 96vw\)'/.test(src), 'dlgWidth = min(1560px, 96vw)')
  assert.ok(/top="3vh"/.test(src), '向上扩(3vh 顶距),把纵向空间也吃满')
  assert.ok(/:height="tableHeight"/.test(src), '表高应绑 tableHeight(随窗口+行数算,不再固定 330)')
  assert.ok(/onWinResize/.test(src), '应有窗口尺寸变化时重算表高')
})

test('多语言:新增词条都有英文译文(切 en 不露中文)', () => {
  const keys = [
    '每箱数量', '每箱', '整箱', '零头箱', '不足每箱（可单独打印零头箱）',
    '不填按本次打印数量',
    '标识卡上的「数量」印每箱数量（一箱一张卡）；打几张卡在打印预览里设置份数',
    '有零头箱：整批不是每箱数量的整数倍，零头箱数量不足每箱，可单独打印零头箱数量',
  ]
  for (const k of keys) {
    const rx = new RegExp(`'${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'([^']*)'`)
    const m = en.match(rx)
    assert.ok(m, `en.js 缺少词条:${k}`)
    assert.notEqual(m[1].trim(), '', `en.js 的 ${k} 译文为空`)
    assert.ok(!/[\u4e00-\u9fa5]/.test(m[1]), `en.js 的 ${k} 译文不应含中文`)
  }
})

test('模板里新增文案一律走 tt(不裸写中文)', () => {
  const drawerRaw = src.slice(src.indexOf('<template>'), src.indexOf('</template>'))
  // 先整段剥掉 HTML 注释(注释里允许写中文说明),再看剩下的行里有没有裸中文
  const drawer = drawerRaw.replace(/<!--[\s\S]*?-->/g, '')
  const offenders = drawer
    .split('\n')
    .filter((line) => /[\u4e00-\u9fa5]/.test(line))
    .filter((line) => !line.includes('tt('))
    .map((line) => line.trim())
  assert.deepEqual(offenders, [], `这些模板行有中文但不是 tt():${offenders.join(' | ')}`)
})
