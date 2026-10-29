/**
 * _q-card-render.mjs — 钉住「材料码标签卡面上真的印出生产日期」(2026-10-23)
 *
 * 链路末环:MaterialLabelDialog.cardsOf(res) → printProductCards(卡面 75×100mm)。
 * 本探针按 cardsOf 的**同一映射**构造卡行,断言卡面「生产日期」栏印的是 res['生产日期'],
 * 并守住二维码口径不变(公司代码@物料编码@批次,日期不进码)。
 *
 * 用法(仓库根): node tools/archive/_pu-label-prod-date-20261023/_q-card-render.mjs
 */
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const captured = { html: '' }
globalThis.window = {
  open: () => {
    captured.html = ''
    return { document: { write(h) { captured.html += String(h) }, close() { /* noop */ } } }
  },
}
globalThis.alert = () => { /* 不应触发 */ }

const { printProductCards, productCardQrText } = await import(
  pathToFileURL(path.join(ROOT, 'frontend', 'src', 'business', 'print-formats.js')).href
)

// 与 MaterialLabelDialog.cardsOf(res) 完全同形
const res = {
  批次号: '20261028',
  生产日期: '2026-10-20',
  lines: [{ 物料编码: 'Y-XC-2040', 规格型号: '高纯度', 打印数量: 40 }],
}
const cards = res.lines.map((l) => ({
  编码: l['物料编码'],
  规格: l['规格型号'] || '',
  数量: l['打印数量'],
  批次: res['批次号'],
  订单编号: 'YJ-20261012-04',
  供应商名称: '灵寿县德航矿产品有限公司',
  生产日期: res['生产日期'] || '',
}))

const fails = []
const log = (ok, msg) => { console.log((ok ? '   [PASS] ' : '   [FAIL] ') + msg); if (!ok) fails.push(msg) }

assert.equal(await printProductCards(cards), true)
const html = captured.html
const m = html.match(/生产日期：<\/span><span class="v">([^<]*)</)
log(!!m && m[1] === '2026-10-20', '卡面「生产日期」栏印出 2026-10-20(实际: ' + (m ? m[1] : '(未找到该栏)') + ')')
log(html.includes('20261028'), '卡面「批　　次」栏仍印 20261028')
log(/data:image\/png/.test(html), '二维码仍生成')
log(productCardQrText({ 编码: 'Y-XC-2040', 批次: '20261028' }) === '0@Y-XC-2040@20261028',
  '二维码口径不变:公司代码@物料编码@批次(日期不进码)')

// 生产日期为空时:卡面该栏留空白(与原行为一致),且不漏 undefined
await printProductCards([{ ...cards[0], 生产日期: '' }])
const empty = captured.html
log(/生产日期：<\/span><span class="v"><\/span>/.test(empty), '生产日期为空时该栏留空白手填线')
log(!empty.includes('undefined'), '空值不漏 undefined')

console.log('')
console.log(fails.length ? 'RESULT: FAIL-' + fails.length : 'RESULT: PASS')
process.exit(fails.length ? 1 : 0)
