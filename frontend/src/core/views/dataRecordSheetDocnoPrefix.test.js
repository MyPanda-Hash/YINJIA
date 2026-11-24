/**
 * dataRecordSheetDocnoPrefix.test.js —— 功能性滤效纸面右上角编号格要有「项目编号：」标签前缀
 *
 * 【用户报的缺口 2026-11-20】「数据记录表 › 功能性滤效」(RD_FILTER_EFF) 的纸面右上角编号格
 *   只显示编号原文(如 C-9520261117)，没有前缀；其它 8 张数据记录表上一轮已经在
 *   RecordSheetPanels.vue 里给声明了 dualDocNo 的面板加过「项目编号：」。
 *   漏掉这张的根因：它是**手写纸面** DataRecordSheet.vue，没走 RecordSheetPanels 的模板。
 *
 * 【口径】前缀是展示层标签，不是数据：
 *   · 一个 12px / #595959 / margin-right:2px 的 <span>，与 RecordSheetPanels 的 .rs-docno-pre 同款；
 *   · 不进 head、不改取数/保存/打印逻辑，打印态照常显示（不得被 @media print 隐藏）；
 *   · 该组件只服务 RD_FILTER_EFF 一个面板（PanelxList 的两处挂载都按面板码判定），
 *     所以前缀也就只该出现在这一处，别的纸面一个字不动。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sheet = readFileSync(new URL('./DataRecordSheet.vue', import.meta.url), 'utf8')
const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

const PREFIX = /<span class="rs-docno-pre">\{\{ tt\('项目编号'\) \}\}：<\/span>/

/** 取报告头编号格（<td class="rs-td rs-docno"> … </td>）的源码片段 */
function docnoCell(src) {
  const at = src.indexOf('<td class="rs-td rs-docno">')
  assert.ok(at >= 0, '找不到功能性滤效报告头的编号格 .rs-docno')
  const end = src.indexOf('</td>', at)
  assert.ok(end > at, '编号格没有闭合标签')
  return src.slice(at, end)
}

test('编号格在编号前渲染「项目编号：」前缀（三个分支都在它后面）', () => {
  const cell = docnoCell(sheet)
  assert.match(cell, PREFIX, '编号格必须先出展示前缀「项目编号：」')
  const pre = cell.indexOf('rs-docno-pre')
  // 编号格的三种形态：参照选择 / 纯输入 / 只读兜底
  for (const branch of ['rs-ref-ctl', 'rs-docno-input', 'rs-docno-text']) {
    const idx = cell.indexOf(branch)
    assert.ok(idx > pre, `${branch} 必须渲染在前缀之后`)
  }
})

test('前缀样式与 RecordSheetPanels 那条完全同款（12px / #595959 / nowrap，间距交给行 gap）', () => {
  const ruleOf = (src, file) => {
    const m = src.match(/\.rs-docno-pre\s*\{([^}]*)\}/)
    assert.ok(m, `${file} 缺少 .rs-docno-pre 规则`)
    return m[1].replace(/\s+/g, '').replace(/;$/, '')
  }
  const own = ruleOf(sheet, 'DataRecordSheet.vue')
  assert.equal(own, 'flex:none;white-space:nowrap;font-size:12px;color:#595959')
  assert.equal(own, ruleOf(panels, 'RecordSheetPanels.vue'), '两处样式要一致，别各自漂移')
})

test('前缀只做展示：不写进 head、不碰取数与保存链路', () => {
  assert.doesNotMatch(sheet, /head\[[^\]]*\]\s*=\s*[^;\n]*项目编号/, '前缀不许拼进 head 字段')
  assert.doesNotMatch(sheet, /项目编号[^;\n]{0,40}\+\s*head\[/, '前缀不许拼到取值表达式里')
  // 编号仍按原样取 / 写：参照确认只写编号本身，前缀只活在模板里
  assert.match(sheet, /props\.head\['文档编号'\] = v/, '编号回写必须仍是选中的编号原值')
  assert.match(sheet, /\{\{ head\['文档编号'\] \|\| head\['单据编号'\] \|\| '—' \}\}/,
    '只读兜底仍是编号原值（不拼前缀）')
})

test('打印态照常显示前缀（不被 @media print / display:none 隐藏）', () => {
  const printRules = [...sheet.matchAll(/@media print\s*\{(.*)$/gm)].map((m) => m[1]).join('\n')
  assert.ok(printRules.length > 0, '文件里应保留打印规则（样品列控件在打印时隐藏）')
  assert.ok(!printRules.includes('rs-docno-pre'), '前缀不能出现在 @media print 里（打印要看得见）')
  assert.ok(!/rs-docno-pre[^}]*display\s*:\s*none/.test(sheet), '.rs-docno-pre 不允许被 display:none')
  assert.ok(!/display\s*:\s*none[^}]*rs-docno-pre/.test(sheet), '不允许用 display:none 藏前缀')
})

test('DataRecordSheet 只服务功能性滤效（所以前缀只这一处，别的纸面不动）', () => {
  const tags = [...list.matchAll(/<DataRecordSheet\b[^>]*>/g)].map((m) => m[0])
  assert.equal(tags.length, 2, 'PanelxList 里应只有「面板页 + 打印预览」两处挂载')
  assert.ok(
    tags.every((t) => /panelCode === 'RD_FILTER_EFF'/.test(t)),
    '两处挂载都必须按 RD_FILTER_EFF 面板码判定，不能变成其它记录表的默认纸面',
  )
})
