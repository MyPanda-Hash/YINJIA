/**
 * inspCommissionVat.test.js —— 检验委托单「总金额（含增值税6%）RMB」回归
 *
 * 2026-11-16 用户口径:
 *   ①「修改文件的总金额计算方式,将合计收费修改为（总金额（含增值税6%）RMB）」;
 *   ②「之后的总金额需要在原基础上增加6%的数值」。
 * ⇒ 纸面标签改为「总金额（含增值税6%）RMB」,金额 = 行表「收费」合计 × (1+6%),
 *    体现为 600 → 636.00(截图里 6 行 ×100 的合计)。
 *
 * 2026-11-19 用户口径(补充,本文件后半段):
 *   ③「收费列是一个样/元(100 元 = 一个样品检验的金额),所以总金额必须乘上『样品数量』」
 *      ⇒ 总金额(含税) = 行表「收费」合计 × **样品数量** × (1+6%);600 净额 × 10 个样 = **6360.00**;
 *   ④「样品数量」是**文本**字段(yj_field 注释:允许「2L/3支」这类写法),解析口径由 `sampleCountOf`
 *      钉住 —— 纯数字 / 计件单位(个 件 支 只 pcs)取数字;**容积(2L / 500ml)与多段写法一律按 1 件**
 *      (2L 是样品体积、一份样品,按 2 件会多收一倍;用户 2026-11-19 明确纠正过);
 *   ⑤「检验委托单的『委托单编号』处增加横杠」⇒ 编辑态单号输入框要有下划线,打印态去掉。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VAT_RATE, sampleCountOf, withVat, vatTotalText } from './inspCommissionVat.js'

const sheet = readFileSync(new URL('./InspCommissionSheet.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

/** 取真正的 @media print 块(用 `媒体查询 {` 定位,避免命中注释里提到的 "@media print") */
function printBlock(src) {
  const m = /@media print\s*\{/.exec(src)
  assert.ok(m, '应有 @media print 块')
  return src.slice(m.index)
}

test('税率 = 6%', () => {
  assert.equal(VAT_RATE, 0.06)
})

test('金额按「原基础上加 6%」算,并按分四舍五入(两位小数)', () => {
  // 用户截图:6 个检验项 × 收费 100 = 600 净额 → 总金额 636.00
  assert.equal(withVat(600), 636)
  assert.equal(vatTotalText(600), '636.00')
  // 单行
  assert.equal(vatTotalText(100), '106.00')
  // 四舍五入边界:123.45 × 1.06 = 130.857 → 130.86
  assert.equal(withVat(123.45), 130.86)
  assert.equal(vatTotalText(123.45), '130.86')
  // 小金额:0.05 × 1.06 = 0.053 → 0.05(按分)
  assert.equal(vatTotalText(0.05), '0.05')
  // 空/脏值按 0,不给纸面 NaN
  assert.equal(vatTotalText(0), '0.00')
  assert.equal(vatTotalText(''), '0.00')
  assert.equal(vatTotalText(null), '0.00')
  assert.equal(vatTotalText('abc'), '0.00')
})

test('不传 qty 时与 2026-11-16 口径**完全一致**(向后兼容)', () => {
  // 老调用点(只有 net)不受第二参数影响:所有断言与上一组逐条对齐
  assert.deepEqual(
    [600, 100, 123.45, 0.05, 0].map((net) => vatTotalText(net)),
    [600, 100, 123.45, 0.05, 0].map((net) => vatTotalText(net, 1)),
  )
  assert.equal(withVat(600), withVat(600, 1))
  assert.equal(vatTotalText(600), '636.00')
})

test('sampleCountOf:样品数量文本 → 件数(只认计件单位,容积/多段按 1)', () => {
  // 纯数字
  assert.equal(sampleCountOf('10'), 10)
  assert.equal(sampleCountOf(10), 10)
  assert.equal(sampleCountOf(' 12 '), 12)
  // 计件单位(个/件/支/只/pcs,允许空格、大小写)
  assert.equal(sampleCountOf('10个'), 10)
  assert.equal(sampleCountOf('3件'), 3)
  assert.equal(sampleCountOf('3 支'), 3)
  assert.equal(sampleCountOf('2只'), 2)
  assert.equal(sampleCountOf('5 PCS'), 5)
  assert.equal(sampleCountOf('2pc'), 2)
  // 容积单位 = 一份样品的**体积**,不是件数 ⇒ 1(用户 2026-11-19 纠正:按 2 件会多收一倍)
  assert.equal(sampleCountOf('2L'), 1)
  assert.equal(sampleCountOf('500ml'), 1)
  assert.equal(sampleCountOf('500 ML'), 1)
  // 多段写法:同一份委托按一个样品计,不猜拆分
  assert.equal(sampleCountOf('2L/3支'), 1)
  assert.equal(sampleCountOf('2/3'), 1)
  // 空 / 非数字 / ≤0 → 1(不猜)
  assert.equal(sampleCountOf(''), 1)
  assert.equal(sampleCountOf('   '), 1)
  assert.equal(sampleCountOf(null), 1)
  assert.equal(sampleCountOf(undefined), 1)
  assert.equal(sampleCountOf(0), 1)
  assert.equal(sampleCountOf('0'), 1)
  assert.equal(sampleCountOf(-2), 1)
  assert.equal(sampleCountOf('abc'), 1)
})

test('总金额 = 行表收费合计 × 样品数量 × (1+6%)', () => {
  // 用户口径的样例:一个样 100 元的目录项 + 10 个样品 ⇒ 100 × 10 × 1.06 = 1060.00
  assert.equal(vatTotalText(100, 10), '1060.00')
  assert.equal(withVat(100, 10), 1060)
  // 6 行 × 100 = 600 净额,10 个样品 ⇒ 6360.00
  assert.equal(vatTotalText(600, 10), '6360.00')
  assert.equal(withVat(600, 10), 6360)
  // 四舍五入仍在**乘完之后**按分取整:33.33 × 3 = 99.99 × 1.06 = 105.9894 → 105.99
  assert.equal(vatTotalText(33.33, 3), '105.99')
  // 123.45 × 10 × 1.06 = 1308.57
  assert.equal(vatTotalText(123.45, 10), '1308.57')
  // 小数数量:0.05 × 3 × 1.06 = 0.159 → 0.16
  assert.equal(vatTotalText(0.05, 3), '0.16')
  // 脏 qty(0 / 空 / 非数字)按 1 件 ⇒ 不把总金额清零
  assert.equal(vatTotalText(600, 0), '636.00')
  assert.equal(vatTotalText(600, ''), '636.00')
  assert.equal(vatTotalText(600, 'abc'), '636.00')
  // 串联样品数量文本:纸面就是这么用的('10个' → 10)
  assert.equal(vatTotalText(100, sampleCountOf('10个')), '1060.00')
  assert.equal(vatTotalText(100, sampleCountOf('2L')), '106.00')
})

test('纸面标签:合计收费 → 总金额（含增值税6%）RMB', () => {
  assert.match(sheet, /tt\('总金额（含增值税6%）RMB：'\)/, '纸面要显示新的总金额标签')
  assert.doesNotMatch(sheet, /tt\('合计收费：'\)/, '旧的「合计收费：」标签不能再出现在纸面上')
  // 英文界面同一条词条
  assert.match(en, /"总金额（含增值税6%）RMB："\s*:\s*"Total Amount \(incl\. 6% VAT\) RMB:"/)
})

test('显示值与回写表头都走含税口径(同一处换算,不各写一份)', () => {
  // 显示:computed 里走 vatTotalTextOf
  assert.match(sheet, /const feeTotalText = computed\(\(\) => \{[\s\S]{0,120}vatTotalTextOf\(items\.value\)/)
  // 回写表头:带入/删行后重算时写含税总金额
  assert.match(sheet, /props\.head\['合计收费'\] = vatTotalTextOf\(arr\)/)
  // 打开已保存单据时静默按现行口径重算表头(旧单里可能是净额)
  assert.match(sheet, /props\.head\['合计收费'\] = next/, '打开单据要按含税口径同步表头')
  // 换算只有一处实现(inspCommissionVat.js),组件里不许再写一遍 1.06
  assert.match(
    sheet,
    /import \{ sampleCountOf, vatTotalText \} from '\.\/inspCommissionVat'/,
    '组件从 inspCommissionVat 取换算与样品数量解析',
  )
  assert.doesNotMatch(sheet, /\*\s*1\.06|\(1\s*\+\s*0\.06\)/, '组件里不许自己再写一遍 1.06/6%')
})

test('总金额按「样品数量」放大:纸面显示与表头回写同源(2026-11-19 口径)', () => {
  // ① 样品数量经 sampleCountOf 解析(空/脏值/容积/多段按 1 件的规则有单测)
  assert.match(
    sheet,
    /const sampleQty = computed\(\(\) => \{[\s\S]{0,160}sampleCountOf\(props\.head\?\.\['样品数量'\]\)/,
    '纸面要按表头「样品数量」算件数',
  )
  // ② 换算点把件数传进去(总金额 = 收费合计 × 数量 × 1.06)
  assert.match(
    sheet,
    /function vatTotalTextOf\(rows\) \{[\s\S]{0,200}return vatTotalText\(net, sampleQty\.value\)/,
    '总金额换算必须带样品数量',
  )
  // ③ 打开单据/改数量的回写 watcher 依赖「样品数量」⇒ 改数量时库里那格同步(纸面显示本来就地变,
  //    只改纸面不改表头会出现"纸面 1060.00 / 列表里 106.00")
  assert.match(
    sheet,
    /\(\) => docKeyOf\(\) \+ '\|' \+ items\.value\.length \+ '\|' \+ String\(props\.head\?\.\['样品数量'\] \?\? ''\)/,
    '表头回写的 watcher 要盯「样品数量」',
  )
  // ④ 行表「收费」列仍是**一个样/元**的单价原样显示,不许改成乘数量后的金额
  assert.match(sheet, /<td class="ic-items-fee">\{\{ feeTextOf\(row\) \}\}<\/td>/, '行表收费列保持单价原样')
  assert.doesNotMatch(sheet, /ic-items-fee[\s\S]{0,80}sampleQty/, '收费列不许乘样品数量')
})

test('单号横杠:编辑态输入框有下划线,打印态去掉(2026-11-19 用户口径)', () => {
  // ① 下划线存在,且是"透明底 + 一条灰线下边框 + 直角"(纸面观感,不是网页控件)
  assert.match(
    sheet,
    /\.ic-meta-no-input :deep\(\.el-input__wrapper\),\s*\n\.ic-meta-no-input :deep\(\.el-input__wrapper\.is-focus\) \{[\s\S]{0,260}border-bottom: 1px solid #8a8a8a/,
    '单号输入框要有下划线(聚焦态也要有,否则点进去线就消失)',
  )
  assert.match(
    sheet,
    /\.ic-meta-no-input :deep\(\.el-input__wrapper\),[\s\S]{0,260}border-radius: 0/,
    '下划线输入框要直角(不要网页控件的圆角)',
  )
  // ② 顺序:必须排在 `.ic-input` 的 `border: none` 之后,否则线会被同权重的规则抹掉
  const inputRule = sheet.indexOf('.ic-input :deep(.el-input__wrapper),')
  const noRule = sheet.indexOf('.ic-meta-no-input :deep(.el-input__wrapper),')
  assert.ok(inputRule >= 0, '应有 .ic-input 的 wrapper 规则')
  assert.ok(noRule > inputRule, '单号下划线规则必须排在 .ic-input 之后(否则被 border: none 抹掉)')
  // ③ 打印态把线去掉:纸样该位置是干净的单号文字,不该印出多余黑线
  assert.match(
    printBlock(sheet),
    /\.ic-sheet \.ic-meta-no-input \.el-input__wrapper[\s\S]{0,140}border-bottom: none !important/,
    '@media print 要去掉单号下划线',
  )
  // ④ 屏幕上 190px 的"提示框"宽度不带上纸(超长手工号会被截断),打印态回满宽
  assert.match(
    printBlock(sheet),
    /\.ic-sheet \.ic-meta-no-input \{\s*\n\s*width: 100% !important/,
    '打印态单号要回满宽,别继承屏幕上的 190px 提示框',
  )
})
