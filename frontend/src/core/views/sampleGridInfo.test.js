/**
 * 表格式样品申请单的信息条（2026-11-20 用户报障，两处都在「外部-开发样品申请单」RD_SAMPLE_EXT）：
 *
 * ① 客户名称只能选、不能打字 —— 「＋新客户」和参照控件都在，但格子不是输入框。
 *    ⇒ config.info[].manualRef 的格子要渲染成 el-input（可自由输入，@input 置脏）+ 右侧放大镜
 *      （点击仍走 openProdRef），并保留「＋新客户」。
 *
 * ② 样品单编号渲染两遍（截图里先一个截断小徽标、再一个完整号）——
 *    根因同一条：上一版「＋新客户」用的是**独立 v-if**，把信息条控件的 v-if/v-else-if 链断成两段。
 *    docno / date 分支先渲染一次后，还会继续落进下面的通用 el-input 分支 ⇒
 *    单号两个输入框、两个日期格也各多挂一个纯文本框。
 *
 * 断言方式：不只看源码文本 —— 把 DocSheet.vue 里的 `<tr class="sg-info-row">` **原样抽出来**，
 * 用 @vue/compiler-dom 编译 + @vue/server-renderer 真渲染，数 HTML 里的控件个数。
 * 把「＋新客户」改回独立 v-if（或删掉 manualRef 分支）都会让这些用例变红。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compile } from '@vue/compiler-dom'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { sampleExtSheetCfg, sampleIntSheetCfg, sampleNdSheetCfg } from './docSheetConfigs.js'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

/** 抽出 grid 信息条那一行模板（<tr class="sg-info-row">…</tr>，内部没有嵌套 tr） */
function gridInfoRowTemplate() {
  const start = vue.indexOf('<tr v-if="gridInfo.length" class="sg-info-row">')
  assert.ok(start > 0, 'DocSheet.vue 里找不到 grid 信息条模板')
  const end = vue.indexOf('</tr>', start)
  assert.ok(end > start, '信息条模板没有闭合的 </tr>')
  return vue.slice(start, end + '</tr>'.length)
}

const template = gridInfoRowTemplate()
const { code } = compile(template, { mode: 'function', prefixIdentifiers: true })
const renderRow = new Function('Vue', code)(await import('vue'))

const ElInput = defineComponent({
  name: 'ElInput',
  inheritAttrs: false,
  props: { modelValue: { default: '' }, placeholder: { default: '' } },
  render() {
    return h('input', { 'data-stub': 'el-input', value: this.modelValue, placeholder: this.placeholder })
  },
})
const ElDatePicker = defineComponent({
  name: 'ElDatePicker',
  inheritAttrs: false,
  props: { modelValue: { default: '' } },
  render() {
    return h('input', { 'data-stub': 'date', value: this.modelValue })
  },
})
const ElSelect = defineComponent({
  name: 'ElSelect',
  inheritAttrs: false,
  render() {
    return h('span', { 'data-stub': 'select' }, this.$slots.default?.())
  },
})
const ElOption = defineComponent({ name: 'ElOption', render: () => null })
const ElIcon = defineComponent({
  name: 'ElIcon',
  render() {
    return h('i', { 'data-stub': 'icon' }, this.$slots.default?.())
  },
})
const Search = defineComponent({
  name: 'Search',
  render: () => h('svg', { 'data-icon': 'search' }),
})

/** 按信息条真实上下文渲染：editable + head + info + 参照字段表（真实面板里客户名称/单据编号都是参照字段） */
async function renderInfoRow({ editable = true, head = {}, info = [], refKeys = [] }) {
  const scope = {
    editable,
    head,
    gridInfo: info,
    gridInfoH: 48,
    tt: (s) => s,
    isRefKey: (k) => refKeys.includes(k),
    selectOptions: () => [],
    custCodeOf: () => '',
    openProdRef: () => {},
    openManualRef: () => {},
    emit: () => {},
  }
  const app = createSSRApp({ render: () => renderRow(scope) })
  app.component('el-input', ElInput)
  app.component('el-date-picker', ElDatePicker)
  app.component('el-select', ElSelect)
  app.component('el-option', ElOption)
  app.component('el-icon', ElIcon)
  app.component('Search', Search)
  return await renderToString(app)
}

const countOf = (html, re) => (html.match(re) || []).length

test('grid 信息条：manualRef 的客户格渲染成输入框（可打字）+ 放大镜 + ＋新客户', async () => {
  const html = await renderInfoRow({
    head: { 客户名称: '惠州市芯悦纯净设备有限公司' },
    info: [{ label: '客户名称', key: '客户名称', span: 2, manualRef: true }],
    refKeys: ['客户名称'],
  })
  assert.equal(countOf(html, /data-stub="el-input"/g), 1, '客户名称格要恰好一个输入框')
  assert.match(html, /placeholder="输入客户名称，或点放大镜选择"/, '输入框要有手填提示')
  assert.match(html, /value="惠州市芯悦纯净设备有限公司"/, '输入框要绑当前客户名')
  assert.match(html, /data-icon="search"/, '放大镜要在')
  assert.match(html, /＋新客户/, '「＋新客户」要保留')
  assert.doesNotMatch(html, /as-ref-ctl/, 'manualRef 格不能再只出纯参照控件')

  // SSR 不执行事件，置脏/点放大镜/开新客户弹窗的接线直接钉源码
  const block = template
  const manualStart = block.indexOf('v-if="editable && f.manualRef"')
  const docnoStart = block.indexOf('v-else-if="editable && f.kind === \'docno\'"')
  assert.ok(manualStart > 0 && docnoStart > manualStart, 'manualRef 分支要排在单号分支前')
  const manual = block.slice(manualStart, docnoStart)
  assert.match(manual, /@input="emit\('dirty'\)"/, '打字要置脏')
  assert.match(manual, /@click\.stop="openProdRef\(f\.key\)"/, '放大镜仍要走客户参照')
  assert.match(manual, /@click="openManualRef\(f\.key\)"/, '＋新客户仍要开手填弹窗')
})

test('grid 信息条：样品单编号只渲染一次（无重复控件）', async () => {
  const html = await renderInfoRow({
    head: { 单据编号: 'lily-2026-11-19-01' },
    info: [{ label: '样品单编号', key: '单据编号', span: 1, kind: 'docno' }],
    // 真实面板里「单据编号」也是参照字段：误命中参照分支同样会多出控件
    refKeys: ['单据编号'],
  })
  assert.equal(countOf(html, /lily-2026-11-19-01/g), 1, '单号只能出现一次')
  assert.equal(countOf(html, /<input/g), 1, '信息条这一格只能有一个输入框')
  assert.equal(countOf(html, /data-stub="el-input"/g), 1, 'docno 只走专门的分支')
  assert.doesNotMatch(html, /as-ref-ctl/, 'docno 格不该再出参照控件')
})

test('grid 信息条：日期格只渲染一个日期控件（链条没被再次穿透）', async () => {
  const html = await renderInfoRow({
    head: { 单据日期: '2026-11-06' },
    info: [{ label: '下单日期', key: '单据日期', span: 2, kind: 'date' }],
    refKeys: ['单据日期'],
  })
  assert.equal(countOf(html, /data-stub="date"/g), 1, '日期格只该有一个 el-date-picker')
  assert.equal(countOf(html, /data-stub="el-input"/g), 0, '日期格不该再挂一个纯文本框')
})

test('grid 信息条：只读态仍是一格纯文本（不因新分支多出控件）', async () => {
  const html = await renderInfoRow({
    editable: false,
    head: { 单据编号: 'lily-2026-11-19-01', 客户名称: '惠州市芯悦纯净设备有限公司' },
    info: [
      { label: '样品单编号', key: '单据编号', span: 1, kind: 'docno' },
      { label: '客户名称', key: '客户名称', span: 2, manualRef: true },
    ],
    refKeys: ['单据编号', '客户名称'],
  })
  assert.equal(countOf(html, /<input/g), 0, '只读态不该有输入控件')
  assert.equal(countOf(html, /class="sg-ro"/g), 2, '两格都走 sg-ro 纯文本')
})

test('config：sampleExtSheetCfg.info 无重复项，单号只登记一次', () => {
  const keys = sampleExtSheetCfg.info.map((i) => i.key)
  assert.equal(keys.filter((k) => k === '单据编号').length, 1, 'info 里单据编号只能有一条')
  assert.equal(new Set(keys).size, keys.length, `info 存在重复键：${keys.join(',')}`)
  const docno = sampleExtSheetCfg.info.find((i) => i.key === '单据编号')
  assert.equal(docno.kind, 'docno', '单号格仍要走 docno 分支')
  const cust = sampleExtSheetCfg.info.find((i) => i.key === '客户名称')
  assert.equal(cust.manualRef, true, '客户名称仍是 manualRef（输入框 + ＋新客户）')
})

test('config：内部单 info 为空、非开发单复用外部单信息条（不受本次改动拖累）', () => {
  assert.deepEqual(sampleIntSheetCfg.info, [], '内部单没有信息条，grid 信息条根本不渲染')
  assert.equal(sampleNdSheetCfg.info, sampleExtSheetCfg.info, '非开发单按展开继承复用同一份 info')
  assert.equal(sampleNdSheetCfg.info.find((i) => i.key === '客户名称').manualRef, true)
})
